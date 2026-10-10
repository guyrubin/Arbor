import { useEffect, useRef, useState } from "react";
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
  const pageRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState(() => ({ childId, ...readTogetherView(childId, gamesAvailable) }));
  const current = state.childId === childId ? state : readTogetherView(childId, gamesAvailable);
  const category = current.category === "games" && !gamesAvailable ? "all" : current.category;
  const setCategory = (next: TogetherCategory) => {
    const value = { category: next === "games" && !gamesAvailable ? "all" as const : next };
    writeTogetherView(childId, value);
    setState({ childId, ...value });
  };
  const rememberDoor = (returnDoor: ReturnDoor) => writeTogetherView(childId, { category, returnDoor });

  useEffect(() => {
    const saved = readTogetherView(childId, gamesAvailable);
    setState({ childId, ...saved });
    if (!saved.returnDoor) return;
    // Shell resets its scroll owners before mounting the arriving route. Restore
    // the selected door afterward, once, rather than racing it with a timeout or
    // retaining a pixel offset that becomes wrong when the AI dock changes width.
    const frame = requestAnimationFrame(() => {
      const door = pageRef.current?.querySelector<HTMLElement>(`[data-together-return="${saved.returnDoor}"]`);
      if (!door || door.closest("[hidden]")) return;
      writeTogetherView(childId, { category: saved.category });
      door.focus({ preventScroll: true });
      door.scrollIntoView({ block: "center", behavior: "auto" });
    });
    return () => cancelAnimationFrame(frame);
  }, [childId, gamesAvailable]);

  return { category, setCategory, pageRef, rememberDoor };
}
