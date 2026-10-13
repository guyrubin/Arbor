import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const seam = vi.hoisted(() => ({ allowed: true, context: null as unknown, hush: new Set<() => void>() }));
vi.mock("../../audio/kidAudio", () => ({ kidAudioAllowed: () => seam.allowed, kidAudioContext: () => seam.context, onKidHush: (fn: () => void) => { seam.hush.add(fn); return () => seam.hush.delete(fn); } }));
import { createExplorerAudio } from "./explorerAudio";

const sources: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; onended?: () => void }[] = [];
const listeners = new Map<string, () => void>();
const visibility = { visibilityState: "visible", addEventListener: vi.fn((name: string, fn: () => void) => listeners.set(name, fn)), removeEventListener: vi.fn((name: string) => listeners.delete(name)) };
const context = {
  currentTime: 7, destination: {}, resume: vi.fn(async () => undefined),
  decodeAudioData: vi.fn(async () => ({ duration: 0.3 })),
  createBufferSource: vi.fn(() => { const source = { start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(), connect: vi.fn(), buffer: null }; sources.push(source); return source; }),
  createGain: vi.fn(() => ({ gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() })),
};
beforeEach(() => {
  vi.clearAllMocks(); sources.length = 0; seam.allowed = true; seam.context = context; seam.hush.clear(); listeners.clear(); visibility.visibilityState = "visible";
  context.resume.mockImplementation(async () => undefined);
  vi.stubGlobal("document", visibility);
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })));
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("Sound Explorer lifecycle", () => {
  it("loads only once with no autoplay, then obeys the shared child/mute gate", async () => {
    const audio = createExplorerAudio();
    expect(await audio.load()).toBe(true); await audio.load();
    expect(fetch).toHaveBeenCalledTimes(3); expect(sources).toHaveLength(0);
    seam.allowed = false; expect(audio.play("bell")).toBe(false); expect(sources).toHaveLength(0);
    seam.allowed = true; expect(audio.play("steps")).toBe(true); expect(sources).toHaveLength(3);
    expect(sources.map(source => source.start.mock.calls[0][0])).toEqual([7, 7.32, 7.64]);
    audio.dispose();
  });
  it("stops all scheduled foley on hush, replacement, hidden tab and unmount", async () => {
    const audio = createExplorerAudio(); await audio.load(); audio.play("steps");
    for (const hush of seam.hush) hush();
    expect(sources.every(source => source.stop.mock.calls.length === 1)).toBe(true);
    audio.play("bell"); const bell = sources.at(-1)!; audio.play("landing"); expect(bell.stop).toHaveBeenCalledOnce();
    const landing = sources.at(-1)!; visibility.visibilityState = "hidden"; listeners.get("visibilitychange")!(); expect(landing.stop).toHaveBeenCalledOnce();
    visibility.visibilityState = "visible"; audio.play("bell"); const last = sources.at(-1)!; audio.dispose();
    expect(last.stop).toHaveBeenCalledOnce(); expect(seam.hush.size).toBe(0); expect(listeners.size).toBe(0); expect(audio.play("bell")).toBe(false);
  });
  it("fails quietly when files or browser audio are unavailable", async () => {
    seam.context = null; const unavailable = createExplorerAudio(); expect(await unavailable.load()).toBe(false); expect(unavailable.play("bell")).toBe(false); unavailable.dispose();
    seam.context = context; vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    const missing = createExplorerAudio(); expect(await missing.load()).toBe(false); expect(missing.play("steps")).toBe(false); missing.dispose();
  });
  it("does not revive the previous child's game after a delayed load", async () => {
    const pending: (() => void)[] = [];
    vi.stubGlobal("fetch", vi.fn(() => new Promise(resolve => pending.push(() => resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })))));
    const old = createExplorerAudio(), load = old.load(); old.dispose(); pending.forEach(resolve => resolve());
    expect(await load).toBe(false); expect(old.play("bell")).toBe(false); expect(sources).toHaveLength(0);
  });
  it("an older failed resume cannot stop a newer sound", async () => {
    const audio = createExplorerAudio(); await audio.load();
    let rejectOld!: (reason: Error) => void;
    context.resume.mockImplementationOnce(() => new Promise<undefined>((_, reject) => { rejectOld = reject; }));
    audio.play("steps"); audio.play("bell"); const bell = sources.at(-1)!;
    rejectOld(new Error("old resume failed")); await Promise.resolve();
    expect(bell.stop).not.toHaveBeenCalled(); audio.dispose();
  });
});
