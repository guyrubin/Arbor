import { useEffect } from "react";

/**
 * F-TALK-2 / MOB-03 — keep the full-screen conversation above the phone's
 * on-screen keyboard.
 *
 * Below 1280 px the conversation is `position: fixed; inset: 0`. iOS Safari
 * (and Chrome's default "resizes-visual" mode) open the keyboard over the
 * layout viewport without resizing it, so the composer and its send button sat
 * under the keyboard. While the panel is full-screen this publishes the height
 * the keyboard covers as `--companion-keyboard-inset` on the root element;
 * companionWorkspace.css lifts the panel's bottom edge by it. Nothing is
 * published (the property is removed) when nothing is covered, when the panel
 * docks or closes, or where visualViewport does not exist.
 */

export const KEYBOARD_INSET_VAR = "--companion-keyboard-inset";

type ViewportLike = {
  height: number;
  offsetTop: number;
  addEventListener(type: "resize" | "scroll", listener: () => void): void;
  removeEventListener(type: "resize" | "scroll", listener: () => void): void;
};
type WindowLike = { innerHeight: number; visualViewport?: ViewportLike | null };
type StyleTarget = { style: { setProperty(name: string, value: string): void; removeProperty(name: string): void } };

/** The px the keyboard covers at the bottom of the layout viewport (0 when none). */
export function keyboardInset(layoutHeight: number, viewport: Pick<ViewportLike, "height" | "offsetTop"> | null | undefined): number {
  if (!viewport) return 0;
  const covered = layoutHeight - (viewport.height + viewport.offsetTop);
  return covered > 0 ? Math.round(covered) : 0;
}

/** Track the visual viewport and publish the inset on `target`; returns the cleanup. */
export function bindVisualViewportInset(win: WindowLike, target: StyleTarget): () => void {
  const viewport = win.visualViewport;
  if (!viewport) return () => {};
  const update = () => {
    const inset = keyboardInset(win.innerHeight, viewport);
    if (inset > 0) target.style.setProperty(KEYBOARD_INSET_VAR, `${inset}px`);
    else target.style.removeProperty(KEYBOARD_INSET_VAR);
  };
  update();
  viewport.addEventListener("resize", update);
  viewport.addEventListener("scroll", update);
  return () => {
    viewport.removeEventListener("resize", update);
    viewport.removeEventListener("scroll", update);
    target.style.removeProperty(KEYBOARD_INSET_VAR);
  };
}

/** While `active` (the panel is full-screen), keep the keyboard inset current. */
export function useVisualViewportInset(active: boolean): void {
  useEffect(() => {
    if (!active || typeof window === "undefined" || typeof document === "undefined") return;
    return bindVisualViewportInset(window, document.documentElement);
  }, [active]);
}
