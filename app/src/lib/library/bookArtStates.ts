/**
 * lib/library/bookArtStates — manuscript v2, engine 1: a page's ordered
 * PICTURE STATES (p9: the swing → the dust on "BOOM" → "the soldiers rise").
 * Pure, so the reader's timing is testable without a clock.
 *
 * - Stage 0 = the page as authored; stage n = `states[n - 1]` is showing.
 * - The first state may wait for the narration's reveal moment ("narration":
 *   REVEAL_LEAD_S before the file ends; 5 s after the page shows when it is
 *   silent); a timed state comes `afterMs` after the previous one
 *   (`silentAfterMs` on a silent page). A tap on the picture or a Next press
 *   brings the next state at once. After the LAST state the page holds still
 *   for ART_STATE_HOLD_MS before Next turns it.
 * - An overlay that any state names is visible only in the states that list
 *   it (the dust shows in "dust", not on the "rise" plate, which paints its
 *   own settling dust). A state's plate cross-fades in over the page's plate;
 *   the hero sprite stays.
 * - A state whose plate is not in the book's plate table is skipped (art not
 *   delivered yet) — the page then behaves exactly as before.
 * - A page with no authored states but overlays marked
 *   `reveal: "afterNarration"` gets one derived state (the v1 dust).
 */
import type { ArtState, Page } from "./types";

/** After the last state: stillness before Next turns the page (ruling 5). */
export const ART_STATE_HOLD_MS = 1500;

/** The page's states, in order, minus those whose plate is missing. */
export function pageArtStates(page: Page, hasPlate: (plateId: string) => boolean): ArtState[] {
  const authored: ArtState[] =
    page.artStates ??
    (() => {
      const ids = (page.overlays ?? []).filter((o) => o.reveal === "afterNarration").map((o) => o.id);
      return ids.length ? [{ id: "reveal", overlays: ids, trigger: "narration" as const }] : [];
    })();
  return authored.filter((s) => !s.plateId || hasPlate(s.plateId));
}

/** Overlay ids some state controls. */
export function stagedOverlayIds(states: readonly ArtState[]): Set<string> {
  return new Set(states.flatMap((s) => s.overlays));
}

/** Is this overlay hidden at stage `n`? (Overlays no state names: never.) */
export function overlayHiddenAt(states: readonly ArtState[], n: number, overlayId: string): boolean {
  if (!stagedOverlayIds(states).has(overlayId)) return false;
  if (n <= 0) return true;
  return !states[Math.min(n, states.length) - 1].overlays.includes(overlayId);
}

/** The state plate showing at stage `n` (the latest reached state that has
 *  one), or null = the page's own plate. */
export function statePlateAt(states: readonly ArtState[], n: number): string | null {
  for (let i = Math.min(n, states.length) - 1; i >= 0; i--) if (states[i].plateId) return states[i].plateId!;
  return null;
}

/** How long after reaching stage `n` the next state comes by itself, or null
 *  (the first state waits for the narration; the last has no next). */
export function nextStateDelay(states: readonly ArtState[], n: number, silent: boolean): number | null {
  const s = states[n];
  if (!s || n === 0 || s.trigger === "narration") return null;
  return silent ? s.trigger.silentAfterMs : s.trigger.afterMs;
}

/** What a press of Next does: a state still to come → bring it; the stillness
 *  after the last state → nothing; else turn the page. */
export function nextIntent(staged: boolean, allShown: boolean, holding: boolean): "reveal" | "hold" | "turn" {
  if (staged && !allShown) return "reveal";
  if (holding) return "hold";
  return "turn";
}
