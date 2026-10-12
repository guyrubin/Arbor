import { useSyncExternalStore } from "react";

/**
 * v3 IA-06r — while an open L2 sheet draws its crumb over the top bar's title
 * zone (layout/Breadcrumb, SheetBreadcrumb), the top bar's own title steps
 * aside (layout/Topbar), so the title zone reads as the crumb. A count, not a
 * flag: a sheet that opens while another one's crumb is still fading out must
 * not bring the title back early.
 */
let shown = 0;
const listeners = new Set<() => void>();

/** A crumb mounted (+1) or unmounted (-1). */
export function announceSheetCrumb(delta: 1 | -1): void {
  shown = Math.max(0, shown + delta);
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** True while at least one L2 crumb is on screen (the store's snapshot). */
export function sheetCrumbShownNow(): boolean {
  return shown > 0;
}

/** The same, as a subscription. Server render: false. */
export function useSheetCrumbShown(): boolean {
  return useSyncExternalStore(subscribe, sheetCrumbShownNow, () => false);
}
