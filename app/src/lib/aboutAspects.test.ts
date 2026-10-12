/**
 * v3 F-CHILD-3 — lib/aboutAspects: the eight areas About {child} shows.
 *
 * Pins, with invented examples only (the repo is public):
 *  - the keyword placement in EN and HE (Hebrew particles, the exact-word
 *    "gan" forms, the first named area winning, a bare "night" NOT being a
 *    sleep word);
 *  - the date of each line (describe ledger → field stamp → onboarding day;
 *    undated lines rank after dated ones; nothing gets an invented date);
 *  - the newest kept line and the newest proposal per area;
 *  - interests and strengths both land in "strengths"; languages become the
 *    talking area's role rows;
 *  - toldSummary counts told areas and never a share of eight.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ChildProfile, MemoryReviewItem } from "../types";
import {
  ASPECT_ICONS,
  ASPECT_IDS,
  ASPECT_TONE,
  asAspectId,
  aspectOfDomain,
  aspectOfWords,
  buildAspects,
  isDated,
  isTold,
  receiptShows,
  RECEIPT_MS,
  toldSummary,
  waitingOffPage,
  type AspectId,
  type AspectReceipt,
  type AspectState,
} from "./aboutAspects";

const mem = (memoryId: string, fact: string, createdAt: string, extra: Partial<MemoryReviewItem> = {}): MemoryReviewItem => ({
  memoryId, childId: "child-a", status: "approved", fact, source: "chat", retention: "90d", createdAt, latestEventId: "", ...extra,
});
const of = (states: AspectState[], id: AspectId) => states.find((s) => s.id === id)!;
type P = Partial<ChildProfile>;

describe("the eight areas", () => {
  it("are the brief's eight, in order, each with a shipped glyph and an area tone", () => {
    expect([...ASPECT_IDS]).toEqual(["temper", "lang", "social", "routine", "sleep", "senses", "school", "strengths"]);
    const subset = new Set(readFileSync(path.resolve(__dirname, "../../public/fonts/material-symbols-rounded-subset.icons.txt"), "utf8")
      .split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#")));
    for (const id of ASPECT_IDS) {
      expect(subset.has(ASPECT_ICONS[id]), `${id} → ${ASPECT_ICONS[id]}`).toBe(true);
      expect(ASPECT_TONE[id], id).toBeTruthy();
    }
  });

  it("asAspectId accepts only the eight ids", () => {
    expect(asAspectId("lang")).toBe("lang");
    expect(asAspectId("strengths")).toBe("strengths");
    for (const bad of ["language", "LANG", "", null, undefined, 3, {}]) expect(asAspectId(bad)).toBeNull();
  });
});

describe("aspectOfWords — the area a line of the parent's words names", () => {
  it.each([
    ["Wakes up twice every night", "sleep"],
    ["Bedtime takes an hour", "sleep"],
    ["Mornings go smoother when the bag is packed the night before.", "routine"],
    ["Getting dressed is a negotiation", "routine"],
    ["Loud noises at birthday parties are hard", "senses"],
    ["Eats only pasta and rice", "senses"],
    ["Entering Bilingual Kindergarten this year", "school"],
    ["Asks for the same friend at every playdate", "social"],
    ["Tantrums when screen time ends", "temper"],
    ["Says new words every day", "lang"],
    ["Loves building towers", "strengths"],
  ] as const)("EN %j → %s", (words, id) => {
    expect(aspectOfWords(words)).toBe(id);
  });

  it("a bare 'night' is not a sleep word; 'at night' is", () => {
    expect(aspectOfWords("Packed the night before")).toBeNull();
    expect(aspectOfWords("Hard to settle at night")).toBe("sleep");
  });

  it.each([
    ["קשה לו להירדם", "sleep"],
    ["ומתעורר באמצע", "sleep"], // the particle ו is removed
    ["בבקרים הכול לוקח זמן", "routine"], // ב + בקרים
    ["אוכל רק פסטה", "senses"],
    ["בגן הוא משחק לבד", "school"], // an exact "gan" form
    ["אוהב לבנות מגדלים", "strengths"],
    ["מדבר בשתי שפות", "lang"],
    ["יש לו הרבה חברים", "social"],
    ["נרגע מהר עם חיבוק", "temper"],
  ] as const)("HE %j → %s", (words, id) => {
    expect(aspectOfWords(words)).toBe(id);
  });

  it("'gan' is matched as a whole word only; a word that merely starts with it is not school", () => {
    expect(aspectOfWords("גנב לו את הכדור")).toBeNull();
    expect(aspectOfWords("לגן")).toBe("school");
  });

  it("the first area the line names wins (sleep is checked before routine)", () => {
    expect(aspectOfWords("Bedtime routine takes an hour")).toBe("sleep");
  });

  it("a line that names no area is not placed", () => {
    expect(aspectOfWords("")).toBeNull();
    expect(aspectOfWords("   ")).toBeNull();
    expect(aspectOfWords("Blue is the colour of the week")).toBeNull();
  });

  it("aspectOfDomain maps only the domains with one clear area", () => {
    expect(aspectOfDomain("feelings")).toBe("temper");
    expect(aspectOfDomain("talking")).toBe("lang");
    expect(aspectOfDomain("playing")).toBe("social");
    expect(aspectOfDomain("family")).toBe("routine");
    expect(aspectOfDomain("thinking")).toBe("school");
    for (const d of ["body", "hands", "moving", "bogus", null]) expect(aspectOfDomain(d)).toBeNull();
  });
});

describe("buildAspects — the newest told line per area, with its day", () => {
  it("an empty profile: eight areas, none told; the count is zero (and nothing is 'of 8')", () => {
    const states = buildAspects({ profile: {} });
    expect(states.map((s) => s.id)).toEqual([...ASPECT_IDS]);
    expect(states.every((s) => !isTold(s) && s.pending === null)).toBe(true);
    expect(toldSummary(states)).toEqual({ told: 0, dated: true });
    expect(buildAspects({ profile: null })).toHaveLength(8);
  });

  it("languages become the talking area's role rows, dated by their stamp", () => {
    const profile: P = { languages: ["Hebrew", "English", "Arabic", " "], factsAsOf: { languages: "2026-06-01T10:00:00.000Z" } };
    const lang = of(buildAspects({ profile }), "lang");
    expect(lang.languages).toEqual({ home: "Hebrew", second: "English", others: ["Arabic"], date: "2026-06-01T10:00:00.000Z" });
    expect(lang.known).toBeNull();
    expect(isTold(lang) && isDated(lang)).toBe(true);
    expect(of(buildAspects({ profile }), "social").languages).toBeNull();
  });

  it("interests and strengths both land in 'strengths'; only a strength carries a 'Still true?' field", () => {
    const interest = of(buildAspects({ profile: { interests: ["Dinosaurs"], interestsUpdatedAt: "2026-05-01T10:00:00.000Z" } }), "strengths");
    expect(interest.known).toEqual({ words: "Dinosaurs", date: "2026-05-01T10:00:00.000Z", source: "profile" });
    const strength = of(buildAspects({ profile: { strengths: ["Patient with his sister"], factsAsOf: { strengths: "2026-04-01T10:00:00.000Z" } } }), "strengths");
    expect(strength.known).toEqual({ words: "Patient with his sister", date: "2026-04-01T10:00:00.000Z", source: "profile", factField: "strengths" });
  });

  it("the school setting is the school area; with no stamp it falls back to the onboarding day, else no date", () => {
    const stamped = of(buildAspects({ profile: { schoolContext: "City kindergarten", onboardingCompletedAt: "2026-02-01T10:00:00.000Z" } }), "school");
    expect(stamped.known).toEqual({ words: "City kindergarten", date: "2026-02-01T10:00:00.000Z", source: "profile", factField: "schoolContext" });
    const undated = buildAspects({ profile: { schoolContext: "City kindergarten" } });
    expect(of(undated, "school").known!.date).toBeNull();
    expect(toldSummary(undated)).toEqual({ told: 1, dated: false });
  });

  it("date precedence: the describe ledger's confirmedAt beats the field stamp; the ledger line is 'describe' with no field", () => {
    const profile: P = {
      challenges: ["Bedtime takes an hour"],
      factsAsOf: { challenges: "2026-01-01T10:00:00.000Z" },
      describedItems: [{ id: "d1", kind: "worry", words: "Bedtime takes an hour", since: "2026-08-20T10:00:00.000Z", source: "describe", confirmedAt: "2026-09-01T10:00:00.000Z" }],
    };
    expect(of(buildAspects({ profile }), "sleep").known).toEqual({ words: "Bedtime takes an hour", date: "2026-09-01T10:00:00.000Z", source: "describe" });
    const noLedger = { ...profile, describedItems: [] };
    expect(of(buildAspects({ profile: noLedger }), "sleep").known).toEqual({ words: "Bedtime takes an hour", date: "2026-01-01T10:00:00.000Z", source: "profile", factField: "challenges" });
  });

  it("a newer kept memory replaces an older line in its area; an older one does not; an undated one never beats a dated one", () => {
    const profile: P = { challenges: ["Bedtime takes an hour"], factsAsOf: { challenges: "2026-09-01T10:00:00.000Z" } };
    const newer = of(buildAspects({ profile, approved: [mem("m1", "Naps at noon now", "2026-10-05T10:00:00.000Z")] }), "sleep");
    expect(newer.known).toEqual({ words: "Naps at noon now", date: "2026-10-05T10:00:00.000Z", source: "memory", memoryId: "m1" });
    const older = of(buildAspects({ profile, approved: [mem("m0", "Naps at noon now", "2026-03-01T10:00:00.000Z")] }), "sleep");
    expect(older.known!.words).toBe("Bedtime takes an hour");
    const undated = of(buildAspects({ profile, approved: [mem("mx", "Naps at noon now", "")] }), "sleep");
    expect(undated.known!.words).toBe("Bedtime takes an hour");
  });

  it("memory is placed by its words first, then by its own domain; a line naming neither stays off About", () => {
    const states = buildAspects({
      profile: {},
      approved: [
        mem("a", "Asked to call grandma before dinner", "2026-10-01T10:00:00.000Z"), // "dinner" → senses
        mem("b", "Points at the bus and waits", "2026-10-01T10:00:00.000Z", { domains: ["talking"] }),
        mem("c", "Blue is the colour of the week", "2026-10-01T10:00:00.000Z"),
      ],
    });
    expect(of(states, "senses").known!.memoryId).toBe("a");
    expect(of(states, "lang").known!.memoryId).toBe("b");
    expect(states.filter((s) => s.known?.memoryId === "c")).toEqual([]);
  });

  it("memory text goes through the parent-words function before it is placed or shown", () => {
    const words = (fact: string) => fact.replace("exhibits sleep-onset difficulty", "takes a while to fall asleep");
    const sleep = of(buildAspects({ profile: {}, approved: [mem("m", "Noa exhibits sleep-onset difficulty", "2026-10-01T10:00:00.000Z")], words }), "sleep");
    expect(sleep.known!.words).toBe("Noa takes a while to fall asleep");
  });

  it("the newest proposal waits in its area; one that names no area is not placed", () => {
    const pending = [
      mem("p1", "Wakes up at five most days", "2026-10-02T10:00:00.000Z", { status: "pending" }),
      mem("p2", "Naps are shorter this week", "2026-10-06T10:00:00.000Z", { status: "pending" }),
      mem("p3", "Something about Tuesday", "2026-10-07T10:00:00.000Z", { status: "pending" }),
    ];
    const states = buildAspects({ profile: {}, pending });
    expect(of(states, "sleep").pending!.memoryId).toBe("p2");
    expect(states.filter((s) => s.pending).map((s) => s.id)).toEqual(["sleep"]);
    // a proposal is not a told line
    expect(isTold(of(states, "sleep"))).toBe(false);
    expect(toldSummary(states).told).toBe(0);
  });

  it("toldSummary counts told areas and says whether every told one is dated", () => {
    const states = buildAspects({
      profile: { languages: ["Hebrew"], schoolContext: "Gan Alon", strengths: ["Kind"], factsAsOf: { languages: "2026-06-01T10:00:00.000Z", schoolContext: "2026-06-01T10:00:00.000Z", strengths: "2026-06-01T10:00:00.000Z" } },
    });
    expect(toldSummary(states)).toEqual({ told: 3, dated: true });
    const one = buildAspects({ profile: { strengths: ["Kind"] } });
    expect(toldSummary(one)).toEqual({ told: 1, dated: false });
  });
});

/* v3 F-CHILD-3 review r1 — what About says about proposals it does not show,
   and how long a Confirm / No receipt stays. */
describe("waitingOffPage — a proposal no area shows waits on #/memory", () => {
  const pending = [
    mem("p1", "Wakes up at five most days", "2026-10-02T10:00:00.000Z", { status: "pending" }),
    mem("p2", "Naps are shorter this week", "2026-10-06T10:00:00.000Z", { status: "pending" }),
    mem("p3", "Something about Tuesday", "2026-10-07T10:00:00.000Z", { status: "pending" }),
  ];
  it("nothing pending, or every proposal shown in its area: nothing is waiting off the page", () => {
    expect(waitingOffPage(buildAspects({ profile: {} }), [])).toBe(false);
    const one = [pending[1]];
    expect(waitingOffPage(buildAspects({ profile: {}, pending: one }), one)).toBe(false);
  });
  it("a proposal that names no area, or an older one its area does not show, is waiting off the page", () => {
    const unplaced = [pending[2]];
    expect(waitingOffPage(buildAspects({ profile: {}, pending: unplaced }), unplaced)).toBe(true);
    const twoInSleep = [pending[0], pending[1]];
    expect(waitingOffPage(buildAspects({ profile: {}, pending: twoInSleep }), twoInSleep)).toBe(true);
  });
  it("it answers yes or no — never a count", () => {
    const states = buildAspects({ profile: {}, pending });
    expect(typeof waitingOffPage(states, pending)).toBe("boolean");
  });
});

describe("receiptShows — a Confirm / No receipt answers one proposal", () => {
  const kept: AspectReceipt = { kind: "kept", memoryId: "p1" };
  it("no receipt shows nothing", () => {
    expect(receiptShows(null, null)).toBe(false);
    expect(receiptShows(null, { memoryId: "p1" })).toBe(false);
  });
  it("it shows beside the proposal it answered (a failed write) and alone once that proposal left the area", () => {
    expect(receiptShows({ kind: "failed", memoryId: "p1" }, { memoryId: "p1" })).toBe(true);
    expect(receiptShows(kept, null)).toBe(true);
  });
  it("a different proposal in the area hides it at once", () => {
    expect(receiptShows(kept, { memoryId: "p2" })).toBe(false);
  });
  it("it clears itself after a few seconds; the card clears it when a different proposal arrives", () => {
    expect(RECEIPT_MS).toBeGreaterThanOrEqual(3000);
    expect(RECEIPT_MS).toBeLessThanOrEqual(10000);
    const card = readFileSync(path.join(__dirname, "..", "components", "about", "AspectCard.tsx"), "utf8");
    expect(card).toMatch(/setTimeout\(\(\) => setReceipt\(null\), RECEIPT_MS\)/);
    expect(card).toContain("return () => clearTimeout(timer);");
    expect(card).toMatch(/pendingId !== null && pendingId !== receipt\.memoryId\) setReceipt\(null\)/);
    expect(card).toContain("receiptShows(receipt, pending)");
    expect(card).toContain("setReceipt({ kind: ok ? (status === \"approved\" ? \"kept\" : \"leftOut\") : \"failed\", memoryId });");
  });
});
