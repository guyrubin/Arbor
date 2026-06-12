import { describe, expect, it } from "vitest";
import type { AdventureResult, Milestone, MissionRecord, SpeechAttempt } from "../types";
import {
  developmentScore,
  domainBands,
  matchResult,
  recommend,
  soundStats,
  speechSimilarity,
  streakDays,
  weeklyActivity,
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
