/**
 * B-KID-73 — the ONE kid audio module: one voice path (queue + cancel), five
 * synthesised effects through ONE shared AudioContext (mocked here), ONE
 * per-child Sound setting that silences both, silent outside Kid Mode and in a
 * hidden tab, the context closed when Kid Mode closes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const voice = vi.hoisted(() => ({
  supported: true,
  engine: "basic" as "basic" | "natural",
  spoken: [] as { text: string; lang: string; onEnd?: () => void }[],
  stops: 0,
}));
vi.mock("../../../lib/voice", () => ({
  voiceSupported: () => voice.supported,
  speakText: (text: string, handlers: { onEnd?: () => void }, lang: string) => { voice.spoken.push({ text, lang, onEnd: handlers.onEnd }); return voice.spoken.length; },
  stopVoice: () => { voice.stops++; },
  voiceState: () => ({ speaking: false, engine: voice.engine }),
}));

import {
  KID_SFX_NOTES, closeKidAudio, isKidReadAloudMuted, kidAudioVisibility, kidHush, kidSay, kidSfx,
  resetKidAudioForTests, setKidAudioChild, setKidReadAloudMuted,
} from "./kidAudio";
import { en as kidsStoriesEn, he as kidsStoriesHe } from "../../../lib/i18nElevation/kidsStories";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => readFileSync(path.join(__dirname, ...p), "utf8");

class FakeParam { setValueAtTime = vi.fn(); exponentialRampToValueAtTime = vi.fn(); }
class FakeNode { connect = vi.fn(); start = vi.fn(); stop = vi.fn(); type = ""; frequency = new FakeParam(); gain = new FakeParam(); buffer: unknown = null; }
const ctxs: FakeCtx[] = [];
class FakeCtx {
  currentTime = 0; sampleRate = 8000; destination = {}; state = "running";
  oscillators: FakeNode[] = []; sources: FakeNode[] = [];
  closed = 0; suspended = 0; resumed = 0;
  constructor() { ctxs.push(this); }
  createOscillator() { const n = new FakeNode(); this.oscillators.push(n); return n; }
  createGain() { return new FakeNode(); }
  createBiquadFilter() { return new FakeNode(); }
  createBufferSource() { const n = new FakeNode(); this.sources.push(n); return n; }
  createBuffer(_c: number, len: number) { const d = new Float32Array(len); return { getChannelData: () => d }; }
  resume() { this.resumed++; return Promise.resolve(); }
  suspend() { this.suspended++; return Promise.resolve(); }
  close() { this.closed++; return Promise.resolve(); }
}

let hidden = false;
beforeEach(() => {
  resetKidAudioForTests();
  ctxs.length = 0;
  voice.spoken = []; voice.stops = 0; voice.supported = true; hidden = false;
  vi.stubGlobal("AudioContext", FakeCtx);
  vi.stubGlobal("navigator", { userActivation: { hasBeenActive: true } });
  vi.stubGlobal("document", { get visibilityState() { return hidden ? "hidden" : "visible"; } });
  vi.stubGlobal("localStorage", { store: {} as Record<string, string>, getItem(k: string) { return this.store[k] ?? null; }, setItem(k: string, v: string) { this.store[k] = v; } });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("voice: one path, a queue, cancel", () => {
  it("one line speaks once through the existing TTS, in the given language", () => {
    expect(kidSay("c1", "שלום", "he")).toBe(1);
    expect(voice.spoken.map((s) => [s.text, s.lang])).toEqual([["שלום", "he"]]);
  });
  it("a list is a queue: the next line starts when the previous ends", () => {
    kidSay("c1", ["Which way?", "The bridge", "The boat"], "en");
    expect(voice.spoken.map((s) => s.text)).toEqual(["Which way?"]);
    voice.spoken[0].onEnd!();
    voice.spoken[1].onEnd!();
    expect(voice.spoken.map((s) => s.text)).toEqual(["Which way?", "The bridge", "The boat"]);
  });
  it("navigation (kidHush) cancels the rest of the queue and stops the voice", () => {
    kidSay("c1", ["one", "two"], "en");
    kidHush();
    voice.spoken[0].onEnd!();
    expect(voice.spoken).toHaveLength(1);
    expect(voice.stops).toBe(1);
  });
  it("silent when Sound is off, before a gesture, in a hidden tab, or without speech", () => {
    setKidReadAloudMuted("c1", true);
    expect(kidSay("c1", "hi", "en")).toBe(0);
    setKidReadAloudMuted("c1", false);
    vi.stubGlobal("navigator", { userActivation: { hasBeenActive: false } });
    expect(kidSay("c1", "hi", "en")).toBe(0);
    vi.stubGlobal("navigator", { userActivation: { hasBeenActive: true } });
    hidden = true;
    expect(kidSay("c1", "hi", "en")).toBe(0);
    hidden = false;
    voice.supported = false;
    expect(kidSay("c1", "hi", "en")).toBe(0);
    expect(voice.spoken).toHaveLength(0);
  });

  it("B-BOOK-61: speaks through the neural engine on a device without speechSynthesis", () => {
    voice.supported = false;
    voice.engine = "natural";
    expect(kidSay("c1", "שלום", "he")).toBeGreaterThan(0);
    expect(voice.spoken.at(-1)).toMatchObject({ text: "שלום", lang: "he" });
    voice.engine = "basic";
    voice.supported = true;
  });
});

describe("effects: synthesised, one shared context", () => {
  it("silent (and no context) outside Kid Mode — the parent register never sounds", () => {
    kidSfx("tap");
    expect(ctxs).toHaveLength(0);
  });
  it("first effect creates ONE context; later effects reuse it", () => {
    setKidAudioChild("c1");
    kidSfx("tap"); kidSfx("correct"); kidSfx("finish");
    expect(ctxs).toHaveLength(1);
    expect(ctxs[0].oscillators).toHaveLength(KID_SFX_NOTES.tap.length + KID_SFX_NOTES.correct.length + KID_SFX_NOTES.finish.length);
  });
  it("page-turn is a filtered-noise swish (a buffer source, no oscillator)", () => {
    setKidAudioChild("c1");
    kidSfx("pageTurn");
    expect(ctxs[0].sources).toHaveLength(1);
    expect(ctxs[0].oscillators).toHaveLength(0);
  });
  it("soft and gentle: every cue is a sine/triangle at gain ≤ 0.14; try-again falls and is quieter than correct", () => {
    for (const notes of Object.values(KID_SFX_NOTES)) for (const n of notes) {
      expect(["sine", "triangle"]).toContain(n.type);
      expect(n.gain).toBeLessThanOrEqual(0.14);
      expect(n.dur).toBeLessThanOrEqual(0.3);
    }
    const t = KID_SFX_NOTES.tryAgain;
    expect(t[1].freq).toBeLessThan(t[0].freq);
    expect(Math.max(...t.map((n) => n.gain))).toBeLessThan(Math.min(...KID_SFX_NOTES.correct.map((n) => n.gain)));
  });
  it("Sound off silences effects too (the ONE per-child setting), and it persists", () => {
    setKidAudioChild("c1");
    setKidReadAloudMuted("c1", true);
    kidSfx("finish");
    expect(ctxs).toHaveLength(0);
    resetKidAudioForTests(); // a new session reads the stored value
    expect(isKidReadAloudMuted("c1")).toBe(true);
    expect(isKidReadAloudMuted("c2")).toBe(false);
  });
  it("a hidden tab plays nothing and pauses the context; visible resumes it", () => {
    setKidAudioChild("c1");
    kidSfx("tap");
    hidden = true;
    kidAudioVisibility(true);
    kidSfx("tap");
    expect(ctxs[0].suspended).toBe(1);
    expect(ctxs[0].oscillators).toHaveLength(1);
    expect(voice.stops).toBe(1);
    hidden = false;
    kidAudioVisibility(false);
    expect(ctxs[0].resumed).toBeGreaterThan(1);
  });
  it("closing Kid Mode closes the context and forgets the child", () => {
    setKidAudioChild("c1");
    kidSfx("tap");
    closeKidAudio();
    expect(ctxs[0].closed).toBe(1);
    kidSfx("tap");
    expect(ctxs).toHaveLength(1);
  });
  it("no audio support = silence, never a throw", () => {
    vi.stubGlobal("AudioContext", undefined);
    setKidAudioChild("c1");
    expect(() => kidSfx("finish")).not.toThrow();
  });
});

describe("wiring", () => {
  it("the Sound control is labelled EN + HE", () => {
    expect(kidsStoriesEn["kidAudio.sound"]).toBe("Sound");
    expect(kidsStoriesHe["kidAudio.sound"]).toMatch(/[\u0590-\u05FF]/);
  });
  it("the overlay owns the bus: child set while open, visibility pauses, close releases, every view's bar has the ONE Sound control", () => {
    const overlay = read("..", "KidModeOverlay.tsx");
    expect(overlay).toContain("setKidAudioChild(childProfile.id);");
    expect(overlay).toContain('document.addEventListener("visibilitychange", onVisibility);');
    expect(overlay).toContain("closeKidAudio();");
    expect(overlay).toContain("useEffect(() => { kidHush(); }, [view, arcadeWorldId]);");
    expect(overlay.match(/<KidSoundToggle /g)?.length).toBe(1);
  });
  it("Fable render: hear-it and Sound are different buttons — Sound at the far side by the exit, hear-it in the instruction bubble with its own glyph", () => {
    const overlay = read("..", "KidModeOverlay.tsx");
    const bar = overlay.slice(overlay.indexOf("data-kid-bar-title"), overlay.indexOf("</header>"));
    expect(bar).not.toContain("<KidHearItButton");
    // the Sound control is the last control before the grown-ups exit
    expect(bar).toMatch(/<KidSoundToggle [^>]*\/>\s*<HoldExitButton /);
    const ra = read("..", "kidReadAloud.tsx");
    const hear = ra.slice(ra.indexOf("export function KidHearItButton"));
    expect(hear).toContain('<Icon name="record_voice_over"');
    expect(hear).not.toContain("M4 9.5h3.5L12 5.5v13l-4.5-4H4z"); // not the speaker
    const toggle = ra.slice(ra.indexOf("export function KidSoundToggle"), ra.indexOf("export const KidReadAloudToggle"));
    expect(toggle).toContain("aria-pressed={!muted}");
    expect(toggle).toContain('data-muted={muted ? "" : undefined}');
    // at 375 px the title keeps >= 40 % of the bar: Home 44 + Sound 44 + exit
    // (56 px ring, "Back to parent" label <= 96 px) + 3 gaps of 8, padding 12 x 2
    const barWidth = 375 - 24;
    const title = barWidth - 44 - 44 - 96 - 3 * 8;
    expect(title / barWidth).toBeGreaterThanOrEqual(0.4);
    expect(overlay).toContain('gap: "8px"');
  });
  it("GameShell taps + finish, the reader's page turn, choice tiles, and ONE voice path", () => {
    const shell = read("..", "game", "GameShell.tsx");
    expect(shell).toContain("onPointerDownCapture={onGamePiecePointerDown}");
    expect(shell).toContain('kidSfx("finish")');
    expect(shell).toContain("autoReadPage(childId, instruction, lang)");
    const reader = read("..", "..", "tabs", "HeroJourneyTab.tsx");
    expect(reader.match(/kidSfx\("pageTurn"\)/g)?.length).toBe(2);
    // Guy, 10 Oct 2026: the legacy book reads its pages aloud again, and its
    // Decision page speaks the question and then each choice (B-KID-73).
    expect(reader).toContain("autoReadPage(childProfile.id, kidSpeech.split(");
    expect(reader).toContain("...choices.map((c) => c.label)].join(");
    const kit = read("..", "..", "ui", "playkit.tsx");
    expect(kit).toContain('if (state === "correct") kidSfx("correct");');
    expect(kit).toContain('else if (state === "wrong") kidSfx("tryAgain");');
    const ra = read("..", "kidReadAloud.tsx");
    expect(ra).toContain("return kidSay(childId, text, lang);");
    // no audio files: the module synthesises everything
    expect(read("kidAudio.ts")).not.toMatch(/\.(mp3|wav|ogg|m4a)\b|new Audio\(/);
  });
});
