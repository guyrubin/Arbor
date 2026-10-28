/**
 * B-AIOPS-02 — a Live conversation spends the family's daily voice time in
 * short server-reserved slices, and the parent never sees the seams:
 *
 *   - the microphone is opened BEFORE any token is minted (a refusal never
 *     spends voice time) and handed to the session, which owns it from there;
 *   - round 4: every slice is renewed 30 s before it ends — never after the
 *     first exchange — naming the slice it renews; the server grows the slices
 *     1 → 2 → 4 → 8 minutes, so a 20-minute talk has four seams;
 *   - a renewal is retried at 15 s and 5 s before the end; the first slice to
 *     arrive wins, one arriving after the end is discarded, and with none the
 *     talk ends calmly (onTalkEnd), never with the connection-ended notice;
 *   - a provider goAway brings the renewal forward to the socket's announced
 *     end; a socket gone while the next slice is on its way holds, then swaps;
 *   - a socket is swapped ONLY at a quiet moment (no model turn open, screened
 *     or playing, no reply awaited, the parent silent) on the same microphone
 *     and playback; forced only in the socket's last second, and then nothing
 *     the parent hears is cut and no owed answer is lost;
 *   - the new socket is seeded with every screened turn of the talk, so no
 *     exchange is lost across a seam;
 *   - when the family's time is spent, the conversation ends calmly at the
 *     slice end through onAllowanceEnd — never onRemoteClose or onError, also
 *     when the provider closes the final slice itself a moment early.
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

const audio = { started: 0, stopped: 0 };
class FakeAudioContext {
  currentTime = 0;
  destination = {};
  state = "running";
  createBuffer(_ch: number, len: number, rate: number) { return { duration: len / rate, copyToChannel() {} }; }
  createBufferSource() {
    // Released audio "plays" for 2 s of the fake clock, then ends.
    const src = { buffer: null, onended: null as null | (() => void), connect() {}, start() { audio.started++; setTimeout(() => src.onended?.(), 2_000); }, stop() { audio.stopped++; } };
    return src;
  }
  createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
  createScriptProcessor() { return { connect() {}, disconnect() {}, onaudioprocess: null as unknown }; }
  close() { return Promise.resolve(); }
}
const getUserMediaMock = vi.fn();
vi.stubGlobal("AudioContext", FakeAudioContext);
vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: getUserMediaMock } });
afterAll(() => vi.unstubAllGlobals());

type Callbacks = { onopen: () => void; onmessage: (m: unknown) => void; onerror: (e: unknown) => void; onclose: () => void };
type FakeSession = { close: ReturnType<typeof vi.fn>; sendRealtimeInput: ReturnType<typeof vi.fn>; sendClientContent: ReturnType<typeof vi.fn>; cb: Callbacks; token: unknown; systemInstruction: unknown };

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
    const session = { close: vi.fn(), sendRealtimeInput: vi.fn(), sendClientContent: vi.fn(), cb: args.callbacks, token: null, systemInstruction: args.config.systemInstruction };
    sessions.push(session);
    return session;
  });
  getUserMediaMock.mockReset();
  audio.started = 0;
  audio.stopped = 0;
});
afterEach(() => { vi.useRealTimers(); });

const handlersFor = () => {
  const seen = { phases: [] as string[], remoteClose: 0, errors: 0, allowanceEnd: 0, talkEnd: 0 };
  const handlers: LiveHandlers = {
    screenTurn: async () => ({ action: "continue" as const }),
    onPhase: (p) => seen.phases.push(p),
    onRemoteClose: () => { seen.remoteClose++; },
    onError: () => { seen.errors++; },
    onAllowanceEnd: () => { seen.allowanceEnd++; },
    onTalkEnd: () => { seen.talkEnd++; },
  };
  return { seen, handlers };
};
const reporter = (log: string[], name: string) => async (event: string) => { log.push(`${name}:${event}`); };
const slice = (n: number, endMs: number, remainingMs: number, log: string[]): LiveSlice => ({
  token: `tok-${n}`, model: "m", systemInstruction: `pinned-${n}`, expiresAt: iso(endMs), remainingMs, reportUsage: reporter(log, `s${n}`), usageId: `u${n}`,
});
/** One complete, screened exchange on a socket: the parent's words, then the
 *  model's audio + transcription and turnComplete (the guard releases it). */
const exchange = async (session: FakeSession, user: string, model: string) => {
  session.cb.onmessage({ serverContent: { inputTranscription: { text: user } } });
  session.cb.onmessage({ data: btoa("\x00\x01\x00\x01"), serverContent: { outputTranscription: { text: model } } });
  session.cb.onmessage({ serverContent: { turnComplete: true } });
  await vi.advanceTimersByTimeAsync(0);
};

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

/** A first slice of 60 s with the rest of a paid day after it. */
const firstSlice = (renew: LiveSessionOptionsRenew, log: string[], stream: MediaStream) => ({
  token: "tok-1", model: "m", systemInstruction: "pinned-1", stream, usageId: "u1",
  expiresAt: iso(T0 + 60_000), remainingMs: 1_140_000, renew, reportUsage: reporter(log, "s1"),
});
type LiveSessionOptionsRenew = (renewOf?: string) => Promise<LiveSlice | null>;
const later = <T,>(ms: number, value: () => T) => new Promise<T>((resolve) => setTimeout(() => resolve(value()), ms));

describe("renewal rule (round 4): 30 s before each slice ends, growing slices, at a quiet moment, seeded", () => {
  it("no renewal after the first exchange: the first slice renews 30 s before it ends, naming its own usage id", async () => {
    const log: string[] = [];
    const { t, stream } = micStream();
    const { seen, handlers } = handlersFor();
    const renew = vi.fn(async () => slice(2, T0 + 180_000, 1_020_000, log));
    const ctl = await startGeminiLive(firstSlice(renew, log, stream), handlers);
    await vi.advanceTimersByTimeAsync(5_000);
    await exchange(sessions[0], "He would not put his shoes on", "Try offering two pairs to choose from.");
    await vi.advanceTimersByTimeAsync(T0 + 29_900 - Date.now());
    expect(renew).not.toHaveBeenCalled();
    expect(sessions).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(200);
    expect(renew).toHaveBeenCalledWith("u1");
    // Swapped at the next quiet moment, on the same microphone.
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.waitFor(() => expect(sessions[0].close).toHaveBeenCalled());
    expect(sessions).toHaveLength(2);
    expect(sessions[1].systemInstruction).toBe("pinned-2");
    expect(getUserMediaMock).not.toHaveBeenCalled();
    expect(t.stopped).toBe(false);
    await vi.waitFor(() => expect(log).toEqual(expect.arrayContaining(["s1:opened", "s1:closed", "s2:opened"])));
    sessions[0].cb.onclose(); // the retired socket's late close is ignored
    expect(seen.phases).not.toContain("closed");
    expect(seen.remoteClose + seen.errors + seen.allowanceEnd + seen.talkEnd).toBe(0);
    ctl.stop();
    expect(t.stopped).toBe(true);
  });

  it("no exchange is lost: the new socket is seeded with every screened turn of the talk, as history it does not answer", async () => {
    const log: string[] = [];
    const { stream } = micStream();
    const { handlers } = handlersFor();
    const renew = vi.fn(async () => slice(2, T0 + 180_000, 1_020_000, log));
    const ctl = await startGeminiLive(firstSlice(renew, log, stream), handlers);
    await exchange(sessions[0], "Bedtime was hard again", "That sounds tiring. What helped last time?");
    await vi.advanceTimersByTimeAsync(32_000);
    await vi.waitFor(() => expect(sessions[1]?.sendClientContent).toHaveBeenCalled());
    expect(sessions[1].sendClientContent).toHaveBeenCalledWith({
      turns: [
        { role: "user", parts: [{ text: "Bedtime was hard again" }] },
        { role: "model", parts: [{ text: "That sounds tiring. What helped last time?" }] },
      ],
      turnComplete: false,
    });
    ctl.stop();
  });

  it("a 20-minute talk on growing slices (1, 2, 4, 8, 5 min): four quiet seams, each renewal 30 s before its own slice ends", async () => {
    const log: string[] = [];
    const { stream } = micStream();
    const { seen, handlers } = handlersFor();
    const ends = [180_000, 420_000, 900_000, 1_200_000];
    const left = [1_020_000, 780_000, 300_000, 0];
    const calls: number[] = [];
    const renew = vi.fn(async (_renewOf?: string) => { const n = calls.length; calls.push(Date.now() - T0); return slice(n + 2, T0 + ends[n], left[n], log); });
    const ctl = await startGeminiLive(firstSlice(renew, log, stream), handlers);
    await exchange(sessions[0], "First", "First answer.");
    await vi.advanceTimersByTimeAsync(T0 + 1_200_000 - Date.now());
    expect(calls).toEqual([30_000, 150_000, 390_000, 870_000]);
    expect(renew.mock.calls.map((call) => call[0])).toEqual(["u1", "u2", "u3", "u4"]);
    expect(sessions).toHaveLength(5);
    for (const retired of sessions.slice(0, 4)) expect(retired.close).toHaveBeenCalled();
    // The last slice has no time after it: the talk ends calmly at 20:00.
    expect(seen.allowanceEnd).toBe(1);
    expect(seen.remoteClose + seen.errors + seen.talkEnd).toBe(0);
    ctl.stop();
  });

  it("never swaps while the model's turn is open, being screened or playing, or while the parent is speaking", async () => {
    const log: string[] = [];
    const { stream } = micStream();
    const { handlers } = handlersFor();
    const renew = vi.fn(async () => slice(2, T0 + 180_000, 1_020_000, log));
    const ctl = await startGeminiLive(firstSlice(renew, log, stream), handlers);
    await vi.advanceTimersByTimeAsync(29_000);
    // The parent asks; the model starts a long turn as the renewal arrives: hold.
    sessions[0].cb.onmessage({ serverContent: { inputTranscription: { text: "And at dinner?" } } });
    sessions[0].cb.onmessage({ serverContent: { outputTranscription: { text: "At dinner, keep it simple" } } });
    await vi.advanceTimersByTimeAsync(20_000);
    expect(renew).toHaveBeenCalledTimes(1);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].close).not.toHaveBeenCalled();
    // The turn completes and plays out: then, and only then, the swap.
    sessions[0].cb.onmessage({ data: btoa("\x00\x01\x00\x01"), serverContent: { turnComplete: true } });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(sessions[0].close).not.toHaveBeenCalled(); // still playing
    await vi.advanceTimersByTimeAsync(3_000);
    expect(sessions[0].close).toHaveBeenCalled();
    ctl.stop();
  });

  it("with no exchange at all, the first slice still renews 30 s before it ends", async () => {
    const log: string[] = [];
    const { stream } = micStream();
    const { handlers } = handlersFor();
    const renew = vi.fn(async () => slice(2, T0 + 180_000, 1_020_000, log));
    const ctl = await startGeminiLive(firstSlice(renew, log, stream), handlers);
    await vi.advanceTimersByTimeAsync(29_000);
    expect(renew).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_500);
    expect(renew).toHaveBeenCalledWith("u1");
    ctl.stop();
  });
});

describe("a forced seam (the socket's last second) cuts nothing the parent hears and loses no owed answer", () => {
  it("a reply still being generated was never heard: it is dropped, never played, and the new socket is asked to answer the parent", async () => {
    const log: string[] = [];
    const { stream } = micStream();
    const { seen, handlers } = handlersFor();
    const renew = vi.fn(async () => slice(2, T0 + 180_000, 1_020_000, log));
    const ctl = await startGeminiLive(firstSlice(renew, log, stream), handlers);
    await exchange(sessions[0], "One", "Two.");
    await vi.advanceTimersByTimeAsync(3_000);
    const playedBefore = audio.started;
    // The parent asks; the model is still generating (buffered, unscreened) at the end.
    sessions[0].cb.onmessage({ serverContent: { inputTranscription: { text: "What about naps?" } } });
    await vi.advanceTimersByTimeAsync(2_000);
    sessions[0].cb.onmessage({ data: btoa("\x00\x01\x00\x01"), serverContent: { outputTranscription: { text: "Naps are" } } });
    for (let at = Date.now(); at < T0 + 58_800; at += 1_000) {
      sessions[0].cb.onmessage({ serverContent: { outputTranscription: { text: " and more" } } });
      await vi.advanceTimersByTimeAsync(1_000);
    }
    await vi.advanceTimersByTimeAsync(T0 + 59_300 - Date.now());
    expect(sessions[0].close).toHaveBeenCalled();
    expect(audio.started).toBe(playedBefore); // the cut reply never played
    expect(sessions[1].sendClientContent).toHaveBeenCalledWith({
      turns: [
        { role: "user", parts: [{ text: "One" }] },
        { role: "model", parts: [{ text: "Two." }] },
        { role: "user", parts: [{ text: "What about naps?" }] },
      ],
      turnComplete: true,
    });
    expect(seen.remoteClose + seen.errors + seen.allowanceEnd + seen.talkEnd).toBe(0);
    ctl.stop();
  });

  it("a question the parent finished just before the seam, not yet answered, is carried to the new socket and answered there", async () => {
    const log: string[] = [];
    const { stream } = micStream();
    const { handlers } = handlersFor();
    const renew = vi.fn(async () => slice(2, T0 + 180_000, 1_020_000, log));
    const ctl = await startGeminiLive(firstSlice(renew, log, stream), handlers);
    await exchange(sessions[0], "One", "Two.");
    // The parent keeps talking through the renewal (no quiet moment), then
    // finishes a question three seconds before the end; no reply has started.
    await vi.advanceTimersByTimeAsync(27_000);
    for (let at = Date.now(); at < T0 + 57_000; at += 1_000) {
      sessions[0].cb.onmessage({ serverContent: { inputTranscription: { text: at < T0 + 56_000 ? " and" : " what about naps?" } } });
      await vi.advanceTimersByTimeAsync(1_000);
    }
    await vi.advanceTimersByTimeAsync(T0 + 59_300 - Date.now());
    expect(sessions[0].close).toHaveBeenCalled();
    const sent = sessions[1].sendClientContent.mock.calls[0][0];
    expect(sent.turnComplete).toBe(true);
    expect(sent.turns[sent.turns.length - 1].role).toBe("user");
    expect(sent.turns[sent.turns.length - 1].parts[0].text).toMatch(/what about naps\?$/);
    ctl.stop();
  });

  it("words the model left unanswered long ago (room noise) are history only — the new socket is not made to reply", async () => {
    const log: string[] = [];
    const { stream } = micStream();
    const { handlers } = handlersFor();
    const renew = vi.fn(async () => slice(2, T0 + 180_000, 1_020_000, log));
    const ctl = await startGeminiLive(firstSlice(renew, log, stream), handlers);
    await exchange(sessions[0], "One", "Two.");
    await vi.advanceTimersByTimeAsync(20_000);
    sessions[0].cb.onmessage({ serverContent: { inputTranscription: { text: "mm" } } });
    await vi.advanceTimersByTimeAsync(T0 + 59_300 - Date.now());
    expect(sessions[0].close).toHaveBeenCalled();
    expect(sessions[1].sendClientContent.mock.calls[0][0].turnComplete).toBe(false);
    ctl.stop();
  });

  it("screened audio already playing plays out across the seam, and a turn still being screened joins the new socket's history", async () => {
    const log: string[] = [];
    const { stream } = micStream();
    const { handlers } = handlersFor();
    let release: () => void = () => {};
    handlers.screenTurn = async (role, text) => {
      if (role === "model" && text === "And sing the same song.") await new Promise<void>((resolve) => { release = resolve; });
      return { action: "continue" as const };
    };
    const renew = vi.fn(async () => slice(2, T0 + 180_000, 1_020_000, log));
    const ctl = await startGeminiLive(firstSlice(renew, log, stream), handlers);
    // A lively talk from before the renewal to the end of the slice: answers
    // keep playing (each plays 2 s), so no quiet moment comes.
    await vi.advanceTimersByTimeAsync(28_000);
    for (let i = 0; Date.now() < T0 + 57_000; i++) {
      await exchange(sessions[0], `Question ${i}?`, `Answer ${i}.`);
      await vi.advanceTimersByTimeAsync(1_500);
    }
    expect(renew).toHaveBeenCalledTimes(1);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].close).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(T0 + 58_500 - Date.now());
    // A second answer completes and waits on its screen at the forced seam.
    sessions[0].cb.onmessage({ data: btoa("\x00\x01\x00\x01"), serverContent: { outputTranscription: { text: "And sing the same song." } } });
    sessions[0].cb.onmessage({ serverContent: { turnComplete: true } });
    await vi.advanceTimersByTimeAsync(T0 + 59_300 - Date.now());
    expect(sessions[0].close).toHaveBeenCalled();
    expect(audio.stopped).toBe(0); // nothing heard was cut
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(sessions[1].sendClientContent).toHaveBeenLastCalledWith({ turns: [{ role: "model", parts: [{ text: "And sing the same song." }] }], turnComplete: false });
    ctl.stop();
  });
});

describe("the renewal is no single point of failure", () => {
  it("a failed renewal is retried at 15 s and 5 s before the end; three failures end the talk calmly — never the connection-ended notice", async () => {
    const { t, stream } = micStream();
    const { seen, handlers } = handlersFor();
    const calls: number[] = [];
    const renew = vi.fn(async () => { calls.push(Date.now() - T0); throw new Error("network"); });
    await startGeminiLive(firstSlice(renew, [], stream), handlers);
    await vi.advanceTimersByTimeAsync(59_000);
    expect(calls).toEqual([30_000, 45_000, 55_000]);
    expect(seen.talkEnd).toBe(0);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(seen.talkEnd).toBe(1);
    expect(seen.remoteClose + seen.errors + seen.allowanceEnd).toBe(0);
    expect(t.stopped).toBe(true);
  });

  it("a retry that succeeds carries the talk on", async () => {
    const log: string[] = [];
    const { stream } = micStream();
    const { seen, handlers } = handlersFor();
    const renew = vi.fn()
      .mockImplementationOnce(async () => { throw new Error("network"); })
      .mockImplementationOnce(async () => slice(2, T0 + 180_000, 1_020_000, log));
    const ctl = await startGeminiLive(firstSlice(renew, log, stream), handlers);
    await vi.advanceTimersByTimeAsync(47_000);
    expect(renew).toHaveBeenCalledTimes(2);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].close).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(seen.remoteClose + seen.errors + seen.allowanceEnd + seen.talkEnd).toBe(0);
    ctl.stop();
  });

  it("a slow (20 s) mint started 30 s before the end still lands in time; a later hedge's slice is discarded, never applied", async () => {
    const log: string[] = [];
    const { stream } = micStream();
    const { seen, handlers } = handlersFor();
    let n = 1;
    const renew = vi.fn(async () => { const k = ++n; return later(20_000, () => slice(k, T0 + 180_000, 1_020_000, log)); });
    const ctl = await startGeminiLive(firstSlice(renew, log, stream), handlers);
    await vi.advanceTimersByTimeAsync(52_000);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].close).toHaveBeenCalled();
    expect(sessions[1].systemInstruction).toBe("pinned-2");
    await vi.advanceTimersByTimeAsync(30_000);
    // The hedge from 45 s answered at 65 s: discarded (reported, never connected).
    expect(renew).toHaveBeenCalledTimes(2);
    expect(sessions).toHaveLength(2);
    expect(log).toContain("s3:failed");
    expect(seen.remoteClose + seen.errors + seen.allowanceEnd + seen.talkEnd).toBe(0);
    ctl.stop();
  });

  it("a late mint is discarded: a slice that arrives after the end is never applied, and the talk has already ended calmly", async () => {
    const log: string[] = [];
    const { stream } = micStream();
    const { seen, handlers } = handlersFor();
    let n = 1;
    const renew = vi.fn(async () => { const k = ++n; return later(40_000, () => slice(k, T0 + 180_000, 1_020_000, log)); });
    await startGeminiLive(firstSlice(renew, log, stream), handlers);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(seen.talkEnd).toBe(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sessions).toHaveLength(1);
    expect(log).toEqual(expect.arrayContaining(["s2:failed", "s3:failed", "s4:failed"]));
    expect(seen.remoteClose + seen.errors + seen.allowanceEnd).toBe(0);
  });
});

describe("goAway: the provider announces the end of a socket", () => {
  const longSlice = (renew: LiveSessionOptionsRenew, log: string[], stream: MediaStream) => ({
    ...firstSlice(renew, log, stream), expiresAt: iso(T0 + 240_000), remainingMs: 900_000,
  });

  it("a goAway inside the renewal window starts the renewal at once and the swap lands before the announced end", async () => {
    const log: string[] = [];
    const { stream } = micStream();
    const { seen, handlers } = handlersFor();
    const renew = vi.fn(async () => slice(2, T0 + 720_000, 420_000, log));
    const ctl = await startGeminiLive(longSlice(renew, log, stream), handlers);
    await vi.advanceTimersByTimeAsync(180_000);
    expect(renew).not.toHaveBeenCalled();
    sessions[0].cb.onmessage({ goAway: { timeLeft: "20s" } });
    await vi.advanceTimersByTimeAsync(0);
    expect(renew).toHaveBeenCalledWith("u1");
    await vi.advanceTimersByTimeAsync(3_000);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].close).toHaveBeenCalled();
    expect(Date.now()).toBeLessThan(T0 + 200_000);
    expect(seen.remoteClose + seen.errors + seen.allowanceEnd + seen.talkEnd).toBe(0);
    ctl.stop();
  });

  it("if the socket closes while the next slice is still on its way, the talk holds and swaps when it arrives", async () => {
    const log: string[] = [];
    const { t, stream } = micStream();
    const { seen, handlers } = handlersFor();
    const renew = vi.fn(async () => later(8_000, () => slice(2, T0 + 720_000, 420_000, log)));
    const ctl = await startGeminiLive(longSlice(renew, log, stream), handlers);
    await vi.advanceTimersByTimeAsync(190_000);
    sessions[0].cb.onmessage({ goAway: { timeLeft: "5s" } });
    await vi.advanceTimersByTimeAsync(5_000);
    sessions[0].cb.onclose();
    expect(seen.phases[seen.phases.length - 1]).toBe("connecting");
    expect(t.stopped).toBe(false);
    await vi.advanceTimersByTimeAsync(4_000);
    expect(sessions).toHaveLength(2);
    expect(seen.phases[seen.phases.length - 1]).toBe("listening");
    expect(seen.remoteClose + seen.errors + seen.allowanceEnd + seen.talkEnd).toBe(0);
    ctl.stop();
  });

  it("a goAway before the renewal window can open ends the talk calmly when the socket closes — not a connection failure", async () => {
    const { stream } = micStream();
    const { seen, handlers } = handlersFor();
    const renew = vi.fn(async () => null);
    await startGeminiLive(longSlice(renew, [], stream), handlers);
    await vi.advanceTimersByTimeAsync(60_000);
    sessions[0].cb.onmessage({ goAway: { timeLeft: "10s" } });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(renew).not.toHaveBeenCalled(); // the server would refuse this early
    sessions[0].cb.onclose();
    expect(seen.talkEnd).toBe(1);
    expect(seen.remoteClose + seen.errors).toBe(0);
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
    await vi.advanceTimersByTimeAsync(31_000);
    expect(renew).toHaveBeenCalledTimes(1);
    expect(seen.allowanceEnd).toBe(0);
    await vi.advanceTimersByTimeAsync(29_000);
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
