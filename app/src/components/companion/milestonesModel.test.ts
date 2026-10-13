import { describe, expect, it } from "vitest";
import type { BehaviorLog, Milestone } from "../../types";
import type { DescribedItem } from "../../lib/describeChild";
import type { KeptThing } from "../../lib/kept/keptThings";
import { DOMAIN_IDS } from "../../lib/domains/registry";
import { ALL_MILESTONES } from "../../lib/milestoneData";
import { groupMilestonesByShelf } from "../../lib/milestones/shelfMap";
import { CUSTOM_MILESTONE_DOMAIN, areaFromQuery, growingDomains, latestKeptMoment, latestStrength, watchDomain } from "./milestonesModel";

/* v3 F-CHILD-1 — the pure reads behind the Milestones pill. Invented words and
   catalogue rows only; no child data. Every read returns words, a date, area
   names or nothing: never a share, a denominator or an order by count. */

const NOW = Date.parse("2026-06-15T12:00:00.000Z");
const catalogue = (): Milestone[] => ALL_MILESTONES.map(m => ({ ...m }));
const ledger = (id: string, words: string, confirmedAt: string, since = confirmedAt): DescribedItem => ({ id, kind: "strength", words, since, source: "describe", confirmedAt });
const thing = (id: string, text: string, at: string, extra: Partial<KeptThing> = {}): KeptThing => ({ id, kind: "said", at, text, attribution: "parent", ...extra });
const log = (id: string, trigger: string, timestamp: string, extra: Partial<BehaviorLog> = {}): BehaviorLog => ({ id, timestamp, behaviorType: "Moment", durationMinutes: 0, trigger, ...extra });

describe("v3 F-CHILD-1 — latestStrength", () => {
  it("is nothing when the parent told no strength", () => {
    expect(latestStrength(null)).toBeNull();
    expect(latestStrength({})).toBeNull();
    expect(latestStrength({ strengths: [], interests: ["Trains"] })).toBeNull();
  });

  it("is the strength told most recently, dated by its own record", () => {
    const profile = {
      strengths: ["Loves to sing", "Builds tall towers"],
      describedItems: [ledger("d-sing", "Loves to sing", "2026-10-03T09:00:00.000Z"), ledger("d-towers", "Builds tall towers", "2026-09-01T09:00:00.000Z")],
    };
    expect(latestStrength(profile)).toEqual({ id: "d-sing", text: "Loves to sing", at: "2026-10-03T09:00:00.000Z" });
  });

  it("falls back to the record's first day when the confirmation date is unreadable", () => {
    const item = { ...ledger("d-kind", "Kind to the cat", "not a date", "2026-08-20T09:00:00.000Z") };
    expect(latestStrength({ strengths: ["Kind to the cat"], describedItems: [item] })).toEqual({ id: "d-kind", text: "Kind to the cat", at: "2026-08-20T09:00:00.000Z" });
  });

  it("a dated strength wins over a line written elsewhere; an undated line is never given a date", () => {
    const dated = latestStrength({ strengths: ["Loves to sing", "Shares snacks"], describedItems: [ledger("d-sing", "Loves to sing", "2026-10-03T09:00:00.000Z")] });
    expect(dated).toEqual({ id: "d-sing", text: "Loves to sing", at: "2026-10-03T09:00:00.000Z" });
    const undated = latestStrength({ strengths: ["Loves to sing", "Shares snacks"] });
    expect(undated?.text).toBe("Shares snacks");
    expect(undated?.at).toBeNull();
  });
});

describe("v3 F-CHILD-1 — latestKeptMoment", () => {
  it("is nothing when nothing was kept", () => {
    expect(latestKeptMoment([], undefined, NOW)).toBeNull();
    expect(latestKeptMoment([], [], NOW)).toBeNull();
  });

  it("is the newest word, first or parent-written moment", () => {
    const things = [
      thing("langObs:w1", "ball", "2026-05-01T10:00:00.000Z"),
      thing("milestones:m1", "Waved bye at the door", "2026-06-01T10:00:00.000Z", { kind: "first", keepsakeId: "k1" }),
    ];
    expect(latestKeptMoment(things, [], NOW)).toEqual({ id: "milestones:m1", text: "Waved bye at the door", at: "2026-06-01T10:00:00.000Z" });
    const logs = [log("l1", "  Laughed at the bubbles  ", "2026-06-10T10:00:00.000Z")];
    expect(latestKeptMoment(things, logs, NOW)).toEqual({ id: "behaviorLogs:l1", text: "Laughed at the bubbles", at: "2026-06-10T10:00:00.000Z" });
  });

  it("a plain Seen-it answer with no note of its own is an answer, not a kept moment", () => {
    const things = [
      thing("langObs:w1", "ball", "2026-05-01T10:00:00.000Z"),
      thing("milestones:m2", "Points at a dog", "2026-06-12T10:00:00.000Z", { kind: "first" }),
    ];
    expect(latestKeptMoment(things, [], NOW)?.id).toBe("langObs:w1");
  });

  it("skips what is dated after now, an empty line, an incident and words the parent did not write", () => {
    const things = [
      thing("langObs:w1", "ball", "2026-05-01T10:00:00.000Z"),
      thing("langObs:w2", "tomorrow", "2026-07-01T10:00:00.000Z"),
      thing("langObs:w3", "   ", "2026-06-02T10:00:00.000Z"),
    ];
    const logs = [
      log("l-hard", "Cried at the shop", "2026-06-10T10:00:00.000Z", { behaviorType: "Meltdown" }),
      log("l-ai", "A drafted line", "2026-06-11T10:00:00.000Z", { contentSource: "ai_draft" }),
      log("l-later", "Not yet happened", "2026-06-20T10:00:00.000Z"),
    ];
    expect(latestKeptMoment(things, logs, NOW)).toEqual({ id: "langObs:w1", text: "ball", at: "2026-05-01T10:00:00.000Z" });
  });
});

describe("v3 F-CHILD-1 — growingDomains", () => {
  const by = groupMilestonesByShelf(catalogue());
  const seenAt = (m: Milestone, at: string): Milestone => ({ ...m, checked: true, observationStatus: "yes", observationUpdatedAt: at });

  it("names the areas with a new Seen it in the last 30 days, in registry order, names only", () => {
    const marks = new Map<string, string>([
      [by.moving[0].id, "2026-06-10T10:00:00.000Z"],
      [by.words[0].id, "2026-05-20T10:00:00.000Z"],
      [by.hands[0].id, "2026-03-01T10:00:00.000Z"],
    ]);
    const ms = catalogue().map(m => (marks.has(m.id) ? seenAt(m, marks.get(m.id)!) : m));
    expect(growingDomains(ms, NOW)).toEqual(["talking", "moving"]);
  });

  it("a Sleep row the parent added grows Body; an answer that is not Seen it grows nothing", () => {
    const sleep: Milestone = { id: "ms-sleep-own", custom: true, tags: ["sleep"], domain: "health_sleep_feeding", ageGroup: "Custom", title: "Falls asleep after one story", description: "x", checked: false };
    const notYet = { ...by.words[0], observationStatus: "not_yet" as const, observationUpdatedAt: "2026-06-10T10:00:00.000Z" };
    expect(growingDomains([seenAt(sleep, "2026-06-14T10:00:00.000Z"), notYet], NOW)).toEqual(["body"]);
    expect(growingDomains([notYet], NOW)).toEqual([]);
    expect(growingDomains([], NOW)).toEqual([]);
  });
});

describe("v3 F-CHILD-1 — areaFromQuery", () => {
  const q = (s: string) => new URLSearchParams(s);
  it("opens ?area=<area>; the old ?shelf=<shelf> opens the area that shelf sits on", () => {
    expect(areaFromQuery(q("area=talking"))).toBe("talking");
    expect(areaFromQuery(q("area=family"))).toBe("family");
    expect(areaFromQuery(q("shelf=food"))).toBe("body");
    expect(areaFromQuery(q("shelf=sleep"))).toBe("body");
    expect(areaFromQuery(q("shelf=school"))).toBe("thinking");
    expect(areaFromQuery(q("area=moving&shelf=words"))).toBe("moving");
    expect(areaFromQuery(q("area=nope&shelf=hands"))).toBe("hands");
  });
  it("opens nothing for an unknown or missing area", () => {
    expect(areaFromQuery(q(""))).toBeNull();
    expect(areaFromQuery(q("area=nope"))).toBeNull();
    expect(areaFromQuery(q("shelf=nope"))).toBeNull();
    expect(areaFromQuery(q("view=areas"))).toBeNull();
  });
});

describe("v3 F-CHILD-1 — watchDomain and Add your own", () => {
  it("a skill files on the area its Seen-it count uses", () => {
    const by = groupMilestonesByShelf(catalogue());
    expect(watchDomain(catalogue(), by.words[0].id)).toBe("talking");
    expect(watchDomain(catalogue(), by.hands[0].id)).toBe("hands");
    expect(watchDomain(catalogue(), by.food[0].id)).toBe("body");
    expect(watchDomain(catalogue(), "no-such-skill")).toBeNull();
  });

  it.each([...DOMAIN_IDS])("a skill the parent adds on %s files back on that same area", domain => {
    const own: Milestone = { id: `ms-own-${domain}`, custom: true, domain: CUSTOM_MILESTONE_DOMAIN[domain], ageGroup: "Custom", title: "Something new", description: "x", checked: false };
    expect(watchDomain([own], own.id)).toBe(domain);
  });
});
