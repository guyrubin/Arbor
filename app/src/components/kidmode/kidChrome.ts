/**
 * kidChrome — B-KID-74 (KC-01): the two things a game hands to the ONE Kid
 * Mode top bar, and the one thing the bar hands back. Tiny external stores,
 * read with useSyncExternalStore (the kidSurfaceTitle pattern).
 *
 * - hear-it: the game's instruction (text + language). The bar shows ONE
 *   speaker button while a game is open; the game prints no hear-it of its own.
 * - home: the overlay registers its "go home" so a game's finish screen offers
 *   Home without a second back control in the game.
 */
import { useSyncExternalStore } from "react";
import type { KidStageScene } from "./kidStageArt";

export interface KidHearIt { text: string; lang: "en" | "he" }

let hearIt: KidHearIt | null = null;
let home: (() => void) | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

export function setKidHearIt(next: KidHearIt | null): void {
  if (next?.text === hearIt?.text && next?.lang === hearIt?.lang) return;
  hearIt = next;
  emit();
}
export function useKidHearIt(): KidHearIt | null {
  return useSyncExternalStore(subscribe, () => hearIt, () => hearIt);
}

/** B-KID-133 (D-01): the mounted view names its stage (a game its world, a
 *  book page its story); null = the overlay's default for the view. */
let stage: KidStageScene | null = null;
export function setKidStage(next: KidStageScene | null): void {
  if (JSON.stringify(next) === JSON.stringify(stage)) return;
  stage = next;
  emit();
}
export function useKidStage(): KidStageScene | null {
  return useSyncExternalStore(subscribe, () => stage, () => stage);
}

export function setKidHome(next: (() => void) | null): void {
  home = next;
  emit();
}
export function useKidHome(): (() => void) | null {
  return useSyncExternalStore(subscribe, () => home, () => home);
}
