/**
 * B-GAME-18 / B-BOOK-51 — the admin weekly rollup of Kid Mode play: per game
 * sittings, replays of sittings and families back within 7 days; per book
 * opened / finished; a cell about fewer than 5 families is hidden. Only
 * kid_mode events count; the egress projection keeps catalogue ids only; the
 * report carries no per-family row and no forbidden key.
 */
import { describe, expect, it } from "vitest";
import {
  buildCohortReport,
  buildKidPlayReport,
  KID_EVENT_PROP_ALLOWLIST,
  MIN_CELL_FAMILIES,
  projectEventProps,
  scanForbiddenKeys,
  summariseKidPlay,
  type CohortEventDoc,
  type CohortMetricsStore,
} from "./cohortMetrics";

const at = (day: number, hour = 10) => new Date(Date.UTC(2026, 9, day, hour)).toISOString(); // October 2026
const sit = (uid: string, day: number, game: string, replay = false): CohortEventDoc => ({ uid, event: "game_sitting", at: at(day), props: { game, replay, kid_mode: true } });
const book = (uid: string, day: number, event: "book_opened" | "book_finished", id = "five-smooth-stones"): CohortEventDoc => ({ uid, event, at: at(day), props: { book_id: id, lang: "en", hero: "own", kid_mode: true } });
const families = (n: number, prefix = "u") => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

describe("summariseKidPlay", () => {
  it("per game per week: sittings, replays, families back within 7 days", () => {
    const six = families(6);
    const events: CohortEventDoc[] = [
      ...six.map((u) => sit(u, 19, "puzzle")), // Mon 19 Oct, week 2026-W43
      sit("u0", 19, "puzzle", true), sit("u1", 19, "puzzle", true),
      sit("u0", 22, "puzzle"), // u0 back on a later day within 7 days
      sit("u1", 19, "puzzle", true), // same day: not a return
      sit("u2", 30, "puzzle"), // 11 days later: not within 7
    ];
    const r = summariseKidPlay(events);
    const w43 = r.games.find((g) => g.week === "2026-W43" && g.game === "puzzle")!;
    expect(w43).toEqual({ week: "2026-W43", game: "puzzle", hidden: false, families: 6, sittings: 10, replays: 3, returned7d: 1 });
  });
  it("a cell about fewer than 5 families is hidden: every number is null", () => {
    const r = summariseKidPlay(families(4).map((u) => sit(u, 19, "calm-builder")));
    expect(MIN_CELL_FAMILIES).toBe(5);
    expect(r.games).toEqual([{ week: "2026-W43", game: "calm-builder", hidden: true, families: null, sittings: null, replays: null, returned7d: null }]);
  });
  it("books: opened and finished per week, small cells hidden", () => {
    const five = families(5);
    const r = summariseKidPlay([
      ...five.map((u) => book(u, 20, "book_opened")),
      ...five.slice(0, 3).map((u) => book(u, 20, "book_finished")),
      book("x1", 20, "book_opened", "noahs-ark"),
    ]);
    expect(r.books).toContainEqual({ week: "2026-W43", book: "five-smooth-stones", hidden: false, families: 5, opened: 5, finished: 3 });
    expect(r.books).toContainEqual({ week: "2026-W43", book: "noahs-ark", hidden: true, families: null, opened: null, finished: null });
  });
  it("only Kid Mode events count", () => {
    const parent = families(6).map((u) => ({ ...sit(u, 19, "puzzle"), props: { game: "puzzle", replay: false } }));
    expect(summariseKidPlay(parent).games).toEqual([]);
  });
});

describe("egress and the report", () => {
  it("the projection keeps the kid allow-list for kid events only — never a child id or choice", () => {
    const raw = { game: "puzzle", replay: true, kid_mode: true, childId: ["child", "1780000000000"].join("-"), choiceId: "b", name: "Synthetic", score: 3, source: "ad" };
    expect(projectEventProps(raw, "game_sitting")).toEqual({ source: "ad", game: "puzzle", replay: true, kid_mode: true });
    expect(projectEventProps(raw, "session_open")).toEqual({ source: "ad" });
    for (const k of KID_EVENT_PROP_ALLOWLIST) expect(k).not.toMatch(/child|choice|name|score/i);
  });
  it("the cohort report carries kidPlay, with no forbidden key and no per-family row", async () => {
    const events = families(6).map((u) => sit(u, 19, "puzzle"));
    const store: CohortMetricsStore = { mode: "null", listRetentionRollups: async () => [], listEvents: async () => events };
    const report = await buildCohortReport(store, { since: at(1), now: new Date(at(28)) });
    expect(report.kidPlay.games).toHaveLength(1);
    expect(scanForbiddenKeys(report)).toEqual([]);
    expect(JSON.stringify(report.kidPlay)).not.toMatch(/"u\d"/);
  });
});

describe("buildKidPlayReport — the founder panel's narrow read", () => {
  it("returns the kid play summary only, Kid Mode events only, internal and demo families out", async () => {
    const events: CohortEventDoc[] = [
      ...families(6).map((u) => sit(u, 19, "puzzle")),
      sit("demo-uid", 19, "puzzle"), sit("internal-uid", 19, "puzzle"),
      { uid: "u0", event: "session_open", at: at(19), props: { source: "ad" } },
    ];
    const store: CohortMetricsStore = {
      mode: "null",
      listRetentionRollups: async () => [
        { uid: "demo-uid", cohort: "demo", firstSeen: "2026-10-01", activeDays: ["2026-10-19"], source: null, market: null },
        { uid: "internal-uid", cohort: "internal", firstSeen: "2026-10-01", activeDays: ["2026-10-19"], source: null, market: null },
      ],
      listEvents: async () => events,
    };
    const r = await buildKidPlayReport(store, { since: at(1), now: new Date(at(28)) });
    expect(Object.keys(r).sort()).toEqual(["generatedAt", "kidPlay", "scanned", "since"]);
    expect(r.kidPlay.games).toEqual([{ week: "2026-W43", game: "puzzle", hidden: false, families: 6, sittings: 6, replays: 0, returned7d: 0 }]);
    // wave-3 carry-over: `events` = scanned (6 kid sittings + 2 internal/demo + 1 session_open), `kept` = counted
    expect(r.scanned).toEqual({ events: 9, kept: 6, mode: "null" });
    expect(scanForbiddenKeys(r)).toEqual([]);
  });
});
