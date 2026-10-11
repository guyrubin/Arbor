/**
 * lib/library/legacyNarration — B-BOOK-73 (Guy, 10 Oct 2026: "This is not the
 * voice"): the legacy kid-shelf books (Noah's Ark, Jonah, Moses, Joseph,
 * Jacob) read aloud from FILES in the narrator Guy chose (Sulafat, the books
 * standard section 6), never through the runtime default voice.
 *
 * Their authored words name the child on almost every page, so the files are
 * the child's own private book files (lib/library/bookAssetPaths):
 *   children/{childId}/books/{storyId}/manifest.json
 *   children/{childId}/books/{storyId}/narration/{set}/<en|he-m|he-f>/<unit>.mp3
 * A book whose manifest is missing stays silent (never an error, never TTS).
 *
 * Units, one file each: `title` (the cover), each beat id but `consequence`
 * (that page shows the chosen answer's outcome), `question` ("What do you
 * do, {name}?"), `choice.<id>` (the answer's label), `outcome.<id>`, `the-end`.
 */
import type { BookAssetSource } from "../bookAssetStore";

/** The set rendered on 11 Oct 2026 (EN gemini-2.5-pro-tts, HE gemini-3.1-flash-tts-preview, voice Sulafat). */
export const LEGACY_NARRATION_SET = "sulafat-v1";

export type LegacyFolder = "en" | "he-m" | "he-f";

export function legacyFolder(lang: "en" | "he", gender: string | undefined): LegacyFolder {
  return lang === "en" ? "en" : gender === "girl" ? "he-f" : "he-m";
}

/** What one legacy page reads, in order. */
export function legacyPageUnits(page: {
  onCover: boolean;
  atEnd: boolean;
  beatId: string | undefined;
  choiceId: string | undefined;
  choiceIds: readonly string[];
}): string[] {
  if (page.atEnd) return ["the-end"];
  if (page.onCover) return ["title"];
  if (!page.beatId) return [];
  if (page.beatId === "decision" && !page.choiceId) return ["decision", "question", ...page.choiceIds.map((id) => `choice.${id}`)];
  if (page.beatId === "consequence") return page.choiceId ? [`outcome.${page.choiceId}`] : [];
  return [page.beatId];
}

export function legacyNarrationRel(set: string, folder: LegacyFolder, unit: string): string {
  return `narration/${set}/${folder}/${unit}.mp3`;
}

/** The manifest a legacy book's narration ships with. */
export interface LegacyNarrationManifest {
  kind: "legacy-narration";
  storyId: string;
  set: string;
  /** Version stamp (the device copy is keyed by it). */
  createdAt: string;
  /** Units per folder. */
  folders: Partial<Record<LegacyFolder, string[]>>;
}

export function parseLegacyManifest(raw: unknown, storyId: string): LegacyNarrationManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Partial<LegacyNarrationManifest>;
  if (m.kind !== "legacy-narration" || m.storyId !== storyId || typeof m.set !== "string" || typeof m.createdAt !== "string" || !m.folders || typeof m.folders !== "object") return null;
  const folders: LegacyNarrationManifest["folders"] = {};
  for (const f of ["en", "he-m", "he-f"] as const) {
    const list = (m.folders as Record<string, unknown>)[f];
    if (Array.isArray(list)) folders[f] = list.filter((u): u is string => typeof u === "string" && /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(u));
  }
  return { kind: "legacy-narration", storyId, set: m.set, createdAt: m.createdAt, folders };
}

/** The store's view of a manifest: the files it may fetch. */
export function legacySource(m: LegacyNarrationManifest): BookAssetSource {
  const files: string[] = [];
  for (const [folder, units] of Object.entries(m.folders) as [LegacyFolder, string[]][]) {
    for (const u of units) files.push(legacyNarrationRel(m.set, folder, u));
  }
  return { bookId: m.storyId, createdAt: m.createdAt, files };
}
