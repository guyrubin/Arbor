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

import type { CanonicalBandId } from "../domains/ageBands";

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
  /** Contact shadow strength 0..1 (the art agent's compositor; default 0.8). */
  shadow?: number;
  /** Where the light comes from along x: > 0 = from the left (the cast falls
   *  to the right), < 0 = from the right. Default 0.8. */
  lightDx?: number;
  /** The plate's mean colour under the hero (r, g, b) — the sprite is graded
   *  a little toward it. */
  tint?: [number, number, number];
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
  /** The items must be done in their listed order: only the next one is
   *  tappable (p7b: helmet → sword → coat, so the coat never lies on the rug
   *  while he still wears it). */
  ordered?: boolean;
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
  /** (x, y) is always the BOTTOM edge of the image (as compose.py places it);
   *  "feet" (default) puts the lowest opaque band's centre (`footX` of the
   *  width) on x, "center" puts the image's horizontal centre on x. */
  anchor?: "feet" | "center";
  footX?: number;
  /** Degrees, clockwise. */
  rotate?: number;
  /** Contact shadow strength (feet-anchored objects on the ground). */
  shadow?: number;
  /** Shown only while a repair item is (not) done: the worn helmet hides when
   *  the helmet is tapped; the helmet on the heap appears. */
  showWhen?: { item: string; done: boolean };
}

/** A patch of the plate redrawn OVER the hero (p8: the water surface over the
 *  dipping fingers). The box is [x0, y0, x1, y1] in master fractions. */
export interface PlateOccluder {
  box: [number, number, number, number];
  opacity: number;
  /** Side / bottom feather and top (waterline) feather, plate-height fractions. */
  feather: number;
  featherTop: number;
}

/** When an art state comes, inside the page's narration: at page show, at a
 *  point (ms or a fraction of the file's duration), when the file ends, or a
 *  time after the previous state. */
export type ArtCue = "start" | { atFraction: number } | { atMs: number } | "audioEnd" | { afterMs: number };

/** One ordered picture state of a page (v3, p9: the swing → the stone in
 *  flight → the dust → the quiet). State 0 is the page as authored; each
 *  state here comes after the previous one (lib/library/bookArtStates). */
export interface ArtState {
  id: string;
  /** A plate that cross-fades in over the page's plate. A state whose plate
   *  is not in the book's plate table is skipped. */
  plateId?: string;
  /** The hero's pose from this state on (e.g. `sling-release`). */
  pose?: Pose;
  /** The overlay ids visible in this state (an overlay any state names shows
   *  only in the states that list it). */
  overlays: string[];
  cue: ArtCue;
  /** The key of this cue in the per-voice sidecar `<file>.cues.json`
   *  ({ flight: ms, boom: ms }); the sidecar wins over `cue`. */
  cueKey?: string;
  /** Sound off / no file: ms after the previous state (the page show for the
   *  first). */
  silentAfterMs: number;
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
  occluders?: PlateOccluder[];
  /** The plate's calm area for the words on a spread page, [x0, y0, x1, y1]
   *  master fractions (physical: the art is not mirrored in Hebrew). */
  textRect?: [number, number, number, number];
  /** Alternative slots by costume ("tunic" — the p5 A/B, BR5). */
  heroAlt?: Record<string, Slot>;
  audio?: PageAudio;
  touch?: TouchTarget[];
  /** Ordered picture states after the page shows (v2). Absent = derived from
   *  the overlays marked `reveal: "afterNarration"` (one state). */
  artStates?: ArtState[];
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
 *  read aloud and never shown to the child. v1 books carry builds + why; the
 *  v2 panel (depth-pass §3.2) carries knows + whyNow + tomorrow (+ together).
 *  The reader shows the sections a book has, in this order. */
export interface ParentPanel {
  /** v2: "What the story knows". */
  knows?: BookLabel;
  /** v1: "What it builds". */
  builds?: BookLabel;
  /** v2: "Why it matters at five, this week". */
  whyNow?: BookLabel;
  /** v1: "Why it is built this way". */
  why?: BookLabel;
  /** v2: "One thing to do tomorrow". */
  tomorrow?: BookLabel;
  askAfter: BookLine;
  askAfterOptional?: BookLine;
  /** v2: a line for reading together (the choice to try on a re-read). */
  together?: BookLabel;
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
  /** The parent panel's age text ("4-7"). */
  ageBand: string;
  /** The canonical age bands the book is for (lib/domains/ageBands; ≥ 1), so
   *  each child sees the books of its own age group. */
  ageBands: CanonicalBandId[];
  cover: Page;
  /** The linear pages in reading order (branch pages live in the choices). */
  pages: Page[];
  decision: {
    pageId: string;
    choices: Choice[];
    /** Dedicated 4:3 pictures for the choice cards (public URLs), by choice id.
     *  A hero sheet may carry its own per-child versions (they show the child);
     *  those win. Without either, the card shows the plate's focus crop. */
    choiceArt?: Record<string, string>;
  };
  /** The first page every branch returns to. */
  rejoinPageId: string;
  parent: ParentPanel;
  /** A pose the hero sheet does not have yet → the nearest pose it has (the
   *  art agent's next round adds it). Used only when the sheet's manifest is
   *  read and lacks the pose. */
  poseFallbacks?: Record<Pose, Pose>;
  /** K2: the legacy hero story this library book supersedes (one David book
   *  per child): a child who HAS this book no longer sees that story on the
   *  kid shelf or as Tonight's story (components/kidmode/kidBooks kidShelfFor). */
  replacesStory?: string;
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
