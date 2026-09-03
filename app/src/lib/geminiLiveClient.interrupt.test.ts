/**
 * AI-V2(b) — Live barge-in: a `serverContent.interrupted` message stops every
 * retained (already-released) AudioBufferSourceNode and resets the playHead,
 * and the WHOLE interruption path routes through the liveTurnGuard —
 * `playChunk` keeps exactly one caller (the guard's release sink; the
 * unreachability pins live in geminiLiveClient.guard.test.ts).
 *
 * The vitest env is node-only, so the browser surface is faked at the seam:
 * AudioContext / getUserMedia are stubbed globals and @google/genai is mocked
 * to hand back the connect callbacks — the guard, the retained-source
 * bookkeeping, and the interrupt flow are the REAL production code.
 */
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const { connectMock } = vi.hoisted(() => ({ connectMock: vi.fn() }));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    live = { connect: connectMock };
    constructor(_opts: unknown) {}
  },
  Modality: { AUDIO: "AUDIO" },
}));

import { startGeminiLive, type LiveHandlers } from "./geminiLiveClient";
import { createVoiceLifetime } from "./voiceLifetime";
import type { LiveTurnVerdict } from "./liveTurnGuard";
import * as ts from "typescript";

class FakeSource {
  buffer: unknown = null;
  onended: null | (() => void) = null;
  startedAt: number | null = null;
  stopped = false;
  connect() {}
  start(t: number) {
    this.startedAt = t;
  }
  stop() {
    this.stopped = true;
  }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  currentTime = 0;
  destination = {};
  sources: FakeSource[] = [];
  sampleRate: number;
  constructor(opts?: { sampleRate?: number }) {
    this.sampleRate = opts?.sampleRate ?? 44100;
    FakeAudioContext.instances.push(this);
  }
  createBuffer(_ch: number, len: number, rate: number) {
    return { duration: len / rate, copyToChannel() {} };
  }
  createBufferSource() {
    const s = new FakeSource();
    this.sources.push(s);
    return s as unknown as AudioBufferSourceNode;
  }
  graphs = 0;
  createMediaStreamSource() {
    this.graphs++;
    return { connect() {}, disconnect() {} };
  }
  createScriptProcessor() {
    return { connect() {}, disconnect() {}, onaudioprocess: null as unknown };
  }
  closed = false;
  close() {
    this.closed = true;
    return Promise.resolve();
  }
}

/** F-01: minted mic tracks are retained so tests can prove they were stopped. */
const micTracks: { stopped: boolean; stop(): void }[] = [];

const getUserMediaMock = vi.fn();
vi.stubGlobal("AudioContext", FakeAudioContext);
vi.stubGlobal("navigator", {
  mediaDevices: {
    getUserMedia: getUserMediaMock,
  },
});

afterAll(() => {
  vi.unstubAllGlobals();
});

/** 4 bytes = 2 PCM16 samples → at 24 kHz a released chunk has duration > 0. */
const CHUNK_B64 = btoa("\x00\x01\x00\x01");

type Callbacks = {
  onopen: () => void;
  onmessage: (msg: unknown) => void;
  onerror: (e: unknown) => void;
  onclose: () => void;
};

async function openSession() {
  FakeAudioContext.instances = [];
  let callbacks: Callbacks | null = null;
  connectMock.mockImplementation(async (args: { callbacks: Callbacks }) => {
    callbacks = args.callbacks;
    return { close() {}, sendRealtimeInput() {} };
  });
  const phases: string[] = [];
  const ctl = await startGeminiLive(
    { token: "tok", model: "m", systemInstruction: "pinned" },
    {
      screenTurn: async () => ({ action: "continue" as const }),
      onPhase: (p) => phases.push(p),
    },
  );
  const outCtx = FakeAudioContext.instances.find((c) => c.sampleRate === 24000)!;
  expect(outCtx).toBeTruthy();
  return { ctl, cb: callbacks! as Callbacks, outCtx, phases };
}

/** Screened release: audio + transcription + turnComplete → sink → playChunk. */
async function releaseTurn(cb: Callbacks, outCtx: FakeAudioContext, text: string, expectCount: number) {
  cb.onmessage({ data: CHUNK_B64, serverContent: { outputTranscription: { text } } });
  cb.onmessage({ serverContent: { turnComplete: true } });
  await vi.waitFor(() => expect(outCtx.sources.length).toBe(expectCount));
}

beforeEach(() => {
  connectMock.mockReset();
  FakeAudioContext.instances = [];
  micTracks.length = 0;
  vi.stubGlobal("AudioContext", FakeAudioContext);
  getUserMediaMock.mockReset().mockImplementation(async () => {
    const track = { stopped: false, stop() { this.stopped = true; } };
    micTracks.push(track);
    return { getTracks: () => [track] };
  });
});
afterEach(() => { vi.useRealTimers(); });

describe("AI-V2(b) — {data…, interrupted} stops retained sources and resets playHead", () => {
  it("stops every retained source on serverContent.interrupted", async () => {
    const { ctl, cb, outCtx } = await openSession();
    // Two screened, released turns are scheduled back-to-back (both playing).
    await releaseTurn(cb, outCtx, "Short goodbyes help. ", 1);
    await releaseTurn(cb, outCtx, "Keep the routine visual.", 2);
    expect(outCtx.sources.map((s) => s.stopped)).toEqual([false, false]);
    // The parent talks over the model — Gemini's server VAD reports it.
    cb.onmessage({ serverContent: { interrupted: true } });
    expect(outCtx.sources.map((s) => s.stopped)).toEqual([true, true]);
    ctl.stop();
  });

  it("resets the playHead: the next released turn starts NOW, not after the cut audio", async () => {
    const { ctl, cb, outCtx } = await openSession();
    await releaseTurn(cb, outCtx, "First answer sentence. ", 1);
    // Scheduled sequentially → the head advanced past 0 for this source.
    expect(outCtx.sources[0].startedAt).toBe(0);
    await releaseTurn(cb, outCtx, "Second answer sentence.", 2);
    expect(outCtx.sources[1].startedAt).toBeGreaterThan(0); // proof the head advances
    cb.onmessage({ serverContent: { interrupted: true } });
    // After the barge-in the schedule head is reset — the next screened turn
    // plays immediately instead of queuing behind stopped audio.
    await releaseTurn(cb, outCtx, "Fresh turn after barge-in.", 3);
    expect(outCtx.sources[2].startedAt).toBe(0);
    ctl.stop();
  });

  it("drops the in-flight (unreleased) buffer: a turnComplete after interrupted releases nothing", async () => {
    const { ctl, cb, outCtx } = await openSession();
    // Audio + transcription arrive but the turn is cut BEFORE it completes.
    cb.onmessage({ data: CHUNK_B64, serverContent: { outputTranscription: { text: "half a sen" } } });
    cb.onmessage({ serverContent: { interrupted: true } });
    cb.onmessage({ serverContent: { turnComplete: true } });
    await new Promise((r) => setTimeout(r, 20));
    expect(outCtx.sources.length).toBe(0); // the cut-off turn NEVER plays
    ctl.stop();
  });

  it("barge-in flips the phase back to listening (session stays open)", async () => {
    const { ctl, cb, outCtx, phases } = await openSession();
    await releaseTurn(cb, outCtx, "Sentence being spoken.", 1);
    expect(phases).toContain("speaking"); // the released audio drove the phase
    cb.onmessage({ serverContent: { interrupted: true } });
    expect(phases[phases.length - 1]).toBe("listening");
    expect(phases).not.toContain("closed");
    ctl.stop();
  });
});

describe("F-01 — a connect that dies before open REJECTS instead of wedging", () => {
  function hangingConnect() {
    FakeAudioContext.instances = [];
    micTracks.length = 0;
    let callbacks: Callbacks | null = null;
    connectMock.mockImplementation((args: { callbacks: Callbacks }) => {
      callbacks = args.callbacks;
      // The SDK promise never settles — the deferred reject must win the race.
      return new Promise<never>(() => {});
    });
    const phases: string[] = [];
    const promise = startGeminiLive(
      { token: "tok", model: "m", systemInstruction: "pinned" },
      { screenTurn: async () => ({ action: "continue" as const }), onPhase: (p) => phases.push(p) },
    );
    return { promise, phases, cb: () => callbacks };
  }

  it("a socket close BEFORE open rejects startGeminiLive and releases mic + audio contexts", async () => {
    const { promise, phases, cb } = hangingConnect();
    await vi.waitFor(() => expect(cb()).toBeTruthy());
    cb()!.onclose();
    await expect(promise).rejects.toThrow("live-closed-before-open");
    // stopAll ran: both audio contexts closed, the mic track stopped, and the
    // caller saw the terminal phase (nothing left holding the microphone).
    expect(FakeAudioContext.instances.map((c) => c.closed)).toEqual([true, true]);
    expect(micTracks.length).toBe(1);
    expect(micTracks[0].stopped).toBe(true);
    expect(phases[phases.length - 1]).toBe("closed");
  });

  it("a socket error BEFORE open rejects with the socket's message", async () => {
    const { promise, cb } = hangingConnect();
    await vi.waitFor(() => expect(cb()).toBeTruthy());
    cb()!.onerror({ message: "handshake refused" });
    await expect(promise).rejects.toThrow("handshake refused");
    expect(FakeAudioContext.instances.every((c) => c.closed)).toBe(true);
    expect(micTracks[0].stopped).toBe(true);
  });

  it("a close AFTER a successful connect reports 'closed' through onPhase (no rejection)", async () => {
    const { ctl, cb, phases } = await openSession();
    cb.onclose();
    expect(phases[phases.length - 1]).toBe("closed"); // reported, not rejected
    ctl.stop();
  });
});

describe("AI-V2(b) — interruption is routed via the guard (source pins)", () => {
  const src = fs.readFileSync(path.join(__dirname, "geminiLiveClient.ts"), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("serverContent.interrupted calls guard.interrupt() — never playback directly", () => {
    expect(code).toMatch(/sc\?\.interrupted[\s\S]{0,200}guard\.interrupt\(\)/);
    // No second playChunk caller appeared (the guard sink stays the only one).
    expect(code.match(/playChunk\(/g)?.length).toBe(1);
  });

  it("the retained-source stop is the guard's onInterrupt sink (stopPlayback)", () => {
    expect(code).toContain("onInterrupt: stopPlayback");
    // stopPlayback stops retained sources and resets the schedule head.
    const stopFn = /const stopPlayback = \(\) => \{[\s\S]*?\n  \};/.exec(code)?.[0] ?? "";
    expect(stopFn).toContain("src.stop()");
    expect(stopFn).toContain("activeSources.clear()");
    expect(stopFn).toContain("playHead = 0");
  });

  it("every scheduled source is retained (and self-releases on natural end)", () => {
    expect(code).toContain("activeSources.add(src)");
    expect(code).toContain("src.onended = () => activeSources.delete(src)");
  });
});


function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flushMicrotasks = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const streamWith = (stop = vi.fn()) => ({ getTracks: () => [{ stop }] }) as unknown as MediaStream;
const options = { token: "tok", model: "m", systemInstruction: "pinned" };

describe("voice startup cancellation and terminal races (fake devices only)", () => {
  it("an already-cancelled attempt never requests a mic or socket", async () => {
    const abort = new AbortController();
    abort.abort();
    await expect(startGeminiLive({ ...options, signal: abort.signal }, {
      screenTurn: async () => ({ action: "continue" }),
    })).rejects.toMatchObject({ name: "AbortError" });
    expect(getUserMediaMock).not.toHaveBeenCalled();
    expect(connectMock).not.toHaveBeenCalled();
  });

  it("X rejects a pending mic immediately and stops a later grant without constructing audio", async () => {
    const mic = deferred<MediaStream>();
    getUserMediaMock.mockReturnValue(mic.promise);
    const abort = new AbortController();
    const pending = startGeminiLive({ ...options, signal: abort.signal }, {
      screenTurn: async () => ({ action: "continue" }),
    });
    const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    abort.abort();
    await rejected;
    const stop = vi.fn();
    mic.resolve(streamWith(stop));
    await flushMicrotasks();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(FakeAudioContext.instances).toHaveLength(0);
    expect(connectMock).not.toHaveBeenCalled();
  });

  it.each([false, true])("X releases granted resources while connect is pending (onopen=%s)", async (openFirst) => {
    const socket = deferred<{ close(): void; sendRealtimeInput(): void }>();
    let cb!: Callbacks;
    connectMock.mockImplementation(({ callbacks }: { callbacks: Callbacks }) => { cb = callbacks; return socket.promise; });
    const abort = new AbortController();
    const onUserInterim = vi.fn();
    const onError = vi.fn();
    const screenTurn = vi.fn(async () => ({ action: "continue" as const }));
    const phases: string[] = [];
    const pending = startGeminiLive({ ...options, signal: abort.signal }, {
      screenTurn, onUserInterim, onError, onPhase: (phase) => phases.push(phase),
    });
    const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await flushMicrotasks();
    expect(cb).toBeDefined();
    if (openFirst) cb.onopen();
    abort.abort();
    // Cleanup is synchronous with X, not delayed to a deadline or SDK resolve.
    expect(micTracks.every((track) => track.stopped)).toBe(true);
    expect(FakeAudioContext.instances.map((context) => context.closed)).toEqual([true, true]);
    await rejected;
    const close = vi.fn();
    socket.resolve({ close, sendRealtimeInput() {} });
    await flushMicrotasks();
    cb.onopen();
    cb.onmessage({ data: CHUNK_B64, serverContent: { inputTranscription: { text: "old caption" }, turnComplete: true } });
    cb.onerror({ message: "late error" });
    cb.onclose();
    expect(close).toHaveBeenCalledTimes(1);
    expect(phases.at(-1)).toBe("closed");
    expect(onUserInterim).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(screenTurn).not.toHaveBeenCalled();
    expect(FakeAudioContext.instances.every((context) => context.graphs === 0)).toBe(true);
  });

  it("onopen followed by close before SDK resolution rejects instead of adopting a dead socket", async () => {
    const socket = deferred<{ close(): void; sendRealtimeInput(): void }>();
    let cb!: Callbacks;
    connectMock.mockImplementation(({ callbacks }: { callbacks: Callbacks }) => { cb = callbacks; return socket.promise; });
    const pending = startGeminiLive(options, { screenTurn: async () => ({ action: "continue" }) });
    const rejected = expect(pending).rejects.toThrow("live-closed-during-start");
    await flushMicrotasks();
    cb.onopen();
    cb.onclose();
    await rejected;
    expect(micTracks[0].stopped).toBe(true);
    const close = vi.fn();
    socket.resolve({ close, sendRealtimeInput() {} });
    await flushMicrotasks();
    expect(close).toHaveBeenCalledTimes(1);
    expect(FakeAudioContext.instances.every((context) => context.closed)).toBe(true);
  });

  it("a post-ready transport error releases all resources before notifying the caller, once", async () => {
    let cb!: Callbacks;
    connectMock.mockImplementation(async ({ callbacks }: { callbacks: Callbacks }) => {
      cb = callbacks;
      return { close() { cb.onclose(); }, sendRealtimeInput() {} };
    });
    const onError = vi.fn(() => {
      expect(micTracks[0].stopped).toBe(true);
      expect(FakeAudioContext.instances.every((context) => context.closed)).toBe(true);
    });
    const ctl = await startGeminiLive(options, { screenTurn: async () => ({ action: "continue" }), onError });
    cb.onerror({ message: "connection lost" });
    cb.onerror({ message: "late duplicate" });
    expect(onError).toHaveBeenCalledTimes(1);
    ctl.stop();
  });

  it.each(["continue", "stop_crisis", "stop_blocked"] as const)("late %s verdict after cancellation never releases or renders", async (action) => {
    const verdict = deferred<{ action: typeof action }>();
    let cb!: Callbacks;
    connectMock.mockImplementation(async ({ callbacks }: { callbacks: Callbacks }) => {
      cb = callbacks;
      return { close() {}, sendRealtimeInput() {} };
    });
    const screenTurn = vi.fn(() => verdict.promise);
    const onModelTurn = vi.fn(), onCrisis = vi.fn(), onBlocked = vi.fn(), onFailClosed = vi.fn();
    const abort = new AbortController();
    await startGeminiLive({ ...options, signal: abort.signal }, { screenTurn, onModelTurn, onCrisis, onBlocked, onFailClosed });
    cb.onmessage({ data: CHUNK_B64, serverContent: { outputTranscription: { text: "Keep the routine visual." }, turnComplete: true } });
    await flushMicrotasks();
    expect(screenTurn).toHaveBeenCalledTimes(1);
    abort.abort();
    verdict.resolve({ action });
    await flushMicrotasks();
    expect(FakeAudioContext.instances.flatMap((context) => context.sources)).toHaveLength(0);
    for (const callback of [onModelTurn, onCrisis, onBlocked, onFailClosed]) expect(callback).not.toHaveBeenCalled();
  });

  it.each(["stop_crisis", "stop_blocked"] as const)("current %s during pending startup still renders AFTER cleanup", async (action) => {
    const socket = deferred<{ close(): void; sendRealtimeInput(): void }>();
    let cb!: Callbacks;
    connectMock.mockImplementation(({ callbacks }: { callbacks: Callbacks }) => { cb = callbacks; return socket.promise; });
    const notify = vi.fn(() => {
      expect(micTracks[0].stopped).toBe(true);
      expect(FakeAudioContext.instances.every((context) => context.closed)).toBe(true);
    });
    const pending = startGeminiLive(options, {
      screenTurn: async () => ({ action }), onCrisis: notify, onBlocked: notify,
    });
    const rejected = expect(pending).rejects.toThrow("live-session-stopped");
    await flushMicrotasks();
    cb.onmessage({ data: CHUNK_B64, serverContent: { outputTranscription: { text: "Keep the routine visual." }, turnComplete: true } });
    await rejected;
    expect(notify).toHaveBeenCalledTimes(1);
    const close = vi.fn();
    socket.resolve({ close, sendRealtimeInput() {} });
    await flushMicrotasks();
    expect(close).toHaveBeenCalledTimes(1);
    expect(FakeAudioContext.instances.flatMap((context) => context.sources)).toHaveLength(0);
  });

  it("a screening rejection still halts before the visible fail-closed fallback", async () => {
    let cb!: Callbacks;
    connectMock.mockImplementation(async ({ callbacks }: { callbacks: Callbacks }) => {
      cb = callbacks; return { close() {}, sendRealtimeInput() {} };
    });
    const onFailClosed = vi.fn(() => expect(micTracks[0].stopped).toBe(true));
    const ctl = await startGeminiLive(options, {
      screenTurn: async () => { throw new Error("screen unavailable"); }, onFailClosed,
    });
    cb.onmessage({ data: CHUNK_B64, serverContent: { outputTranscription: { text: "Keep the routine visual." }, turnComplete: true } });
    await flushMicrotasks();
    expect(onFailClosed).toHaveBeenCalledWith("screen-unavailable");
    expect(FakeAudioContext.instances.flatMap((context) => context.sources)).toHaveLength(0);
    ctl.stop();
  });

  it.each(["mic", "socket"] as const)("the %s deadline remains bounded and cleans up late resources", async (stage) => {
    vi.useFakeTimers();
    const lateStop = vi.fn(), lateClose = vi.fn();
    const mic = deferred<MediaStream>();
    const socket = deferred<{ close(): void; sendRealtimeInput(): void }>();
    if (stage === "mic") getUserMediaMock.mockReturnValue(mic.promise);
    else connectMock.mockReturnValue(socket.promise);
    const pending = startGeminiLive(options, { screenTurn: async () => ({ action: "continue" }) });
    const rejected = expect(pending).rejects.toThrow(stage === "mic" ? "live-mic-timeout" : "live-connect-timeout");
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(stage === "mic" ? 15_000 : 10_000);
    await rejected;
    if (stage === "mic") mic.resolve(streamWith(lateStop));
    else socket.resolve({ close: lateClose, sendRealtimeInput() {} });
    await flushMicrotasks();
    expect(stage === "mic" ? lateStop : lateClose).toHaveBeenCalledTimes(1);
    expect(FakeAudioContext.instances.every((context) => context.closed)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("partial AudioContext construction failure stops the mic and the first context", async () => {
    vi.stubGlobal("AudioContext", class extends FakeAudioContext {
      constructor(opts?: { sampleRate?: number }) {
        if (opts?.sampleRate === 24000) throw new Error("output context unavailable");
        super(opts);
      }
    });
    await expect(startGeminiLive(options, { screenTurn: async () => ({ action: "continue" }) })).rejects.toThrow("output context unavailable");
    expect(micTracks[0].stopped).toBe(true);
    expect(FakeAudioContext.instances.map((context) => context.closed)).toEqual([true]);
    expect(connectMock).not.toHaveBeenCalled();
  });

  it("late callbacks from the old socket cannot stop or caption a newer real client attempt", async () => {
    const callbacks: Callbacks[] = [];
    connectMock.mockImplementation(async ({ callbacks: cb }: { callbacks: Callbacks }) => {
      callbacks.push(cb);
      return { close() {}, sendRealtimeInput() {} };
    });
    const firstAbort = new AbortController();
    await startGeminiLive({ ...options, signal: firstAbort.signal }, {
      screenTurn: async () => ({ action: "continue" }),
    });
    firstAbort.abort();
    const newCaption = vi.fn(), newError = vi.fn();
    const second = await startGeminiLive(options, {
      screenTurn: async () => ({ action: "continue" }), onUserInterim: newCaption, onError: newError,
    });
    callbacks[0].onerror({ message: "old connection" });
    callbacks[0].onclose();
    callbacks[0].onmessage({ serverContent: { inputTranscription: { text: "old words" } } });
    expect(micTracks[1].stopped).toBe(false);
    expect(FakeAudioContext.instances.slice(2).every((context) => !context.closed)).toBe(true);
    expect(newCaption).not.toHaveBeenCalled();
    expect(newError).not.toHaveBeenCalled();
    callbacks[1].onmessage({ serverContent: { inputTranscription: { text: "current words" } } });
    expect(newCaption).toHaveBeenCalledWith("current words");
    second.stop();
  });

  it("a synchronous SDK throw cleans up without an unhandled startup deferred", async () => {
    connectMock.mockImplementation(() => { throw new Error("SDK construction failed"); });
    await expect(startGeminiLive(options, {
      screenTurn: async () => ({ action: "continue" }),
    })).rejects.toThrow("SDK construction failed");
    await flushMicrotasks();
    expect(micTracks[0].stopped).toBe(true);
    expect(FakeAudioContext.instances.every((context) => context.closed)).toBe(true);
  });

  it("graph setup failure releases the connected socket, microphone and both contexts", async () => {
    const close = vi.fn();
    connectMock.mockResolvedValue({ close, sendRealtimeInput() {} });
    vi.stubGlobal("AudioContext", class extends FakeAudioContext {
      createScriptProcessor(): never { throw new Error("processor unavailable"); }
    });
    await expect(startGeminiLive(options, {
      screenTurn: async () => ({ action: "continue" }),
    })).rejects.toThrow("processor unavailable");
    expect(close).toHaveBeenCalledTimes(1);
    expect(micTracks[0].stopped).toBe(true);
    expect(FakeAudioContext.instances.every((context) => context.closed)).toBe(true);
  });

});


/** Execute Coach's actual callback/extraction closures without mounting React.
 * Only their surrounding API/state dependencies are synthetic. AST extraction
 * must find exactly one production declaration/call; never substitute a copy
 * of the owner checks. The real client + guard still drive socket callbacks. */
const coachCallbackSource = ts.createSourceFile(
  "CoachTab.tsx",
  fs.readFileSync(path.join(__dirname, "../components/tabs/CoachTab.tsx"), "utf8"),
  ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX,
);
const proposalInitializers: ts.Expression[] = [];
const liveHandlerObjects: ts.ObjectLiteralExpression[] = [];
const collectCoachCallbacks = (node: ts.Node) => {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "deriveConversationProposals" && node.initializer) {
    proposalInitializers.push(node.initializer);
  }
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "startGeminiLive") {
    const handlers = node.arguments[1];
    if (handlers && ts.isObjectLiteralExpression(handlers)) liveHandlerObjects.push(handlers);
  }
  ts.forEachChild(node, collectCoachCallbacks);
};
collectCoachCallbacks(coachCallbackSource);
if (proposalInitializers.length !== 1 || liveHandlerObjects.length !== 1) {
  throw new Error("Coach production extraction/Live handlers must each be covered exactly once");
}
const bindProductionCoachCallbacks = (scope: Record<string, unknown>): LiveHandlers => {
  const source = "function bind(" + Object.keys(scope).join(",") + ") {\n"
    + "let liveClosed = false;\nconst deriveConversationProposals = " + proposalInitializers[0].getText(coachCallbackSource) + ";\n"
    + "return (" + liveHandlerObjects[0].getText(coachCallbackSource) + ");\n}";
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } });
  const bind = new Function(compiled.outputText + "\nreturn bind;")() as (...args: unknown[]) => LiveHandlers;
  return bind(...Object.values(scope));
};

function productionCoachHarness() {
  const lifetime = createVoiceLifetime();
  const attempt = lifetime.begin();
  const extraction = deferred<{ proposals: unknown[] }>();
  let proposals: unknown[] = [];
  const phases: { phase: string; current: boolean; released: boolean }[] = [];
  const api = {
    extractConversationProposals: vi.fn(() => extraction.promise),
    liveTurn: vi.fn(async (): Promise<LiveTurnVerdict> => ({ action: "continue" })),
  };
  const appendVoiceAiDelta = vi.fn();
  const appendVoiceUserTurn = vi.fn();
  const finalizeVoiceAiTurn = vi.fn();
  const clearLiveRefs = vi.fn();
  const setVoiceInterim = vi.fn();
  const normalizeConversationProposals = vi.fn((drafts: unknown[]) => drafts);
  const speak = vi.fn();
  const handlers = bindProductionCoachCallbacks({
    attempt, api, voiceLifetimeRef: { current: lifetime },
    voiceSessionIdRef: { current: "synthetic-session" }, voiceTurnRef: { current: 0 },
    childProfile: { id: "synthetic-child" }, getAiLanguage: () => "en", milestones: [],
    behaviorLogs: [], conversationChanges: [], normalizeConversationProposals,
    attachProposalConflicts: (drafts: unknown[]) => drafts,
    setConversationProposals: (update: (current: unknown[]) => unknown[]) => { proposals = update(proposals); },
    EscalationRequiredError: class extends Error {},
    clearLiveRefs, setVoiceInterim, appendVoiceUserTurn, appendVoiceAiDelta, finalizeVoiceAiTurn,
    voiceOnRef: { current: true }, speak,
    setVoicePhase: (phase: string) => phases.push({
      phase, current: attempt.isCurrent(),
      released: micTracks.every((track) => track.stopped) && FakeAudioContext.instances.every((context) => context.closed),
    }),
  });
  return {
    lifetime, attempt, handlers, extraction, api, phases, normalizeConversationProposals,
    appendVoiceUserTurn, appendVoiceAiDelta, finalizeVoiceAiTurn, clearLiveRefs, setVoiceInterim, speak,
    get proposals() { return proposals; },
  };
}

describe("ordinary remote close versus safety halt — real client + production Coach callbacks", () => {
  it.each([true, false])("remote-close retirement enabled=%s blocks late extraction (false is the pre-fix negative control)", async (retireOnRemoteClose) => {
    const coach = productionCoachHarness();
    let cb!: Callbacks;
    // A synchronous close event caused by cleanup must not notify twice.
    const close = vi.fn(() => cb.onclose());
    connectMock.mockImplementation(async ({ callbacks }: { callbacks: Callbacks }) => {
      cb = callbacks;
      return { close, sendRealtimeInput() {} };
    });
    expect(coach.handlers.onRemoteClose).toBeTypeOf("function");
    const remoteClose = vi.fn(coach.handlers.onRemoteClose!);
    const ctl = await startGeminiLive({ ...options, signal: coach.attempt.signal }, {
      ...coach.handlers, onRemoteClose: retireOnRemoteClose ? remoteClose : undefined,
    });
    expect(coach.attempt.adopt(ctl)).toBe(true);
    cb.onmessage({ serverContent: { inputTranscription: { text: "A visual routine helped today." }, turnComplete: true } });
    await flushMicrotasks();
    expect(coach.appendVoiceUserTurn).toHaveBeenCalledWith("A visual routine helped today.");
    expect(coach.api.extractConversationProposals).toHaveBeenCalledTimes(1);

    cb.onclose();
    expect(close).toHaveBeenCalledTimes(1);
    expect(coach.phases).toContainEqual({ phase: "off", current: true, released: true });
    expect(coach.attempt.isCurrent()).toBe(!retireOnRemoteClose);
    expect(remoteClose).toHaveBeenCalledTimes(retireOnRemoteClose ? 1 : 0);
    const draft = { id: "late-draft" };
    coach.extraction.resolve({ proposals: [draft] });
    await flushMicrotasks();
    // Without the new callback, the actual pre-fix extraction appends after
    // voice is off. With it, even normalization must remain unreachable.
    expect(coach.proposals).toEqual(retireOnRemoteClose ? [] : [draft]);
    expect(coach.normalizeConversationProposals).toHaveBeenCalledTimes(retireOnRemoteClose ? 0 : 1);

    if (retireOnRemoteClose) {
      const next = coach.lifetime.begin();
      const nextStop = vi.fn();
      next.adopt({ stop: nextStop });
      const clears = coach.clearLiveRefs.mock.calls.length;
      coach.handlers.onRemoteClose!(); // stale production callback from the old attempt
      expect(next.isCurrent()).toBe(true);
      expect(nextStop).not.toHaveBeenCalled();
      expect(coach.clearLiveRefs).toHaveBeenCalledTimes(clears);
    }
    coach.lifetime.cancel();
  });

  it.each(["stop_crisis", "stop_blocked"] as const)("current %s survives phase closure, renders after halt, then retires", async (action) => {
    const coach = productionCoachHarness();
    let cb!: Callbacks;
    const close = vi.fn(() => cb.onclose());
    connectMock.mockImplementation(async ({ callbacks }: { callbacks: Callbacks }) => {
      cb = callbacks;
      return { close, sendRealtimeInput() {} };
    });
    coach.api.liveTurn.mockResolvedValue({
      action, resourcesMarkdown: "Synthetic crisis resources", blockedMarkdown: "Synthetic blocked notice", spokenText: "Synthetic redirect",
    });
    const remoteClose = vi.fn(coach.handlers.onRemoteClose!);
    const ctl = await startGeminiLive({ ...options, signal: coach.attempt.signal }, { ...coach.handlers, onRemoteClose: remoteClose });
    expect(coach.attempt.adopt(ctl)).toBe(true);
    cb.onmessage({ data: CHUNK_B64, serverContent: { outputTranscription: { text: "Keep the routine visual." }, turnComplete: true } });
    await flushMicrotasks();
    expect(coach.phases).toContainEqual({ phase: "off", current: true, released: true });
    expect(coach.appendVoiceAiDelta).toHaveBeenCalledTimes(1);
    expect(coach.appendVoiceAiDelta).toHaveBeenCalledWith(action === "stop_crisis" ? "Synthetic crisis resources" : "Synthetic blocked notice");
    expect(coach.speak).toHaveBeenCalledWith("Synthetic redirect");
    expect(coach.attempt.isCurrent()).toBe(false);
    expect(coach.lifetime.current).toBeNull();
    expect(coach.phases[coach.phases.length - 1]).toEqual({ phase: "off", current: false, released: true });
    expect(remoteClose).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
    expect(FakeAudioContext.instances.flatMap((context) => context.sources)).toHaveLength(0);
    coach.lifetime.cancel();
  });
});
