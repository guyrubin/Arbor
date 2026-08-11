/* i18nElevation/actionbar — masterplan 4.2: the shared ContentActionBar's
 * verb canon + default labels.
 *
 * The audit found 9 hand-rolled content action clusters with zero shared
 * abstraction ("save" ships in 2 incompatible shapes inside LearnLibrary.tsx
 * alone). The consolidation contract (Kinedu's most-praised trait): the SAME
 * verbs in the SAME order on every content object. This module is that
 * contract's single source of truth:
 *
 *   - CONTENT_ACTION_ORDER — the fixed verb canon: done · save · rate ·
 *     share · more(swap). Every verb is optional per surface; the ORDER is
 *     invariant.
 *   - orderContentActions() — pure re-ordering/dedupe helper the component
 *     maps over, so canonical order can never depend on caller prop order.
 *     It lives HERE (not in the .tsx) so node-env tests pin the ordering
 *     behavior without importing React/analytics.
 *   - en/he default labels — used only when a surface passes no label
 *     override (existing surfaces keep their own t() strings, so migration
 *     changes zero visible copy).
 *
 * FIREWALL: labels are plain action words — never a grade, verdict, or
 * efficacy claim (rate asks the PARENT's opinion, echoing learn.pulseAsk).
 *
 * Hebrew = calm Israeli-parent transcreation; flagged for arbor-localization
 * native review.
 *
 * NOTE: not yet registered in i18nElevation/index.ts (that file is owned by
 * another workstream this wave — same convention as continue.ts /
 * childsignals.ts). Surfaces resolve these keys via actionbarText() below;
 * eventual index.ts registration is a pure no-op for callers. */

/** The fixed verb set. Surfaces support any subset; order is invariant. */
export type ContentActionVerb = "done" | "save" | "rate" | "share" | "more";

/** Canonical render order — done · save · rate · share · more(swap). */
export const CONTENT_ACTION_ORDER: readonly ContentActionVerb[] = [
  "done",
  "save",
  "rate",
  "share",
  "more",
];

/**
 * Re-order a surface's declared actions into the canonical verb order,
 * regardless of the order the caller passed them in. Unsupported verbs are
 * simply absent; duplicate declarations of a verb keep the FIRST occurrence
 * (one slot per verb — the bar never renders the same verb twice).
 */
export function orderContentActions<T extends { verb: ContentActionVerb }>(
  actions: readonly T[],
): T[] {
  const out: T[] = [];
  for (const verb of CONTENT_ACTION_ORDER) {
    const first = actions.find((a) => a.verb === verb);
    if (first) out.push(first);
  }
  return out;
}

export const en: Record<string, string> = {
  "elev.actionbar.done": "Did it",
  "elev.actionbar.save": "Save",
  "elev.actionbar.saved": "Saved",
  "elev.actionbar.rate": "Helpful?",
  "elev.actionbar.share": "Share",
  "elev.actionbar.more": "Swap",
};

export const he: Record<string, string> = {
  "elev.actionbar.done": "עשינו",
  "elev.actionbar.save": "שמירה",
  "elev.actionbar.saved": "נשמר",
  "elev.actionbar.rate": "עזר לכם?",
  "elev.actionbar.share": "שיתוף",
  "elev.actionbar.more": "החלפה",
};

/**
 * Direct accessor used until this module is registered in i18nElevation/
 * index.ts. Missing key → the key itself (the app-wide convention).
 */
export function actionbarText(key: string, heMode: boolean): string {
  const dict = heMode ? he : en;
  return dict[key] ?? en[key] ?? key;
}

/**
 * Default label for a verb when the surface passes no override. `active`
 * swaps save → saved (the one verb whose toggled state reads differently);
 * every other verb keeps its base label in both states.
 */
export function verbLabel(
  verb: ContentActionVerb,
  heMode: boolean,
  active?: boolean,
): string {
  const key =
    verb === "save" && active ? "elev.actionbar.saved" : `elev.actionbar.${verb}`;
  return actionbarText(key, heMode);
}
