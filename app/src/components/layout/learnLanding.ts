import { useEffect, useRef } from "react";
import { learnRedirectFor, type ActiveTab } from "../../lib/routes";

/**
 * v3 F-SHELL-1 (review finding 1) — #/learn is only the short-read reader.
 *
 * Whether a #/learn visit carries a read is decided ONCE, at arrival: the
 * Library consumes the pending card request as it opens the read, so reading
 * the request again a render later would send a parent who is mid-read to
 * the library. A visit without a read replaces its hash with the For you
 * library section (LEARN_LIBRARY_HASH); replace, not push, so Back never
 * returns to an empty #/learn. The tab body renders nothing while it goes.
 *
 * On For you with `section=library`, the library section ("Courses by
 * area", else the course gallery) is scrolled into view once it has mounted
 * (the tab is lazy and enters after the outgoing tab's exit).
 */
export const LIBRARY_SECTION_SELECTORS = ['[data-testid="academy-by-area"]', '[data-testid="academy-courses"]'] as const;

/** Frames to wait for the lazy For you page before giving up (about 4 s at 60 Hz). */
const LIBRARY_SCROLL_FRAMES = 240;

const liveHash = (): string => {
  try {
    return typeof window === "undefined" ? "" : window.location.hash;
  } catch {
    return "";
  }
};

/** Returns the redirect this #/learn visit is making (null when none). */
export function useLearnLanding(
  activeTab: ActiveTab,
  pendingCardId: string | null | undefined,
  consumeLearnRequest: (() => void) | undefined,
  librarySection: boolean,
): string | null {
  // undefined = not on #/learn; otherwise the arrival's decision, latched.
  const arrival = useRef<string | null | undefined>(undefined);
  if (activeTab !== "learn") arrival.current = undefined;
  else if (arrival.current === undefined) arrival.current = learnRedirectFor(activeTab, pendingCardId, liveHash());
  const redirect = activeTab === "learn" ? arrival.current ?? null : null;

  useEffect(() => {
    if (!redirect) return;
    consumeLearnRequest?.();
    try { window.location.replace(redirect); } catch { /* SSR / tests */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redirect]);

  useEffect(() => {
    if (!librarySection || typeof document === "undefined" || typeof requestAnimationFrame === "undefined") return;
    let frame = 0;
    let left = LIBRARY_SCROLL_FRAMES;
    const step = () => {
      for (const selector of LIBRARY_SECTION_SELECTORS) {
        const section = document.querySelector(selector);
        if (section) { section.scrollIntoView({ block: "center", behavior: "auto" }); return; }
      }
      if (--left > 0) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [librarySection]);

  return redirect;
}
