/**
 * lib/library/plans/patterns — B-BOOK-75/76: the pattern catalogue's CONTRACT
 * (kid-everyday-plans-standard §1, §3, §4, §7). A pattern is one hard
 * everyday pattern in parent words, with: the shared manuscript frames
 * (screens 0–4 and 8 of the skeleton), a SOURCED menu of steps the parent
 * composes screens 5–7 from, the box items, the red lines, the parent panel
 * and the sources. Content lives one file per pattern (./patterns/*.ts); the
 * registry below is what the composer, the reader and the tests read.
 *
 * Rules carried by the type (the lint proves them on the content):
 *  - a pattern names a behaviour, never a condition (§3 rule);
 *  - every step comes from the menu and names its sources (§1 field 9);
 *  - the red lines are parent words for the care card, never a checklist (§4);
 *  - the child text is first person, no verdict, no diagnosis noun (§5).
 */
import type { CanonicalBandId } from "../../domains/ageBands";
import type { ShelfId } from "../../shelves/registry";
import type { BookLabel, BookLine, BoxItem, PatternId, Pose, Slot } from "../types";
import type { PlanPose } from "./planPoses";

/** Where the pattern's door sits for the parent. The standard's "Body" shelf
 *  is not one of the app's nine shelves: the two body-domain shelves are
 *  `sleep` and `food`; `"body"` here means the body domain's door, placed by
 *  the Parent host row (B-PROG-16, Wave 3). */
export type PatternShelf = ShelfId | "body";

/** The light rig and the authored geometry of one shared plate (the plate
 *  itself is registered in ./planPlates). */
export interface PatternPageArt {
  plateId: string;
  /** Where the hero stands (master-plate fractions), pose from the step or frame. */
  slot: Omit<Slot, "pose">;
  /** The plate's 3:4 phone window centre for this page. */
  phoneCrop?: number;
}

/** A frame page of the skeleton (screens 0–4 and 8): authored once per
 *  pattern, the same for every family. `closing` is the frame line that may
 *  carry `{name}` (standard §5: the name only on the cover and frame pages). */
export interface PatternFramePage {
  id: string;
  text: BookLine;
  closing?: BookLine;
  pose: PlanPose;
  art: PatternPageArt;
  /** "spread" for the cover and the win page. */
  spread?: boolean;
}

/** One item of the pattern's sourced step menu. The text may carry
 *  `{minutes}` and `{time}`; the composer fills them from the parent's choice
 *  (§6 step 2). */
export interface PlanMenuItem {
  id: string;
  /** Which of the three steps this item can be (1 = the act, 2 = the comfort
   *  or help, 3 = the no-pressure rule). */
  slot: 1 | 2 | 3;
  text: BookLine;
  /** The step in the parent's words (the panel's planSteps line). */
  parentLine: BookLabel;
  /** Allows a parent-set duration (3–10 min); `defaultMinutes` when so. */
  defaultMinutes?: number;
  /** The default time of day, as the composer's key ("evening", "after-meal", "bedtime"). */
  defaultTime?: string;
  pose: PlanPose;
  art: PatternPageArt;
  sourceIds: string[];
}

/** A guideline or public method a step comes from (§1 field 9). */
export interface PatternSource {
  id: string;
  label: BookLabel;
  /** Public URL where one exists; the reviewer confirms. */
  url?: string;
}

/** A red line (§4), in parent words, for the care card. */
export interface RedLine {
  id: string;
  text: BookLabel;
}

export interface PatternDef {
  id: PatternId;
  /** A title the child can say that names the win, never the problem. */
  title: BookLabel;
  coverLine: BookLabel;
  /** "{name}'s special plan" */
  coverNameLine: BookLabel;
  shelf: PatternShelf;
  ageBands: CanonicalBandId[];
  /** The parent panel's age text. */
  ageText: string;
  /** How a parent describes it at 2am (the door and the search intent). */
  parentWords: BookLabel;
  /** The manuscript frames: cover, screens 1–4 and the win (standard §2). */
  frames: {
    cover: PatternFramePage;
    bodyGood: PatternFramePage;
    howItWorks: PatternFramePage;
    sometimesHard: PatternFramePage;
    wePlan: PatternFramePage;
    win: PatternFramePage;
  };
  /** The sourced menu; `defaultSteps` names one item per slot. */
  menu: PlanMenuItem[];
  defaultSteps: [string, string, string];
  /** The authored box items the parent may choose from (the child taps). */
  boxItems: BoxItem[];
  /** The default duration the plan sits first in Tonight (days). */
  defaultDurationDays: number;
  /** Bounds for a parent-set step duration (standard §6: 3–10). */
  minutesRange: [number, number];
  sources: PatternSource[];
  watchFor: RedLine[];
  /** The parent panel, adult words, in the positioning lexicon. */
  parent: {
    knows: BookLabel;
    whyNow: BookLabel;
    tomorrow: BookLabel;
    askAfter: BookLine;
    together: BookLabel;
    sourceNote: BookLabel;
    firstWeek: BookLabel;
  };
  /** Diagnosis nouns and verdicts this pattern never uses (§1 field 11),
   *  beyond the shared §5 lists; EN and HE. */
  bannedWords: { en: string[]; he: string[] };
  /** The poses this pattern draws from the shared list (≤ 6). */
  poses: PlanPose[];
  /** The one adult sentence the book "knows" (BookBase.knowledge). */
  knowledge: string;
  /** The sceptic's three (§1 field 13), answered in watchFor or the panel.
   *  Written for the reviewer; never rendered. */
  scepticsThree: { en: string }[];
  /** Pose stopgaps while a child's plan sheet lacks a pose. */
  poseFallbacks?: Record<Pose, Pose>;
}
