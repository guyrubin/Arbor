import { describe, expect, it } from "vitest";
import type { AdventureResult, Milestone, MissionRecord, SpeechAttempt } from "../types";
import {
  ageAppropriateSoundIds,
  developmentScore,
  domainBands,
  isSoundAgeAppropriate,
  matchResult,
  memoryGridSize,
  memoryMaxCards,
  memorySetIndexForAge,
  recommend,
  soundStats,
  speechDose,
  speechSimilarity,
  streakDays,
  weeklyActivity,
  weeklyMissionPlan,
} from "./signals";

const at = (daysBack: number, sound = "s", result: SpeechAttempt["result"] = "got"): SpeechAttempt => ({
  id: `a${daysBack}-${Math.random()}`,
  sound,
  level: "word",
  target: "sun",
  result,
  method: "parent",
  timestamp: new Date(Date.now() - daysBack * 86400000).toISOString(),
});

describe("soundStats", () => {
  it("computes weighted accuracy per sound", () => {
    const stats = soundStats([at(1, "s", "got"), at(1, "s", "almost"), at(1, "s", "missed"), at(1, "r", "got")]);
    const s = stats.find((x) => x.sound === "s")!;
    expect(s.attempts).toBe(3);
    expect(s.accuracy).toBe(50); // (1 + 0.5 + 0) / 3
    const r = stats.find((x) => x.sound === "r")!;
    expect(r.accuracy).toBe(100);
  });

  it("tracks the highest level mastered", () => {
    const attempts: SpeechAttempt[] = [
      { ...at(2), level: "word", result: "got" },
      { ...at(1), level: "sentence", result: "got" },
      { ...at(0), level: "story", result: "missed" },
    ];
    expect(soundStats(attempts)[0].levelReached).toBe("sentence");
  });
});

describe("streakDays", () => {
  const rec = (date: string, completed = true): MissionRecord => ({
    id: `${date}-m`,
    date,
    missionId: "new-words",
    domain: "language",
    completed,
    timestamp: `${date}T10:00:00.000Z`,
  });

  it("counts consecutive days ending today", () => {
    expect(streakDays([rec("2026-06-12"), rec("2026-06-11"), rec("2026-06-10")], "2026-06-12")).toBe(3);
  });

  it("allows the streak to survive until end of today", () => {
    expect(streakDays([rec("2026-06-11"), rec("2026-06-10")], "2026-06-12")).toBe(2);
  });

  it("breaks on a gap", () => {
    expect(streakDays([rec("2026-06-12"), rec("2026-06-09")], "2026-06-12")).toBe(1);
    expect(streakDays([rec("2026-06-08")], "2026-06-12")).toBe(0);
  });

  it("ignores incomplete missions", () => {
    expect(streakDays([rec("2026-06-12", false)], "2026-06-12")).toBe(0);
  });
});

describe("developmentScore", () => {
  it("is 0 with no activity and capped at 100", () => {
    expect(developmentScore({ sessions: 0, activeDays: 0, domainsTouched: [] })).toBe(0);
    expect(
      developmentScore({ sessions: 50, activeDays: 7, domainsTouched: ["language", "speech", "cognition", "social", "emotional"] })
    ).toBe(100);
  });

  it("rewards consistency and breadth, not just volume", () => {
    const burst = developmentScore({ sessions: 20, activeDays: 1, domainsTouched: ["speech"] });
    const steady = developmentScore({ sessions: 10, activeDays: 5, domainsTouched: ["speech", "language", "cognition"] });
    expect(steady).toBeGreaterThan(burst);
  });
});

describe("weeklyActivity", () => {
  it("only counts the last 7 days", () => {
    const week = weeklyActivity([at(1), at(10)], [], [], [], new Date().toISOString().slice(0, 10));
    expect(week.sessions).toBe(1);
  });
});

describe("domainBands + recommend", () => {
  const ms = (domain: Milestone["domain"], checked: boolean): Milestone => ({
    id: `m-${domain}-${Math.random()}`,
    domain,
    ageGroup: "4-5",
    title: "t",
    description: "d",
    checked,
  });

  it("anchors bands on milestones and never returns an age number", () => {
    const bands = domainBands(
      [ms("language_communication", true), ms("language_communication", true), ms("social_development", false)],
      [],
      [],
      []
    );
    const lang = bands.find((b) => b.domain === "language")!;
    const social = bands.find((b) => b.domain === "social")!;
    expect(lang.band).toBe("strong");
    expect(social.band).toBe("emerging");
    expect(bands).toHaveLength(5);
  });

  it("uses speech practice accuracy for the speech domain", () => {
    const bands = domainBands([], [at(1, "s", "got"), at(1, "s", "got"), at(1, "s", "got"), at(1, "s", "got")], [], []);
    const speech = bands.find((b) => b.domain === "speech")!;
    expect(speech.signal).toBeGreaterThanOrEqual(75);
    expect(speech.basis).toContain("Speech Coach accuracy");
  });

  it("blends adventure comprehension into cognition", () => {
    const adv = (correct: boolean): AdventureResult => ({
      id: `adv-${Math.random()}`,
      scenarioId: "hungry-lion",
      sceneId: "food",
      skill: "logic",
      correct,
      timestamp: new Date().toISOString(),
    });
    const low = domainBands([ms("cognition_executive_function", false)], [], [], [adv(true), adv(true), adv(true)]);
    const cog = low.find((b) => b.domain === "cognition")!;
    expect(cog.signal).toBeGreaterThan(0);
    expect(cog.basis).toContain("Adventure comprehension");
  });

  it("recommends the weakest domain with a matching mission", () => {
    const bands = domainBands([ms("attachment_regulation", false), ms("language_communication", true)], [], [], []);
    const rec = recommend(bands, []);
    expect(["emotional", "social", "speech", "cognition"]).toContain(rec.domain);
    expect(rec.missionId).toBeTruthy();
    expect(rec.headline).toMatch(/Increase/);
  });
});

describe("speech matching", () => {
  it("scores exact and near matches generously", () => {
    expect(speechSimilarity("sun", "sun")).toBe(1);
    expect(matchResult("sun", "the sun").result).toBe("got");
    expect(matchResult("rabbit", "wabbit").result).toBe("got"); // 1 substitution in 6 letters ≈ 0.83
    expect(matchResult("rocket", "rock it").result).toBe("got"); // phrase fallback
    expect(matchResult("sun", "elephant").result).toBe("missed");
  });

  it("flags partial attempts as almost", () => {
    expect(matchResult("dinosaur", "dinour").result).toBe("almost");
  });
});

describe("weeklyMissionPlan (closed loop)", () => {
  const ms = (domain: Milestone["domain"], checked: boolean, title: string): Milestone => ({
    id: `${domain}-${title}`, domain, ageGroup: "3-4y", title, description: "", checked,
  });
  const rec = (domain: MissionRecord["domain"], daysBack: number, completed = true): MissionRecord => {
    const date = new Date(Date.now() - daysBack * 86400000).toISOString().slice(0, 10);
    return { id: `${date}-${domain}`, date, missionId: `m-${domain}`, domain, completed, timestamp: date };
  };
  const today = new Date().toISOString().slice(0, 10);

  it("targets domains with the most not-yet-reached milestones first", () => {
    const milestones = [
      ms("language_communication", false, "Says 50 words"),
      ms("language_communication", false, "Two-word phrases"),
      ms("social_development", false, "Plays alongside peers"),
      ms("cognition_executive_function", true, "Sorts by color"), // checked → ignored
    ];
    const plan = weeklyMissionPlan(milestones, [], today, 3);
    expect(plan.focus[0].domain).toBe("language"); // 2 gaps
    expect(plan.focus[0].gaps).toBe(2);
    expect(plan.focus[0].targetMilestone).toBe("Says 50 words");
    expect(plan.focus.map((f) => f.domain)).toContain("social");
    expect(plan.focus.map((f) => f.domain)).not.toContain("cognition"); // only checked milestone
  });

  it("de-prioritizes a domain already practiced last week vs a neglected one", () => {
    const milestones = [
      ms("language_communication", false, "L1"),
      ms("social_development", false, "S1"),
    ];
    // Both have 1 gap, but social was practiced 3× last week → language should rank first.
    const missions = [rec("social", 1), rec("social", 2), rec("social", 3)];
    const plan = weeklyMissionPlan(milestones, missions, today, 2);
    expect(plan.focus[0].domain).toBe("language");
  });

  it("falls back to a balanced week when no milestone gaps exist", () => {
    const plan = weeklyMissionPlan([ms("language_communication", true, "done")], [], today, 3);
    expect(plan.focus).toHaveLength(3);
    expect(plan.focus.every((f) => f.gaps === 0)).toBe(true);
  });
});

describe("memory match age-aware difficulty", () => {
  it("caps grid size by age ceiling", () => {
    const strong = [80, 85, 90, 95, 88, 92]; // would earn 12 cards
    expect(memoryGridSize(strong)).toBe(12);            // no age cap
    expect(memoryGridSize(strong, 8)).toBe(8);          // capped for a 3-4yo
    expect(memoryGridSize(strong, 6)).toBe(6);          // capped for a toddler
  });
  it("maps age to a sensible ceiling", () => {
    expect(memoryMaxCards(2)).toBe(6);
    expect(memoryMaxCards(4)).toBe(8);
    expect(memoryMaxCards(7)).toBe(12);
    expect(memoryMaxCards(undefined)).toBe(12);
  });
  it("picks a gentler theme for the youngest", () => {
    expect(memorySetIndexForAge(2, 3)).toBe(0);
    expect(memorySetIndexForAge(7, 3)).toBe(2);
    expect(memorySetIndexForAge(7, 1)).toBe(0); // single set → always 0
  });
});

describe("ASHA speech age-gating + dosage", () => {
  const lib = [
    { id: "p", band: "early" as const },
    { id: "k", band: "middle" as const },
    { id: "r", band: "late" as const },
  ];
  it("gates target sounds by age (ASHA norms)", () => {
    expect(isSoundAgeAppropriate("early", 2)).toBe(true);
    expect(isSoundAgeAppropriate("middle", 2)).toBe(false);
    expect(isSoundAgeAppropriate("middle", 3)).toBe(true);
    expect(isSoundAgeAppropriate("late", 3)).toBe(false);
    expect(isSoundAgeAppropriate("late", 5)).toBe(true);
    expect(ageAppropriateSoundIds(lib, 2)).toEqual(["p"]);
    expect(ageAppropriateSoundIds(lib, 6)).toEqual(["p", "k", "r"]);
  });

  it("tracks dosage: trials today and sessions this week", () => {
    const today = "2026-06-17";
    const att = (date: string): SpeechAttempt => ({
      id: `${date}-${Math.random()}`, sound: "s", level: "word", target: "sun", result: "got", method: "parent",
      timestamp: `${date}T10:00:00.000Z`,
    });
    const attempts = [
      ...Array.from({ length: 50 }, () => att("2026-06-17")), // 50 trials today
      att("2026-06-16"), att("2026-06-15"),                   // 2 more distinct days
    ];
    const dose = speechDose(attempts, today);
    expect(dose.trialsToday).toBe(50);
    expect(dose.sessionMetToday).toBe(true);     // 50 ≥ 50
    expect(dose.sessionsThisWeek).toBe(3);        // 3 distinct days
    expect(dose.weeklyMet).toBe(true);            // 3 ≥ 3
  });

  it("reports an unmet dose honestly", () => {
    const dose = speechDose([], "2026-06-17");
    expect(dose.trialsToday).toBe(0);
    expect(dose.sessionMetToday).toBe(false);
    expect(dose.weeklyMet).toBe(false);
  });
});
