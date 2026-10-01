/**
 * B-TODAY-02 — the Smart Reminders preference store reads old shapes safely.
 *
 * The switches were guidance | milestone | weekly: `weekly` had no reader and
 * `milestone` gated the (now retired, B-SHELL-02) bell's monitoring rows while
 * its description promised celebrations. The taxonomy is guidance | moments.
 * A parent's stored legacy prefs must load without error, keep their
 * `guidance` choice, and carry no dead switch forward.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_PREFS, loadPrefs, savePrefs } from "./jitaiPrefs";

const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
};
const LS_KEY = "arbor.jitai.prefs";

describe("B-TODAY-02 — jitaiPrefs taxonomy + read-migration", () => {
  beforeEach(() => mem.clear());

  it("defaults: guidance + moments, both on, nothing else", () => {
    expect(Object.keys(DEFAULT_PREFS.types).sort()).toEqual(["guidance", "moments"]);
    expect(loadPrefs().types).toEqual({ guidance: true, moments: true });
  });

  it("a stored legacy {milestone:false, weekly:false} loads with no dead switch and defaults intact", () => {
    mem.set(LS_KEY, JSON.stringify({ types: { guidance: false, milestone: false, weekly: false }, quietStart: 22, quietEnd: 7 }));
    const p = loadPrefs();
    expect(p.types).toEqual({ guidance: false, moments: true });
    expect(p.types).not.toHaveProperty("milestone");
    expect(p.types).not.toHaveProperty("weekly");
    expect(p.types).not.toHaveProperty("notes");
    expect(p.quietStart).toBe(22);
  });

  it("round-trips the moments switch", () => {
    savePrefs({ ...DEFAULT_PREFS, types: { guidance: true, moments: false } });
    expect(loadPrefs().types.moments).toBe(false);
  });

  it("corrupt storage falls back to defaults", () => {
    mem.set(LS_KEY, "{not json");
    expect(loadPrefs().types).toEqual({ guidance: true, moments: true });
  });
});
