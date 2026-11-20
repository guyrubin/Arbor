import { useSyncExternalStore } from "react";

/**
 * B-STATUS-01: a success said after the surface that did the work has closed.
 * The line is drawn once, on the shell that stays (components/layout/Shell).
 * One line; a new seq is a new answer. This tab only — nothing is stored.
 */
export interface VisitReceipt {
  text: string;
  seq: number;
}

const listeners = new Set<() => void>();
let current: VisitReceipt | null = null;
let seq = 0;

function emit() {
  listeners.forEach((listener) => listener());
}

export function showVisitReceipt(text: string): void {
  const clean = text.trim();
  if (!clean) return;
  seq += 1;
  current = { text: clean, seq };
  emit();
}

export function currentVisitReceipt(): VisitReceipt | null {
  return current;
}

export function clearVisitReceipt(): void {
  if (!current) return;
  current = null;
  emit();
}

export function subscribeVisitReceipt(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The shell's one slot. A stub that returns null is enough for harnesses
 *  that never mount the real hook. */
export function useVisitReceiptNote(): VisitReceipt | null {
  return useSyncExternalStore(subscribeVisitReceipt, currentVisitReceipt, () => null);
}
