/**
 * Wave L · TJB-05 (second half) — the day's step on the since-visit strip.
 *
 * The strip enumerates what happened since the parent was last here. Today's
 * primary move was the one act it never listed: `actionLoops` was written and
 * read by nothing, so a parent who set a step in the morning came back in the
 * evening to a strip that said the step had not happened.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSinceVisitRows, SINCE_VISIT_MAX_ROWS } from "./sinceVisitEvents";
import { buildTimeline } from "../../lib/signalTimeline";
import { en, he } from "../../lib/i18nElevation/closeloop";

const PREV = "2026-09-03T20:00:00.000Z";
const base = {
  previousVisitAt: PREV,
  behaviorLogs: [],
  playLogs: [],
  milestones: [],
  conversations: [],
};

const accepted = {
  id: "today.child-1.2026-09-04",
  status: "accepted" as const,
  acceptedAt: "2026-09-04T07:30:00.000Z",
};

describe("TJB-05 — the step is an event on the since-visit strip", () => {
  it("was absent before the source existed, and appears now", () => {
    // Negative control: the same call WITHOUT the actions input — the shipped
    // shape — still produces nothing, so the row genuinely comes from the wire.
    expect(buildSinceVisitRows({ ...base }).rows).toHaveLength(0);
    const rows = buildSinceVisitRows({ ...base, actions: [accepted] }).rows;
    expect(rows).toEqual([
      { kind: "action", at: Date.parse(accepted.acceptedAt), done: false, focusId: `action-${accepted.id}` },
    ]);
  });

  it("a completed step is ONE row stamped at the outcome, not two events", () => {
    const rows = buildSinceVisitRows({
      ...base,
      actions: [{ ...accepted, status: "completed", outcomeAt: "2026-09-04T19:00:00.000Z" }],
    }).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "action", done: true });
    expect((rows[0] as { at: number }).at).toBe(Date.parse("2026-09-04T19:00:00.000Z"));
  });

  it("steps from before the previous visit are not new", () => {
    const old = { ...accepted, id: "old", acceptedAt: "2026-09-01T09:00:00.000Z" };
    expect(buildSinceVisitRows({ ...base, actions: [old] }).rows).toHaveLength(0);
  });

  it("the focusId is the id buildTimeline assigns the same record", () => {
    const rows = buildSinceVisitRows({ ...base, actions: [accepted] }).rows;
    const focusId = (rows[0] as { focusId: string }).focusId;
    const [signal] = buildTimeline({
      actionOutcomes: [{
        ...accepted,
        recommendation: "Name the next transition five minutes ahead.",
        source: "today-guidance",
        capacity: "standard",
      }],
    });
    // The strip's deep-link must land on a row that actually exists.
    expect(focusId).toBe(signal.id);
  });

  it("respects the strip's row budget and counts into the overflow", () => {
    const many = Array.from({ length: 5 }, (_, i) => ({
      ...accepted,
      id: `a${i}`,
      acceptedAt: new Date(Date.parse(PREV) + (i + 1) * 3_600_000).toISOString(),
    }));
    const out = buildSinceVisitRows({ ...base, actions: many });
    expect(out.rows).toHaveLength(SINCE_VISIT_MAX_ROWS);
    expect(out.totalEvents).toBe(5);
    expect(out.hiddenCount).toBe(5 - SINCE_VISIT_MAX_ROWS);
  });

  it("FIREWALL: the row carries no outcome word — a 'not today' never reaches the strip", () => {
    const rows = buildSinceVisitRows({
      ...base,
      actions: [{ ...accepted, status: "completed", outcomeAt: "2026-09-04T19:00:00.000Z" }],
    }).rows;
    expect(JSON.stringify(rows)).not.toMatch(/helped|somewhat|not_today/);
  });

  it("Today feeds the ledger in, and the strip labels both variants in EN + HE", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const overview = readFileSync(path.join(here, "../tabs/OverviewTab.tsx"), "utf8");
    expect(overview).toContain("actions: actionLoop,");

    const strip = readFileSync(path.join(here, "./SinceLastVisit.tsx"), "utf8");
    expect(strip).toContain('case "action":');
    expect(strip).toContain("elev.closeloop.since.outcome");
    expect(strip).toContain("elev.closeloop.since.accepted");
    for (const k of ["elev.closeloop.since.accepted", "elev.closeloop.since.outcome"]) {
      expect(en[k], `EN ${k}`).toBeTruthy();
      expect(he[k], `HE ${k}`).toBeTruthy();
    }
  });
});
