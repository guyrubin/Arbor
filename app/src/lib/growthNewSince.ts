/**
 * B-GROWTH-NEW-1A — "New since {date}" on the Growth hub (W2-GROWTH critic
 * round 1). The hub used to open on three totals ("5 noticed · 2 areas · 6
 * moments this week"): totals, not what changed. This builds 2–4 dated rows
 * in the parent's own words from what was written down since the previous
 * visit:
 *   - each milestone the parent marked "seen" (observationUpdatedAt),
 *   - the words written down, one row per language (the words themselves),
 *   - the moments written down (the newest note, quoted).
 *
 * CLINICAL FIREWALL: counts and the parent's own words only — no window total,
 * no comparison between languages or with a previous period, no verdict.
 * Pure: the caller passes `t` and the date formatter, so EN + HE share it.
 */
import type { BehaviorLog, Milestone } from "../types";
import type { LangObservation } from "../growth/vocabAgg";
import { languageName } from "./languageName";

export type NewSinceKind = "milestone" | "words" | "moment";
export interface NewSinceRow {
  id: string;
  kind: NewSinceKind;
  /** Epoch ms of the newest thing in the row (sort key). */
  at: number;
  /** The row sentence in the reader's language. */
  text: string;
  /** The parent's own words quoted in the row (bidi-isolated by the renderer), if any. */
  quote?: string;
  /** ISO timestamp the row's date is printed from. */
  dateIso: string;
}

type T = (key: string, vars?: Record<string, string | number>) => string;

/** At most this many rows; the block collapses when there are none. */
export const NEW_SINCE_MAX = 4;
/** Anchor when the parent has no previous visit on record: the last seven days. */
export const NEW_SINCE_FALLBACK_MS = 7 * 24 * 60 * 60 * 1000;
/** A note longer than this is cut on a word boundary with an ellipsis. */
export const NOTE_SNIPPET_MAX = 60;

export function noteSnippet(note: string | undefined | null, max = NOTE_SNIPPET_MAX): string {
  const s = String(note ?? "").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).trimEnd()}…`;
}

/** The instant the block anchors on: the previous visit, else seven days ago. */
export function newSinceAnchor(previousVisitAt: string | null | undefined, nowMs: number): number {
  const p = previousVisitAt ? Date.parse(previousVisitAt) : NaN;
  return Number.isFinite(p) && p < nowMs ? p : nowMs - NEW_SINCE_FALLBACK_MS;
}

export function buildNewSince(input: {
  sinceMs: number;
  milestones: Milestone[];
  langObs: LangObservation[];
  behaviorLogs: BehaviorLog[];
  milestoneTitle: (m: Milestone) => string;
  t: T;
}): NewSinceRow[] {
  const { sinceMs, milestones, langObs, behaviorLogs, milestoneTitle, t } = input;
  const after = (iso: string | undefined) => {
    const ms = iso ? Date.parse(iso) : NaN;
    return Number.isFinite(ms) && ms >= sinceMs ? ms : null;
  };
  const rows: NewSinceRow[] = [];

  for (const m of milestones) {
    const seen = m.observationStatus ? m.observationStatus === "yes" : m.checked;
    const at = seen ? after(m.observationUpdatedAt) : null;
    if (at == null) continue;
    rows.push({
      id: `ms-${m.id}`,
      kind: "milestone",
      at,
      text: t("elev.growth.newSince.noticed", { title: milestoneTitle(m) }),
      dateIso: m.observationUpdatedAt as string,
    });
  }

  const byLang = new Map<string, LangObservation[]>();
  for (const o of langObs) {
    if (after(o.timestamp) == null || !String(o.phrase ?? "").trim()) continue;
    const key = String(o.language ?? "").trim();
    byLang.set(key, [...(byLang.get(key) ?? []), o]);
  }
  for (const [lang, list] of byLang) {
    const sorted = [...list].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    const n = sorted.length;
    const language = lang ? languageName(lang, t) : "";
    const words = sorted.slice(0, 2).map((o) => `“${noteSnippet(o.phrase, 30)}”`).join(", ");
    rows.push({
      id: `words-${lang || "none"}`,
      kind: "words",
      at: Date.parse(sorted[0].timestamp),
      text: n === 1
        ? t(language ? "elev.growth.newSince.word.one" : "elev.growth.newSince.word.oneNoLang", { language })
        : t(language ? "elev.growth.newSince.word.many" : "elev.growth.newSince.word.manyNoLang", { n, language }),
      quote: words,
      dateIso: sorted[0].timestamp,
    });
  }

  const moments = behaviorLogs
    .filter((l) => after(l.timestamp) != null)
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  if (moments.length > 0) {
    const withNote = moments.find((l) => noteSnippet(l.notes).length > 0);
    const n = moments.length;
    rows.push({
      id: "moments",
      kind: "moment",
      at: Date.parse(moments[0].timestamp),
      text: n === 1
        ? t(withNote ? "elev.growth.newSince.moment.one" : "elev.growth.newSince.moment.oneNoNote")
        : t(withNote ? "elev.growth.newSince.moment.many" : "elev.growth.newSince.moment.manyNoNote", { n }),
      quote: withNote ? `“${noteSnippet(withNote.notes)}”` : undefined,
      dateIso: (withNote ?? moments[0]).timestamp,
    });
  }

  return rows.sort((a, b) => b.at - a.at).slice(0, NEW_SINCE_MAX);
}
