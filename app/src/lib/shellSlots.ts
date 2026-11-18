import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * v10 (canvas V77) — two small slots a route fills in the shell it sits in.
 *
 * - The breadcrumb's last level: the boards continue "place › pill › view" with
 *   the thing the route has open (Plans › "Saying goodbye at drop-off",
 *   Library › Reads, Things Dylan said › Hebrew). Only the route knows it.
 * - The end of the pill row: by default the day and the time ("Monday 16
 *   November · 17:40"). Some boards put something of the route's own there:
 *   My child "· your record since Thu 8 October", About "· nothing is
 *   remembered without your approval", Said the date alone, Moments the
 *   "Professional view" link, Visits an "Add appointment" button.
 *
 * A route sets a slot with the hook while it is mounted; unmounting clears it,
 * so a slot never outlives its route. Values are compared by content, so a
 * route re-rendering cannot loop the shell. Display text only: callers pass
 * already-translated strings (both languages are the caller's job) and already
 * formatted dates (lib/formatDate's V10 helpers).
 */

export type ShellRowEnd = {
  /** Replaces the time after the day: "Monday 16 November · {suffix}". */
  suffix?: string;
  /** The day alone, no time and no suffix ("Monday 16 November"). */
  dateOnly?: boolean;
  /** Replaces the day and time entirely (a route's own sentence). */
  text?: string;
  /** A link-styled action at the row's end (Moments: Professional view). */
  link?: { label: string; onClick: () => void; testId?: string };
  /** A button at the row's end, after the day and time (Visits: Add appointment). */
  action?: { label: string; onClick: () => void; icon?: string; testId?: string };
};

type Slots = { crumb: string | null; rowEnd: ShellRowEnd | null };

let slots: Slots = { crumb: null, rowEnd: null };
const listeners = new Set<() => void>();

const keyOf = (end: ShellRowEnd | null): string =>
  end
    ? JSON.stringify([end.suffix ?? null, !!end.dateOnly, end.text ?? null, end.link?.label ?? null, end.link?.testId ?? null, end.action?.label ?? null, end.action?.icon ?? null, end.action?.testId ?? null])
    : "";

/** Set either slot (the hooks use this; tests call it directly). */
export function setShellSlots(patch: Partial<Slots>): void {
  const next = { ...slots, ...patch };
  // Same content: nothing to redraw (handlers are bound to the route's latest closure).
  if (next.crumb === slots.crumb && keyOf(next.rowEnd) === keyOf(slots.rowEnd)) return;
  slots = next;
  listeners.forEach((fn) => fn());
}

/** Listen for slot changes (the shell, through useShellSlots; tests). */
export const subscribeShellSlots = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const read = () => slots;

/** The shell's read of both slots (Shell, Topbar). */
export function useShellSlots(): Slots {
  return useSyncExternalStore(subscribeShellSlots, read, read);
}

/** A route names what it has open as the breadcrumb's last level (null: nothing). */
export function useShellCrumb(label: string | null | undefined): void {
  const value = label?.trim() ? label.trim() : null;
  useEffect(() => {
    setShellSlots({ crumb: value });
    return () => setShellSlots({ crumb: null });
  }, [value]);
}

/** A route sets the end of its pill row (null: the shell's day and time). */
export function useShellRowEnd(end: ShellRowEnd | null | undefined): void {
  const latest = useRef(end ?? null);
  latest.current = end ?? null;
  const key = keyOf(end ?? null);
  useEffect(() => {
    const value = latest.current;
    // The handlers always call the route's latest closure.
    const bound: ShellRowEnd | null = value
      ? {
          ...value,
          ...(value.link ? { link: { ...value.link, onClick: () => latest.current?.link?.onClick() } } : {}),
          ...(value.action ? { action: { ...value.action, onClick: () => latest.current?.action?.onClick() } } : {}),
        }
      : null;
    setShellSlots({ rowEnd: bound });
    return () => setShellSlots({ rowEnd: null });
  }, [key]);
}

/** Tests only: clear both slots between cases. */
export function resetShellSlotsForTest(): void {
  slots = { crumb: null, rowEnd: null };
  listeners.forEach((fn) => fn());
}
