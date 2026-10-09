/**
 * B-PLAY-12 — the Stories library merges into the Comics shelf.
 *
 * #/stories used to carry its own "Your library" module: every hero run the
 * child had read (finished or not), in the story language. #/comics carried
 * the comic books. A hero-less finished run is NOT a comic (KID-MODE §0 #2),
 * so moving the shelf naively would have hidden it (law 6: nothing a parent
 * could reach before becomes unreachable).
 *
 * The one shelf model: the Comics shelf shows every run the Stories library
 * showed — a run whose story has a read-along comic ON the shelf appears as
 * that comic; every other run appears as a text "book" (title, date, reread in
 * an inline reader). Pure: no React, no storage, no model call.
 */
import type { HeroJourneyRun } from "../types";
import { savedComicDocId, type SavedComicMeta } from "./heroComics";

export interface StoryShelfInput {
  runs: readonly HeroJourneyRun[];
  /** The child's saved comics (savedComics collection). */
  savedComics: readonly SavedComicMeta[];
  /** The Stories library's own filter: the story can be told in the shelf's
   *  language (a run of a story with no spec stays listed). */
  tellable: (storyId: string) => boolean;
  /** Whether the shelf SHOWS this comic slot and it can open. Omitted = every
   *  saved comic is shown. Pass false for a slot the shelf does not draw (no
   *  hero yet) or whose pages this device has confirmed gone — the run then
   *  comes back as a text book, so it never becomes unreachable. */
  comicShown?: (docId: string) => boolean;
}

/** When a run happened: completedAt, else startedAt (the stories contract's fold). */
export const runAt = (run: Pick<HeroJourneyRun, "completedAt" | "startedAt">): string => run.completedAt || run.startedAt || "";

/** The read-along comic slot a run's story owns, when the shelf shows one. */
export function runComicDocId(run: Pick<HeroJourneyRun, "storyId">, input: Pick<StoryShelfInput, "savedComics" | "comicShown">): string | null {
  const docId = savedComicDocId(run.storyId, "journey");
  if (!input.savedComics.some((m) => m.id === docId)) return null;
  return input.comicShown && !input.comicShown(docId) ? null : docId;
}

/** The runs the Stories library listed (same language filter). */
export const libraryRuns = (input: Pick<StoryShelfInput, "runs" | "tellable">): HeroJourneyRun[] =>
  input.runs.filter((r) => input.tellable(r.storyId));

/** The text books on the Comics shelf: every library run with no comic shown, newest first. */
export function storyShelfTextBooks(input: StoryShelfInput): HeroJourneyRun[] {
  return libraryRuns(input)
    .filter((run) => runComicDocId(run, input) === null)
    .sort((a, b) => runAt(b).localeCompare(runAt(a)) || b.id.localeCompare(a.id));
}
