import { describe, expect, it } from "vitest";
import { translate } from "../i18n";
import { ALL_MILESTONES } from "../milestoneData";
import { DOMAIN_IDS, DEVELOPMENTAL_DOMAIN_IDS, VOCAB_IDS, toDomains, type DomainId } from "../domains/registry";
import { toObservations, type Observation, type ObservationOrigin, type ObservationValue } from "../observations";
import { BODY_ONLY_SHELF, SHELVES, SHELF_IDS, milestoneShelf, shelfDef, shelfLabel, shelfOf, shelvesOfDomain, type ShelfId } from "./registry";

/**
 * B-LOOP-03 — nine parent shelves over the eight registry domains.
 *  1) shape: every domain has ≥1 shelf, every shelf exactly one domain, body two.
 *  2) shelfOf, TABLE-DRIVEN over every ObservationOrigin × domain set that
 *     lib/observations.ts actually produces (read from its builders): each
 *     resolves — ZERO throws; the body-only cases (no sleep/feeding signal)
 *     file under `food` = "Body, food & growth" (framer ruling (d), 6 Oct).
 *  3) milestoneShelf over every catalogue row; the tagged rows.
 *  4) EN + HE labels for all nine.
 */

const ordered = (doms: readonly DomainId[]): DomainId[] => DOMAIN_IDS.filter((d) => doms.includes(d));
type Case = { origin: ObservationOrigin; domains: DomainId[]; subArea?: string; value: ObservationValue; expect: ShelfId | "throws" };

const DOMAIN_SHELF: Record<DomainId, ShelfId | "throws"> = {
  talking: "words", moving: "moving", hands: "hands", thinking: "school",
  playing: "play", feelings: "feelings", body: "food", family: "family",
};
const firstNonBody = (doms: DomainId[]): ShelfId | "throws" => {
  const d = doms.find((x) => x !== "body");
  if (d) return DOMAIN_SHELF[d];
  return doms.includes("body") ? "food" : "throws";
};

/** Every origin × domain combination the read model's builders produce. */
function producedCases(): Case[] {
  const cases: Case[] = [];
  const moment = (behaviorType: string): ObservationValue => ({ type: "moment", behaviorType });
  // behaviorLogs: toDomains("behavior", type), unknown types → ["feelings"]
  for (const type of VOCAB_IDS.behavior) {
    const doms = ordered(toDomains("behavior", type));
    const special = type === "Sleep Meltdown" ? "sleep" : type === "Food Refusal" ? "food" : null;
    cases.push({ origin: "behaviorLogs", domains: doms, value: moment(type), expect: special ?? firstNonBody(doms) });
  }
  cases.push({ origin: "behaviorLogs", domains: ["feelings"], value: moment("Something new"), expect: "feelings" });
  // milestones + keepsakes: toDomains("developmental", every DevelopmentalDomainId); an untagged custom row
  for (const id of DEVELOPMENTAL_DOMAIN_IDS) {
    const doms = ordered(toDomains("developmental", id));
    cases.push({ origin: "milestones", domains: doms, value: { type: "milestone", milestoneId: `ms-custom-${id}`, title: "x" }, expect: firstNonBody(doms) });
    cases.push({ origin: "keepsakes", domains: doms, value: { type: "keepsake", milestoneId: `ms-custom-${id}`, note: "x" }, expect: firstNonBody(doms) });
  }
  // a noticed catalogue feeding row → food even though its domain is hands
  cases.push({ origin: "milestones", domains: ["hands"], value: { type: "milestone", milestoneId: "asha-feed-12m", title: "x" }, expect: "food" });
  cases.push({ origin: "keepsakes", domains: ["hands"], value: { type: "keepsake", milestoneId: "cdc-15m-8", note: "x" }, expect: "food" });
  // growthEntries: ["body"], growth_measurements
  cases.push({ origin: "growthEntries", domains: ["body"], subArea: "growth_measurements", value: { type: "measurement", heightCm: 90 }, expect: "food" });
  // langObs / speechAttempts: talking
  cases.push({ origin: "langObs", domains: ["talking"], subArea: "expressive", value: { type: "word", language: "he", phrase: "x" }, expect: "words" });
  cases.push({ origin: "speechAttempts", domains: ["talking"], subArea: "speech_sounds", value: { type: "practice", activity: "speech:s" }, expect: "words" });
  // goalObservations + playLogs: toDomains("play", id); fine-motor activity → hands
  for (const id of VOCAB_IDS.play) {
    const doms = ordered(toDomains("play", id));
    cases.push({ origin: "goalObservations", domains: doms, value: { type: "goal_note", goalId: "g", text: "x" }, expect: firstNonBody(doms) });
    cases.push({ origin: "playLogs", domains: doms, value: { type: "play", activityId: "a", title: "x" }, expect: firstNonBody(doms) });
  }
  cases.push({ origin: "playLogs", domains: ordered(toDomains("play", "motor", { activityId: "motor-peg-drop" })), value: { type: "play", activityId: "motor-peg-drop", title: "x" }, expect: "hands" });
  // screenings: each screen id, and the union of all of them
  const screenAll = new Set<DomainId>();
  for (const id of VOCAB_IDS.screen) {
    const doms = ordered(toDomains("screen", id));
    doms.forEach((d) => screenAll.add(d));
    cases.push({ origin: "screenings", domains: doms, value: { type: "check", bandId: "b" }, expect: firstNonBody(doms) });
  }
  cases.push({ origin: "screenings", domains: ordered([...screenAll]), value: { type: "check", bandId: "b" }, expect: firstNonBody(ordered([...screenAll])) });
  // practiceEvents + missionRecords: toDomains("practice", id)
  for (const id of VOCAB_IDS.practice) {
    const doms = ordered(toDomains("practice", id));
    cases.push({ origin: "practiceEvents", domains: doms, value: { type: "practice", activity: "k" }, expect: firstNonBody(doms) });
    cases.push({ origin: "missionRecords", domains: doms, value: { type: "practice", activity: "mission:m" }, expect: firstNonBody(doms) });
  }
  cases.push({ origin: "mimicSessions", domains: ["hands", "playing"], value: { type: "practice", activity: "mimic:p" }, expect: "hands" });
  cases.push({ origin: "adventureResults", domains: ["thinking"], value: { type: "practice", activity: "adventure:s" }, expect: "school" });
  // memory: any registry domain (B-GROWTH-29 answer domains), one at a time, plus body with another domain
  for (const d of DOMAIN_IDS) cases.push({ origin: "memory", domains: [d], value: { type: "fact", fact: "x" }, expect: DOMAIN_SHELF[d] });
  cases.push({ origin: "memory", domains: ["body", "family"], value: { type: "fact", fact: "x" }, expect: "family" });
  return cases;
}

describe("B-LOOP-03 — the shelf registry shape", () => {
  it("nine shelves, unique ids, order 1…9, labelKey elev.shelves.<id>, an illustration key each", () => {
    expect(SHELF_IDS).toEqual(["sleep", "food", "words", "feelings", "play", "moving", "hands", "school", "family"]);
    expect(SHELVES.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const s of SHELVES) {
      expect(s.labelKey).toBe(`elev.shelves.${s.id}`);
      expect(s.illustrationKey).toBe(`shelf.${s.id}`);
    }
  });

  it("every DomainId has ≥1 shelf; every shelf maps to exactly one registry domain; body carries Sleep and Food", () => {
    for (const d of DOMAIN_IDS) expect(shelvesOfDomain(d).length, d).toBeGreaterThanOrEqual(1);
    for (const s of SHELVES) expect(DOMAIN_IDS.filter((d) => d === s.domain), s.id).toHaveLength(1);
    expect(shelvesOfDomain("body")).toEqual(["sleep", "food"]);
    expect(shelfDef("sleep").subAreas).toEqual(["sleep"]);
  });

  it("a shelf carries no profession, score or verdict field (names only)", () => {
    for (const s of SHELVES) {
      // framer ruling 6 Oct: + glyph / tint (the Material Symbols map, DATA; never a verdict)
      for (const key of Object.keys(s)) expect(["id", "domain", "subAreas", "labelKey", "order", "illustrationKey", "glyph", "tint"], `${s.id}.${key}`).toContain(key);
    }
  });

  it("framer ruling: every shelf has a glyph in the shipped icon subset and an allowed tint; no two shelves share glyph + tint", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const subset = new Set(fs.readFileSync(path.resolve(__dirname, "../../../public/fonts/material-symbols-rounded-subset.icons.txt"), "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#")));
    const pairs = new Set<string>();
    for (const s of SHELVES) {
      expect(subset.has(s.glyph), `${s.id} glyph ${s.glyph}`).toBe(true);
      expect(["sky", "yellow", "lav", "pink", "green", "peach", "deep"]).toContain(s.tint);
      expect(pairs.has(`${s.glyph}|${s.tint}`), `${s.id} repeats a glyph + tint`).toBe(false);
      pairs.add(`${s.glyph}|${s.tint}`);
    }
  });
});

describe("B-LOOP-03 — shelfOf, every ObservationOrigin × domain the read model produces", () => {
  const cases = producedCases();
  const origins: ObservationOrigin[] = ["behaviorLogs", "milestones", "keepsakes", "growthEntries", "langObs", "goalObservations", "screenings", "playLogs", "speechAttempts", "practiceEvents", "mimicSessions", "adventureResults", "missionRecords", "memory"];

  it("the table covers every ObservationOrigin", () => {
    expect(new Set(cases.map((c) => c.origin))).toEqual(new Set(origins));
  });

  it("every combination resolves to its bound shelf (zero throws)", () => {
    const failures: string[] = [];
    cases.forEach((c, i) => {
      const o = { id: `case-${i}`, origin: c.origin, domains: c.domains, value: c.value, ...(c.subArea ? { subArea: c.subArea } : {}) };
      let got: string;
      try {
        got = shelfOf(o);
      } catch {
        got = "throws";
      }
      if (got !== c.expect) failures.push(`${c.origin} × ${c.domains.join("+")} (${JSON.stringify(c.value).slice(0, 60)}): got ${got}, want ${c.expect}`);
    });
    expect(failures).toEqual([]);
  });

  it("nothing is off the shelves: no case expects a throw; body-only records file under Body, food & growth (framer ruling (d), REJECTIONS.md)", () => {
    expect(cases.filter((c) => c.expect === "throws")).toEqual([]);
    const bodyOnly = cases.filter((c) => c.domains.length === 1 && c.domains[0] === "body" && !c.subArea && c.value.type !== "moment");
    expect(bodyOnly.map((c) => c.origin).sort()).toEqual(["keepsakes", "memory", "milestones"]);
    for (const c of bodyOnly) expect(c.expect, c.origin).toBe("food");
    expect(BODY_ONLY_SHELF).toBe("food");
  });

  it("the read model derives the shelf at build time and always sets one", () => {
    const at = "2026-10-01T10:00:00.000Z";
    const obs = toObservations({
      behaviorLogs: [{ id: "b1", behaviorType: "Sleep Meltdown", timestamp: at } as never],
      growthEntries: [{ id: "g1", date: at, heightCm: 90 } as never],
      langObs: [{ id: "w1", timestamp: at, language: "he", phrase: "אבא" } as never],
      memoryFacts: [{ id: "f1", fact: "x", at, domains: ["body"] }, { id: "f2", fact: "y", at, domains: ["family"] }],
    }, { id: "child-1" });
    const by = (id: string): Observation => obs.find((o) => o.id === id)!;
    expect(by("behaviorLogs:b1").shelf).toBe("sleep");
    expect(by("growthEntries:g1").shelf).toBe("food");
    expect(by("langObs:w1").shelf).toBe("words");
    expect(by("memory:f2").shelf).toBe("family");
    // body-only fact: on the record (domain counts unchanged) AND on Body, food & growth
    expect(by("memory:f1").domains).toEqual(["body"]);
    expect(by("memory:f1").shelf).toBe("food");
    for (const o of obs) expect(o.shelf, o.id).toBeDefined();
  });
});

describe("B-LOOP-03 — milestoneShelf over the catalogue", () => {
  it("every catalogue row resolves to exactly one shelf", () => {
    for (const m of ALL_MILESTONES) expect(SHELF_IDS, m.id).toContain(milestoneShelf(m));
  });

  it("the tagged rows: six feeding rows on Body, food & growth (the fork row among them; cdc-60m-12 retired B-LOOP-14 r2), one fine-motor row on Hands, no sleep row in the catalogue", () => {
    const tagged = ALL_MILESTONES.filter((m) => m.tags?.length).map((m) => `${m.id}:${m.tags!.join(",")}`);
    expect(tagged.sort()).toEqual(["asha-feed-12m:feeding", "asha-feed-24m:feeding", "asha-feed-9m:feeding", "cdc-15m-8:feeding", "cdc-18m-9:feeding", "cdc-36m-11:feeding", "cdc-36m-9:fine_motor"]);
    for (const m of ALL_MILESTONES.filter((x) => x.tags?.includes("feeding"))) expect(milestoneShelf(m), m.id).toBe("food");
  });

  it("B-LOOP-01 (split): the three fused 3-year skills are three rows — beads and clothes on Hands, the fork on Body, food & growth — and each row's practice sits on the same shelf", async () => {
    const { PRACTICES } = await import("../../content/practices");
    const want: Record<string, string> = { "cdc-36m-9": "hands", "cdc-36m-10": "hands", "cdc-36m-11": "food" };
    for (const [id, shelf] of Object.entries(want)) {
      const m = ALL_MILESTONES.find((x) => x.id === id)!;
      expect(m, id).toBeTruthy();
      expect(milestoneShelf(m), id).toBe(shelf);
      expect(PRACTICES.find((p) => p.id === `pr-${id}`)?.shelf, `pr-${id}`).toBe(shelf);
    }
    // a stored cdc-36m-9 doc without the tag still resolves by id (the catalogue row carries it)
    const { tags: _drop, ...stored } = ALL_MILESTONES.find((m) => m.id === "cdc-36m-9")!;
    expect(milestoneShelf(stored)).toBe("hands");
    // NEGATIVE CONTROL: without the tag a sensory_motor_patterns row files on Moving (the defect)
    expect(milestoneShelf({ id: "custom-beads", domain: "sensory_motor_patterns", custom: true })).toBe("moving");
    expect(milestoneShelf({ id: "custom-beads", domain: "sensory_motor_patterns", custom: true, tags: ["fine_motor"] })).toBe("hands");
  });

  it("B-LOOP-01 (forks, framer ruling 6 Oct): the fork row is an eating skill — cdc-36m-11 and its practice file on Body, food & growth, never on Hands (cdc-60m-12 retired B-LOOP-14 r2: no CDC 2022 source)", async () => {
    const { PRACTICES } = await import("../../content/practices");
    for (const id of ["cdc-36m-11"]) {
      const m = ALL_MILESTONES.find((x) => x.id === id)!;
      expect(m.tags, id).toContain("feeding");
      expect(milestoneShelf(m), id).toBe("food");
      expect(PRACTICES.find((p) => p.id === `pr-${id}`)?.shelf, `pr-${id}`).toBe("food");
      // a stored doc without the tag still resolves by id (the catalogue row carries it)
      const { tags: _drop, ...stored } = m;
      expect(milestoneShelf(stored), `${id} stored`).toBe("food");
    }
    // every catalogue row whose title names a fork is on the food shelf
    for (const m of ALL_MILESTONES.filter((x) => /\bfork\b/i.test(x.title))) expect(milestoneShelf(m), m.id).toBe("food");
  });

  it("a stored catalogue doc without tags resolves by id; a parent-added row by its own tags/domain; an untagged body row → Body, food & growth", () => {
    const { tags: _drop, ...stored } = ALL_MILESTONES.find((m) => m.id === "asha-feed-9m")!;
    expect(milestoneShelf(stored)).toBe("food");
    expect(milestoneShelf({ id: "ms-1", domain: "language_communication", custom: true })).toBe("words");
    expect(milestoneShelf({ id: "ms-2", domain: "health_sleep_feeding", custom: true, tags: ["sleep"] })).toBe("sleep");
    expect(milestoneShelf({ id: "ms-3", domain: "health_sleep_feeding", custom: true })).toBe("food");
  });
});

describe("B-LOOP-03 — labels EN + HE", () => {
  const tEn = (k: string) => translate("en", k);
  const tHe = (k: string) => translate("he", k);
  it("all nine resolve in both languages, as the pack prints them", () => {
    expect(SHELF_IDS.map((id) => shelfLabel(id, tEn))).toEqual(["Sleep", "Body, food & growth", "Words", "Feelings", "Play & friends", "Moving", "Hands & senses", "School & thinking", "Family"]);
    expect(SHELF_IDS.map((id) => shelfLabel(id, tHe))).toEqual(["שינה", "גוף, אוכל וגדילה", "מילים", "רגשות", "משחק וחברים", "תנועה", "ידיים וחושים", "גן, בית ספר וחשיבה", "משפחה"]);
    for (const id of SHELF_IDS) expect(shelfLabel(id, tHe), id).not.toMatch(/[A-Za-z]/);
  });
});
