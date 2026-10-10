/**
 * kidVoicePlayer — iOS Safari plays an <audio> element outside a gesture only
 * once that same element has played inside one. The child's first tap blesses
 * the two reused channels; every later page sets the src of the same element.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SILENT_WAV, blessKidVoice, installKidVoiceUnlock, kidVoiceBlessed, kidVoiceElement, resetKidVoiceForTest } from "./kidVoicePlayer";

class FakeAudio {
  static made = 0;
  src = "";
  paused = true;
  preload = "";
  attrs = new Map<string, string>();
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeupdate: (() => void) | null = null;
  constructor() { FakeAudio.made++; }
  setAttribute(k: string, v: string) { this.attrs.set(k, v); }
  play = vi.fn(() => { this.paused = false; return Promise.resolve(); });
  pause = vi.fn(() => { this.paused = true; });
}

const listeners = new Map<string, Set<() => void>>();
const doc = {
  addEventListener: vi.fn((t: string, fn: () => void) => { if (!listeners.has(t)) listeners.set(t, new Set()); listeners.get(t)!.add(fn); }),
  removeEventListener: vi.fn((t: string, fn: () => void) => { listeners.get(t)?.delete(fn); }),
};
const fire = (t: string) => { for (const fn of [...(listeners.get(t) ?? [])]) fn(); };

beforeEach(() => {
  FakeAudio.made = 0;
  listeners.clear();
  vi.stubGlobal("Audio", FakeAudio);
  vi.stubGlobal("document", doc);
  resetKidVoiceForTest();
});
afterEach(() => vi.unstubAllGlobals());

describe("kidVoicePlayer", () => {
  it("one reused element per channel", () => {
    expect(kidVoiceElement("page")).toBe(kidVoiceElement("page"));
    expect(kidVoiceElement("clip")).not.toBe(kidVoiceElement("page"));
    expect(FakeAudio.made).toBe(2);
  });
  it("the bless plays a valid silent WAV on both channels, un-muted, inside the gesture", async () => {
    expect(SILENT_WAV.startsWith("data:audio/wav;base64,UklGR")).toBe(true);
    blessKidVoice();
    const page = kidVoiceElement("page") as unknown as FakeAudio;
    const clip = kidVoiceElement("clip") as unknown as FakeAudio;
    expect(page.play).toHaveBeenCalledTimes(1);
    expect(clip.play).toHaveBeenCalledTimes(1);
    expect(page.src).toBe(SILENT_WAV);
    expect(kidVoiceBlessed()).toBe(true);
    await Promise.resolve();
    expect(page.pause).toHaveBeenCalled(); // the silence stops; a real page's src would not be paused
  });
  it("a page already playing when the bless lands is left alone", async () => {
    const page = kidVoiceElement("page") as unknown as FakeAudio;
    page.src = "blob:page-1";
    page.paused = false;
    blessKidVoice();
    expect(page.src).toBe("blob:page-1");
    expect(page.play).not.toHaveBeenCalled();
  });
  it("installed on open: the first tap blesses, then the listeners go; never on keydown", () => {
    const remove = installKidVoiceUnlock();
    expect(doc.addEventListener.mock.calls.map(([t]) => t).sort()).toEqual(["click", "pointerup", "touchend"]);
    fire("touchend");
    expect(kidVoiceBlessed()).toBe(true);
    expect([...listeners.values()].every((s) => s.size === 0)).toBe(true);
    remove();
  });
});
