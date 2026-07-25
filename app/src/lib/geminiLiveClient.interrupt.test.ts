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
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
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

import { startGeminiLive } from "./geminiLiveClient";

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
  createMediaStreamSource() {
    return { connect() {}, disconnect() {} };
  }
  createScriptProcessor() {
    return { connect() {}, disconnect() {}, onaudioprocess: null as unknown };
  }
  close() {
    return Promise.resolve();
  }
}

vi.stubGlobal("AudioContext", FakeAudioContext);
vi.stubGlobal("navigator", {
  mediaDevices: { getUserMedia: async () => ({ getTracks: () => [] as { stop(): void }[] }) },
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
});

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
