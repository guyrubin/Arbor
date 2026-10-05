/**
 * lib/library/bookArtStates — a page's ordered PICTURE STATES, cued by the
 * narration (manuscript v3, p9: the swing → the stone in flight on "The stone
 * flew" → the dust on "BOOM" → the quiet after the file ends). Pure, so the
 * reader's timing is testable without a clock.
 *
 * - Stage 0 = the page as authored; stage n = `states[n - 1]` is showing.
 * - Each state has a CUE inside the page's narration: "start" (page show),
 *   { atMs }, { atFraction } of the file's duration, "audioEnd", or
 *   { afterMs } after the previous state. A `cueKey` (flight, boom) is
 *   looked up first in the per-voice sidecar next to the file
 *   (`<file>.cues.json`, { flight: ms, boom: ms }); without a sidecar the
 *   cue's own fraction applies.
 * - Silent (Sound off, no file): each state comes `silentAfterMs` after the
 *   previous one (the page show for the first).
 * - A Next press (or a tap on the picture) brings the next unseen state;
 *   Next turns the page only after the LAST state has held ART_STATE_HOLD_MS.
 * - An overlay any state names shows only in the states that list it. A
 *   state's plate cross-fades in over the page's plate (the latest reached
 *   state with a plate wins); a state's pose replaces the hero's pose from
 *   then on. A state whose plate is not in the book's table is skipped.
 * - A page with no authored states but overlays marked
 *   `reveal: "afterNarration"` gets one derived state (the v1 dust).
 */
import type { ArtCue, ArtState, Page } from "./types";

/** After the last state: stillness before Next turns the page. */
export const ART_STATE_HOLD_MS = 1500;

/** Where the narration is (ms), as the audio element reports it. */
export interface NarrationClock {
  positionMs: number;
  /** NaN / Infinity until the file's duration is known. */
  durationMs: number;
  ended: boolean;
}

/** Per-voice cue times (ms) from the `<file>.cues.json` sidecar. */
export type CueTimes = Record<string, number>;

/** The page's states, in order, minus those whose plate is missing. */
export function pageArtStates(page: Page, hasPlate: (plateId: string) => boolean): ArtState[] {
  const authored: ArtState[] =
    page.artStates ??
    (() => {
      const ovs = (page.overlays ?? []).filter((o) => o.reveal === "afterNarration");
      if (!ovs.length) return [];
      const at = ovs.find((o) => o.revealAt != null)?.revealAt;
      const cue: ArtCue = at != null ? { atMs: at * 1000 } : "audioEnd";
      return [{ id: "reveal", overlays: ovs.map((o) => o.id), cue, silentAfterMs: 5000 }];
    })();
  // a skipped state's silent wait passes to the next kept one (Sound off,
  // flight not delivered: the dust still comes at 4 s + 1.5 s)
  const out: ArtState[] = [];
  let carry = 0;
  for (const s of authored) {
    if (s.plateId && !hasPlate(s.plateId)) carry += s.silentAfterMs;
    else {
      out.push(carry ? { ...s, silentAfterMs: s.silentAfterMs + carry } : s);
      carry = 0;
    }
  }
  return out;
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

function latest<K extends "plateId" | "pose">(states: readonly ArtState[], n: number, key: K): string | null {
  for (let i = Math.min(n, states.length) - 1; i >= 0; i--) {
    const v = states[i][key];
    if (v) return v;
  }
  return null;
}

/** The state plate showing at stage `n`, or null = the page's own plate. */
export const statePlateAt = (states: readonly ArtState[], n: number): string | null => latest(states, n, "plateId");

/** The hero pose a state has set by stage `n`, or null = the page's pose. */
export const statePoseAt = (states: readonly ArtState[], n: number): string | null => latest(states, n, "pose");

/** A state's cue time in ms within this file, or null (not a point in time,
 *  or the duration is not known yet). The sidecar wins over the fraction. */
export function cueMs(state: ArtState, durationMs: number, cues: CueTimes): number | null {
  if (state.cueKey && Number.isFinite(cues[state.cueKey])) return cues[state.cueKey];
  const c = state.cue;
  if (c === "start") return 0;
  if (c === "audioEnd" || "afterMs" in c) return null;
  if ("atMs" in c) return c.atMs;
  return Number.isFinite(durationMs) && durationMs > 0 ? c.atFraction * durationMs : null;
}

/** The stage the narration has reached from stage `n`: every following state
 *  whose cue point has passed (on `ended`, every cue but a timed one). */
export function audioStage(states: readonly ArtState[], n: number, clock: NarrationClock, cues: CueTimes): number {
  let i = n;
  for (; i < states.length; i++) {
    const s = states[i];
    if (typeof s.cue === "object" && "afterMs" in s.cue) break;
    const at = cueMs(s, clock.durationMs, cues);
    const reached = clock.ended || (at != null && clock.positionMs >= at);
    if (!reached) break;
  }
  return i;
}

/** How long after reaching stage `n` the next state comes by a timer, or null
 *  (the narration brings it). Silent: always its `silentAfterMs`. */
export function timerDelay(states: readonly ArtState[], n: number, silent: boolean): number | null {
  const s = states[n];
  if (!s) return null;
  if (silent) return s.silentAfterMs;
  if (s.cue === "start") return 0;
  if (typeof s.cue === "object" && "afterMs" in s.cue) return s.cue.afterMs;
  return null;
}

/** The sidecar path for a narration file: `<page>.mp3` → `<page>.cues.json`. */
export function cuesPath(src: string): string {
  return src.replace(/\.(mp3|wav|m4a)$/, "") + ".cues.json";
}

/** Read a sidecar (untrusted JSON): finite, non-negative ms per key. */
export function readCues(raw: unknown): CueTimes {
  const out: CueTimes = {};
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw)) if (/^[A-Za-z0-9_-]{1,32}$/.test(k) && typeof v === "number" && Number.isFinite(v) && v >= 0) out[k] = v;
  return out;
}

/** What a press of Next does: a state still to come → bring it; the stillness
 *  after the last state → nothing; else turn the page. */
export function nextIntent(staged: boolean, allShown: boolean, holding: boolean): "reveal" | "hold" | "turn" {
  if (staged && !allShown) return "reveal";
  if (holding) return "hold";
  return "turn";
}
