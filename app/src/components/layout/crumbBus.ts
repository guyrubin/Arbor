import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { newSheetToken, openSheetEntry, releaseSheetEntry, retireSheetEntry, sheetEntryLeft } from "../../lib/sheetHistory";

/**
 * v3 IA-06 — the seam an L2 sheet uses to name itself in the top bar's crumb
 * and to own one browser-history entry while it is open.
 *
 *   const close = useL2Sheet(open, label, onClose);
 *
 * `close(after?)` is the sheet's ONE close path (its own button, the dialog's
 * Escape/backdrop/Android back, and every row that leaves for another route).
 * Navigation goes in `after`: it runs once the sheet's history entry is gone,
 * so the new route's entry replaces it instead of being popped by it.
 */
export type SheetClose = (after?: () => void) => void;
export interface SheetCrumb { label: string; close: SheetClose }

type Slot = { seq: number; crumb: SheetCrumb };
const slots = new Map<object, Slot>();
const listeners = new Set<() => void>();
let slotSeq = 0;
let top: SheetCrumb | null = null;

function publish(): void {
  let next: Slot | null = null;
  for (const slot of slots.values()) if (!next || slot.seq > next.seq) next = slot;
  const crumb = next ? next.crumb : null;
  if (crumb === top) return;
  top = crumb;
  listeners.forEach(listener => listener());
}

/** Name (or rename) the owner's crumb. A new owner goes on top; a rename keeps its place. */
export function putSheetCrumb(owner: object, crumb: SheetCrumb): void {
  const slot = slots.get(owner);
  if (slot) slot.crumb = crumb;
  else slots.set(owner, { seq: ++slotSeq, crumb });
  publish();
}

export function dropSheetCrumb(owner: object): void {
  if (slots.delete(owner)) publish();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The open sheet the crumb names — the most recently opened one — or null. */
export function currentSheetCrumb(): SheetCrumb | null {
  return top;
}

export function useSheetCrumb(): SheetCrumb | null {
  return useSyncExternalStore(subscribe, currentSheetCrumb, currentSheetCrumb);
}

/**
 * One history entry while `open`: Back closes the sheet (onClose runs), and
 * the returned close retires the entry so it leaves none behind.
 */
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
    else after?.();
  }, []);
}

/** useSheetHistory plus the crumb: the sheet is named in the top bar while open. */
export function useL2Sheet(open: boolean, label: string, onClose: () => void): SheetClose {
  const close = useSheetHistory(open, onClose);
  const owner = useRef<object>({}).current;
  useEffect(() => {
    if (!open) return;
    return () => dropSheetCrumb(owner);
  }, [open, owner]);
  useEffect(() => {
    if (open) putSheetCrumb(owner, { label, close });
  }, [open, label, close, owner]);
  return close;
}
