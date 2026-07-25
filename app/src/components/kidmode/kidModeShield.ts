/**
 * KID-2: keyboard lock for Kid Mode.
 *
 * The overlay renders as a sibling of the parent shell inside the Shell mount
 * node (`.arbor-app`). The backdrop already swallows pointers, and Escape is
 * blocked — but without this shield, Tab could still walk focus into the
 * (visually hidden) parent-shell controls behind the z-70 overlay, and Enter
 * would activate them sight-unseen. While Kid Mode is open, every sibling of
 * the Kid Mode layers is made `inert` + `aria-hidden`, so nothing behind the
 * overlay is focusable, clickable, or readable by a screen reader. The
 * returned function undoes the shield exactly (restoring any pre-existing
 * aria-hidden value and never un-inerting nodes that were already inert).
 *
 * Pure DOM-attribute logic — no React, no I/O, no child-data write — so it is
 * unit-testable in the node vitest harness with attribute-bearing stand-ins.
 */

/** Marker attribute carried by the Kid Mode layers themselves (backdrop + overlay). */
export const KID_MODE_LAYER_ATTR = "data-kid-mode-layer";

/** Structural subset of Element used by the shield (node-testable). */
export interface ShieldableElement {
  hasAttribute(name: string): boolean;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

/**
 * Make every non-Kid-Mode sibling inert + aria-hidden. Returns an undo
 * function that restores exactly the attributes this call changed.
 */
export function shieldShellSiblings(children: readonly ShieldableElement[]): () => void {
  const shielded: { el: ShieldableElement; prevAriaHidden: string | null }[] = [];
  for (const el of children) {
    // Never shield the Kid Mode layers themselves (backdrop + overlay).
    if (el.hasAttribute(KID_MODE_LAYER_ATTR)) continue;
    // Already inert (owned by someone else) — leave it, and don't undo it later.
    if (el.hasAttribute("inert")) continue;
    el.setAttribute("inert", "");
    const prevAriaHidden = el.getAttribute("aria-hidden");
    el.setAttribute("aria-hidden", "true");
    shielded.push({ el, prevAriaHidden });
  }
  return () => {
    for (const { el, prevAriaHidden } of shielded) {
      el.removeAttribute("inert");
      if (prevAriaHidden === null) el.removeAttribute("aria-hidden");
      else el.setAttribute("aria-hidden", prevAriaHidden);
    }
  };
}
