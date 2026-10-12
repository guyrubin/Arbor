import { useEffect, useRef } from "react";
import { useIsPresent } from "motion/react";
import { goToRoute, useHashQuery } from "../../hooks/useHashQuery";
import { STUDIO_WORLDS } from "../practice/studioWorlds";
import type { TogetherCategory } from "./companionChoices";

/* v3 F-TOG-2 — Together's category is the hash: #/practice?f=<category>.
   The Shell draws the five pills from PLACE_PILLS.together (F-SHELL-1) and a
   pill is a link to #/practice?f=…, so the page only READS f (default all).
   A choice made on the page (the hero move, a studio door) writes the same
   hash, a new history entry, so Back returns to the pill it left.

   The one thing kept in session storage is the way back from a parent tool:
   a world with no Kid Mode seat (word-world opens its own parent page) names
   its card, and Back focuses that card again, once. */

/** The pills, in the Shell row's order. */
export const TOGETHER_CATEGORIES: readonly TogetherCategory[] = ["all", "games", "stories", "routines", "offscreen"];
const returnDoors: readonly string[] = STUDIO_WORLDS.map((world) => `world-${world.id}`);
export type ReturnDoor = `world-${string}`;
export type TogetherReturn = { category: TogetherCategory; returnDoor: ReturnDoor };
const key = (childId: string) => `arbor.together.return.${childId}`;

/** The category a hash names; anything else is All together, and Games is All
 *  together while play is closed for this child (under three). */
export function categoryFromQuery(value: string | null | undefined, gamesAvailable: boolean): TogetherCategory {
  const category = TOGETHER_CATEGORIES.includes(value as TogetherCategory) ? value as TogetherCategory : "all";
  return category === "games" && !gamesAvailable ? "all" : category;
}

/** Only a presentation choice lives here, never a child's records or a preview. */
export function readTogetherReturn(childId: string): TogetherReturn | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key(childId)) || "null") as Partial<TogetherReturn> | null;
    if (!value || !TOGETHER_CATEGORIES.includes(value.category as TogetherCategory)) return null;
    if (!value.returnDoor || !returnDoors.includes(value.returnDoor)) return null;
    return { category: value.category as TogetherCategory, returnDoor: value.returnDoor };
  } catch { return null; }
}

export function writeTogetherReturn(childId: string, value: TogetherReturn | null) {
  try {
    if (value && returnDoors.includes(value.returnDoor) && TOGETHER_CATEGORIES.includes(value.category)) {
      sessionStorage.setItem(key(childId), JSON.stringify({ category: value.category, returnDoor: value.returnDoor }));
    } else sessionStorage.setItem(key(childId), "null");
  } catch { /* Private browsing still supports choosing in this visit. */ }
}

export function useTogetherNavigation(childId: string, gamesAvailable: boolean) {
  const isPresent = useIsPresent();
  const query = useHashQuery();
  const pageRef = useRef<HTMLDivElement>(null);
  const cancelRestoreRef = useRef<(() => void) | null>(null);
  const category = categoryFromQuery(query.get("f"), gamesAvailable);
  const categoryRef = useRef(category);
  categoryRef.current = category;
  /** The pill a choice on the page lands on: the same link a Shell pill is. */
  const setCategory = (next: TogetherCategory) => {
    cancelRestoreRef.current?.();
    writeTogetherReturn(childId, null);
    goToRoute("practice", { f: categoryFromQuery(next, gamesAvailable) });
  };
  const rememberDoor = (returnDoor: ReturnDoor) => {
    cancelRestoreRef.current?.();
    writeTogetherReturn(childId, { category, returnDoor });
  };

  useEffect(() => {
    // mode="wait" retains Together during exit. Early Back can make that same
    // instance present again without a mount, so return belongs to presence,
    // not just to mounting. Never restore while the route is leaving.
    if (!isPresent) return;
    const saved = readTogetherReturn(childId);
    if (!saved) return;
    // Shell resets its scroll owners before mounting the arriving route. Restore
    // the selected card afterward, once, rather than racing it with a timeout or
    // retaining a pixel offset that becomes wrong when the AI dock changes width.
    let active = true;
    const frame = requestAnimationFrame(() => {
      if (!active) return;
      active = false;
      cancelRestoreRef.current = null;
      const latest = readTogetherReturn(childId);
      if (!latest || latest.category !== saved.category || latest.returnDoor !== saved.returnDoor) return;
      // The parent came back to another pill: the way back is spent.
      if (categoryRef.current !== saved.category) { writeTogetherReturn(childId, null); return; }
      const door = pageRef.current?.querySelector<HTMLElement>(`[data-together-return="${saved.returnDoor}"]`);
      if (!door || door.closest("[hidden]")) return;
      writeTogetherReturn(childId, null);
      door.focus({ preventScroll: true });
      door.scrollIntoView({ block: "center", behavior: "auto" });
    });
    const cancel = () => {
      active = false;
      cancelAnimationFrame(frame);
      if (cancelRestoreRef.current === cancel) cancelRestoreRef.current = null;
    };
    cancelRestoreRef.current = cancel;
    return cancel;
  }, [childId, gamesAvailable, isPresent]);

  return { category, setCategory, pageRef, rememberDoor, query };
}
