/**
 * Guy, 10 Oct 2026 ("it is not clear how to play"): the GO / STOP pad and the
 * floor arrows follow the rules' view. GO while the cat counts (or cannot see,
 * in its sunglasses); STOP from the ears' twitch through the look and the
 * verdict; nothing at the tag and the ending. The demonstration shows both.
 */
import { describe, expect, it } from "vitest";
import { signalOf } from "./SneakFreeze";
import { startSitting, step, view } from "./rules";
import type { SneakView } from "./rules";

const base = (): SneakView => view(startSitting({ seed: "signal", track: "A", level: 1, intro: false }));
const at = (patch: Partial<SneakView>, watcher: Partial<SneakView["watcher"]> = {}): SneakView => {
  const v = base();
  return { ...v, ...patch, watcher: { ...v.watcher, ...watcher } };
};

describe("Sneak & Freeze: the GO / STOP signal", () => {
  it("GO before the first hold and while the cat counts", () => {
    expect(signalOf(base())).toBe("go");
    expect(signalOf(at({ phase: "counting" }))).toBe("go");
    expect(signalOf(at({ phase: "waiting" }))).toBe("go");
  });
  it("STOP from the tell through the look and the verdict", () => {
    for (const phase of ["tell", "looking", "verdict"] as const) expect(signalOf(at({ phase })), phase).toBe("stop");
  });
  it("a fake turn is STOP while the ears twitch, GO once the cat laughs", () => {
    expect(signalOf(at({ phase: "fake" }, { pose: "tell" }))).toBe("stop");
    expect(signalOf(at({ phase: "fake" }, { pose: "laughing" }))).toBe("go");
  });
  it("the sunglasses make every phase GO (the cat cannot see)", () => {
    expect(signalOf(at({ phase: "looking" }, { sunglasses: true }))).toBe("go");
  });
  it("no signal at the tag or the ending", () => {
    expect(signalOf(at({ phase: "tagged" }))).toBeNull();
    expect(signalOf(at({ phase: "done", done: true }))).toBeNull();
  });
  it("the demonstration: GO while it counts, STOP from the tell", () => {
    let s = startSitting({ seed: "demo", track: "A", level: 1, intro: true });
    const seen = new Set<string>();
    for (let i = 0; i < 200 && s.phase === "intro"; i++) {
      const v = view(s);
      seen.add(`${v.demo}:${signalOf(v)}`);
      s = step(s, 50, { holding: false });
    }
    expect(seen.has("count:go")).toBe(true);
    expect(seen.has("look:stop")).toBe(true);
    expect([...seen].some((x) => x.startsWith("count:stop"))).toBe(false);
  });
});
