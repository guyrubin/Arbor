/**
 * B-KID-53 (KA-13 interim) — the Kid Mode header names WHERE the child is:
 * inside a world or a story, the overlay title is that world's / story's own
 * name (set by the surface while it is open), and the overlay's Home is the
 * one back control. A tiny external store, read with useSyncExternalStore.
 */
import { useSyncExternalStore } from "react";

let title: string | null = null;
const listeners = new Set<() => void>();

export function setKidSurfaceTitle(next: string | null): void {
  if (next === title) return;
  title = next;
  listeners.forEach((fn) => fn());
}

const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const read = () => title;

export function useKidSurfaceTitle(): string | null {
  return useSyncExternalStore(subscribe, read, read);
}
