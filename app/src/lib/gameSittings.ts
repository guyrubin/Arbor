/* gameSittings — B-GAME-18: exactly ONE analytics event per game sitting.
 *
 * THE DEFECT THIS CLOSES
 * ──────────────────────
 * The sitting event fired from a ref inside the mounted game. A ref lives as
 * long as one mount, so every remount of the same game started a "new"
 * sitting: a reload that restores the persisted Kid Mode view, an error
 * boundary reset, the session key settling once sign-in hydrates, or a child
 * stepping back to the world and straight into the same game again. The
 * admin report then counted one visit as two or three sittings.
 *
 * THE RULE
 * ────────
 * A sitting is a stretch of play with one game, for one account and child.
 *  - Opening a game starts a sitting, unless the same game's sitting is still
 *    warm: touched less than SITTING_GAP_MS ago in this tab for the same
 *    scope. Then the open is the same sitting and nothing is sent.
 *  - Play again is always its own sitting (replay: true).
 *  - A different game, a different scope (account or child), or a gap longer
 *    than SITTING_GAP_MS starts a fresh one.
 *
 * WHAT IS KEPT, AND WHERE
 * ───────────────────────
 * The scope is a short hash computed by the caller (sittingScope) and held in
 * memory only; it is never written and never sent. The tab's last sitting is
 * kept in sessionStorage (GAME_SITTING_KEY) so a reload continues it: a
 * catalogue game id, a time and the prompted flag. No child id, no content,
 * nothing about how the child played. It is a registered device key
 * (lib/childDataSinks ACCOUNT_DEVICE_KEYS) and account deletion sweeps it.
 *
 * `prompted` marks a sitting that a grown-up's door opened Kid Mode onto
 * (markGameDoor, called by the overlay on that arrival). The admin report's
 * 7-day return counts only sittings the child opened themselves.
 */
import { catalogueId, trackGameSitting } from "./kpiEvents";

/** Re-opening the same game within this long continues the sitting. */
export const SITTING_GAP_MS = 30 * 60_000;
/** A grown-up's door mark is consumed by that game's next open within this long. */
export const DOOR_MARK_MS = 10 * 60_000;
/** sessionStorage: this tab's last sitting (game id, time, prompted). */
export const GAME_SITTING_KEY = "arbor.kidmode.sitting";

type Last = { g: string; at: number; p: boolean };
type State = { scope: string | null; last: Last | null; door: { g: string; at: number } | null };
const state: State = { scope: null, last: null, door: null };

const store = (): Storage | null => {
  try { return typeof sessionStorage === "undefined" ? null : sessionStorage; } catch { return null; }
};
function readLast(): Last | null {
  try {
    const raw = store()?.getItem(GAME_SITTING_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Last>;
    const g = catalogueId(v?.g);
    return g && typeof v.at === "number" && Number.isFinite(v.at) ? { g, at: v.at, p: v.p === true } : null;
  } catch { return null; }
}
function writeLast(last: Last | null): void {
  try {
    const s = store();
    if (!s) return;
    if (last) s.setItem(GAME_SITTING_KEY, JSON.stringify({ g: last.g, at: last.at, p: last.p }));
    else s.removeItem(GAME_SITTING_KEY);
  } catch { /* storage unavailable: memory still dedupes within the page */ }
}

/** FNV-1a over the account and child: compared in memory, never stored or sent. */
export function sittingScope(owner: string | null | undefined, child: string | null | undefined): string {
  const text = `${owner ?? ""}\u0000${child ?? ""}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

/** A first call in this page adopts the stored sitting (a reload continues it);
 *  a later change of account or child forgets it. */
function enter(scope: string): void {
  if (state.scope === scope) return;
  state.last = state.scope === null ? readLast() : null;
  if (state.scope !== null) writeLast(null);
  state.scope = scope;
}

/** A grown-up's door opened Kid Mode onto this game (KidModeOverlay). */
export function markGameDoor(game: string, now = Date.now()): void {
  const g = catalogueId(game);
  state.door = g ? { g, at: now } : null;
}
function takeDoor(g: string, now: number): boolean {
  const door = state.door;
  if (!door) return false;
  state.door = null; // any open consumes the mark: a different game means the child chose
  return door.g === g && now - door.at <= DOOR_MARK_MS;
}

/** The game opened. Sends the sitting event unless this continues a warm one.
 *  Returns whether an event was sent. */
export function openGameSitting(game: string, scope: string, now = Date.now()): boolean {
  const g = catalogueId(game);
  if (!g) return false;
  enter(scope);
  const prompted = takeDoor(g, now);
  const last = state.last;
  if (last && last.g === g && now - last.at < SITTING_GAP_MS && now >= last.at) {
    state.last = { ...last, at: now };
    writeLast(state.last);
    return false;
  }
  state.last = { g, at: now, p: prompted };
  writeLast(state.last);
  trackGameSitting({ game: g, replay: false, prompted });
  return true;
}

/** Play again: always a new sitting of the same game, same way in. */
export function replayGameSitting(game: string, scope: string, now = Date.now()): void {
  const g = catalogueId(game);
  if (!g) return;
  enter(scope);
  const prompted = state.last?.g === g ? state.last.p : false;
  state.last = { g, at: now, p: prompted };
  writeLast(state.last);
  trackGameSitting({ game: g, replay: true, prompted });
}

/** The game unmounted: the gap counts from when the child left it. */
export function leaveGameSitting(game: string, scope: string, now = Date.now()): void {
  const g = catalogueId(game);
  if (!g || state.scope !== scope || state.last?.g !== g) return;
  state.last = { ...state.last, at: now };
  writeLast(state.last);
}

/** Tests only: a fresh page. */
export function resetGameSittingsForTest(): void {
  state.scope = null; state.last = null; state.door = null;
}
