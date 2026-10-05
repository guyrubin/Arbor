/**
 * B-GAME-08a — the file-based kid sound bank: manifest + clips decoded on the
 * ONE kid AudioContext (mocked), de-dupe, foley rate jitter, voice never
 * overlapping (count words cut, lines queue, max one queued), the kidAudio
 * gates (Kid Mode child, Sound, hidden tab), kidHush stopping the voice, and
 * failure tolerance (no manifest, a missing clip, a decode error).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/voice", () => ({ voiceSupported: () => true, speakText: () => 1, stopVoice: () => {} }));

import { kidHush, resetKidAudioForTests, setKidAudioChild, setKidReadAloudMuted } from "./kidAudio";
import { DEDUPE_MS, FOLEY_RATE_JITTER, clipUrl, createKidSoundBank, parseSoundManifest } from "./kidSoundBank";

class FakeSource {
  buffer: { duration: number; id: string } | null = null;
  playbackRate = { value: 1 };
  onended: (() => void) | null = null;
  started = 0;
  stopped = 0;
  connect = vi.fn();
  start() { this.started++; }
  stop() { this.stopped++; }
}
const ctxs: FakeCtx[] = [];
class FakeCtx {
  currentTime = 0; sampleRate = 8000; destination = {}; state = "running";
  sources: FakeSource[] = [];
  resumed = 0;
  failDecode = new Set<string>();
  constructor() { ctxs.push(this); }
  createBufferSource() { const s = new FakeSource(); this.sources.push(s); return s; }
  createGain() { return { gain: { value: 1 }, connect: vi.fn() }; }
  createBuffer() { return { duration: 0, id: "silent" }; }
  decodeAudioData(data: ArrayBuffer) {
    const id = new TextDecoder().decode(data);
    if (this.failDecode.has(id)) return Promise.reject(new Error("decode"));
    return Promise.resolve({ duration: 0.6, id });
  }
  resume() { this.resumed++; this.state = "running"; return Promise.resolve(); }
  suspend() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
}

const MANIFEST = { ext: "m4a", he: { n1: 600, n2: 600, freeze: 700, statue1: 1400, intro: 3000 }, en: { n1: 500 }, foley: { step1: 200, turn: 300, missing: 100 } };
const fetched: string[] = [];
function fetcher(files: Record<string, unknown>) {
  return async (url: string) => {
    fetched.push(url);
    if (!(url in files)) return { ok: false, json: async () => null, arrayBuffer: async () => new ArrayBuffer(0) };
    const body = files[url];
    return { ok: true, json: async () => body, arrayBuffer: async () => new TextEncoder().encode(String(body)).buffer as ArrayBuffer };
  };
}
const BASE = "/audio/kid/sneak";
const FILES: Record<string, unknown> = {
  [`${BASE}/manifest.json`]: MANIFEST,
  ...Object.fromEntries(Object.keys(MANIFEST.he).map((id) => [`${BASE}/he/${id}.m4a`, `he/${id}`])),
  ...Object.fromEntries(Object.keys(MANIFEST.en).map((id) => [`${BASE}/en/${id}.m4a`, `en/${id}`])),
  [`${BASE}/foley/step1.m4a`]: "foley/step1",
  [`${BASE}/foley/turn.m4a`]: "foley/turn",
  // foley/missing.m4a is listed in the manifest but absent (404)
};

let hidden = false;
let clock = 1000;
beforeEach(() => {
  resetKidAudioForTests();
  ctxs.length = 0;
  fetched.length = 0;
  hidden = false;
  clock = 1000;
  vi.stubGlobal("AudioContext", FakeCtx);
  vi.stubGlobal("navigator", { userActivation: { hasBeenActive: true } });
  vi.stubGlobal("document", { get visibilityState() { return hidden ? "hidden" : "visible"; } });
  vi.stubGlobal("localStorage", { store: {} as Record<string, string>, getItem(k: string) { return this.store[k] ?? null; }, setItem(k: string, v: string) { this.store[k] = v; } });
  setKidAudioChild("c1");
});
afterEach(() => { vi.unstubAllGlobals(); });

async function loaded(lang: "he" | "en" = "he", files = FILES, random = () => 0.5) {
  const bank = createKidSoundBank({ base: BASE, lang, fetcher: fetcher(files), random, now: () => clock });
  const ok = await bank.load();
  return { bank, ok, ctx: ctxs[0] };
}
const playedIds = (ctx: FakeCtx) => ctx.sources.filter((s) => s.started && s.buffer?.id !== "silent").map((s) => s.buffer?.id);

describe("manifest + files", () => {
  it("reads the manifest and fetches the kid language's voice and the foley — nothing else", async () => {
    const { bank, ok } = await loaded("he");
    expect(ok).toBe(true);
    expect(fetched).toContain(`${BASE}/manifest.json`);
    expect(fetched).toContain(`${BASE}/he/freeze.m4a`);
    expect(fetched).toContain(`${BASE}/foley/turn.m4a`);
    expect(fetched.some((u) => u.includes("/en/"))).toBe(false);
    expect(bank.has("freeze", "voice")).toBe(true);
    expect(bank.has("n1", "voice")).toBe(true);
    expect(bank.has("turn")).toBe(true);
    expect(clipUrl("/a/", "foley", "x", "wav")).toBe("/a/foley/x.wav");
  });

  it("validates the manifest: bad ext or shape = null; odd ids and durations dropped", () => {
    expect(parseSoundManifest(null)).toBeNull();
    expect(parseSoundManifest({ ext: "mp3", he: {} })).toBeNull();
    const m = parseSoundManifest({ ext: "wav", he: { n1: 500, "../x": 1, bad: "1" }, foley: { step1: 100 } });
    expect(m).toEqual({ ext: "wav", he: { n1: 500 }, en: {}, foley: { step1: 100 } });
  });

  it("failure-tolerant: no manifest, a missing clip and a decode error are silent, never a throw", async () => {
    const none = createKidSoundBank({ base: BASE, lang: "he", fetcher: fetcher({}) });
    await expect(none.load()).resolves.toBe(false);
    expect(none.play("n1", { kind: "voice" })).toBe(false);
    const thrower = createKidSoundBank({ base: BASE, lang: "he", fetcher: async () => { throw new Error("offline"); } });
    await expect(thrower.load()).resolves.toBe(false);
    const { bank } = await loaded();
    expect(bank.has("missing")).toBe(false);
    expect(bank.play("missing")).toBe(false);
    expect(bank.play("nope", { kind: "voice" })).toBe(false);
    // a decode error on one clip leaves the others playable
    vi.stubGlobal("AudioContext", class extends FakeCtx { constructor() { super(); this.failDecode.add("he/n2"); } });
    resetKidAudioForTests();
    setKidAudioChild("c1");
    ctxs.length = 0;
    const second = createKidSoundBank({ base: BASE, lang: "he", fetcher: fetcher(FILES) });
    await second.load();
    expect(second.has("n2", "voice")).toBe(false);
    expect(second.has("n1", "voice")).toBe(true);
  });

  it("no audio support: load still resolves, play is silent", async () => {
    vi.stubGlobal("AudioContext", undefined);
    const bank = createKidSoundBank({ base: BASE, lang: "he", fetcher: fetcher(FILES) });
    await expect(bank.load()).resolves.toBe(true);
    expect(() => bank.play("turn")).not.toThrow();
    expect(bank.play("turn")).toBe(false);
  });
});

describe("play", () => {
  it("de-dupes the same id inside ~60 ms, not after", async () => {
    const { bank, ctx } = await loaded();
    expect(bank.play("step1")).toBe(true);
    clock += DEDUPE_MS - 10;
    expect(bank.play("step1")).toBe(false);
    expect(bank.play("turn")).toBe(true); // other ids are independent
    clock += 20;
    expect(bank.play("step1")).toBe(true);
    expect(playedIds(ctx)).toEqual(["foley/step1", "foley/turn", "foley/step1"]);
  });

  it("foley gets a ±3 % random rate; voice plays at the asked rate", async () => {
    let r = 0;
    const { bank, ctx } = await loaded("he", FILES, () => r);
    bank.play("step1");
    clock += 100; r = 1;
    bank.play("step1", { rate: 1 });
    bank.play("n1", { kind: "voice", rate: 1 });
    const rates = ctx.sources.map((s) => s.playbackRate.value);
    expect(rates[0]).toBeCloseTo(1 - FOLEY_RATE_JITTER, 5);
    expect(rates[1]).toBeCloseTo(1 + FOLEY_RATE_JITTER, 5);
    expect(rates[2]).toBe(1);
  });

  it("voice never overlaps: a count word cuts the current line and drops the queue", async () => {
    const { bank, ctx } = await loaded();
    bank.play("statue1", { kind: "voice" });
    bank.play("intro", { kind: "voice" }); // queued behind statue1
    bank.play("n1", { kind: "voice", mode: "cut" });
    const [statue, n1] = ctx.sources;
    expect(statue.stopped).toBe(1);
    expect(n1.buffer?.id).toBe("he/n1");
    n1.onended?.();
    expect(playedIds(ctx)).toEqual(["he/statue1", "he/n1"]); // the queued intro was dropped
  });

  it("lines queue behind the current line, at most one (the newest wins), and start when it ends", async () => {
    const { bank, ctx } = await loaded();
    expect(bank.play("statue1", { kind: "voice" })).toBe(true);
    expect(bank.play("freeze", { kind: "voice" })).toBe(true);
    expect(bank.play("intro", { kind: "voice" })).toBe(true);
    expect(playedIds(ctx)).toEqual(["he/statue1"]);
    ctx.currentTime = 2;
    ctx.sources[0].onended?.();
    expect(playedIds(ctx)).toEqual(["he/statue1", "he/intro"]);
    // foley never waits for the voice
    bank.play("turn");
    expect(playedIds(ctx)).toEqual(["he/statue1", "he/intro", "foley/turn"]);
  });

  it("after a line has finished, the next line plays at once", async () => {
    const { bank, ctx } = await loaded();
    bank.play("n1", { kind: "voice" });
    ctx.currentTime = 5; // n1 (0.6 s) is long over, even if onended was missed
    bank.play("freeze", { kind: "voice" });
    expect(playedIds(ctx)).toEqual(["he/n1", "he/freeze"]);
  });
});

describe("the kid audio gates", () => {
  it("silent outside Kid Mode, with Sound off, and in a hidden tab", async () => {
    const { bank, ctx } = await loaded();
    setKidAudioChild(null);
    expect(bank.play("turn")).toBe(false);
    setKidAudioChild("c1");
    setKidReadAloudMuted("c1", true);
    expect(bank.play("turn")).toBe(false);
    setKidReadAloudMuted("c1", false);
    hidden = true;
    expect(bank.play("turn")).toBe(false);
    expect(playedIds(ctx)).toEqual([]);
  });

  it("kidHush (and turning Sound off) stops the voice clip and clears the queue", async () => {
    const { bank, ctx } = await loaded();
    bank.play("statue1", { kind: "voice" });
    bank.play("intro", { kind: "voice" });
    kidHush();
    expect(ctx.sources[0].stopped).toBe(1);
    ctx.sources[0].onended?.();
    expect(playedIds(ctx)).toEqual(["he/statue1"]);
    bank.play("freeze", { kind: "voice" });
    setKidReadAloudMuted("c1", true);
    expect(ctx.sources[1].stopped).toBe(1);
  });

  it("unlock resumes a suspended context inside the gesture; dispose stops and detaches", async () => {
    const { bank, ctx } = await loaded();
    ctx.state = "suspended";
    bank.unlock();
    expect(ctx.resumed).toBe(1);
    bank.play("statue1", { kind: "voice" });
    bank.dispose();
    expect(ctx.sources.find((s) => s.buffer?.id === "he/statue1")?.stopped).toBe(1);
    expect(bank.play("turn")).toBe(false);
  });

  it("the bank holds no file names of its own and never speaks through the device voice", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("./kidSoundBank.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/speakText|speechSynthesis|kidSay|createOscillator/);
  });
});
