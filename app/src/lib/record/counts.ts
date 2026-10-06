/* B-GROWTH-35 — ONE truth: every count of the child's record on every screen
 * comes from these selectors. Care "What changed" (components/sections/
 * AskSpecialist, mounted by ConsultTab), the visit packet's "since the last
 * export" delta (consult/packet), Milestones' headline and domain rows, the
 * Journal's "moments this week" (lib/signalTimeline.weekMomentCount delegates
 * here), the Profile chapter and #/reports' lead line all call the functions
 * below. Nothing else counts moments or noticed milestones.
 *
 * The rules (over the same records the read model lib/observations.ts folds,
 * typed as a narrowing of its ObservationSources):
 *   - a MOMENT is one behaviorLogs row, or one day of words the parent wrote
 *     down in one language (langObs, folded per UTC day per language exactly
 *     as the Journal row is — wordDays below is that ONE fold);
 *   - a NOTICED MILESTONE is a milestone the parent marked `checked`;
 *   - a FIRST is a keepsake the parent kept on a noticed milestone.
 *
 * The window: `sinceIso === null` means the WHOLE record ("since you
 * started") and includes records that carry no date (legacy marks made before
 * every mark was stamped). A date means strictly after it and never after now
 * — an undated record is never "new since" anything.
 *
 * Why not toObservations(): the read model leaves a record without a valid
 * date OUT by design, so a "since you started" read through it (or through a
 * date filter anchored on the first dated entry, as Care's line was) drops
 * every undated noticed milestone — the "0 milestones noticed" beside
 * Milestones' "6 noticed".
 *
 * CLINICAL FIREWALL (law 1): integers only. No denominator, no rate, no
 * delta between periods, no percentage.
 */
import type { ObservationSources } from "../observations";

export type RecordCountSources = {
  behaviorLogs?: ReadonlyArray<{ timestamp?: string | number | null }>;
  milestones?: ReadonlyArray<{ id?: string; checked?: boolean; observationUpdatedAt?: string | null }>;
  keepsakes?: ReadonlyArray<{ milestoneId: string; noticedOn?: string | null }>;
  langObs?: ReadonlyArray<{ timestamp?: string | null; language?: string | null; phrase?: string | null }>;
};

/** Compile-time tie: the read model's records are valid count sources. */
export const asCountSources = (s: Pick<ObservationSources, "behaviorLogs" | "milestones" | "keepsakes" | "langObs">): RecordCountSources => s;

const toMs = (v: string | number | null | undefined): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  if (!v) return NaN;
  return new Date(v).getTime();
};

/** In the window? `sinceIso` null = the whole record (undated included). */
const inWindow = (at: string | number | null | undefined, sinceIso: string | null, nowMs: number): boolean => {
  const t = toMs(at);
  if (sinceIso === null) return !Number.isFinite(t) || t <= nowMs;
  if (!Number.isFinite(t)) return false;
  const since = toMs(sinceIso);
  return (Number.isFinite(since) ? t > since : true) && t <= nowMs;
};

export interface WordDay {
  language: string;
  /** UTC YYYY-MM-DD */
  day: string;
  /** ISO of the newest word that day (the row's date). */
  latest: string;
  /** The words, newest first. */
  phrases: string[];
}

/** THE fold of written-down words: one row per UTC day per language. The
 *  Journal (lib/signalTimeline.buildTimeline) renders these rows; the moment
 *  count counts them. */
export function wordDays(langObs: RecordCountSources["langObs"]): WordDay[] {
  const days = new Map<string, { language: string; day: string; latest: string; latestMs: number; phrases: { ms: number; phrase: string }[] }>();
  for (const o of langObs ?? []) {
    const phrase = o.phrase?.trim();
    const language = o.language?.trim();
    if (!phrase || !language || !o.timestamp) continue;
    const ms = new Date(o.timestamp).getTime();
    if (!Number.isFinite(ms)) continue;
    const day = new Date(ms).toISOString().slice(0, 10);
    const key = `${language.toLowerCase()}|${day}`;
    const entry = days.get(key);
    if (!entry) {
      days.set(key, { language, day, latest: o.timestamp, latestMs: ms, phrases: [{ ms, phrase }] });
    } else {
      entry.phrases.push({ ms, phrase });
      if (ms > entry.latestMs) {
        entry.latest = o.timestamp;
        entry.latestMs = ms;
      }
    }
  }
  return [...days.values()].map((e) => ({
    language: e.language,
    day: e.day,
    latest: e.latest,
    phrases: e.phrases.sort((a, b) => b.ms - a.ms).map((p) => p.phrase),
  }));
}

/** Moments on already-folded rows (the Journal's timeline signals): rows of
 *  kind "moment" in the window. The same rule as momentsSince. */
export function momentRowsSince(
  rows: ReadonlyArray<{ kind: string; at: string | null }>,
  sinceIso: string | null,
  nowMs: number = Date.now(),
): number {
  return rows.filter((r) => r.kind === "moment" && inWindow(r.at, sinceIso, nowMs)).length;
}

/** Moments the parent captured since `sinceIso` (null = the whole record). */
export function momentsSince(src: RecordCountSources, sinceIso: string | null, nowMs: number = Date.now()): number {
  const logs = (src.behaviorLogs ?? []).filter((l) => inWindow(l.timestamp, sinceIso, nowMs)).length;
  const words = wordDays(src.langObs).filter((w) => inWindow(w.latest, sinceIso, nowMs)).length;
  return logs + words;
}

/** Milestones the parent marked noticed since `sinceIso` (null = all of them,
 *  undated legacy marks included). */
export function milestonesNoticedSince(src: RecordCountSources, sinceIso: string | null, nowMs: number = Date.now()): number {
  return (src.milestones ?? []).filter((m) => m.checked === true && inWindow(m.observationUpdatedAt, sinceIso, nowMs)).length;
}

/** Firsts the parent kept (a keepsake on a noticed milestone) since `sinceIso`.
 *  `noticedOn` is a local day (YYYY-MM-DD): "since" = a later day. */
export function firstsSince(src: RecordCountSources, sinceIso: string | null, nowMs: number = Date.now()): number {
  const noticed = new Set((src.milestones ?? []).filter((m) => m.checked === true && m.id).map((m) => m.id as string));
  const today = new Date(nowMs).toISOString().slice(0, 10);
  return (src.keepsakes ?? []).filter((k) => {
    if (!noticed.has(k.milestoneId)) return false;
    if (sinceIso === null) return true;
    const day = k.noticedOn ?? "";
    return /^\d{4}-\d{2}-\d{2}$/.test(day) && day > sinceIso.slice(0, 10) && day <= today;
  }).length;
}

/**
 * B-GROWTH-34 → B-GROWTH-35 — "how many milestones has the parent noticed",
 * whole record, with the per-domain split the Milestones rows read. Plain
 * counts (law 1): no denominator, no window total, no share. `noticed` IS
 * milestonesNoticedSince(record, null). lib/pulse re-exports this.
 */
export function noticedMilestoneCounts(
  milestones: ReadonlyArray<{ checked: boolean; domain: string }>,
): { noticed: number; areas: number; byDomain: Record<string, number> } {
  const byDomain: Record<string, number> = {};
  for (const m of milestones) {
    if (!m.checked) continue;
    byDomain[m.domain] = (byDomain[m.domain] ?? 0) + 1;
  }
  return { noticed: milestonesNoticedSince({ milestones }, null), areas: Object.keys(byDomain).length, byDomain };
}

const WEEK_MS = 7 * 86_400_000;

/** B-CAREPRO-NEW-2e — #/reports' lead line and Care's "What changed":
 *  moments and noticed milestones since an anchor (no anchor = this week).
 *  `wholeRecord: true` = "since you started": the whole record, undated
 *  marks included (never a date filter on the first dated entry). */
export function reportsLeadCounts(input: {
  logs: RecordCountSources["behaviorLogs"];
  milestones: RecordCountSources["milestones"];
  langObs?: RecordCountSources["langObs"];
  sinceIso: string | null;
  nowMs: number;
  wholeRecord?: boolean;
}): { moments: number; milestones: number; sinceMs: number } {
  const src: RecordCountSources = { behaviorLogs: input.logs, milestones: input.milestones, langObs: input.langObs };
  if (input.wholeRecord) {
    return { moments: momentsSince(src, null, input.nowMs), milestones: milestonesNoticedSince(src, null, input.nowMs), sinceMs: Number.NEGATIVE_INFINITY };
  }
  const since = input.sinceIso ? new Date(input.sinceIso).getTime() : NaN;
  const sinceMs = Number.isFinite(since) ? since : input.nowMs - WEEK_MS;
  const sinceIso = new Date(sinceMs).toISOString();
  return { moments: momentsSince(src, sinceIso, input.nowMs), milestones: milestonesNoticedSince(src, sinceIso, input.nowMs), sinceMs };
}
