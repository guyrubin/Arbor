/**
 * lib/library/types — B-BOOK-01: the Book model of the new kid library
 * (Arbor Kids BOOKS, 6 Oct). One authored book = data only: every word, every
 * branch, every hero slot and every narration path is decided here, so a book
 * reads with ZERO model calls (lane A §2.4, lane C §6.1).
 *
 * - The story shape is lane A's Cost-and-Repair rule (§2.3): linear pages up to
 *   ONE decision page, three typed choices (hard | easy | third — the type is
 *   for critics only and is never rendered), 1-2 branch pages per choice, one
 *   rejoin page, echo lines keyed by the choice id on the rejoin and last pages.
 * - Art is a 3:2 master plate per scene (lib/library/bookPlates.ts) with the
 *   child's hero composited from a slot (fractions of the master) — the plate
 *   never contains the child. `phoneCrop` names the centre of the 3:4 window
 *   shown at narrow portrait widths.
 * - `{hero}` in any text is the child's display name, isolated for bidi at
 *   render time (lib/library/bookText.ts). Hebrew text has a masculine and a
 *   feminine form (`he.m` / `he.f`); a choice label is one Hebrew infinitive.
 * - A story choice is a story event: nothing here describes the child, and no
 *   field records which path a child took.
 */

/** The hero poses a sheet provides (lane A §6.0; grip-free, lane B §1). */
export type Pose = "run" | "stand" | "wave" | "walk" | "arms-wide" | "sit";

/** A line of book text: English, and Hebrew in both grammatical genders. */
export interface BookLine {
  en: string;
  he: { m: string; f: string };
}

/** A short UI-facing label (a choice, an action tap): one EN, one HE. */
export interface BookLabel {
  en: string;
  he: string;
}

/** Where the hero stands on a plate. All numbers are fractions of the master
 *  plate: (x, y) = the feet centre (sit: the hip contact point); scale = the
 *  hero's height / the plate's height. Sprites are authored facing the
 *  viewer's right; `facing: "left"` flips the sprite. z "fg" = the hero stands
 *  behind an optional foreground occluder layer. */
export interface Slot {
  pose: Pose;
  x: number;
  y: number;
  scale: number;
  facing: "left" | "right";
  z: "fr" | "fg";
}

/** A narration file per language / Hebrew gender. Paths are public URLs. */
export interface AudioSet {
  en?: string;
  he?: { m?: string; f?: string };
}

/** A page's narration: the default set, plus per-path variants keyed by the
 *  choice id (only where the page's text carries an echo line). */
export interface PageAudio extends AudioSet {
  paths?: Record<string, AudioSet>;
}

/** A tap-to-play hotspot (lane C §2.5: NOT in v1 — typed so the data can carry
 *  it later without a schema change; the reader ignores it). */
export interface TouchTarget {
  id: string;
  /** Fractions of the master plate. */
  rect: { x: number; y: number; w: number; h: number };
  label: BookLabel;
  sound?: string;
}

/** The repair page's ONE action (lane A rule 3): the before-text is the page's
 *  `text`, the button is `label`, then `textAfter` (and `heroAfter`). */
export interface ActionTap {
  label: BookLabel;
  textAfter: BookLine;
  heroAfter?: Slot;
  audio?: AudioSet;
}

export interface Page {
  id: string;
  plateId: string;
  /** Centre x (fraction of the master) of the 3:4 phone window. */
  phoneCrop: number;
  hero: Slot | null;
  text: BookLine;
  /** One line per choice id, shown after the page text on the rejoin page and
   *  the last page (lane A rule 5). */
  echo?: Record<string, BookLine>;
  /** A closing line after the echo (the last page's "Goodnight."). */
  closing?: BookLine;
  actionTap?: ActionTap;
  audio?: PageAudio;
  touch?: TouchTarget[];
}

export type ChoiceType = "hard" | "easy" | "third";

export interface Choice {
  id: string;
  /** Critic use only — never rendered, never stored. */
  type: ChoiceType;
  label: BookLabel;
  /** A Material Symbols glyph that is in the shipped icon subset. */
  icon: string;
  /** 1-2 branch pages (lane A rule 4). */
  branch: Page[];
  /** The spoken label, when a file exists. */
  audio?: AudioSet;
}

/** The parent panel (lane A §6.2): after the story, parent register, never
 *  read aloud and never shown to the child. */
export interface ParentPanel {
  builds: BookLabel;
  why: BookLabel;
  askAfter: BookLine;
  askAfterOptional?: BookLine;
  sourceNote: BookLabel;
}

export interface Book {
  id: string;
  title: BookLabel;
  coverLine: BookLabel;
  /** e.g. "Genesis 12:1-9". */
  sourceRef: string;
  /** One adult sentence: what the story knows about being a person. */
  knowledge: string;
  /** Lane A §2.5 mode + the verse that gives the hero room. */
  childRole: string;
  /** What the book adds in the text's silences (shown to the parent). */
  additions: string[];
  ageBand: string;
  cover: Page;
  /** The linear pages in reading order (branch pages live in the choices). */
  pages: Page[];
  decision: { pageId: string; choices: Choice[] };
  /** The first page every branch returns to. */
  rejoinPageId: string;
  parent: ParentPanel;
}

/** The child the book is read for — display-time data only. */
export interface BookReaderChild {
  id: string;
  name?: string;
  gender?: "girl" | "boy" | "other" | "unspecified";
  /** The hero sheet to composite (lib/library/heroSheet.ts). */
  heroSheetId?: string | null;
}

export type BookLang = "en" | "he";
export type HeGender = "m" | "f";
