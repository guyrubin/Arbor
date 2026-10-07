/**
 * B-LOOP-11 — the journal by shelves: pure selectors over the read model.
 *
 *  · `shelfSignalIds` maps the shelf's observations to the timeline's signal
 *    ids (behaviorLogs → `moment-`, milestones → `milestone-`, actionLoops →
 *    `action-`), so a shelf page renders the SAME day-grouped engine
 *    (signalTimeline.groupByDay) filtered by `shelfOf` and nothing else;
 *  · `shelfPractice` is the B-LOOP-09 chooser scoped to ONE shelf (its
 *    `candidateFilter` seam — no chooser change);
 *  · `shelfNotice` is the B-LOOP-04 per-shelf selection for ONE shelf.
 *
 * FIREWALL: counts choose nothing here and compare nothing; a shelf's count
 * is read only to print "{n} noticed" on its own tile (never ranked, never
 * coloured, the grid order is the registry's `order`).
 */
import type { BehaviorLog, Milestone } from "../../types";
import type { Observation, ObservationOrigin } from "../observations";
import type { TimelineSignal } from "../signalTimeline";
import type { ShelfId } from "../shelves/registry";
import { selectNextMilestonesByShelf, type NoticePick } from "../milestones/selectByShelf";
import { practiceCandidates, type ChoosePracticeInput, type PracticePick } from "../practice/choosePractice";
import { shelfWordsThenNow, type DatedWords } from "../today/shelfWords";
import { quotableWords } from "../today/fromRecord";

/** Read-model origin → the timeline signal id prefix (the origins the journal thread shows). */
export const SIGNAL_PREFIX: Partial<Record<ObservationOrigin, string>> = {
  behaviorLogs: "moment-",
  milestones: "milestone-",
  actionLoops: "action-",
};

/** The signal ids of the observations filed on `shelf`. */
export function shelfSignalIds(observations: ReadonlyArray<Pick<Observation, "id" | "origin" | "shelf">>, shelf: ShelfId): Set<string> {
  const out = new Set<string>();
  for (const o of observations) {
    if (o.shelf !== shelf) continue;
    const prefix = SIGNAL_PREFIX[o.origin];
    if (!prefix) continue;
    const recordId = o.id.slice(o.origin.length + 1);
    out.add(`${prefix}${recordId}`);
  }
  return out;
}

/** The timeline signals on one shelf, in the stream's own order. */
export function signalsOnShelf(
  signals: readonly TimelineSignal[],
  observations: ReadonlyArray<Pick<Observation, "id" | "origin" | "shelf">>,
  shelf: ShelfId,
): TimelineSignal[] {
  const ids = shelfSignalIds(observations, shelf);
  return signals.filter((s) => ids.has(s.id));
}

/** The shelf's next practice: the chooser's candidate for this shelf only. */
export function shelfPractice(input: ChoosePracticeInput, shelf: ShelfId): PracticePick | null {
  const prior = input.candidateFilter;
  return practiceCandidates({ ...input, candidateFilter: (p) => p.shelf === shelf && (!prior || prior(p)) }, 1)[0] ?? null;
}

/** The shelf's next thing to notice (never ahead of band, never a shelf answered today). */
export function shelfNotice(milestones: Milestone[], comparisonMonths: number | null, shelf: ShelfId, now: Date = new Date()): NoticePick | null {
  if (comparisonMonths === null) return null;
  return selectNextMilestonesByShelf(milestones, comparisonMonths, { perShelf: 1, total: 9, now }).find((p) => p.shelf === shelf) ?? null;
}

/* ── B-LOOP-12 — the professional view's per-domain counts ─────────────── */

export interface ProDomainCounts {
  /** Entries on the domain's shelves in the last `days` days. */
  noticed: number;
  /** Milestones the parent marked seen on the domain's shelves (all time). */
  milestonesSeen: number;
  /** Distinct days with a practice done on the domain's shelves in the window. */
  practiceDays: number;
}

/** Counts only, per registry domain (through each entry's shelf). */
export function proDomainCounts(
  observations: ReadonlyArray<Pick<Observation, "at" | "origin" | "shelf">>,
  shelvesOf: (shelf: ShelfId) => string,
  now: Date = new Date(),
  days = 30,
): Map<string, ProDomainCounts> {
  const out = new Map<string, ProDomainCounts>();
  const end = now.getTime();
  const start = end - days * 86_400_000;
  const practice = new Map<string, Set<string>>();
  for (const o of observations) {
    if (!o.shelf) continue;
    const domain = shelvesOf(o.shelf);
    const c = out.get(domain) ?? { noticed: 0, milestonesSeen: 0, practiceDays: 0 };
    const t = Date.parse(o.at);
    const inWindow = Number.isFinite(t) && t >= start && t <= end;
    if (inWindow) c.noticed += 1;
    if (o.origin === "milestones") c.milestonesSeen += 1;
    if (o.origin === "actionLoops" && inWindow) {
      const set = practice.get(domain) ?? new Set<string>();
      set.add(o.at.slice(0, 10));
      practice.set(domain, set);
      c.practiceDays = set.size;
    }
    out.set(domain, c);
  }
  return out;
}

/* ── P5-LOOP c2 r1 · B-LOOP-NEW-1c / 1d — the grid remembers in the parent's words ── */

/** "Today" / "Yesterday" (Intl, so EN and HE localize natively), else "2 Oct". */
export function shelfDayLabel(iso: string, now: Date, locale: string): string {
  const at = new Date(iso);
  if (!Number.isFinite(at.getTime())) return "";
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const daysAgo = Math.round((day(now) - day(at)) / 86_400_000);
  if (daysAgo === 0 || daysAgo === 1) {
    try {
      const s = new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-daysAgo, "day");
      return s.charAt(0).toUpperCase() + s.slice(1);
    } catch {
      /* fall through to the date */
    }
  }
  return at.toLocaleDateString(locale === "he" ? "he-IL" : "en-GB", { day: "numeric", month: "short" });
}

/** Per shelf, the parent's newest own words on it (lib/today/shelfWords `now`), verbatim. */
export function latestWordsByShelf(
  observations: ReadonlyArray<Pick<Observation, "id" | "origin" | "shelf" | "at">>,
  logs: readonly BehaviorLog[],
  shelves: readonly ShelfId[],
): Partial<Record<ShelfId, DatedWords>> {
  const out: Partial<Record<ShelfId, DatedWords>> = {};
  for (const shelf of shelves) {
    const w = shelfWordsThenNow(observations, logs, shelf).now;
    if (w) out[shelf] = w;
  }
  return out;
}

/** The newest of those, with its shelf — null when the parent has written nothing yet. */
export function latestOwnWords(byShelf: Partial<Record<ShelfId, DatedWords>>): (DatedWords & { shelf: ShelfId }) | null {
  let best: (DatedWords & { shelf: ShelfId }) | null = null;
  for (const [shelf, w] of Object.entries(byShelf) as [ShelfId, DatedWords][]) {
    if (!best || Date.parse(w.at) > Date.parse(best.at)) best = { ...w, shelf };
  }
  return best;
}

/* ── P5-LOOP c2 r2 · B-LOOP-NEW-2c / 2d — one line per tile, family words first ── */

/** One dated line of the family's own words on a shelf, with its record id
 *  (so the header's entry can be excluded from its tile — never shown twice). */
export interface ShelfEntryWords extends DatedWords {
  id: string;
  /** A "Things {name} said" quote keepsake (the child's words, kept by the parent). */
  quote?: boolean;
}

/** The shelf a quote keepsake belongs to: what the child SAID is the Words shelf. */
export const QUOTE_SHELF: ShelfId = "words";

/** A quote keepsake's local day ("YYYY-MM-DD") as a local-noon instant (no UTC day shift). */
const quoteAt = (noticedOn: string): string => `${noticedOn}T12:00:00`;

/**
 * Per shelf, the family's own words, newest first: the parent's written
 * notes (behaviorLogs, `quotableWords`, verbatim) and — on the Words shelf —
 * the child's kept quotes (keepsakes `kind: "quote"`, lib/loop/tonight
 * quotesFromDocs). FIREWALL: verbatim and dated; nothing computed or compared.
 */
export function ownWordsByShelf(
  observations: ReadonlyArray<Pick<Observation, "id" | "origin" | "shelf" | "at">>,
  logs: readonly BehaviorLog[],
  quotes: ReadonlyArray<{ id: string; note: string; noticedOn: string }>,
  shelves: readonly ShelfId[],
): Partial<Record<ShelfId, ShelfEntryWords[]>> {
  const wanted = new Set<ShelfId>(shelves);
  const byId = new Map(logs.map((l) => [`behaviorLogs:${l.id}`, l]));
  const out: Partial<Record<ShelfId, ShelfEntryWords[]>> = {};
  const push = (shelf: ShelfId, w: ShelfEntryWords) => {
    (out[shelf] ??= []).push(w);
  };
  for (const o of observations) {
    if (o.origin !== "behaviorLogs" || !o.shelf || !wanted.has(o.shelf)) continue;
    const log = byId.get(o.id);
    const text = log ? quotableWords(log) : null;
    if (!text || !Number.isFinite(Date.parse(o.at))) continue;
    push(o.shelf, { id: o.id, text, at: o.at });
  }
  if (wanted.has(QUOTE_SHELF)) {
    for (const q of quotes) {
      const text = q.note.replace(/\s+/g, " ").trim();
      const at = quoteAt(q.noticedOn);
      if (!text || !Number.isFinite(Date.parse(at))) continue;
      push(QUOTE_SHELF, { id: `keepsakes:${q.id}`, text, at, quote: true });
    }
  }
  for (const list of Object.values(out)) list?.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return out;
}

/** The header's line: the parent's newest written note on any shelf (quotes are the child's words, not the parent's). */
export function latestOwnEntry(byShelf: Partial<Record<ShelfId, ShelfEntryWords[]>>): (ShelfEntryWords & { shelf: ShelfId }) | null {
  let best: (ShelfEntryWords & { shelf: ShelfId }) | null = null;
  for (const [shelf, list] of Object.entries(byShelf) as [ShelfId, ShelfEntryWords[]][]) {
    const w = list.find((x) => !x.quote);
    if (w && (!best || Date.parse(w.at) > Date.parse(best.at))) best = { ...w, shelf };
  }
  return best;
}

/** Per shelf, the newest own words EXCEPT the header's entry (that shelf shows its previous line, or none). */
export function tileWordsExcept(byShelf: Partial<Record<ShelfId, ShelfEntryWords[]>>, excludeId: string | null | undefined): Partial<Record<ShelfId, ShelfEntryWords>> {
  const out: Partial<Record<ShelfId, ShelfEntryWords>> = {};
  for (const [shelf, list] of Object.entries(byShelf) as [ShelfId, ShelfEntryWords[]][]) {
    const w = list.find((x) => x.id !== excludeId);
    if (w) out[shelf] = w;
  }
  return out;
}
