import { describe, expect, it } from "vitest";
import type { Milestone } from "../../types";
import { firstMilestoneRecord } from "./milestonesModel";
import { milestonesRowEndSuffix } from "./useMilestonesRowEnd";

// V77 boards: the pill row on #/development and #/milestones ends
// "· your record since <the first milestone record, V10 day>". Synthetic rows.
const NOW = Date.parse("2026-11-16T12:00:00.000Z");
const row = (id: string, extra: Partial<Milestone>): Milestone => ({ id, title: id, description: "", ageGroup: "", domain: "language", checked: false, ...extra } as Milestone);
const strip = (s: string | null) => s?.replace(/[⁨⁩]/g, "") ?? null;

describe("the Milestones pill row's end", () => {
  const rows = [
    row("a", { checked: true, observationStatus: "yes", observationUpdatedAt: "2026-10-14T10:00:00.000Z" }),
    row("b", { observationStatus: "not_yet", observationUpdatedAt: "2026-10-08T09:00:00.000Z" }),
    row("c", { observationStatus: "yes", observationUpdatedAt: "2026-11-12T09:00:00.000Z", checked: true }),
  ];
  it("names the first milestone record, any answer, in the boards' day form (EN + HE)", () => {
    expect(firstMilestoneRecord(rows, NOW)).toBe(Date.parse("2026-10-08T09:00:00.000Z"));
    expect(strip(milestonesRowEndSuffix(rows, "en", NOW))).toBe("your record since Thu 8 Oct");
    const he = strip(milestonesRowEndSuffix(rows, "he", NOW))!;
    expect(he.startsWith("התיעוד שלכם מאז")).toBe(true);
    expect(he).toContain("8");
  });
  it("NEGATIVE CONTROL: no dated record, no suffix (the shell keeps its day and time)", () => {
    expect(milestonesRowEndSuffix([], "en", NOW)).toBeNull();
    // an unanswered row with a date, and an answer with no date, are not a record's day
    expect(milestonesRowEndSuffix([row("x", { observationUpdatedAt: "2026-10-01T00:00:00.000Z" }), row("y", { checked: true, observationStatus: "yes" })], "en", NOW)).toBeNull();
  });
});
