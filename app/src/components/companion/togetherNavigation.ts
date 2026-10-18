import { useEffect, useRef, useState } from "react";
import { useIsPresent } from "motion/react";
import { goToRoute, useHashQuery } from "../../hooks/useHashQuery";
import { routeHash } from "../../lib/routes";
import { STUDIO_WORLDS } from "../practice/studioWorlds";
import type { TogetherCategory, TogetherFilterParam } from "./companionChoices";

/** v4: the three filters, Routines first (the default). */
export const TOGETHER_CATEGORIES: readonly TogetherCategory[] = ["routines", "games", "stories"];
export const DEFAULT_TOGETHER_CATEGORY: TogetherCategory = "routines";
/** A filter id, current or former, as the filter it now opens (null when unknown). */
export function togetherCategoryOf(raw: unknown): TogetherCategory | null {
  if (raw === "routines" || raw === "games" || raw === "stories") return raw;
  if (raw === "all") return "routines";
  if (raw === "offscreen") return "games";
  return null;
}
const returnDoors = ["story-library", "story-bedtime", "story-comics", "story-family", "more-ideas", ...STUDIO_WORLDS.map((world) => `world-${world.id}`)] as const;
type ReturnDoor = typeof returnDoors[number];
type ViewState = { category: TogetherCategory; returnDoor?: ReturnDoor };
const key = (childId: string) => `arbor.together.view.${childId}`;

/** Only presentation choices live here, never a child's records or a preview.
 * Session scope keeps a parent’s catalogue choice when Shell remounts a route.
 * v4: Play (`games`) exists at every age — without a world that fits, it holds
 * the away ideas — so a stored Play choice is kept whether or not a world is
 * listed (a pending return to a world card that is not rendered is simply not
 * found, so it is neither focused nor consumed). */
export function readTogetherView(childId: string, _gamesAvailable: boolean): ViewState {
  try {
    const value = JSON.parse(sessionStorage.getItem(key(childId)) || "null") as { category?: unknown; returnDoor?: ReturnDoor } | null;
    const category = togetherCategoryOf(value?.category) ?? DEFAULT_TOGETHER_CATEGORY;
    return { category, ...(value?.returnDoor && returnDoors.includes(value.returnDoor) ? { returnDoor: value.returnDoor } : {}) };
  } catch { return { category: DEFAULT_TOGETHER_CATEGORY }; }
}

export function writeTogetherView(childId: string, value: ViewState) {
  const safe = { category: value.category, ...(value.returnDoor && returnDoors.includes(value.returnDoor) ? { returnDoor: value.returnDoor } : {}) };
  try { sessionStorage.setItem(key(childId), JSON.stringify(safe)); } catch { /* Private browsing still supports choosing in this visit. */ }
}

export function useTogetherNavigation(childId: string, gamesAvailable: boolean) {
  const isPresent = useIsPresent();
  const query = useHashQuery();
  const requested = query.get("f");
  // v4: a former id (all, offscreen) opens the filter it became; an unknown one the default.
  const routeCategory = requested === null ? null : togetherCategoryOf(requested) ?? DEFAULT_TOGETHER_CATEGORY;
  const pageRef = useRef<HTMLDivElement>(null);
  const cancelRestoreRef = useRef<(() => void) | null>(null);
  const [state, setState] = useState(() => ({ childId, ...readTogetherView(childId, gamesAvailable) }));
  const current = state.childId === childId ? state : readTogetherView(childId, gamesAvailable);
  const category = routeCategory ?? current.category;
  const setCategory = (next: TogetherFilterParam) => {
    cancelRestoreRef.current?.();
    // Pin the starting choice before pushing the first filter URL, so Back
    // returns to that choice rather than re-reading the newest stored value.
    if (routeCategory === null && typeof window !== "undefined" && window.location.hash.split("?")[0] === "#/practice") {
      window.history.replaceState(window.history.state, "", `#${routeHash("practice", { f: category })}`);
    }
    const value = { category: togetherCategoryOf(next) ?? DEFAULT_TOGETHER_CATEGORY };
    writeTogetherView(childId, value);
    setState({ childId, ...value });
    goToRoute("practice", { f: value.category });
  };
  const rememberDoor = (returnDoor: ReturnDoor) => {
    cancelRestoreRef.current?.();
    writeTogetherView(childId, { category, returnDoor });
  };

  useEffect(() => {
    const saved = readTogetherView(childId, gamesAvailable);
    // More can change only the query while Together stays mounted. An explicit
    // destination wins over an earlier per-child choice or queued return door.
    const value = routeCategory === null || category === saved.category ? saved : { category };
    if (value !== saved) writeTogetherView(childId, value);
    setState({ childId, ...value });
  }, [childId, gamesAvailable, routeCategory]);

  useEffect(() => {
    // mode="wait" retains Together during exit. Early Back can make that same
    // instance present again without a mount, so return belongs to presence,
    // not just to mounting. Never restore while the route is leaving.
    if (!isPresent) return;
    const saved = readTogetherView(childId, gamesAvailable);
    if (!saved.returnDoor || saved.category !== category) return;
    // Shell resets its scroll owners before mounting the arriving route. Restore
    // the selected door afterward, once, rather than racing it with a timeout or
    // retaining a pixel offset that becomes wrong when the AI dock changes width.
    let active = true;
    const frame = requestAnimationFrame(() => {
      if (!active) return;
      active = false;
      cancelRestoreRef.current = null;
      const latest = readTogetherView(childId, gamesAvailable);
      if (latest.category !== saved.category || latest.returnDoor !== saved.returnDoor) return;
      const door = pageRef.current?.querySelector<HTMLElement>(`[data-together-return="${saved.returnDoor}"]`);
      if (!door || door.closest("[hidden]")) return;
      writeTogetherView(childId, { category: saved.category });
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
  }, [childId, gamesAvailable, isPresent, category]);

  return { category, setCategory, pageRef, rememberDoor };
}
