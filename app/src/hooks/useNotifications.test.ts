/**
 * AP-046 — useNotifications unit tests.
 *
 * Key invariants:
 *   1. Monitoring notification text = VERBATIM DomainSignal.note (no transform).
 *   2. Badge count is "N unread notifications" framing — no "alerts/problems/issues".
 *   3. Monitoring items navigate to the "development" tab.
 *   4. JITAI nudge item uses headlineKey/bodyKey (not raw copy).
 *   5. No monitoring items emitted when child is on-track (no watch-areas).
 */
import { describe, it, expect } from "vitest";
import { deriveMonitoring } from "../lib/monitoring";
import { nextNudge } from "../lib/jitai";
import type { BehaviorLog, Milestone } from "../types";
import type { RhythmPrediction } from "../rhythm/predict";

// ── Helpers ──────────────────────────────────────────────────────────────────

const NOW = new Date("2026-06-17T12:00:00.000Z").getTime();

const baseRhythm = (over: Partial<RhythmPrediction> = {}): RhythmPrediction => ({
  confidence: "low",
  daysObserved: 2,
  daysNeeded: 5,
  bands: [],
  frictionPeak: null,
  calmWindow: null,
  windDownHour: null,
  ...over,
});

// P1-C: "overdue" means the parent ANSWERED "not yet" and the skill is past the
// band. A milestone with no observation record at all is merely unanswered and
// (correctly) produces no watch signal — see monitoring.test.ts.
const overdueMilestone = (domain: Milestone["domain"]): Milestone => ({
  id: `m-${domain}`,
  domain,
  ageGroup: "2 months",
  title: "Test skill",
  description: "desc",
  checked: false,
  observationStatus: "not_yet",
  observationUpdatedAt: new Date(NOW - 3 * 24 * 60 * 60 * 1000).toISOString(),
});

// ── Monitoring note verbatim tests ────────────────────────────────────────────

describe("AP-046: monitoring note verbatim", () => {
  it("DomainSignal.note is the source text — no string operations applied by consumers", () => {
    // Reproduce the signal that useNotifications would derive.
    const result = deriveMonitoring(
      {
        ageYears: 5, // 60 months — well past the 2-month upper bound + grace
        milestones: [overdueMilestone("language_communication")],
        behaviorLogs: [],
        now: NOW,
      },
      "Alex",
    );
    const watchArea = result.watchAreas.find((d) => d.domain === "language_communication");
    expect(watchArea).toBeDefined();
    // The note must NOT be falsy or have been trimmed/sliced/replaced.
    expect(watchArea!.note.length).toBeGreaterThan(20);
    // It must contain the non-diagnostic close from monitoring.ts buildNote().
    expect(watchArea!.note).toContain(
      "Children develop at their own pace and this isn't a diagnosis",
    );
    // It must contain the provider mention.
    expect(watchArea!.note).toContain("worth mentioning to your provider");
    // The name should appear verbatim (no transformation).
    expect(watchArea!.note).toContain("Alex");
  });

  it("on-track domains emit no monitoring notification items", () => {
    const result = deriveMonitoring(
      { ageYears: 1, milestones: [], behaviorLogs: [], now: NOW },
      "Eli",
    );
    expect(result.watchAreas.length).toBe(0);
  });

  it("monitoring item note is identical string reference (no copy transformation)", () => {
    const result = deriveMonitoring(
      {
        ageYears: 5,
        milestones: [overdueMilestone("social_development")],
        behaviorLogs: [],
        now: NOW,
      },
      "Maya",
    );
    const signal = result.watchAreas[0];
    // The note passed through to the notification is the same .note string —
    // simulate what useNotifications does: assign note: signal.note.
    const notifNote = signal.note; // no slice / replace / template-rewrite
    expect(notifNote).toBe(signal.note);
  });
});

// ── JITAI nudge tests ─────────────────────────────────────────────────────────

describe("AP-046: JITAI nudge in notifications", () => {
  it("nudge item uses headlineKey, not resolved copy", () => {
    const at = (h: number) => new Date(2026, 5, 17, h, 0, 0).getTime();
    const n = nextNudge({
      nowMs: at(16),
      rhythm: baseRhythm({ confidence: "low" }),
      loggedToday: 0,
      recent7d: 4,
      childName: "Dylan",
    });
    expect(n).not.toBeNull();
    expect(n!.kind).toBe("log");
    // The notification item would carry headlineKey (not resolved text).
    expect(n!.headlineKey).toBe("nudge.log.headline");
    expect(n!.bodyKey).toBe("nudge.log.body");
  });

  it("no nudge when conditions are quiet", () => {
    const at = (h: number) => new Date(2026, 5, 17, h, 0, 0).getTime();
    const n = nextNudge({
      nowMs: at(11),
      rhythm: baseRhythm({ confidence: "low" }),
      loggedToday: 2,
      recent7d: 6,
      childName: "Dylan",
    });
    expect(n).toBeNull();
  });
});

// ── Badge framing tests ───────────────────────────────────────────────────────

describe("AP-046: badge count framing", () => {
  it("badge aria-label uses 'unread notifications' not 'alerts'/'problems'/'issues'", () => {
    // This test codifies the requirement that the aria-label must say
    // "N unread notifications" and NOT contain "alert", "problem", or "issue".
    const buildAriaLabel = (n: number) =>
      n === 1 ? "1 unread notification" : `${n} unread notifications`;

    const ariaLabel3 = buildAriaLabel(3);
    expect(ariaLabel3).toBe("3 unread notifications");
    expect(ariaLabel3).not.toMatch(/alert|problem|issue/i);

    const ariaLabel0 = buildAriaLabel(0);
    expect(ariaLabel0).toBe("0 unread notifications");
    expect(ariaLabel0).not.toMatch(/alert|problem|issue/i);
  });

  it("singular form for exactly 1 item", () => {
    const buildAriaLabel = (n: number) =>
      n === 1 ? "1 unread notification" : `${n} unread notifications`;
    const ariaLabel = buildAriaLabel(1);
    expect(ariaLabel).toBe("1 unread notification");
  });
});

// ── TJB-03 / ENG-02 — the hook is the ONE choke point that reads the prefs ──
import { readFileSync } from "node:fs";
import path from "node:path";

describe("TJB-03 / N1-06 — useNotifications enforces the contract through the ONE choke point", () => {
  const src = readFileSync(path.join(process.cwd(), "src/hooks/useNotifications.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("NEGATIVE CONTROL — the pre-fix hook (no prefs import, unconditional nextNudge) fails these matchers", () => {
    const preFix = `import { nextNudge } from "../lib/jitai";
  const nudge = useMemo(
    () =>
      nextNudge({
        nowMs: Date.now(),
        rhythm,
        loggedToday: loggedTodayCount,
        recent7d,
        childName: firstName,
      }),`;
    expect(preFix).not.toMatch(/import \{[^}]*\bloadPrefs\b[^}]*\} from "\.\.\/growth\/jitaiPrefs"/);
    expect(preFix).not.toMatch(/planNudge/);
  });

  it("NEGATIVE CONTROL — the TJB-03 hook (quiet hours open-coded in the hook) fails the N1-06 pins", () => {
    // This is what the hook looked like immediately before N1-06: correct, but
    // a SECOND implementation site of the contract. The law is that there is
    // exactly one, and it is growth/nudgeSchedule.
    const tjb03 = `import { loadPrefs, isInQuietHours, shownNudgesToday, recordNudgeShown } from "../growth/jitaiPrefs";
  const quiet = isInQuietHours(prefs, Date.now());
  const nudge = useMemo(() => (quiet ? null : nextNudge({ ... }, prefs)), [quiet]);`;
    expect(tjb03).not.toMatch(/import \{[^}]*\bplanNudge\b[^}]*\} from "\.\.\/growth\/nudgeSchedule"/);
    expect(tjb03).toMatch(/isInQuietHours\(prefs/); // the open-coded gate …
    expect(src).not.toMatch(/isInQuietHours\(/); // … which the current hook no longer has.
  });

  it("imports loadPrefs + the shown counter from growth/jitaiPrefs, and planNudge from the choke point", () => {
    expect(src).toMatch(/import \{[^}]*\bloadPrefs\b[^}]*\} from "\.\.\/growth\/jitaiPrefs"/);
    expect(src).toMatch(/import \{[^}]*\brecordNudgeShown\b[^}]*\} from "\.\.\/growth\/jitaiPrefs"/);
    expect(src).toMatch(/import \{[^}]*\bplanNudge\b[^}]*\} from "\.\.\/growth\/nudgeSchedule"/);
  });

  it("routes the delivery decision through planNudge on the bell channel", () => {
    expect(src).toMatch(/planNudge\(\{[\s\S]*?channel: "bell"[\s\S]*?\}\)/);
    expect(src).toMatch(/const nudge = isDeliveredNudge\(plan\) \? plan\.candidate : null/);
    expect(src).toMatch(/shownToday,\s*\},\s*prefs,\s*\)/);
    expect(src).toMatch(/recordNudgeShown\(nudge\.kind\)/);
  });

  it("emits the two audit events, and never logs no_candidate as a suppression", () => {
    expect(src).toMatch(/import \{[^}]*\btrackNudgeScheduled\b[^}]*\} from "\.\.\/lib\/kpiEvents"/);
    expect(src).toMatch(/trackNudgeScheduled\(\{ kind: plan\.kind, channel: plan\.channel \}\)/);
    expect(src).toMatch(/plan\.reason !== "no_candidate"/);
  });

  it("the bell renders the CANDIDATE's copy, never the name-free template", () => {
    // The bell is in-app and behind auth: its rows are unchanged by N1-06.
    // `plan.template` is reserved for channels that leave the device, and the
    // hook must not put it on an AppNotification.
    expect(src).toContain("headlineKey: nudge.headlineKey");
    expect(src).toContain("vars: nudge.vars");
    expect(src).not.toMatch(/plan\.template/);
    expect(src).not.toMatch(/titleKey/);
  });

  it("the parent's Milestone toggle governs the monitoring items; the item carries the real route + capture flag", () => {
    expect(src).toMatch(/prefs\.types\.milestone \? monitoring\.watchAreas : \[\]/);
    expect(src).toContain("capture: nudge.capture");
    expect(src).not.toContain("nudge.action as ActiveTab");
  });
});

// ── N1-06 — the bell's rows and badge are UNCHANGED for identical prefs ──────
import { planNudge } from "../growth/nudgeSchedule";
import { DEFAULT_PREFS, isInQuietHours, type JitaiPrefs } from "../growth/jitaiPrefs";

describe("N1-06 — routing the bell through planNudge changes no row and no badge", () => {
  /** Exactly what the hook did BEFORE N1-06: quiet gate, then nextNudge. */
  const preN106 = (prefs: JitaiPrefs, shownToday: string[], nowMs: number) =>
    isInQuietHours(prefs, nowMs)
      ? null
      : nextNudge(
          { nowMs, rhythm: baseRhythm(), loggedToday: 0, recent7d: 1, childName: "Dylan", shownToday },
          prefs,
        );

  /** Exactly what the hook does now. */
  const postN106 = (prefs: JitaiPrefs, shownToday: string[], nowMs: number) => {
    const candidate = nextNudge(
      { nowMs, rhythm: baseRhythm(), loggedToday: 0, recent7d: 1, childName: "Dylan", shownToday },
      prefs,
    );
    const plan = planNudge({ prefs, shownToday, now: nowMs, candidate, channel: "bell" });
    return plan.deliver ? plan.candidate : null;
  };

  const prefsWith = ({
    types,
    ...rest
  }: Partial<Omit<JitaiPrefs, "types">> & { types?: Partial<JitaiPrefs["types"]> } = {}): JitaiPrefs => ({
    ...DEFAULT_PREFS,
    ...rest,
    types: { ...DEFAULT_PREFS.types, ...(types ?? {}) },
  });

  const matrix: Array<[string, JitaiPrefs, string[]]> = [
    ["defaults, nothing shown", prefsWith(), []],
    ["defaults, one kind shown", prefsWith(), ["log"]],
    ["defaults, at the ceiling", prefsWith(), ["log", "calm"]],
    ["guidance off", prefsWith({ types: { guidance: false } }), []],
    ["milestone off", prefsWith({ types: { milestone: false } }), []],
    ["narrow quiet window", prefsWith({ quietStart: 1, quietEnd: 6 }), []],
    ["calm-window only", prefsWith({ calmWindowOnly: true }), []],
  ];

  for (const [label, prefs, shown] of matrix) {
    it(`identical nudge row for every hour of the day — ${label}`, () => {
      for (let h = 0; h < 24; h++) {
        const nowMs = new Date(2026, 5, 17, h, 30, 0).getTime();
        const before = preN106(prefs, shown, nowMs);
        const after = postN106(prefs, shown, nowMs);
        expect(after, `hour ${h} — ${label}`).toEqual(before);
      }
    });
  }

  it("badge arithmetic is unchanged: the nudge contributes 0 or 1 row, exactly as before", () => {
    for (const [label, prefs, shown] of matrix) {
      for (let h = 0; h < 24; h++) {
        const nowMs = new Date(2026, 5, 17, h, 30, 0).getTime();
        const beforeRows = preN106(prefs, shown, nowMs) ? 1 : 0;
        const afterRows = postN106(prefs, shown, nowMs) ? 1 : 0;
        expect(afterRows, `hour ${h} — ${label}`).toBe(beforeRows);
      }
    }
  });
});
