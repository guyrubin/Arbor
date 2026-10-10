import { useEffect, useRef, useState } from "react";
import { useIsPresent } from "motion/react";
import { STUDIO_WORLDS } from "../practice/studioWorlds";
import type { TogetherCategory } from "./companionChoices";

const categories: readonly TogetherCategory[] = ["all", "stories", "games", "offscreen"];
const returnDoors = ["story-library", "story-bedtime", "story-comics", "story-family", "more-ideas", ...STUDIO_WORLDS.map((world) => `world-${world.id}`)] as const;
type ReturnDoor = typeof returnDoors[number];
type ViewState = { category: TogetherCategory; returnDoor?: ReturnDoor };
const key = (childId: string) => `arbor.together.view.${childId}`;

/** Only presentation choices live here, never a child's records or a preview.
 * Session scope keeps a parent’s catalogue choice when Shell remounts a route. */
export function readTogetherView(childId: string, gamesAvailable: boolean): ViewState {
  try {
    const value = JSON.parse(sessionStorage.getItem(key(childId)) || "null") as Partial<ViewState> | null;
    const category = value && categories.includes(value.category as TogetherCategory) ? value.category! : "all";
    return {
      category: category === "games" && !gamesAvailable ? "all" : category,
      ...(value?.returnDoor && returnDoors.includes(value.returnDoor) ? { returnDoor: value.returnDoor } : {}),
    };
  } catch { return { category: "all" }; }
}

export function writeTogetherView(childId: string, value: ViewState) {
  const safe = { category: value.category, ...(value.returnDoor && returnDoors.includes(value.returnDoor) ? { returnDoor: value.returnDoor } : {}) };
  try { sessionStorage.setItem(key(childId), JSON.stringify(safe)); } catch { /* Private browsing still supports choosing in this visit. */ }
}

export function useTogetherNavigation(childId: string, gamesAvailable: boolean) {
  const isPresent = useIsPresent();
  const pageRef = useRef<HTMLDivElement>(null);
  const cancelRestoreRef = useRef<(() => void) | null>(null);
  const [state, setState] = useState(() => ({ childId, ...readTogetherView(childId, gamesAvailable) }));
  const current = state.childId === childId ? state : readTogetherView(childId, gamesAvailable);
  const category = current.category === "games" && !gamesAvailable ? "all" : current.category;
  const setCategory = (next: TogetherCategory) => {
    cancelRestoreRef.current?.();
    const value = { category: next === "games" && !gamesAvailable ? "all" as const : next };
    writeTogetherView(childId, value);
    setState({ childId, ...value });
  };
  const rememberDoor = (returnDoor: ReturnDoor) => {
    cancelRestoreRef.current?.();
    writeTogetherView(childId, { category, returnDoor });
  };

  useEffect(() => {
    setState({ childId, ...readTogetherView(childId, gamesAvailable) });
  }, [childId, gamesAvailable]);

  useEffect(() => {
    // mode="wait" retains Together during exit. Early Back can make that same
    // instance present again without a mount, so return belongs to presence,
    // not just to mounting. Never restore while the route is leaving.
    if (!isPresent) return;
    const saved = readTogetherView(childId, gamesAvailable);
    if (!saved.returnDoor) return;
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
  }, [childId, gamesAvailable, isPresent]);

  return { category, setCategory, pageRef, rememberDoor };
}
