import { isSupportedPlayAge } from "../../lib/age/playEligibility";
import type { ActionLoopEntry } from "../../actionLoop/model";
import type { FocusSignals } from "../../hooks/useTodaysFocus";
import type { BehaviorLog, Milestone, PlayLog } from "../../types";
import { isIncidentType } from "../../content/behaviorTaxonomy";
import { bandForAge } from "../../playbank/content";
import { selectDailyPlay, type PlaySelectContext, type ScoredActivity } from "../../playbank/select";

const DAY = 86_400_000;

/** The same bounded signal contract as Today: counts and parent-selected
 * categories, never journal notes, quoted moments or inferred diagnoses. */
export function focusSignalsForNow(input: {
  behaviorLogs: readonly Pick<BehaviorLog, "timestamp" | "behaviorType">[];
  playLogs: readonly Pick<PlayLog, "timestamp">[];
  milestones: readonly Pick<Milestone, "checked" | "observationUpdatedAt">[];
  actionLoop: readonly ActionLoopEntry[];
}, now: Date): FocusSignals {
  const end = now.getTime();
  const since = end - 7 * DAY;
  const inWindow = (raw?: string) => {
    const at = Date.parse(raw ?? "");
    return Number.isFinite(at) && at >= since && at <= end;
  };
  const moments = input.behaviorLogs.filter((row) => inWindow(row.timestamp));
  const patterns = new Map<string, number>();
  for (const row of moments) {
    if (isIncidentType(row.behaviorType)) patterns.set(row.behaviorType, (patterns.get(row.behaviorType) ?? 0) + 1);
  }
  const topTrigger = [...patterns].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const completed = input.actionLoop
    .filter((row) => row.status === "completed" && row.outcome && Date.parse(row.outcomeAt ?? row.acceptedAt) <= end)
    .sort((a, b) => (b.outcomeAt ?? b.acceptedAt).localeCompare(a.outcomeAt ?? a.acceptedAt))[0];
  const stamps = [
    ...moments.map((row) => row.timestamp),
    ...input.playLogs.filter((row) => inWindow(row.timestamp)).map((row) => row.timestamp),
    ...input.milestones.filter((row) => row.checked && inWindow(row.observationUpdatedAt)).map((row) => row.observationUpdatedAt),
    ...input.actionLoop.filter((row) => inWindow(row.outcomeAt)).map((row) => row.outcomeAt),
  ].map((raw) => Date.parse(raw ?? "")).filter(Number.isFinite);
  return {
    count: moments.length + input.playLogs.filter((row) => inWindow(row.timestamp)).length + input.milestones.filter((row) => row.checked && inWindow(row.observationUpdatedAt)).length,
    topTrigger,
    ...(completed?.outcome ? { lastActionRecommendation: completed.recommendation, lastActionOutcome: completed.outcome } : {}),
    ...(stamps.length ? { latestAt: Math.max(...stamps) } : {}),
  };
}

/** Reuse the live library's ranking, but do not let weighting offer an
 * out-of-band activity on the home screen. Never expose its internal score. */
export function dailyPlayForNow(context: PlaySelectContext, count = 3): ScoredActivity[] {
  if (!isSupportedPlayAge(context.ageYears)) return [];
  const band = bandForAge(context.ageYears);
  return selectDailyPlay(context, 100)
    .filter((pick) => pick.activity.bands.includes(band))
    .slice(0, count);
}
