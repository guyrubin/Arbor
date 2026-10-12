import { isSupportedPlayAge } from "../../lib/age/playEligibility";
import type { ActionLoopEntry } from "../../actionLoop/model";
import type { FocusSignals } from "../../hooks/useTodaysFocus";
import type { BehaviorLog, Milestone, PlayLog } from "../../types";
import { isIncidentType } from "../../content/behaviorTaxonomy";
import { bandForAge } from "../../playbank/content";
import { selectDailyPlay, type PlaySelectContext, type ScoredActivity } from "../../playbank/select";
import { toDomains, type DomainId } from "../../lib/domains/registry";

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

/** The guide reader's "How to begin" for a step in the parent's or the
 * model's own words: its sentences, at most three (the third keeps the rest). */
export function stepLines(text: string): string[] {
  const parts = (text.match(/[^.!?]+[.!?]*/g) ?? []).map(part => part.trim()).filter(Boolean);
  if (parts.length <= 3) return parts.length ? parts : [text];
  return [parts[0], parts[1], parts.slice(2).join(" ")];
}

/** A library pick for Now. `topic-match` (v3 F-NOW-1, FEAT-02): the activity
 * speaks to an area of the family's active question, so the card may quote
 * that question; every other reason is the library's own. */
export type NowPlayPick = Omit<ScoredActivity, "reason"> & { reason: ScoredActivity["reason"] | "topic-match" };

/** Reuse the live library's ranking, but do not let weighting offer an
 * out-of-band activity on the home screen. Never expose its internal score.
 * With `topicDomains` (the areas of the active question's guide topic), the
 * in-band activities in those areas come first, in the library's own order. */
export function dailyPlayForNow(context: PlaySelectContext & { topicDomains?: readonly DomainId[] }, count = 3): NowPlayPick[] {
  if (!isSupportedPlayAge(context.ageYears)) return [];
  const band = bandForAge(context.ageYears);
  const { topicDomains, ...select } = context;
  const inBand: NowPlayPick[] = selectDailyPlay(select, 100).filter((pick) => pick.activity.bands.includes(band));
  const wanted = new Set<DomainId>(topicDomains ?? []);
  if (!wanted.size) return inBand.slice(0, count);
  const fits = (pick: NowPlayPick) => toDomains("play", pick.activity.domain, { activityId: pick.activity.id }).some((domain) => wanted.has(domain));
  const matched = inBand.filter(fits).map((pick): NowPlayPick => ({
    activity: pick.activity, score: pick.score, reason: "topic-match", ...(pick.continuation ? { continuation: true } : {}),
  }));
  return [...matched, ...inBand.filter((pick) => !fits(pick))].slice(0, count);
}
