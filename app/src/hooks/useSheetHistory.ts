import { useCallback, useEffect, useRef } from "react";
import { afterSheetBack, newSheetToken, openSheetEntry, releaseSheetEntry, retireSheetEntry, sheetEntryLeft } from "../lib/sheetHistory";

/**
 * v3 IA-06 — the seam an L2 sheet uses to own one browser-history entry while
 * it is open (the ledger is lib/sheetHistory):
 *
 *   const close = useSheetHistory(open, onClose);
 *   <Sheet open onClose={() => close()} title={title}
 *     companion={<SheetBreadcrumb label={title} close={close} />}>   // layout/Breadcrumb
 *
 * Back closes the sheet (onClose runs). `close(after?)` is the sheet's ONE
 * close path: its own button, the dialog's Escape and backdrop, its crumb,
 * and every row that leaves for another route. It closes the sheet and
 * retires the entry with one history.back(). Navigation goes in `after`,
 * which runs once no sheet's Back is in flight, so the new route's entry is
 * never the one a Back pops. A second activation while the first Back is in
 * flight (a double tap on a row) queues behind it the same way.
 */
export type SheetClose = (after?: () => void) => void;

export function useSheetHistory(open: boolean, onClose: () => void): SheetClose {
  const latest = useRef(onClose);
  latest.current = onClose;
  const token = useRef<string | null>(null);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const mine = token.current ?? (token.current = newSheetToken());
    openSheetEntry(mine);
    const onPop = () => {
      if (token.current !== mine || !sheetEntryLeft(mine)) return;
      token.current = null;
      latest.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      releaseSheetEntry(mine);
    };
  }, [open]);

  return useCallback((after?: () => void) => {
    const mine = token.current;
    token.current = null;
    latest.current();
    if (mine) retireSheetEntry(mine, after);
    else if (after) afterSheetBack(after);
  }, []);
}
