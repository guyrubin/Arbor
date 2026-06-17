import { describe, expect, it } from "vitest";
import {
  ageGroupToMonths,
  classifyBehaviorDomain,
  deriveMonitoring,
  buildMonitoringReportDoc,
  MONITORED_DOMAIN_LABEL,
} from "./monitoring.js";
import type { BehaviorLog, Milestone } from "../types";

const NOW = new Date("2026-06-06T12:00:00.000Z").getTime();
const daysAgo = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

const milestone = (over: Partial<Milestone> = {}): Milestone => ({
  id: Math.random().toString(36).slice(2),
  domain: "language_communication",
  ageGroup: "18 months",
  title: "Uses several single words",
  description: "Says a handful of words",
  checked: false,
  ...over,
});

const log = (over: Partial<BehaviorLog> = {}): BehaviorLog => ({
  id: Math.random().toString(36).slice(2),
  timestamp: daysAgo(2),
  behaviorType: "Meltdown",
  intensity: 5,
  durationMinutes: 20,
  trigger: "Transition",
  response: "Held space",
  resolved: false,
  ...over,
});

describe("ageGroupToMonths", () => {
  it("parses month labels", () => {
    expect(ageGroupToMonths("2 months")).toBe(2);
    expect(ageGroupToMonths("18 months")).toBe(18);
  });
  it("parses year labels to months", () => {
    expect(ageGroupToMonths("2 years")).toBe(24);
    expect(ageGroupToMonths("3-5y")).toBe(60);
  });
  it("treats bare 'Age X-Y' as years and uses the upper bound", () => {
    expect(ageGroupToMonths("Age 4-5")).toBe(60);
  });
  it("returns null for unparseable input", () => {
    expect(ageGroupToMonths("")).toBeNull();
    expect(ageGroupToMonths("toddler")).toBeNull();
  });
});

describe("classifyBehaviorDomain", () => {
  it("routes language cues", () => {
    expect(classifyBehaviorDomain({ behaviorType: "Won't say words", trigger: "", notes: "" })).toBe(
      "language_communication",
    );
  });
  it("routes social cues", () => {
    expect(classifyBehaviorDomain({ behaviorType: "Avoids peers at play", trigger: "", notes: "" })).toBe(
      "social_development",
    );
  });
  it("defaults unknown behavior to attachment & regulation", () => {
    expect(classifyBehaviorDomain({ behaviorType: "Big tantrum", trigger: "", notes: "" })).toBe(
      "attachment_regulation",
    );
  });
  it("returns null for empty input", () => {
    expect(classifyBehaviorDomain({ behaviorType: "", trigger: "", notes: "" })).toBeNull();
  });
});

describe("deriveMonitoring — milestone surveillance", () => {
  it("flags a domain when a past-band milestone is unobserved", () => {
    const res = deriveMonitoring(
      {
        ageYears: 3, // 36 months, well past an 18-month milestone
        milestones: [milestone({ domain: "language_communication", checked: false })],
        now: NOW,
      },
      "Mila",
    );
    const lang = res.domains.find((d) => d.domain === "language_communication")!;
    expect(lang.level).toBe("monitor");
    expect(lang.reasons).toContain("milestone_overdue");
    expect(res.elevated).toBe(true);
    expect(res.watchAreas).toHaveLength(1);
  });

  it("does NOT flag a milestone still inside the typical window", () => {
    const res = deriveMonitoring(
      {
        ageYears: 1.5, // 18 months — exactly the band, within grace
        milestones: [milestone({ ageGroup: "18 months", checked: false })],
        now: NOW,
      },
      "Mila",
    );
    expect(res.elevated).toBe(false);
  });

  it("does NOT flag observed (checked) milestones", () => {
    const res = deriveMonitoring(
      {
        ageYears: 4,
        milestones: [milestone({ ageGroup: "18 months", checked: true })],
        now: NOW,
      },
      "Mila",
    );
    expect(res.elevated).toBe(false);
  });

  it("ignores ecosystem milestones and unparseable age groups", () => {
    const res = deriveMonitoring(
      {
        ageYears: 5,
        milestones: [
          milestone({ domain: "ecosystem_stressors", ageGroup: "2 years", checked: false }),
          milestone({ ageGroup: "toddler", checked: false }),
        ],
        now: NOW,
      },
      "Mila",
    );
    expect(res.elevated).toBe(false);
  });
});

describe("deriveMonitoring — behavior-pattern surveillance", () => {
  it("flags a cluster of recent intense unresolved moments", () => {
    const res = deriveMonitoring(
      {
        ageYears: 3,
        behaviorLogs: [
          log({ behaviorType: "Meltdown", intensity: 5, resolved: false }),
          log({ behaviorType: "Meltdown", intensity: 4, resolved: false }),
          log({ behaviorType: "Tantrum", intensity: 5, resolved: false }),
        ],
        now: NOW,
      },
      "Mila",
    );
    const reg = res.domains.find((d) => d.domain === "attachment_regulation")!;
    expect(reg.level).toBe("monitor");
    expect(reg.reasons).toContain("behavior_pattern");
    expect(reg.patternMoments).toBe(3);
  });

  it("does not flag resolved, low-intensity, or stale moments", () => {
    const res = deriveMonitoring(
      {
        ageYears: 3,
        behaviorLogs: [
          log({ resolved: true }),
          log({ intensity: 2 }),
          log({ timestamp: daysAgo(60) }),
        ],
        now: NOW,
      },
      "Mila",
    );
    expect(res.elevated).toBe(false);
  });

  it("requires at least three moments before flagging", () => {
    const res = deriveMonitoring(
      {
        ageYears: 3,
        behaviorLogs: [log(), log()],
        now: NOW,
      },
      "Mila",
    );
    expect(res.elevated).toBe(false);
  });
});

describe("deriveMonitoring — framing guarantees (non-negotiable)", () => {
  it("never emits a score, percentage, probability, or diagnosis word", () => {
    const res = deriveMonitoring(
      {
        ageYears: 4,
        milestones: [milestone({ ageGroup: "18 months", checked: false })],
        behaviorLogs: [log(), log(), log()],
        now: NOW,
      },
      "Mila",
    );
    const text = [res.headline, ...res.domains.map((d) => d.note)].join(" ").toLowerCase();
    expect(text).not.toMatch(/\d+\s*%/);
    // No scores, condition names, or diagnostic claims. (The reassuring phrase
    // "this isn't a diagnosis" is allowed — it's the framing, not a claim.)
    const claims = text.replace(/this isn't a diagnosis/g, "");
    expect(claims).not.toMatch(/diagnos|disorder|asd|autism|adhd|delay\b|risk score|probability/);
    // Every monitored domain note must point back to the provider.
    for (const d of res.watchAreas) {
      expect(d.note.toLowerCase()).toContain("provider");
    }
  });

  it("returns a calm on-track headline when nothing is flagged", () => {
    const res = deriveMonitoring({ ageYears: 2, now: NOW }, "Mila");
    expect(res.elevated).toBe(false);
    expect(res.headline).toContain("on track");
    expect(res.domains).toHaveLength(Object.keys(MONITORED_DOMAIN_LABEL).length);
  });
});

describe("buildMonitoringReportDoc", () => {
  it("produces a provider-ready doc with the non-diagnostic note", () => {
    const res = deriveMonitoring(
      {
        ageYears: 3,
        milestones: [milestone({ ageGroup: "18 months", checked: false })],
        now: NOW,
      },
      "Mila",
    );
    const doc = buildMonitoringReportDoc(res, "Mila Cohen", 3);
    expect(doc.title).toMatch(/Monitoring/);
    expect(doc.subtitle).toContain("Mila Cohen");
    const headings = doc.sections.map((s) => s.heading);
    expect(headings).toContain("Areas to discuss");
    expect(headings).toContain("Non-diagnostic note");
  });

  it("still renders cleanly when no areas are flagged", () => {
    const res = deriveMonitoring({ ageYears: 2, now: NOW }, "Mila");
    const doc = buildMonitoringReportDoc(res, "Mila Cohen", 2);
    const discuss = doc.sections.find((s) => s.heading === "Areas to discuss")!;
    expect(String(discuss.body)).toMatch(/No areas/);
  });
});
