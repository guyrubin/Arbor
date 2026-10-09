/**
 * B-PROG-13 — the kid side of a program: links only.
 *
 * A program week may name a kid world (`ProgramWeek.kidWorld`). The program
 * page offers ONE door, "Play {world} together", that opens the EXISTING Kid
 * Mode entry seam (useKidModeEntry → request({ view: "arcade", worldId })) on
 * that world — exactly what Together's world tile does for the same world.
 *
 * The door is offered only when Kid Mode can really open that world for THIS
 * child, by the rules the parent doors already use (no new gate):
 *  - Kid Mode opens for the child at all (lib/age/playGate kidModeOpenFor);
 *  - the world is among the child's band-fitting worlds (studioWorldsForChild);
 *  - the world has a Kid Mode seat (opensInKidMode — Word World is parent-only
 *    in the arcade today) and works in the UI language (worksInLanguage —
 *    Sound Lab's drill is English-only).
 * Otherwise there is no door (never a dead control). Pure; no React.
 */
import type { ProgramKidWorld } from "../../content/programs/types";
import { KID_WORLDS } from "../kidmode/kidWorlds";
import { opensInKidMode, studioWorldsForChild, worksInLanguage } from "../practice/studioWorlds";
import { kidModeOpenFor } from "../../lib/age/playGate";
import type { AgedChild } from "../../lib/age/forChild";

export interface ProgramKidWorldDoor {
  /** The Kid Mode arcade id the door opens (the seam's `worldId`). */
  worldId: string;
  /** The world's ONE name, shared by the parent door and the child (i18n key). */
  nameKey: string;
}

/** A program's kid world id → the arcade / studio id the seam opens. A kid id
 *  resolves through the kid world registry ("sound-lab" → "speech"); a world
 *  with no kid seat keeps its studio id ("word-world"). */
export function programKidWorldStudioId(kidWorld: ProgramKidWorld): string {
  return KID_WORLDS.find((w) => w.id === kidWorld)?.worldId ?? kidWorld;
}

/** The door for this week, or null when there is no world or Kid Mode cannot open it. */
export function programKidWorldDoor(
  kidWorld: ProgramKidWorld | undefined,
  child: AgedChild | null | undefined,
  lang: "en" | "he",
  now?: Date,
): ProgramKidWorldDoor | null {
  if (!kidWorld || !kidModeOpenFor(child, now)) return null;
  const id = programKidWorldStudioId(kidWorld);
  const world = studioWorldsForChild(lang, child, now).worlds.find((w) => w.id === id);
  if (!world || !opensInKidMode(world) || !worksInLanguage(world, lang)) return null;
  return { worldId: world.id, nameKey: world.kidNameKey };
}
