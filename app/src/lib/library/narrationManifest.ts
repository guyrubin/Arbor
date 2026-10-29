/**
 * lib/library/narrationManifest — B-BOOK-35 / B-BOOK-73 (CI half): the
 * narration file manifests of the kid shelf, per book and voice folder (EN,
 * HE-m, HE-f), and their ONE pure check.
 *
 * What a shelf book needs, per folder:
 *  - `shared`: the name-free files one render serves to every child. A
 *    library book ships them in git (narrationFiles SHARED_NARRATION_SETS);
 *    a legacy shelf story (the beats-and-choices books) has no shared set
 *    yet, so every name-free unit is a MISSING shared file until the EU
 *    renders land (Guy's spend; nothing is rendered here).
 *  - `perChild`: the name-bearing files, rendered per child on the EU path
 *    into the child's own private files (never in git, never on a public
 *    path; bookRelease.guard), so CI can list them but never hold them.
 *
 * The manifest (src/content/narrationManifests.json, written by
 * scripts/narration-manifest.mts) records a sha256 per shipped shared file and
 * the frozen list of missing shared files (it may only shrink). The check:
 * every expected shared file is shipped with its hash, or listed missing; a
 * listed-missing file that now exists must move to the hashed list; the
 * per-child lists match the books. The read half (a full read with the real
 * files makes no runtime TTS request and finds every file it asks for) runs in the
 * B-BOOK-27 reader harness (components/library/allBooks.fullRead.zeroCall).
 */
import { KID_SHELF_STORIES } from "../heroJourneys";
import { authoredChoice, authoredScene } from "../heroJourneyRender";
import type { HeroStorySpec } from "../../types";
import { LIBRARY_BOOKS } from "./books";
import { legacyPageUnits, type LegacyFolder } from "./legacyNarration";
import { nameBearingFiles, SHARED_NARRATION_SETS, sharedNarrationShipped, VOICE_FOLDERS, type VoiceFolder } from "./narrationFiles";

export interface FolderNeeds {
  /** Name-free files one render serves to every child (shipped in git when the book has a shared set). */
  shared: string[];
  /** Name-bearing files, rendered per child into the child's private files. */
  perChild: string[];
}

export interface ShelfBookNeeds {
  bookId: string;
  kind: "library" | "legacy";
  /** The shared set in git, or null (none yet). */
  set: string | null;
  folders: Record<VoiceFolder, FolderNeeds>;
}

export interface FolderManifest {
  /** Shipped shared file → sha256. */
  files: Record<string, string>;
  /** Expected shared files not shipped yet: FROZEN, may only shrink. */
  missing: string[];
  /** The per-child (name-bearing) files a child's render must produce. */
  perChild: string[];
}

export interface NarrationManifests {
  schema: 1;
  books: Record<string, { kind: "library" | "legacy"; set: string | null; folders: Record<VoiceFolder, FolderManifest> }>;
}

/** A name no authored line contains: a unit whose words carry it names the child. */
const SENTINEL = "Zqxv";

/** Every unit a legacy story reads, in order (legacyPageUnits over its pages). */
export function legacyStoryUnits(story: HeroStorySpec): string[] {
  const choiceIds = story.beats.find((b) => b.id === "decision")?.choices?.map((c) => c.id) ?? [];
  const units = [
    ...legacyPageUnits({ onCover: true, atEnd: false, beatId: undefined, choiceId: undefined, choiceIds }),
    ...story.beats.flatMap((b) =>
      b.id === "consequence"
        ? choiceIds.flatMap((id) => legacyPageUnits({ onCover: false, atEnd: false, beatId: b.id, choiceId: id, choiceIds }))
        : legacyPageUnits({ onCover: false, atEnd: false, beatId: b.id, choiceId: undefined, choiceIds }),
    ),
    ...legacyPageUnits({ onCover: false, atEnd: true, beatId: undefined, choiceId: undefined, choiceIds }),
  ];
  return [...new Set(units)];
}

/** Does this legacy unit say the child's name in this folder? */
export function legacyUnitNamesChild(story: HeroStorySpec, unit: string, folder: LegacyFolder): boolean {
  if (unit === "question") return true; // "What do you do, {name}?"
  if (unit === "title" || unit === "the-end") return false;
  const lang = folder === "en" ? "en" : "he";
  const hero = { name: SENTINEL, nameLatin: SENTINEL, gender: folder === "he-f" ? "girl" : "boy" } as const;
  const [kind, id] = unit.split(".");
  const choice = story.beats.find((b) => b.id === "decision")?.choices?.find((c) => c.id === id);
  if (kind === "choice" && choice) return authoredChoice(choice, lang, hero).label.includes(SENTINEL);
  if (kind === "outcome" && choice) return authoredChoice(choice, lang, hero).consequence.includes(SENTINEL);
  const beat = story.beats.find((b) => b.id === unit);
  return beat ? authoredScene(beat, lang, undefined, hero).narration.includes(SENTINEL) : true;
}

/** What every shelf book needs, per voice folder: the released library books and the legacy shelf. */
export function shelfNarrationNeeds(): ShelfBookNeeds[] {
  const out: ShelfBookNeeds[] = [];
  for (const book of Object.values(LIBRARY_BOOKS)) {
    const shipped = sharedNarrationShipped(book);
    const folders = {} as Record<VoiceFolder, FolderNeeds>;
    for (const folder of VOICE_FOLDERS) folders[folder] = { shared: [...shipped[folder]], perChild: nameBearingFiles(book, folder) };
    out.push({ bookId: book.id, kind: "library", set: Object.prototype.hasOwnProperty.call(SHARED_NARRATION_SETS, book.id) ? SHARED_NARRATION_SETS[book.id] : null, folders });
  }
  for (const story of KID_SHELF_STORIES) {
    const units = legacyStoryUnits(story);
    const folders = {} as Record<VoiceFolder, FolderNeeds>;
    for (const folder of VOICE_FOLDERS) {
      const named = units.filter((u) => legacyUnitNamesChild(story, u, folder));
      folders[folder] = { shared: units.filter((u) => !named.includes(u)).map((u) => `${u}.mp3`), perChild: named.map((u) => `${u}.mp3`) };
    }
    out.push({ bookId: story.id, kind: "legacy", set: null, folders });
  }
  return out;
}

/**
 * The CI check over the manifest. `hashOf(bookId, set, folder, file)` returns
 * the shipped file's sha256, or null when it is not on disk.
 */
export function manifestFindings(manifests: NarrationManifests, needs: readonly ShelfBookNeeds[], hashOf: (bookId: string, set: string, folder: VoiceFolder, file: string) => string | null): string[] {
  const out: string[] = [];
  for (const need of needs) {
    const m = manifests.books[need.bookId];
    if (!m) { out.push(`${need.bookId}: no narration manifest`); continue; }
    if (m.set !== need.set) out.push(`${need.bookId}: the manifest names set ${m.set}, the book ${need.set}`);
    for (const folder of VOICE_FOLDERS) {
      const at = `${need.bookId}/${folder}`;
      const fm = m.folders[folder];
      if (!fm) { out.push(`${at}: no folder in the manifest`); continue; }
      const want = new Set(need.folders[folder].shared);
      for (const file of want) {
        const listed = Object.prototype.hasOwnProperty.call(fm.files, file);
        if (!listed && !fm.missing.includes(file)) out.push(`${at}/${file}: a page file neither shipped nor listed missing`);
        if (listed) {
          const h = need.set ? hashOf(need.bookId, need.set, folder, file) : null;
          if (h === null) out.push(`${at}/${file}: listed with a hash but missing on disk`);
          else if (h !== fm.files[file]) out.push(`${at}/${file}: the file's hash is not the manifest's`);
        }
      }
      for (const file of Object.keys(fm.files)) if (!want.has(file)) out.push(`${at}/${file}: in the manifest but no page reads it`);
      for (const file of fm.missing) {
        if (!want.has(file)) out.push(`${at}/${file}: listed missing but no page reads it`);
        else if (need.set && hashOf(need.bookId, need.set, folder, file) !== null) out.push(`${at}/${file}: shipped now: move it from missing to the hashed files`);
      }
      const per = need.folders[folder].perChild;
      if (JSON.stringify([...fm.perChild].sort()) !== JSON.stringify([...per].sort())) out.push(`${at}: the per-child list is not the book's (${per.length} name-bearing files)`);
    }
  }
  for (const id of Object.keys(manifests.books)) if (!needs.some((n) => n.bookId === id)) out.push(`${id}: a manifest for a book not on the shelf`);
  return out;
}

/** Missing shared files per book and folder (the render list the report states). */
export function missingCounts(manifests: NarrationManifests): Record<string, Record<VoiceFolder, { missing: number; perChild: number }>> {
  const out: Record<string, Record<VoiceFolder, { missing: number; perChild: number }>> = {};
  for (const [id, m] of Object.entries(manifests.books)) {
    out[id] = {} as Record<VoiceFolder, { missing: number; perChild: number }>;
    for (const folder of VOICE_FOLDERS) out[id][folder] = { missing: m.folders[folder].missing.length, perChild: m.folders[folder].perChild.length };
  }
  return out;
}
