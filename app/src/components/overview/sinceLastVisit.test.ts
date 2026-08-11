import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { buildSinceVisitRows, SINCE_VISIT_MAX_ROWS } from "./sinceVisitEvents";
import { en as svEn, he as svHe } from "../../lib/i18nElevation/sincevisit";

/**
 * W1 1.1 — SinceLastVisit acceptance (masterplan 2026-08-11 §3 · Maytal
 * Row-1 #1). Three layers:
 *   1. the pure row builder (filtering strictly after the previous visit,
 *      ≤3 rows, overflow math, priority order, the Rule-A noticed fold),
 *   2. the i18n module contract (en/he parity, namespacing, and the clinical
 *      firewall: EVENT language only — never comparative/trend wording),
 *   3. source-level structure: OverviewTab renders SinceLastVisit BEFORE the
 *      primary-action slot, deep-links rows, and instruments the strip.
 */

const T0 = Date.parse("2026-08-10T20:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();
const PREV = iso(T0);

const beh = (id: string, atMs: number) => ({ id, timestamp: iso(atMs) });
const play = (id: string, atMs: number) => ({ id, timestamp: iso(atMs) });
const ms = (title: string, checked: boolean, atMs?: number) => ({
  title,
  checked,
  observationUpdatedAt: atMs === undefined ? undefined : iso(atMs),
});
const convo = (id: string, atMs: number) => ({ id, updatedAt: iso(atMs) });

const EMPTY = { behaviorLogs: [], playLogs: [], milestones: [], conversations: [] };

describe("buildSinceVisitRows — filtering + aggregation", () => {
  it("no previous visit → no rows (the strip is returning-parents only)", () => {
    const r = buildSinceVisitRows({ ...EMPTY, previousVisitAt: null, behaviorLogs: [beh("a", T0 + 1)] });
    expect(r.rows).toEqual([]);
    expect(r.totalEvents).toBe(0);
  });

  it("only events STRICTLY after the previous visit count", () => {
    const r = buildSinceVisitRows({
      ...EMPTY,
      previousVisitAt: PREV,
      behaviorLogs: [beh("old", T0 - 1), beh("boundary", T0), beh("new", T0 + 60_000)],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ kind: "moments", count: 1, focusId: "moment-new" });
  });

  it("moments aggregate to ONE row carrying the NEWEST journal signal id", () => {
    const r = buildSinceVisitRows({
      ...EMPTY,
      previousVisitAt: PREV,
      behaviorLogs: [beh("a", T0 + 1000), beh("b", T0 + 9000), beh("c", T0 + 5000)],
    });
    expect(r.rows).toEqual([{ kind: "moments", at: T0 + 9000, count: 3, focusId: "moment-b" }]);
  });

  it("play rows carry the play- signal prefix (journal timeline deep-link)", () => {
    const r = buildSinceVisitRows({ ...EMPTY, previousVisitAt: PREV, playLogs: [play("p1", T0 + 2000)] });
    expect(r.rows[0]).toMatchObject({ kind: "plays", focusId: "play-p1" });
  });

  it("milestone crossings are title-specific rows and outrank the aggregates", () => {
    const r = buildSinceVisitRows({
      ...EMPTY,
      previousVisitAt: PREV,
      milestones: [ms("First steps", true, T0 + 3000), ms("Old news", true, T0 - 5000), ms("Unchecked", false, T0 + 3000)],
      behaviorLogs: [beh("a", T0 + 1000)],
    });
    expect(r.rows[0]).toMatchObject({ kind: "milestone", title: "First steps" });
    expect(r.rows[1]).toMatchObject({ kind: "moments" });
  });

  it("caps at 3 rows and reports hidden EVENTS for '+N more in Journal'", () => {
    const r = buildSinceVisitRows({
      previousVisitAt: PREV,
      milestones: [ms("A", true, T0 + 1), ms("B", true, T0 + 2)],
      behaviorLogs: [beh("m1", T0 + 3), beh("m2", T0 + 4)],
      playLogs: [play("p1", T0 + 5), play("p2", T0 + 6), play("p3", T0 + 7)],
      conversations: [convo("c1", T0 + 8)],
    });
    expect(r.rows).toHaveLength(SINCE_VISIT_MAX_ROWS);
    // milestone A + milestone B + moments(2) shown; plays(3) + convo(1) hidden.
    expect(r.totalEvents).toBe(2 + 2 + 3 + 1);
    expect(r.hiddenCount).toBe(4);
  });

  it("the Rule-A fold inserts the noticed row after milestones", () => {
    const r = buildSinceVisitRows({
      ...EMPTY,
      previousVisitAt: PREV,
      includeNoticedRow: true,
      milestones: [ms("First steps", true, T0 + 1)],
      behaviorLogs: [beh("a", T0 + 2)],
    });
    expect(r.rows.map((x) => x.kind)).toEqual(["milestone", "noticed", "moments"]);
  });

  it("conversations since the visit produce a row", () => {
    const r = buildSinceVisitRows({ ...EMPTY, previousVisitAt: PREV, conversations: [convo("c", T0 + 1)] });
    expect(r.rows).toEqual([{ kind: "conversations", at: T0 + 1, count: 1 }]);
  });
});

/* ── i18n module contract + clinical firewall ─────────────────────────────── */

// EVENT language only: comparative/trend wording is a firewall breach on a
// child-data surface ("more than last time" = a trend delta by inspection).
// The `u` flag keeps the emoji class from matching lone surrogate halves
// (without it, 📈's high surrogate also matches 👋's).
const BANNED_EN = /\bmore than\b|\bless than\b|\bfaster\b|\bslower\b|\bimproved\b|\bdeclined\b|\bbehind\b|\bahead of\b|\btrend\b|[↑↓📈📉]|\d+\s*%/iu;
const BANNED_HE = /יותר מ|פחות מ|מהר יותר|לאט יותר|שיפור|ירידה|מגמה|בפיגור/;

describe("i18nElevation/sincevisit — en/he records", () => {
  it("keys are namespaced, parity holds, and no value is empty", () => {
    expect(Object.keys(svEn).sort()).toEqual(Object.keys(svHe).sort());
    for (const [k, v] of [...Object.entries(svEn), ...Object.entries(svHe)]) {
      expect(k.startsWith("elev.sincevisit."), `${k} must be namespaced elev.sincevisit.*`).toBe(true);
      expect(v.trim().length, `${k} is empty`).toBeGreaterThan(0);
    }
  });

  it("both records interpolate the same {var} tokens per key", () => {
    const vars = (s: string) => (s.match(/\{[a-z]+\}/gi) ?? []).sort();
    for (const k of Object.keys(svEn)) {
      expect(vars(svHe[k]), `{var} mismatch on ${k}`).toEqual(vars(svEn[k]));
    }
  });

  it("clinical firewall: EVENT language only — no comparative/trend wording, no %", () => {
    for (const [k, v] of Object.entries(svEn)) expect(v, `en ${k} carries trend wording`).not.toMatch(BANNED_EN);
    for (const [k, v] of Object.entries(svHe)) expect(v, `he ${k} carries trend wording`).not.toMatch(BANNED_HE);
  });

  it("the mockup voice ships: the returning greeting + the since-visit title", () => {
    expect(svHe["elev.sincevisit.greeting"]).toContain("שמחנו לראות אותך שוב");
    expect(svHe["elev.sincevisit.title"]).toContain("חדש מאז הביקור האחרון");
    expect(svHe["elev.sincevisit.resume"]).toContain("ממשיכים מאיפה שהפסקנו");
  });
});

/* ── Source-level structure (house pattern: node env, source scans) ───────── */

const SRC_ROOT = path.resolve(__dirname, "..", "..");
function read(rel: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
}
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("OverviewTab wiring — the strip precedes the primary action (Rule A order)", () => {
  const overview = stripComments(read("components/tabs/OverviewTab.tsx"));
  const strip = stripComments(read("components/overview/SinceLastVisit.tsx"));

  it("SinceLastVisit renders BEFORE the primary-action slot", () => {
    const stripIdx = overview.indexOf("<SinceLastVisit");
    const primaryIdx = overview.indexOf("<TodayActionLoop");
    expect(stripIdx).toBeGreaterThan(-1);
    expect(primaryIdx).toBeGreaterThan(-1);
    expect(stripIdx).toBeLessThan(primaryIdx);
  });

  it("the strip is gated on the returning-parent state (useLastVisit two-slot)", () => {
    expect(overview).toContain("useLastVisit(childProfile)");
    expect(overview).toMatch(/showSinceStrip\s*&&/);
    expect(overview).toMatch(/previousVisitAt:\s*isReturning\s*\?\s*previousVisitAt\s*:\s*null/);
  });

  it("moment/play rows deep-link through the requestJournalFocus seam", () => {
    expect(overview).toMatch(/requestJournalFocus\(row\.focusId\)/);
  });

  it("the strip instruments render + row taps (KPI 0.8)", () => {
    expect(strip).toContain('track("sincevisit_shown"');
    expect(strip).toContain('track("sincevisit_row_tap"');
  });

  it("the strip carries the mounted continuity footer (today.intent.* now live)", () => {
    expect(strip).toContain('t("today.intent.remembers")');
    expect(strip).toContain('t("today.intent.memoryLine"');
  });

  it("no comparative/trend wording in the strip component itself (firewall)", () => {
    expect(strip).not.toMatch(BANNED_EN);
    expect(strip).not.toMatch(BANNED_HE);
  });

  it("day-0 keeps the lean shape: narrative and disclosure are dayZero-gated", () => {
    expect(overview).toMatch(/\{!dayZero\s*&&\s*\(\s*<ProgressNarrative/);
    expect(overview).toMatch(/dayZero\s*=/);
  });

  it("Rule A fold: ArborNoticedCard collapses into a strip row when Today is full", () => {
    expect(overview).toMatch(/\{!foldNoticed\s*&&\s*<ArborNoticedCard\s*\/>\}/);
    expect(overview).toMatch(/includeNoticedRow:\s*foldNoticed/);
  });
});
