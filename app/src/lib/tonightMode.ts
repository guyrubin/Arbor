/**
 * B-PLAY-14 — "From today" on the Tonight cover.
 *
 * The evening entry points (the BEDTIME JITAI cue, the lifecycle story doors)
 * used to land on #/bedtime-stories, a separate route. They now land on
 * #/stories with the Tonight cover's "From today" option selected. The mode
 * rides a one-shot request (the same shape as the capture request seam), not
 * a hash: ArborContext owns `#/<tab>` and rewrites anything else.
 *
 * Device-local and in-memory only (sessionStorage backs a reload); nothing
 * about the child is stored here — just which of the two options to open on.
 */
export type TonightMode = "today" | "hero";

const KEY = "arbor.tonightMode";
let pending: TonightMode | null = null;

/** Ask the Stories page to open its Tonight cover on `mode`, once. */
export function requestTonightMode(mode: TonightMode): void {
  pending = mode;
  try { sessionStorage.setItem(KEY, mode); } catch { /* storage unavailable */ }
}

/** Read and clear the pending request (null when none). */
export function consumeTonightMode(): TonightMode | null {
  let mode = pending;
  pending = null;
  try {
    const stored = sessionStorage.getItem(KEY);
    if (!mode && (stored === "today" || stored === "hero")) mode = stored;
    sessionStorage.removeItem(KEY);
  } catch { /* storage unavailable */ }
  return mode;
}
