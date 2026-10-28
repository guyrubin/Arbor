/**
 * B-AIOPS-02 — a Live conversation spends the family's daily voice time in
 * short server-reserved slices, and the parent never sees the seams:
 *
 *   - the microphone is opened BEFORE any token is minted (a refusal never
 *     spends voice time) and handed to the session, which owns it from there;
 *   - while the family has time left, the next slice is minted before this one
 *     ends and the socket is swapped at a quiet moment on the same microphone
 *     and playback (no "closed" phase, no connection-ended path);
 *   - when the family's time is spent, the conversation ends calmly at the
 *     slice end through onAllowanceEnd — never onRemoteClose or onError, also
 *     when the provider closes the final slice itself a moment early;
 *   - a renewal that fails for any other reason is a connection end, not rest.
 *
 * Same seam as geminiLiveClient.interrupt.test.ts: AudioContext and
 * getUserMedia are stubbed, @google/genai is mocked to hand back callbacks;
 * the client, its guard and its timers are the real code (fake clock).
 */
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";

const { connectMock } = vi.hoisted(() => ({ connectMock: vi.fn() }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    live = { connect: (args: any) => {
      const result = connectMock(args);
      void Promise.resolve(result).then(() => args.callbacks.onmessage({ setupComplete: {} })).catch(() => {});
      return result;
    } };
  },
  Modality: { AUDIO: "AUDIO" },
}));

import { requestLiveMicrophone, startGeminiLive, type LiveHandlers, type LiveSlice } from "./geminiLiveClient";

class FakeAudioContext {
  currentTime = 0;
  destination = {};
  state = "running";
  createBuffer(_ch: number, len: number, rate: number) { return { duration: len / rate, copyToChannel() {} }; }
  createBufferSource() { return { buffer: null, onended: null, connect() {}, start() {}, stop() {} }; }
  createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
  createScriptProcessor() { return { connect() {}, disconnect() {}, onaudioprocess: null as unknown }; }
  close() { return Promise.resolve(); }
}
const getUserMediaMock = vi.fn();
vi.stubGlobal("AudioContext", FakeAudioContext);
vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: getUserMediaMock } });
afterAll(() => vi.unstubAllGlobals());

type Callbacks = { onopen: () => void; onmessage: (m: unknown) => void; onerror: (e: unknown) => void; onclose: () => void };
type FakeSession = { close: ReturnType<typeof vi.fn>; sendRealtimeInput: ReturnType<typeof vi.fn>; cb: Callbacks; token: unknown; systemInstruction: unknown };

const T0 = Date.parse("2026-10-28T10:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();
let sessions: FakeSession[] = [];
const track = () => ({ stopped: false, stop() { this.stopped = true; } });
const micStream = () => { const t = track(); return { t, stream: { getTracks: () => [t] } as unknown as MediaStream }; };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(T0);
  sessions = [];
  connectMock.mockReset().mockImplementation(async (args: { callbacks: Callbacks; config: { systemInstruction: unknown } }) => {
    const session = { close: vi.fn(), sendRealtimeInput: vi.fn(), cb: args.callbacks, token: null, systemInstruction: args.config.systemInstruction };
    sessions.push(session);
    return session;
  });
  getUserMediaMock.mockReset();
});
afterEach(() => { vi.useRealTimers(); });

const handlersFor = () => {
  const seen = { phases: [] as string[], remoteClose: 0, errors: 0, allowanceEnd: 0 };
  const handlers: LiveHandlers = {
    screenTurn: async () => ({ action: "continue" as const }),
    onPhase: (p) => seen.phases.push(p),
    onRemoteClose: () => { seen.remoteClose++; },
    onError: () => { seen.errors++; },
    onAllowanceEnd: () => { seen.allowanceEnd++; },
  };
  return { seen, handlers };
};
const reporter = (log: string[], name: string) => async (event: string) => { log.push(`${name}:${event}`); };
const slice = (n: number, endMs: number, remainingMs: number, log: string[]): LiveSlice => ({
  token: `tok-${n}`, model: "m", systemInstruction: `pinned-${n}`, expiresAt: iso(endMs), remainingMs, reportUsage: reporter(log, `s${n}`),
});

describe("the microphone opens before the mint and is handed to the session", () => {
  it("a supplied stream is used as is (no second permission request) and released when the session ends", async () => {
    const { t, stream } = micStream();
    const { handlers } = handlersFor();
    const ctl = await startGeminiLive({ token: "tok-1", model: "m", systemInstruction: "pinned", stream }, handlers);
    expect(getUserMediaMock).not.toHaveBeenCalled();
    ctl.stop();
    expect(t.stopped).toBe(true);
  });

  it("a refused microphone rejects before anything else happens; a grant after cancellation releases itself", async () => {
    getUserMediaMock.mockRejectedValueOnce(Object.assign(new Error("denied"), { name: "NotAllowedError" }));
    await expect(requestLiveMicrophone()).rejects.toMatchObject({ name: "NotAllowedError" });
    const late = micStream();
    let grant: (s: MediaStream) => void = () => {};
    getUserMediaMock.mockImplementationOnce(() => new Promise((resolve) => { grant = resolve; }));
    const owner = new AbortController();
    const pending = requestLiveMicrophone(owner.signal);
    owner.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    grant(late.stream);
    await Promise.resolve(); await Promise.resolve();
    expect(late.t.stopped).toBe(true);
  });
});

describe("renewal: the next slice is minted before this one ends, invisibly", () => {
  it("mints 8 s before the end, swaps at a quiet moment on the same microphone, and closes the old socket — no closed phase, no remote close", async () => {
    const log: string[] = [];
    const { t, stream } = micStream();
    const { seen, handlers } = handlersFor();
    const renew = vi.fn(async () => slice(2, T0 + 120_000, 60_000, log));
    const ctl = await startGeminiLive({ token: "tok-1", model: "m", systemInstruction: "pinned-1", stream,
      expiresAt: iso(T0 + 60_000), remainingMs: 120_000, renew, reportUsage: reporter(log, "s1") }, handlers);
    expect(sessions).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(51_000);
    expect(renew).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_500);
    expect(renew).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(sessions).toHaveLength(2));
    await vi.waitFor(() => expect(sessions[0].close).toHaveBeenCalled());
    expect(sessions[1].systemInstruction).toBe("pinned-2");
    expect(getUserMediaMock).not.toHaveBeenCalled();
    expect(t.stopped).toBe(false);
    await vi.waitFor(() => expect(log).toEqual(expect.arrayContaining(["s1:opened", "s1:closed", "s2:opened"])));
    // The old socket's late close and frames are ignored; the parent saw nothing.
    sessions[0].cb.onclose();
    expect(seen.phases).not.toContain("closed");
    expect(seen.remoteClose + seen.errors + seen.allowanceEnd).toBe(0);
    ctl.stop();
    expect(t.stopped).toBe(true);
  });

  it("waits for a quiet moment: while the model's turn is open the swap holds, then happens before the slice ends", async () => {
    const log: string[] = [];
    const { stream } = micStream();
    const { seen, handlers } = handlersFor();
    const renew = vi.fn(async () => slice(2, T0 + 120_000, 60_000, log));
    const ctl = await startGeminiLive({ token: "tok-1", model: "m", systemInstruction: "pinned-1", stream,
      expiresAt: iso(T0 + 60_000), remainingMs: 120_000, renew }, handlers);
    await vi.advanceTimersByTimeAsync(50_000);
    // The model starts a turn (transcription arrives, not yet complete).
    sessions[0].cb.onmessage({ serverContent: { outputTranscription: { text: "One more idea" } } });
    await vi.advanceTimersByTimeAsync(3_000);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].close).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(6_000); // past end − 1 s: the forced swap
    expect(sessions[0].close).toHaveBeenCalled();
    expect(seen.remoteClose + seen.errors + seen.allowanceEnd).toBe(0);
    ctl.stop();
  });
});

describe("the calm end at the family's allowance", () => {
  it("a final slice (under 30 s left) ends at its expiry through onAllowanceEnd — never the connection-ended path", async () => {
    const { t, stream } = micStream();
    const { seen, handlers } = handlersFor();
    const renew = vi.fn(async () => null);
    await startGeminiLive({ token: "tok-1", model: "m", systemInstruction: "pinned", stream,
      expiresAt: iso(T0 + 60_000), remainingMs: 10_000, renew }, handlers);
    await vi.advanceTimersByTimeAsync(59_000);
    expect(seen.allowanceEnd).toBe(0);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(renew).not.toHaveBeenCalled();
    expect(seen.allowanceEnd).toBe(1);
    expect(seen.remoteClose).toBe(0);
    expect(seen.errors).toBe(0);
    expect(t.stopped).toBe(true);
    expect(sessions[0].close).toHaveBeenCalled();
  });

  it("spent mid-conversation (another parent used the rest): renew answers null and the session ends calmly at this slice's end", async () => {
    const { stream } = micStream();
    const { seen, handlers } = handlersFor();
    const renew = vi.fn(async () => null);
    await startGeminiLive({ token: "tok-1", model: "m", systemInstruction: "pinned", stream,
      expiresAt: iso(T0 + 60_000), remainingMs: 120_000, renew }, handlers);
    await vi.advanceTimersByTimeAsync(53_000);
    expect(renew).toHaveBeenCalledTimes(1);
    expect(seen.allowanceEnd).toBe(0);
    await vi.advanceTimersByTimeAsync(7_000);
    expect(seen.allowanceEnd).toBe(1);
    expect(seen.remoteClose + seen.errors).toBe(0);
  });

  it("the provider closing a final slice a moment early is the same calm end, not a failure", async () => {
    const { stream } = micStream();
    const { seen, handlers } = handlersFor();
    await startGeminiLive({ token: "tok-1", model: "m", systemInstruction: "pinned", stream,
      expiresAt: iso(T0 + 60_000), remainingMs: 0, renew: async () => null }, handlers);
    await vi.advanceTimersByTimeAsync(57_000);
    sessions[0].cb.onclose();
    expect(seen.allowanceEnd).toBe(1);
    expect(seen.remoteClose).toBe(0);
  });

  it("a renewal that fails to mint is a connection end at the slice end — not a resting state", async () => {
    const { stream } = micStream();
    const { seen, handlers } = handlersFor();
    await startGeminiLive({ token: "tok-1", model: "m", systemInstruction: "pinned", stream,
      expiresAt: iso(T0 + 60_000), remainingMs: 120_000, renew: async () => { throw new Error("network"); } }, handlers);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(seen.remoteClose).toBe(1);
    expect(seen.allowanceEnd).toBe(0);
  });

  it("a mid-slice provider close with time left is still a connection end (the resting state is only for the allowance)", async () => {
    const { stream } = micStream();
    const { seen, handlers } = handlersFor();
    await startGeminiLive({ token: "tok-1", model: "m", systemInstruction: "pinned", stream,
      expiresAt: iso(T0 + 60_000), remainingMs: 120_000, renew: async () => null }, handlers);
    await vi.advanceTimersByTimeAsync(20_000);
    sessions[0].cb.onclose();
    expect(seen.remoteClose).toBe(1);
    expect(seen.allowanceEnd).toBe(0);
  });
});
