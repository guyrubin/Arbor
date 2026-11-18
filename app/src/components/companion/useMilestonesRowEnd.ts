import { useMemo } from "react";
import { fmtDayV10 } from "../../lib/formatDate";
import { useShellRowEnd } from "../../lib/shellSlots";
import type { Milestone } from "../../types";
import { firstMilestoneRecord } from "./milestonesModel";
import { milestonesV10Copy } from "./milestonesV10Copy";

/** The pill row's end text on My child › Milestones: "your record since <day>". Null with no dated record. Pure. */
export function milestonesRowEndSuffix(milestones: readonly Milestone[], uiLang: string, nowMs: number = Date.now()): string | null {
  const first = firstMilestoneRecord(milestones, nowMs);
  if (first === null) return null;
  return milestonesV10Copy(uiLang).recordSince.replace("{date}", fmtDayV10(first, uiLang === "he" ? "he" : "en", new Date(nowMs)));
}

/**
 * V77 boards: on #/development and #/milestones the pill row ends "Monday 16
 * November · your record since Thu 8 Oct" (the shell's day, then the first
 * milestone record). With no dated record the shell keeps its day and time.
 */
export function useMilestonesRowEnd(milestones: readonly Milestone[], uiLang: string): void {
  const suffix = useMemo(() => milestonesRowEndSuffix(milestones, uiLang), [milestones, uiLang]);
  useShellRowEnd(suffix ? { suffix } : null);
}
