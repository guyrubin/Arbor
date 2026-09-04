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

/** The activity kinds the exit strip can name (mirrors ChildActivityType). */
export type KidActivityKind = "practice" | "speech" | "mimic" | "adventure" | "mission";

export const KID_ACTIVITY_KINDS: readonly KidActivityKind[] = [
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
  childName: string
): string | null {
  const parts: string[] = [];
  for (const kind of KID_ACTIVITY_KINDS) {
    const n = counts[kind];
    if (!n) continue;
    parts.push(t(`elev.childsignals.title.${kind}.${n === 1 ? "one" : "many"}`, { count: n }));
  }
  if (parts.length === 0) return null;
  const name = childName.trim() || t("elev.childsignals.prov.fallback");
  return t("elev.learnCare.kidExit.strip", {
    name,
    summary: parts.join(t("elev.learnCare.kidExit.join")),
  });
}
