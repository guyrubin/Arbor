/* ════════════════════════════════════════════════════════════════════════════
   devPicture — the Today "Development picture" card's render decision.

   Wave S+L residue (b): the running app's card still printed "0 noticed" in
   the ring and "0 of 133 noticed" beside it on day-0 (only the 3-stat footer
   had the teach-line rule). Same rule as HubHero (RUN-08): when EVERY count
   is zero the card renders the TEACH line and NO numeral — never a
   denominator before the numerator is ≥ 1. The first non-zero count brings
   the numbers back.

   Pure — unit-tested in devPicture.test.ts (all-zero → no numeral in the
   output shape at all).
   ════════════════════════════════════════════════════════════════════════════ */

export interface DevPictureCounts {
  /** Milestones the parent marked as noticed. */
  noticed: number;
  /** The age-appropriate total the ring would be read against. */
  total: number;
  /** Parent-expressed active goals (count). */
  focus: number;
  /** Domains (of 7) with at least one noticed milestone. */
  domains: number;
  /** Moments + activities in the trailing 7 days. */
  week: number;
}

export type DevPictureView =
  | { kind: "teach" }
  | { kind: "counts"; noticed: number; total: number; focus: number; domains: number; week: number };

/**
 * Teach when nothing has been noticed AND nothing else counts either. The
 * footer stats (focus / domains / week) can be non-zero while `noticed` is 0
 * (a family that logs moments but has not marked a milestone) — that state
 * still shows the ring at 0 of N? No: the ring's "0 of 133" is the deficit
 * read the rule bans, so the ring needs `noticed ≥ 1` and the footer needs
 * any non-zero stat. Both zero → teach.
 */
export function devPictureView(c: DevPictureCounts): DevPictureView {
  const anyFooter = c.focus > 0 || c.domains > 0 || c.week > 0;
  if (c.noticed <= 0 && !anyFooter) return { kind: "teach" };
  return { kind: "counts", noticed: c.noticed, total: c.total, focus: c.focus, domains: c.domains, week: c.week };
}

/** The ring (numerator of total) renders only once something was noticed. */
export const devPictureShowsRing = (view: DevPictureView): boolean => view.kind === "counts" && view.noticed > 0;
