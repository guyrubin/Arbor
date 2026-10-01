import { describe, it, expect } from "vitest";
import { toObservations, summariseByDomain, type ObservationSources } from "./observations";
import { DOMAIN_IDS } from "./domains/registry";

/* B-GROWTH-28 — a fixture child with ONE record of each source yields ONE
   observation per record, each with ≥1 registry domain. */

const NOW = new Date("2026-10-01T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const child = { id: "c1", name: "Maya", age: 3, languages: ["Hebrew", "English"], birthDate: "2023-04-01" };

const sources: ObservationSources = {
  behaviorLogs: [{ id: "b1", timestamp: daysAgo(1), behaviorType: "Sleep Meltdown", intensity: 3, durationMinutes: 5, trigger: "bed", context: "Home" }],
  milestones: [{ id: "m1", domain: "language_communication", ageGroup: "3 years", title: "Says two-word phrases", description: "", checked: true, observationStatus: "yes", observationUpdatedAt: daysAgo(2) }],
  keepsakes: [{ milestoneId: "m1", note: "She said 'more juice'", noticedOn: "2026-09-29", createdAt: daysAgo(2), updatedAt: daysAgo(2) }],
  growthEntries: [{ id: "g1", childId: "c1", date: "2026-09-20", heightCm: 96 }],
  langObs: [{ id: "w1", timestamp: daysAgo(3), language: "Hebrew", phrase: "עוד" }],
  goalObservations: [{ id: "o1", goalId: "goal1", capabilityNodeId: "social", observationText: "Took turns", timestamp: daysAgo(4) }],
  screenings: [{ id: "s1", bandId: "3-5", bandLabel: "3 to 5 years", answeredAt: daysAgo(5), domains: [{ domain: "social_development" } as never], watchAreas: [], elevated: false }],
  playLogs: [{ id: "p1", activityId: "motor-scissor-snip", title: "Snip", domain: "motor", reason: "stage-match", source: "today", timestamp: daysAgo(6) }],
  speechAttempts: [{ id: "sp1", sound: "s", level: "word", target: "sun", result: "got", method: "parent", timestamp: daysAgo(7) }],
  practiceEvents: [{ id: "pe1", kind: "memory-round" as never, domain: "cognition", timestamp: daysAgo(8) }],
  mimicSessions: [{ id: "mi1", packId: "faces", promptId: "smile", rating: 2, timestamp: daysAgo(9) }],
  adventureResults: [{ id: "a1", scenarioId: "x", sceneId: "y", skill: "logic", correct: true, timestamp: daysAgo(10) }],
  missionRecords: [{ id: "mr1", date: "2026-09-20", missionId: "m", domain: "emotional", completed: true, timestamp: daysAgo(11) }],
  memoryFacts: [{ id: "f1", fact: "Loves trains", at: daysAgo(12), domains: ["playing"] }],
};

describe("B-GROWTH-28 — toObservations", () => {
  const obs = toObservations(sources, child);

  it("one observation per source record, each with ≥1 registry domain", () => {
    const recordCount = Object.values(sources).reduce((n, list) => n + (list?.length ?? 0), 0);
    expect(obs).toHaveLength(recordCount);
    for (const o of obs) {
      expect(o.domains.length, o.id).toBeGreaterThanOrEqual(1);
      for (const d of o.domains) expect(DOMAIN_IDS).toContain(d);
      expect(o.childId).toBe("c1");
    }
    expect(new Set(obs.map((o) => o.id)).size).toBe(obs.length);
  });

  it("tags each source with the domain the registry gives it", () => {
    const by = (origin: string) => obs.find((o) => o.origin === origin)!;
    expect(by("behaviorLogs").domains).toEqual(["feelings", "body"]);
    expect(by("milestones").domains).toEqual(["talking"]);
    expect(by("keepsakes").domains).toEqual(["talking"]);
    expect(by("growthEntries")).toMatchObject({ domains: ["body"], kind: "measurement" });
    expect(by("langObs").domains).toEqual(["talking"]);
    expect(by("goalObservations").domains).toEqual(["playing"]);
    expect(by("playLogs").domains).toEqual(["hands"]); // fine-motor activity
    expect(by("speechAttempts").domains).toEqual(["talking"]);
    expect(by("practiceEvents")).toMatchObject({ domains: ["thinking"], source: "kid_practice" });
    expect(by("mimicSessions").domains).toEqual(["hands", "playing"]);
    expect(by("missionRecords").domains).toEqual(["feelings"]);
  });

  it("ages each observation (months at the time) and sorts newest first", () => {
    for (let i = 1; i < obs.length; i++) expect(Date.parse(obs[i - 1].at)).toBeGreaterThanOrEqual(Date.parse(obs[i].at));
    const ms = obs.find((o) => o.origin === "milestones")!;
    expect(ms.ageAtObservationMonths).toBeGreaterThanOrEqual(41);
    expect(ms.pretermCorrected).toBe(false);
  });

  it("leaves out what it cannot place: undated, unchecked, unknown domain, recogniser-scored, untagged facts", () => {
    const none = toObservations({
      milestones: [{ id: "m2", domain: "social_development", ageGroup: "", title: "t", description: "", checked: false, observationUpdatedAt: daysAgo(1) }],
      growthEntries: [{ id: "g2", childId: "c1", date: "not a date", heightCm: 90 }],
      goalObservations: [{ id: "o2", goalId: "g", capabilityNodeId: "made-up", observationText: "x", timestamp: daysAgo(1) }],
      speechAttempts: [{ id: "sp2", sound: "s", level: "word", target: "sun", result: "got", method: "auto", timestamp: daysAgo(1) }],
      memoryFacts: [{ id: "f2", fact: "old fact", at: daysAgo(1) }],
    }, child);
    expect(none).toEqual([]);
  });

  it("a preterm infant is aged on corrected months", () => {
    const baby = { id: "c2", name: "N", age: 0, languages: [], birthDate: "2026-06-01", preterm: { gestationalWeeks: 32 } } as never;
    const [o] = toObservations({ langObs: [{ id: "w", timestamp: "2026-09-01T10:00:00Z", language: "Hebrew", phrase: "x" }] }, baby);
    expect(o.pretermCorrected).toBe(true);
    expect(o.ageAtObservationMonths!).toBeLessThan(3);
  });
});

describe("B-GROWTH-28 — summariseByDomain: integers and ISO dates only", () => {
  const sum = summariseByDomain(toObservations(sources, child), NOW);

  it("lists only domains that have observations, in registry order", () => {
    expect(sum.map((s) => s.domain)).toEqual(DOMAIN_IDS.filter((d) => sum.some((s) => s.domain === d)));
    expect(sum.find((s) => s.domain === "family")).toBeUndefined();
  });

  it("every value is an integer or an ISO date (no rate, no delta, no percent)", () => {
    const ISO = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/;
    for (const s of sum) {
      expect(Object.keys(s).sort()).toEqual(["count12w", "count4w", "domain", "latest", "latestAt"]);
      expect(Number.isInteger(s.count4w)).toBe(true);
      expect(Number.isInteger(s.count12w)).toBe(true);
      expect(s.count12w).toBeGreaterThanOrEqual(s.count4w);
      expect(s.latestAt === null || ISO.test(s.latestAt)).toBe(true);
      expect(s.latest.length).toBeLessThanOrEqual(3);
      for (const d of s.latest) expect(d).toMatch(ISO);
    }
    const talking = sum.find((s) => s.domain === "talking")!;
    expect(talking.count4w).toBe(4); // milestone, keepsake, word, parent speech try
  });
});
