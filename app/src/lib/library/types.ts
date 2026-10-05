/**
 * lib/library/types — B-BOOK-01 (+ RULINGS BR1-BR9, 6 Oct): the Book model of
 * the new kid library. One authored book = data only: every word, every
 * branch, every hero slot and every narration path is decided here, so a book
 * reads with ZERO model calls (lane A §2.4, lane C §6.1). The engine is
 * book-agnostic: no book id, page id or pose name is known to it.
 *
 * - Story shape (lane A §2.3 + BR3): linear pages up to ONE decision page,
 *   typed choices (hard | easy | third — for critics only, never rendered),
 *   1-2 branch pages per choice, a rejoin page, echo lines keyed by the choice
 *   id. A repair page asks the child to tap EACH item (it cannot fail); its
 *   after-text shows when all are done. No "Another way?" (BR3): re-reading
 *   from the cover is the way to choose differently.
 * - Art is a 3:2 master plate per scene (lib/library/bookPlates.ts) with the
 *   child's hero composited from a slot (fractions of the master). The plate
 *   owns its 3:4 window, its text zone and its choice-card focus rects (BR6).
 * - Page types: "facing" (art page + text page) and "spread" (the whole plate
 *   large, the words on a paper panel in the plate's calm text zone).
 * - `{name}` (or the older `{hero}`) in any text is the child's display name, isolated for bidi at
 *   render time (lib/library/bookText.ts). Hebrew has a masculine and a
 *   feminine form; a choice label is one Hebrew infinitive.
 * - A story choice is a story event: nothing here describes the child, and no
 *   field records which path a child took.
 */

/** A pose id, resolved against the hero sheet's manifest (open set, BR ruling 2). */
export type Pose = string;

/** A line of book text: English, and Hebrew in both grammatical genders. */
export interface BookLine {
  en: string;
  he: { m: string; f: string };
}

/** A short UI-facing label (a choice, a repair prompt): one EN, one HE. */
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

/** One thing the child brings back on a repair page (a goat, a scattered
 *  stone). (x, y) = where it is painted on the master plate; `to` = where it
 *  hops when tapped (absent = it hops in place). */
export interface RepairItem {
  id: string;
  label?: BookLabel;
  x: number;
  y: number;
  to?: { x: number; y: number };
  /** An alpha overlay (same box as the plate) shown once this item is done. */
  plateDetailAfter?: string;
  /** A short sound on the tap (a public URL), when a file exists. */
  sound?: string;
  /** The line this tap adds to the page ("Off comes the helmet."), shown in
   *  tap order between the before-text and the after-text. */
  line?: BookLine;
  /** The page overlay this item IS (e.g. the helmet): the tap moves that
   *  overlay to `to` instead of a marker. */
  overlay?: string;
}

/** The repair (BR3): the child taps EACH item; every tap answers, nothing can
 *  fail; when all are done the after-text (and `heroAfter`) shows. The page's
 *  `text` is the before-text. */
export interface Repair {
  items: RepairItem[];
  promptLabel: BookLabel;
  textAfter: BookLine;
  heroAfter?: Slot;
  audio?: AudioSet;
}

/** A separate art layer over the plate (a helmet, a sword, a dust cloud).
 *  (x, y) = the bottom centre in master fractions; scale = height / plate
 *  height; aspect = width / height of its box (the image is drawn contain). */
export interface PageOverlay {
  id: string;
  /** Public URL (alpha WebP). */
  file: string;
  x: number;
  y: number;
  scale: number;
  aspect?: number;
  /** "afterNarration": hidden until `revealAt` seconds into the page audio,
   *  else 1.2 s after it ends, else (silent page) on a tap on the picture. */
  reveal?: "always" | "afterNarration";
  revealAt?: number;
  /** Drawn over the hero (default) or behind it. */
  z?: "over" | "under";
}

export type PageType = "facing" | "spread";

export interface Page {
  id: string;
  plateId: string;
  /** "facing" (default) or "spread" (cover, decision, climax, ending). */
  type?: PageType;
  /** Overrides the plate's 3:4 window centre for this page. */
  phoneCrop?: number;
  hero: Slot | null;
  text: BookLine;
  /** One line per choice id, shown after the page text on the rejoin page and
   *  the last page (lane A rule 5). */
  echo?: Record<string, BookLine>;
  /** A closing line after the echo (the last page's "Goodnight."). */
  closing?: BookLine;
  repair?: Repair;
  overlays?: PageOverlay[];
  audio?: PageAudio;
  touch?: TouchTarget[];
}

export type ChoiceType = "hard" | "easy" | "third";

export interface Choice {
  id: string;
  /** Critic use only — never rendered, never stored. */
  type: ChoiceType;
  label: BookLabel;
  /** A Material Symbols glyph in the shipped icon subset — shown only when the
   *  decision plate has no focus crop for this choice. */
  icon?: string;
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
  /** The cover's name line ("{name} as David"), gender-neutral. */
  coverNameLine?: BookLabel;
  /** e.g. "1 Samuel 17". */
  sourceRef: string;
  /** One adult sentence: what the story knows about being a person. */
  knowledge: string;
  /** BR2 mode (CAST | COMPANION) + the verse that gives the hero room. */
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
