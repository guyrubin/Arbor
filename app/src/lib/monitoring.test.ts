import { describe, expect, it } from "vitest";
import {
  ageGroupToMonths,
  classifyBehaviorDomain,
  deriveMonitoring,
  buildMonitoringReportDoc,
  pickHighestWatchSignal,
  monitoredDomainToPlayHint,
  watchPointsSummary,
  MONITORED_DOMAIN_LABEL,
} from "./monitoring.js";
import type { BehaviorLog, Milestone } from "../types";

const NOW = new Date("2026-06-06T12:00:00.000Z").getTime();
const daysAgo = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

/**
 * A milestone the parent HAS answered. Default response = "not yet" (or "yes"
 * when the fixture is `checked`), because every surveillance test below is
 * about what a real parent response produces.
 *
 * P1-C: an ANSWER is what the monitoring layer scores. The raw catalogue shape
 * — `checked: false` with no observation record at all — is a DIFFERENT thing
 * ("never asked") and has its own fixture, `unansweredMilestone`, below.
 */
const milestone = (over: Partial<Milestone> = {}): Milestone => {
  const merged: Milestone = {
    id: Math.random().toString(36).slice(2),
    domain: "language_communication",
    ageGroup: "18 months",
    title: "Uses several single words",
    description: "Says a handful of words",
    checked: false,
    ...over,
  };
  if (merged.observationStatus === undefined) {
    merged.observationStatus = merged.checked ? "yes" : "not_yet";
  }
  return merged;
};

/** The seeded-catalogue shape: the parent has never responded to this item. */
const unansweredMilestone = (over: Partial<Milestone> = {}): Milestone => {
  const m = milestone(over);
  delete m.observationStatus;
  delete m.observationUpdatedAt;
  return m;
};

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

  // ── P1-C (2026-08-12 audit) — "never asked" is not "asked and not seen". ──
  // The milestone catalogue is SEEDED unanswered (133 rows, `checked: false`,
  // no observation record). Scoring absence as a deficit told a brand-new
  // parent that a skill "typically seen by now hasn't been noted yet" for their
  // child, complete with a pediatrician nudge — manufactured from no data at
  // all. These tests are firewall-adjacent: they may not be relaxed.
  it("does NOT flag a past-band milestone the parent has NEVER answered", () => {
    const res = deriveMonitoring(
      {
        ageYears: 5, // 60 months, far past an 18-month milestone
        milestones: [unansweredMilestone({ ageGroup: "18 months" })],
        now: NOW,
      },
      "Mila",
    );
    expect(res.elevated).toBe(false);
    expect(res.watchAreas).toEqual([]);
    const lang = res.domains.find((d) => d.domain === "language_communication")!;
    expect(lang.level).toBe("on_track");
    expect(lang.overdueMilestones).toEqual([]);
  });

  it("a brand-new account (whole catalogue unanswered) produces NO watch signal", () => {
    const catalogue = (["language_communication", "social_development", "cognition_executive_function"] as const)
      .flatMap((domain) => ["2 months", "9 months", "18 months", "2 years"].map((ageGroup) =>
        unansweredMilestone({ domain, ageGroup })));
    const res = deriveMonitoring({ ageYears: 5, milestones: catalogue, now: NOW }, "Mila");
    expect(res.elevated).toBe(false);
    expect(pickHighestWatchSignal(res)!.level).toBe("on_track");
    expect(watchPointsSummary(res)).toEqual([]);
  });

  it("scores 'not yet' and 'not sure' — the parent's real answers — identically to before", () => {
    for (const status of ["not_yet", "not_sure"] as const) {
      const res = deriveMonitoring(
        {
          ageYears: 5,
          milestones: [milestone({ ageGroup: "18 months", observationStatus: status })],
          now: NOW,
        },
        "Mila",
      );
      expect(res.elevated, `${status} must still flag`).toBe(true);
      expect(res.watchAreas[0].overdueMilestones[0].status).toBe(status);
    }
  });

  it("a legacy row with an observation timestamp but no status still counts as answered", () => {
    const res = deriveMonitoring(
      {
        ageYears: 5,
        milestones: [{
          ...unansweredMilestone({ ageGroup: "18 months" }),
          observationUpdatedAt: "2026-06-01T10:00:00.000Z",
        }],
        now: NOW,
      },
      "Mila",
    );
    expect(res.elevated).toBe(true);
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

describe("pickHighestWatchSignal", () => {
  it("returns the domain with both reasons over milestone-only", () => {
    const res = deriveMonitoring(
      {
        ageYears: 4,
        milestones: [
          milestone({ domain: "language_communication", ageGroup: "18 months", checked: false }),
        ],
        behaviorLogs: [
          log({ behaviorType: "Meltdown", intensity: 5, resolved: false }),
          log({ behaviorType: "Meltdown", intensity: 5, resolved: false }),
          log({ behaviorType: "Tantrum", intensity: 5, resolved: false }),
        ],
        now: NOW,
      },
      "Mila",
    );
    const signal = pickHighestWatchSignal(res);
    // attachment_regulation has behavior_pattern; language_communication has milestone_overdue
    // neither has both, so milestone_overdue (priority 2) > behavior_pattern (priority 1)
    expect(signal).not.toBeNull();
    expect(signal!.domain).toBe("language_communication");
  });

  it("returns the on-track domain with highest encouragement when nothing is flagged", () => {
    const res = deriveMonitoring({ ageYears: 2, now: NOW }, "Mila");
    const signal = pickHighestWatchSignal(res);
    expect(signal).not.toBeNull();
    expect(signal!.level).toBe("on_track");
  });

  it("returns null when domains array is empty", () => {
    const emptyResult = deriveMonitoring({ ageYears: 0, now: NOW }, "");
    // force empty domains to test the guard
    const signal = pickHighestWatchSignal({ ...emptyResult, domains: [] });
    expect(signal).toBeNull();
  });

  it("the non-diagnostic copy for a monitor signal never contains banned diagnostic terms", () => {
    const res = deriveMonitoring(
      {
        ageYears: 4,
        milestones: [milestone({ domain: "language_communication", ageGroup: "18 months", checked: false })],
        now: NOW,
      },
      "Mila",
    );
    const signal = pickHighestWatchSignal(res)!;
    const text = signal.note.toLowerCase();
    // Strip the explicit negation phrase so we test for accidental positive use only.
    const withoutNegation = text.replace(/this isn't a diagnosis/g, "");
    expect(withoutNegation).not.toMatch(/diagnos|disorder|asd|autism|adhd|delay\b|risk score|probability/);
    // Must retain the provider nudge.
    expect(text).toContain("provider");
    // Must not contain alarming language.
    expect(text).not.toMatch(/alert|alarm|urgent|emergency|serious concern/);
  });
});

describe("monitoredDomainToPlayHint", () => {
  it("maps every monitored domain to a play domain hint", () => {
    const domains = Object.keys(MONITORED_DOMAIN_LABEL) as (keyof typeof MONITORED_DOMAIN_LABEL)[];
    const valid = new Set(["regulation", "language", "social", "cognitive", "motor"]);
    for (const d of domains) {
      expect(valid.has(monitoredDomainToPlayHint(d))).toBe(true);
    }
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

  // UND-4 — the printable preserves the parent's actual response: a "not sure"
  // milestone is its OWN category with its date, never collapsed into not-yet.
  it("splits 'not sure' from 'not yet' with the parent's observation dates", () => {
    const res = deriveMonitoring(
      {
        ageYears: 3,
        milestones: [
          milestone({
            title: "Uses several single words",
            observationStatus: "not_sure",
            observationUpdatedAt: "2026-06-01T10:00:00.000Z",
          }),
          milestone({
            title: "Points to things when named",
            observationStatus: "not_yet",
            observationUpdatedAt: "2026-06-02T10:00:00.000Z",
          }),
          milestone({ title: "Legacy undated item" }), // no explicit status/date
        ],
        now: NOW,
      },
      "Mila",
    );
    const doc = buildMonitoringReportDoc(res, "Mila Cohen", 3);
    const notSure = doc.sections.find((s) => s.heading.includes("not sure about"))!;
    expect(notSure).toBeDefined();
    const notSureBody = (notSure.body as string[]).join("\n");
    expect(notSureBody).toContain("Uses several single words");
    expect(notSureBody).toContain('parent marked "not sure" on 2026-06-01');
    const notYet = doc.sections.find((s) => s.heading === "Skills not yet observed (past typical window)")!;
    const notYetBody = (notYet.body as string[]).join("\n");
    expect(notYetBody).toContain("Points to things when named");
    expect(notYetBody).toContain('parent marked "not yet" on 2026-06-02');
    expect(notYetBody).toContain("Legacy undated item");
    expect(notYetBody).not.toContain("Uses several single words"); // never double-listed
    // Counts-only guarantee holds for the whole doc (the builder also runs
    // assertClinicianExportCeiling — this is the readable assertion).
    const all = doc.sections.flatMap((s) => (Array.isArray(s.body) ? s.body : [s.body])).join("\n");
    expect(all).not.toMatch(/\d+(\.\d+)?\s*%/);
  });
});

// ── UND-3 — "Gentle watch points" card content (real domains + counts only) ──
describe("watchPointsSummary (UND-3)", () => {
  it("all-checked child → empty (card hidden / neutral — NO fabricated claim)", () => {
    const res = deriveMonitoring(
      {
        ageYears: 5,
        milestones: [
          milestone({ checked: true, ageGroup: "18 months" }),
          milestone({ checked: true, domain: "social_development", ageGroup: "2 years" }),
        ],
        now: NOW,
      },
      "Mila",
    );
    expect(watchPointsSummary(res)).toEqual([]);
  });

  it("surfaces a real unobserved past-band domain with its true count", () => {
    const res = deriveMonitoring(
      {
        ageYears: 4,
        milestones: [
          milestone({ ageGroup: "18 months" }), // language, overdue for a 4yo
          milestone({ ageGroup: "2 years" }),   // language, overdue too
        ],
        now: NOW,
      },
      "Mila",
    );
    expect(watchPointsSummary(res)).toEqual([
      { domain: "language_communication", count: 2 },
    ]);
  });

  it("no language (code-switching-class) claim unless a language item is actually unobserved", () => {
    const res = deriveMonitoring(
      {
        ageYears: 4,
        milestones: [
          milestone({ checked: true, ageGroup: "18 months" }), // language observed
          milestone({ domain: "sensory_motor_patterns", ageGroup: "18 months" }), // motor overdue
        ],
        now: NOW,
      },
      "Mila",
    );
    const points = watchPointsSummary(res);
    expect(points.map((p) => p.domain)).toEqual(["sensory_motor_patterns"]);
    expect(points.some((p) => p.domain === "language_communication")).toBe(false);
  });

  it("excludes behavior-pattern-only domains (the card is about the not-seen milestone column)", () => {
    const res = deriveMonitoring(
      {
        ageYears: 4,
        milestones: [],
        behaviorLogs: [log(), log(), log()], // 3 intense unresolved → regulation pattern
        now: NOW,
      },
      "Mila",
    );
    expect(res.elevated).toBe(true); // the monitoring layer still flags it…
    expect(watchPointsSummary(res)).toEqual([]); // …but the milestone card stays silent
  });

  it("caps at two domains, largest count first", () => {
    const res = deriveMonitoring(
      {
        ageYears: 6,
        milestones: [
          milestone({ domain: "language_communication", ageGroup: "18 months" }),
          milestone({ domain: "social_development", ageGroup: "2 years" }),
          milestone({ domain: "social_development", ageGroup: "18 months" }),
          milestone({ domain: "sensory_motor_patterns", ageGroup: "2 years" }),
        ],
        now: NOW,
      },
      "Mila",
    );
    const points = watchPointsSummary(res);
    expect(points).toHaveLength(2);
    expect(points[0]).toEqual({ domain: "social_development", count: 2 });
    expect(points[1].count).toBe(1);
  });
});
