/**
 * The `day-windows` landing (Weekly report › Your day at a glance). The route
 * lands on its stop; the page's stamped primary move (the carry band's accept
 * or "Back to Now") sits above it. A landing must never leave that control
 * half under the shell's top strip: either it is fully above the screen or it
 * is fully below the strip. Content that loads after the first paint (visits,
 * Family plan dates) moves it, so the landing is measured, not a fixed margin.
 */

/** How far to scroll back (a negative delta) so the control clears the strip; 0 when it is fine. */
export function landingNudge({ top, bottom, stripBottom, clearance = 8 }: { top: number; bottom: number; stripBottom: number; clearance?: number }): number {
  // Fully above the visible area, or already fully below the strip: nothing to do.
  if (bottom <= 0 || top >= stripBottom + clearance) return 0;
  // Partly under the strip: scroll back until it sits fully below it.
  return top - (stripBottom + clearance);
}

/** The bottom edge of the shell chrome pinned to the top of the viewport (sticky or fixed headers). */
export function topChromeBottom(doc: Document = document): number {
  let bottom = 0;
  for (const el of Array.from(doc.querySelectorAll<HTMLElement>("header, [data-shell-top]"))) {
    const r = el.getBoundingClientRect();
    if (r.height === 0 || r.top > 1) continue;
    const pos = getComputedStyle(el).position;
    if (pos === "sticky" || pos === "fixed") bottom = Math.max(bottom, r.bottom);
  }
  return bottom;
}

/** True while the control is on screen and something else is drawn over its top edge or its centre. */
export function isCovered(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  if (r.bottom <= 0 || r.top >= window.innerHeight) return false;
  const x = r.left + r.width / 2;
  for (const y of [Math.max(0, r.top + 3), r.top + r.height / 2]) {
    if (y < 0) continue;
    const hit = document.elementFromPoint(x, y);
    if (hit && !el.contains(hit)) return true;
  }
  return false;
}

/** The nearest scrolling ancestor (the app's <main>), or the document's scroller. */
export function scrollerOf(el: HTMLElement): HTMLElement {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return (document.scrollingElement as HTMLElement) ?? document.documentElement;
}

/**
 * Land on a stop and keep the stamped control clear of the top strip while the
 * page settles (about two seconds). Stops as soon as the parent scrolls with
 * a wheel, a touch or a key. Returns a cleanup.
 */
export function landOnStop(stopId: string, root: HTMLElement): () => void {
  let done = false;
  const land = () => {
    if (done) return;
    const stop = document.getElementById(stopId);
    if (!stop) return;
    stop.scrollIntoView({ block: "start", behavior: "auto" });
    const stamped = root.querySelector<HTMLElement>("[data-primary-move]");
    if (!stamped) return;
    const scroller = scrollerOf(root);
    const r = stamped.getBoundingClientRect();
    const delta = landingNudge({ top: r.top, bottom: r.bottom, stripBottom: topChromeBottom() });
    if (delta !== 0) scroller.scrollBy({ top: delta, behavior: "auto" });
    // Then the hit test (what the sweep checks): while shell chrome still
    // covers the control, step it down below the chrome.
    for (let i = 0; i < 16 && isCovered(stamped); i += 1) scroller.scrollBy({ top: -16, behavior: "auto" });
  };
  const stop = () => {
    done = true;
  };
  const first = window.setTimeout(land, 120);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => land()) : null;
  ro?.observe(root);
  const settle = window.setTimeout(() => {
    ro?.disconnect();
    done = true;
  }, 2500);
  const events = ["wheel", "touchstart", "keydown"] as const;
  for (const e of events) window.addEventListener(e, stop, { passive: true, once: true });
  return () => {
    window.clearTimeout(first);
    window.clearTimeout(settle);
    ro?.disconnect();
    for (const e of events) window.removeEventListener(e, stop);
    done = true;
  };
}
