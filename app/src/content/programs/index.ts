/**
 * B-PROG-02 — the program registry (B-PROG-01 shape, content/programs/types).
 * v1 carries Talk Together (thesis §8, E2: Talk Together first, Steady Nights
 * second — B-PROG-06). Every program here ships `reviewStatus: "draft"` until
 * the clinical reviewer signs.
 */
import type { Program } from "./types";
import { TALK_TOGETHER } from "./talkTogether";

export const PROGRAMS: readonly Program[] = [TALK_TOGETHER];

export function programById(id: string): Program | undefined {
  return PROGRAMS.find((program) => program.id === id);
}
