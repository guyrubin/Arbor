/**
 * kidExitRecap — KID-12: the parent strip shown on Kid Mode EXIT.
 *
 * The parent hands over the device, the child plays, and the parent used to
 * get nothing back: `closeKidMode` cleared state and returned nothing, and no
 * "since last visit" source read the practice ledgers. The copy and the fold
 * already existed (`lib/i18nElevation/childsignals.ts`, `foldChildActivity`) —
 * they were simply never mounted on the exit path.
 *
 * This module is the pure half: given the activity ledgers and the moment Kid
 * Mode opened, it produces ONE parent-register line naming what happened.
 *
 * ── TWO REGISTERS, KEPT APART (binding) ─────────────────────────────────────
 * The strip is shown on EXIT, to the PARENT. It is never rendered inside Kid
 * Mode and never uses kid.* copy. Equally, nothing here is a reward, a score,
 * or a streak the child would see — it reuses the existing parent-facing
 * `elev.childsignals.title.*` counts.
 *
 * ── CLINICAL FIREWALL ───────────────────────────────────────────────────────
 * COUNTS ONLY. Correctness, ratings and scores exist on the raw practice
 * records and are deliberately never read here — same rule `foldChildActivity`
 * follows. No percentage, no verdict, no colour meaning good or bad.
 */

/** The activity kinds the exit strip can name (mirrors ChildActivityType).
 *  B-SHELL-04: `hero` joined — a finished hero story was the one thing a child
 *  could do in Kid Mode that the exit recap never named. The guard in
 *  kidExitRecap.test.ts pins KID_ACTIVITY_KINDS ⊇ ChildActivityType. */
export type KidActivityKind = "practice" | "speech" | "mimic" | "adventure" | "mission" | "hero";

export const KID_ACTIVITY_KINDS: readonly KidActivityKind[] = [
  "hero",
  "speech",
  "mimic",
  "adventure",
  "mission",
  "practice",
];

/** Timestamps only — the ledgers' other fields are deliberately not accepted,
 *  so a score can never reach this module even by accident. */
export type KidActivityLedgers = Partial<Record<KidActivityKind, (string | number | undefined | null)[]>>;

export type KidActivityCounts = Partial<Record<KidActivityKind, number>>;

const msOf = (stamp: string | number | undefined | null): number | null => {
  if (stamp == null || stamp === "") return null;
  const ms = typeof stamp === "number" ? stamp : Date.parse(stamp);
  return Number.isFinite(ms) ? ms : null;
};

/** How many rows each ledger gained since `sinceMs`. Kinds with none are
 *  omitted entirely, so a quiet session produces an empty object (and no
 *  strip) rather than a row of zeroes. */
export function countsSince(ledgers: KidActivityLedgers, sinceMs: number): KidActivityCounts {
  const out: KidActivityCounts = {};
  for (const kind of KID_ACTIVITY_KINDS) {
    let n = 0;
    for (const stamp of ledgers[kind] ?? []) {
      const ms = msOf(stamp);
      if (ms != null && ms >= sinceMs) n += 1;
    }
    if (n > 0) out[kind] = n;
  }
  return out;
}

/** Total rows across every kind — the "was anything at all done?" test. */
export function totalActivity(counts: KidActivityCounts): number {
  return KID_ACTIVITY_KINDS.reduce((sum, kind) => sum + (counts[kind] ?? 0), 0);
}

type Translate = (key: string, vars?: Record<string, string | number>) => string;

/**
 * The ONE parent-register line, or null when nothing happened (no strip, no
 * empty toast). `t` must resolve the `elev.childsignals.*` keys — pass
 * `withChildSignals(t, he)` so the existing EN + HE aggregated titles are
 * reused verbatim rather than re-authored.
 */
export function kidExitRecapLine(
  counts: KidActivityCounts,
  t: Translate,
  childName: string,
  /** B-PLAY-05: extra parent-register parts (finished story titles) and the
   *  wrapper key; the exit strip passes neither and is unchanged. */
  opts: { extraParts?: readonly string[]; stripKey?: string } = {},
): string | null {
  const parts: string[] = [];
  for (const kind of KID_ACTIVITY_KINDS) {
    const n = counts[kind];
    if (!n) continue;
    parts.push(t(`elev.childsignals.title.${kind}.${n === 1 ? "one" : "many"}`, { count: n }));
  }
  for (const extra of opts.extraParts ?? []) if (extra.trim()) parts.push(extra);
  if (parts.length === 0) return null;
  const name = childName.trim() || t("elev.childsignals.prov.fallback");
  return t(opts.stripKey ?? "elev.learnCare.kidExit.strip", {
    name,
    summary: parts.join(t("elev.learnCare.kidExit.join")),
  });
}

/** B-PLAY-05: the fallback window when no Kid Mode session is known (7 days). */
export const SINCE_LAST_PLAY_FALLBACK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * B-PLAY-05 + W2-SHELLPLAY critic r1 — the Practice door's ONE sentence:
 * "Since Tuesday, Dylan played 3 rounds and finished <title>."
 *
 * One unit ("rounds": every ledger row is one round played), one stated window
 * (the weekday the latest Kid Mode session began; "In the last 7 days" when
 * none is known — the fallback window), and at most one finished story title,
 * which the caller renders bidi-isolated in the editorial face. Hebrew takes
 * the verb's gender from the child's profile; with no gender on file it uses
 * an impersonal form — never a slash. null when nothing happened, so day 0
 * renders nothing. Counts only — no correctness, no score, no streak.
 */
export interface DoorSinceSentence {
  /** Text before the story title (or the whole sentence when there is none). */
  before: string;
  /** The finished story's title, or null. Render inside a bidi isolate. */
  title: string | null;
  after: string;
  rounds: number;
}

/** The sentinel split around the title, so the title can be its own node. */
const TITLE_SLOT = "[[title]]";

export function doorSinceSentence(input: {
  ledgers: KidActivityLedgers;
  stories: ReadonlyArray<{ title: string; completedAt?: string | null }>;
  sinceMs: number;
  /** true when sinceMs is the 7-day fallback, not a known session start. */
  sinceIsFallback: boolean;
  nowMs: number;
  uiLang: "en" | "he";
  gender?: string | null;
  t: Translate;
  childName: string;
}): DoorSinceSentence | null {
  const rounds = totalActivity(countsSince(input.ledgers, input.sinceMs));
  const story = input.stories.find((s) => {
    const ms = msOf(s.completedAt ?? null);
    return ms != null && ms >= input.sinceMs && !!s.title?.trim();
  });
  if (rounds === 0 && !story) return null;

  const locale = input.uiLang === "he" ? "he-IL" : "en-GB";
  const sameDay = new Date(input.sinceMs).toDateString() === new Date(input.nowMs).toDateString();
  const when = input.sinceIsFallback
    ? input.t("elev.practice.door.when.week")
    : sameDay
    ? input.t("elev.practice.door.when.today")
    : input.t("elev.practice.door.when.day", {
        day: new Intl.DateTimeFormat(locale, { weekday: "long" }).format(new Date(input.sinceMs)),
      });
  const g = input.gender === "boy" || input.gender === "girl" ? input.gender : "neutral";
  const shape = rounds > 0 && story ? "playedFinished" : rounds > 0 ? "played" : "finished";
  const name = input.childName.trim() || input.t("elev.childsignals.prov.fallback");
  const roundsText = rounds > 0 ? input.t(rounds === 1 ? "elev.practice.door.rounds.one" : "elev.practice.door.rounds.many", { n: rounds }) : "";
  const full = input.t(`elev.practice.door.sentence.${shape}.${g}`, {
    when,
    name,
    rounds: roundsText,
    title: story ? TITLE_SLOT : "",
  });
  if (!story) return { before: full, title: null, after: "", rounds };
  const [before, after = ""] = full.split(TITLE_SLOT);
  return { before, title: story.title.trim(), after, rounds };
}
