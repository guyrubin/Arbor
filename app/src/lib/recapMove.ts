/* ════════════════════════════════════════════════════════════════════════════
   recapMove — TJB-11: the weekly recap's ONE move must never vanish silently.

   The recap ends on a single card whose whole job is one recommendation
   (`digest.tryThisWeek`) with a CTA into `acceptTodayAction`. TODAY-1 correctly
   forbids persisting FALLBACK copy into `actionLoops` — deterministic
   boilerplate must never be replayed back as "the model's step" — so WeeklyTab
   passes `canAccept: digest.generated === "ai"`.

   The defect was what happens next. RecapStoryCards renders the CTA when
   `canAccept`, a done-state when `accepted`, and — when NEITHER — nothing at
   all. So on a fallback week the parent reaches the last card, reads a
   suggestion, and finds a blank space where every other week has a button. No
   error, no explanation, no route. The move is simply gone.

   This module is the pure resolution of that card's action state so the
   "silent" case is impossible to reach by accident: `kind: "note"` is a real,
   named outcome that the renderer must handle, not a fall-through.

   It does NOT relax TODAY-1 — `kind: "accept"` still requires an AI digest.
   ════════════════════════════════════════════════════════════════════════════ */

export type RecapMove =
  /** The step is already today's — show the done-state. */
  | { kind: "accepted" }
  /** A model-written step: offer the accept CTA. */
  | { kind: "accept" }
  /** Built-in guidance: show the suggestion WITH an honest note, never a CTA. */
  | { kind: "note"; noteKey: string; whyKey: string }
  /** There is no recommendation text at all — render no action affordance. */
  | { kind: "none" };

export function resolveRecapMove(input: {
  /** The recommendation text as stored on the digest. */
  text: string | null | undefined;
  /** WeeklyTab's TODAY-1 decision: AI digests only. */
  canAccept: boolean;
  /** Today's step already IS this recommendation. */
  accepted: boolean;
}): RecapMove {
  if (!input.text || !input.text.trim()) return { kind: "none" };
  if (input.accepted) return { kind: "accepted" };
  if (input.canAccept) return { kind: "accept" };
  return {
    kind: "note",
    noteKey: "elev.closeloop.recap.builtin",
    whyKey: "elev.closeloop.recap.builtin.why",
  };
}
