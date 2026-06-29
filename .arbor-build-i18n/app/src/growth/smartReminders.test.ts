/**
 * AP-058 Smart Reminders — unit tests.
 *
 * Acceptance criteria tested:
 *  1. Max-2/day contract is enforced (ceiling gate).
 *  2. Quiet-hours logic (including midnight-wrap).
 *  3. Per-type toggle state machine (prefs round-trip).
 *  4. calmWindowOnly toggle persists.
 *  5. Default prefs: quietStart=21, quietEnd=8, all types on.
 *  6. FRAMING GATE: banned strings absent from SmartRemindersPanel source.
 *  7. Max-2 copy present in the SmartRemindersPanel source.
 *  8. Non-surveillance copy: "monitor"/"surveillance"/"watching" absent.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  loadPrefs,
  savePrefs,
  isInQuietHours,
  isUnderDailyCeiling,
  DEFAULT_PREFS,
  formatHour,
  type JitaiPrefs,
} from "./jitaiPrefs";

// ── Minimal localStorage stub ─────────────────────────────────────────────────
const LS: Record<string, string> = {};
beforeEach(() => {
  Object.keys(LS).forEach((k) => delete LS[k]);
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => LS[k] ?? null,
    setItem: (k: string, v: string) => { LS[k] = v; },
    removeItem: (k: string) => { delete LS[k]; },
    clear: () => Object.keys(LS).forEach((k) => delete LS[k]),
  });
});

// ── 1. Default prefs ──────────────────────────────────────────────────────────
describe("DEFAULT_PREFS", () => {
  it("quiet start defaults to 21 (9pm)", () => {
    expect(DEFAULT_PREFS.quietStart).toBe(21);
  });
  it("quiet end defaults to 8 (8am)", () => {
    expect(DEFAULT_PREFS.quietEnd).toBe(8);
  });
  it("all nudge types default to on", () => {
    expect(DEFAULT_PREFS.types.guidance).toBe(true);
    expect(DEFAULT_PREFS.types.milestone).toBe(true);
    expect(DEFAULT_PREFS.types.weekly).toBe(true);
  });
  it("calmWindowOnly defaults to false", () => {
    expect(DEFAULT_PREFS.calmWindowOnly).toBe(false);
  });
});

// ── 2. Prefs round-trip ───────────────────────────────────────────────────────
describe("loadPrefs / savePrefs round-trip", () => {
  it("returns defaults when no stored value", () => {
    const p = loadPrefs();
    expect(p.quietStart).toBe(21);
    expect(p.quietEnd).toBe(8);
    expect(p.types.guidance).toBe(true);
  });

  it("persists a toggled type", () => {
    const p = loadPrefs();
    p.types.milestone = false;
    savePrefs(p);
    const reloaded = loadPrefs();
    expect(reloaded.types.milestone).toBe(false);
    expect(reloaded.types.guidance).toBe(true); // unchanged
  });

  it("persists quiet-hours change", () => {
    const p = loadPrefs();
    p.quietStart = 22;
    p.quietEnd = 7;
    savePrefs(p);
    const reloaded = loadPrefs();
    expect(reloaded.quietStart).toBe(22);
    expect(reloaded.quietEnd).toBe(7);
  });

  it("persists calmWindowOnly toggle", () => {
    const p = loadPrefs();
    p.calmWindowOnly = true;
    savePrefs(p);
    const reloaded = loadPrefs();
    expect(reloaded.calmWindowOnly).toBe(true);
  });
});

// ── 3. Quiet-hours gate ───────────────────────────────────────────────────────
function msAt(h: number) {
  return new Date(2026, 5, 17, h, 0, 0).getTime();
}

describe("isInQuietHours", () => {
  const prefs: JitaiPrefs = { ...DEFAULT_PREFS, types: { ...DEFAULT_PREFS.types }, quietStart: 21, quietEnd: 8 };

  it("blocks at 22:00 (inside 21–08 window)", () => {
    expect(isInQuietHours(prefs, msAt(22))).toBe(true);
  });
  it("blocks at 00:00 (midnight, inside wrap-around window)", () => {
    expect(isInQuietHours(prefs, msAt(0))).toBe(true);
  });
  it("blocks at 07:00 (inside 21–08 window)", () => {
    expect(isInQuietHours(prefs, msAt(7))).toBe(true);
  });
  it("allows at 08:00 (quiet end boundary, exclusive)", () => {
    expect(isInQuietHours(prefs, msAt(8))).toBe(false);
  });
  it("allows at 10:00 (well outside quiet window)", () => {
    expect(isInQuietHours(prefs, msAt(10))).toBe(false);
  });
  it("allows at 20:00 (just before quiet start)", () => {
    expect(isInQuietHours(prefs, msAt(20))).toBe(false);
  });
  it("blocks at 21:00 (quiet start boundary, inclusive)", () => {
    expect(isInQuietHours(prefs, msAt(21))).toBe(true);
  });

  it("handles simple (non-wrap) range like quietStart=1, quietEnd=6", () => {
    const p: JitaiPrefs = { ...prefs, quietStart: 1, quietEnd: 6 };
    expect(isInQuietHours(p, msAt(3))).toBe(true);
    expect(isInQuietHours(p, msAt(0))).toBe(false);
    expect(isInQuietHours(p, msAt(7))).toBe(false);
  });
});

// ── 4. Max-2/day contract ─────────────────────────────────────────────────────
describe("isUnderDailyCeiling (max 2/day contract)", () => {
  it("allows 0 sent", () => {
    expect(isUnderDailyCeiling(0)).toBe(true);
  });
  it("allows 1 sent", () => {
    expect(isUnderDailyCeiling(1)).toBe(true);
  });
  it("blocks at 2 sent (ceiling reached)", () => {
    expect(isUnderDailyCeiling(2)).toBe(false);
  });
  it("blocks at 3 sent", () => {
    expect(isUnderDailyCeiling(3)).toBe(false);
  });
});

// ── 5. formatHour helper ──────────────────────────────────────────────────────
describe("formatHour", () => {
  it("formats midnight as 12:00 am", () => {
    expect(formatHour(0)).toBe("12:00 am");
  });
  it("formats 9am", () => {
    expect(formatHour(9)).toBe("9:00 am");
  });
  it("formats noon as 12:00 pm", () => {
    expect(formatHour(12)).toBe("12:00 pm");
  });
  it("formats 21 (9pm)", () => {
    expect(formatHour(21)).toBe("9:00 pm");
  });
  it("formats 8 (8am)", () => {
    expect(formatHour(8)).toBe("8:00 am");
  });
});

// ── 6. Framing gate: banned copy absent from SmartRemindersPanel ──────────────
describe("SmartRemindersPanel framing gate (source-level)", () => {
  // Read the panel source directly — this test fails a build if banned strings
  // are introduced into the settings copy.
  let panelSource: string;
  try {
    panelSource = readFileSync(
      path.join(process.cwd(), "src/components/sections/SmartRemindersPanel.tsx"),
      "utf8",
    );
  } catch {
    panelSource = "";
  }

  it("panel source file is present", () => {
    expect(panelSource.length).toBeGreaterThan(0);
  });

  // Banned terms from advisory-tension gate (AP-058 BINDING CLINICAL FRAMING).
  // "monitor" as a standalone word in copy strings (comments and the word "monitoring" inside
  // variable names/keys are acceptable — the guard targets user-visible copy strings).
  // We check for the banned phrasing as it would appear in JSX string content / i18n keys.
  it('i18n keys do not contain "monitor" as copy (surveillance framing)', () => {
    // Pull only i18n key name strings (the "sr.xxx" namespace) from the source
    const i18nKeys = panelSource.match(/"sr\.[^"]+"/g) ?? [];
    const badKeys = i18nKeys.filter((k) => /monitor/i.test(k));
    expect(badKeys).toHaveLength(0);
  });

  it('source does not hardcode "surveillance" in any JSX string', () => {
    // Check string literals for the word surveillance
    const stringLiterals = panelSource.match(/"[^"]*surveillance[^"]*"/gi) ?? [];
    expect(stringLiterals).toHaveLength(0);
  });

  it('source does not hardcode "watching your child" / "track your child"', () => {
    const banned = /watching\s+your\s+child|track\s+your\s+child/i;
    expect(banned.test(panelSource)).toBe(false);
  });
});

// ── 7. Max-2 copy gate: "max 2" or equivalent present in i18n keys ────────────
describe("Max-2/day contract visible in i18n keys", () => {
  let i18nSource: string;
  try {
    i18nSource = readFileSync(
      path.join(process.cwd(), "src/lib/i18n.ts"),
      "utf8",
    );
  } catch {
    i18nSource = "";
  }

  it("i18n.ts contains the sr.max2 contract key", () => {
    expect(i18nSource).toContain('"sr.max2"');
  });

  it("sr.max2 EN value mentions max 2 per day", () => {
    const match = i18nSource.match(/"sr\.max2":\s*"([^"]+)"/);
    expect(match).not.toBeNull();
    // The value must mention "2" and "day" (or equivalent)
    const val = match?.[1] ?? "";
    expect(/2/.test(val)).toBe(true);
    expect(/day/i.test(val)).toBe(true);
  });
});

// ── 8. Non-surveillance copy in i18n sr.* keys ────────────────────────────────
describe("Smart Reminders i18n keys pass framing gate", () => {
  let i18nSource: string;
  try {
    i18nSource = readFileSync(
      path.join(process.cwd(), "src/lib/i18n.ts"),
      "utf8",
    );
  } catch {
    i18nSource = "";
  }

  // Extract all sr.* key-value pairs from the EN dict section.
  function extractSrValues(src: string): string[] {
    const matches = src.matchAll(/"sr\.[^"]+"\s*:\s*"([^"]+)"/g);
    return [...matches].map((m) => m[1]);
  }

  it('sr.* EN values do not contain "monitor" (surveillance framing)', () => {
    const vals = extractSrValues(i18nSource);
    const bad = vals.filter((v) => /\bmonitor\b/i.test(v));
    expect(bad).toHaveLength(0);
  });

  it('sr.* EN values do not contain "surveillance"', () => {
    const vals = extractSrValues(i18nSource);
    const bad = vals.filter((v) => /surveillance/i.test(v));
    expect(bad).toHaveLength(0);
  });

  it('sr.* EN values do not imply "more reminders = better development"', () => {
    const vals = extractSrValues(i18nSource);
    const bad = vals.filter((v) => /more reminders.*(improve|better|boost|develop)/i.test(v));
    expect(bad).toHaveLength(0);
  });
});
