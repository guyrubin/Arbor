/**
 * lib/library/plans/planNarration — PR C (Everyday Plans): the ONE contract of
 * a PLAN book's narration, rendered in-product through the canonical books'
 * pipeline (server/planNarration.ts, components/kidmode/hero/buildPlanNarration)
 * with the same narrator (Sulafat), style prompt and fidelity handling.
 *
 * Differences from a canonical book, all deliberate:
 * - EVERY page file is rendered per child (cover, p1–p4, s1–s3, the win page):
 *   a pattern has no shipped shared set, and the reader plays files only.
 * - The set key is the CHILD ID (narration.ts: `<root>/<pattern>/<childId>/
 *   <en|he-m|he-f>/<pageId>.mp3`), because the files speak the child's name:
 *   they are child data, stored under the child's private book files
 *   (`children/{childId}/books/{pattern}/narration/{childId}/…`, the prefix the
 *   export inventory and the erase sweep cover) and listed in the registered
 *   `bookAssets/{pattern}` doc (CHILD_SUBCOLLECTIONS).
 * - The voice folder is chosen by the family's language and the child's
 *   gender (narrationVoice.narrationFolder); the Hebrew folder reads the
 *   pattern's HE-m / HE-f text (first person: the verbs differ).
 * - A line that carries the child's name — and the parent's own-words step,
 *   which is the child's record — is child data for the route policy
 *   (`child_profile`, the EU path canonical name pages take); the pattern's
 *   authored lines are public text.
 * - Idempotent by the words: each stored file remembers a hash of exactly
 *   what the voice was asked to read; a file is rendered again only when that
 *   changes (a renamed child, a re-approved own step), never silently.
 *
 * Pure: no I/O, no React, no Firebase.
 */
import { heroAvatarHash } from "../../heroSheetContract";
import type { BookAssetsDoc } from "../bookAssetPaths";
import { missingBookPoses } from "../bookPoses";
import { bookNarrationFiles, isNameBearing, type NarrationFile, type VoiceFolder } from "../narrationFiles";
import { direct, geminiText, NARRATION_VOICE, stylePrompt } from "../narrationTts";
import type { AiDataClass } from "../../../ai/capabilities/contracts";
import type { PlanBook } from "../types";
import { OWN_STEP } from "./composePlanBook";
import { PLAN_SHEET_BOOK_ID } from "./planPoses";

export type { VoiceFolder };

/** The data classes a plan file's words fall under (the route policy's input). */
export type PlanNarrationDataClasses = readonly AiDataClass[];

export interface PlanNarrationRow extends NarrationFile {
  folder: VoiceFolder;
  /** `cover`, `p1`, `s1-sit-after-meal-5m` … (the file without `.mp3`). */
  stem: string;
  /** The words the voice reads ({name} still a token). */
  ttsText: string;
  /** The style prompt (input.prompt): the canonical narrator's. */
  style: string;
  /** The words with Gemini-TTS tags ({name} still a token). */
  tagged: string;
  nameBearing: boolean;
  /** The parent's own-words step (B-GA-11): the child's record, not the pattern's text. */
  ownStep: boolean;
  /** Child data (the EU path canonical name pages take), or public text. */
  dataClasses: PlanNarrationDataClasses;
}

const stemOf = (file: string) => file.replace(/\.mp3$/, "");
const isOwnStepStem = (stem: string) => new RegExp(`^s[123]-${OWN_STEP}$`).test(stem);

/** The route decision of one file: a line that says the child's name, or the
 *  parent's own step, is child data (`child_profile`: EU residency in prod,
 *  exactly as a canonical name page); the pattern's authored text is public. */
export function planNarrationDataClasses(row: Pick<PlanNarrationRow, "nameBearing" | "ownStep">): PlanNarrationDataClasses {
  return row.nameBearing || row.ownStep ? ["child_profile"] : ["public"];
}

/** Every narration file of a plan book for one voice folder, in reading order
 *  (bookNarrationFiles: a plan book is linear — cover, p1…p4, s1…s3, the win
 *  page; it has no decision, no repair and no end-page prompt). */
export function planNarrationFiles(book: PlanBook, folder: VoiceFolder): NarrationFile[] {
  return bookNarrationFiles(book, folder).filter((f) => f.file.endsWith(".mp3"));
}

/** Every file with its TTS input. EN reads the display text; HE reads the
 *  pattern's HE-m / HE-f display text (the patterns carry no separately
 *  pointed TTS manuscript yet). */
export function planNarrationRows(book: PlanBook, folder: VoiceFolder): PlanNarrationRow[] {
  const lang = folder === "en" ? "en" : "he";
  return planNarrationFiles(book, folder).map((f) => {
    const stem = stemOf(f.file);
    const nameBearing = isNameBearing(f);
    const ownStep = isOwnStepStem(stem);
    const row = { ...f, folder, stem, ttsText: f.text, style: stylePrompt(lang, f.text, stem), tagged: geminiText(direct(f.text)), nameBearing, ownStep };
    return { ...row, dataClasses: planNarrationDataClasses(row) };
  });
}

export interface PlanTtsInput {
  text: string;
  prompt: string;
  languageCode: string;
  lang: "en" | "he";
  nameBearing: boolean;
  dataClasses: PlanNarrationDataClasses;
  /** The hash of exactly what the voice is asked to read (idempotency key). */
  textHash: string;
}

/** The hash a stored file remembers: the folder, the words (name filled) and
 *  the prompt. Same words = same file; anything else = a deliberate re-render. */
export function planNarrationTextHash(folder: VoiceFolder, text: string, prompt: string): string {
  return heroAvatarHash(`plan-narration-v1|${folder}|${text.normalize("NFC")}|${prompt.normalize("NFC")}`);
}

/** The TTS request of one file for one child (the name filled in), or null. */
export function planNarrationRequest(book: PlanBook, folder: VoiceFolder, file: string, firstName: string): PlanTtsInput | null {
  const row = planNarrationRows(book, folder).find((r) => r.file === file);
  if (!row) return null;
  const lang = folder === "en" ? "en" : "he";
  const text = row.tagged.split("{name}").join(firstName);
  return { text, prompt: row.style, languageCode: NARRATION_VOICE[lang].languageCode, lang, nameBearing: row.nameBearing, dataClasses: row.dataClasses, textHash: planNarrationTextHash(folder, text, row.style) };
}

/* ── Where the files live ────────────────────────────────────────────────── */

/** A plan book's narration set = the child id (narration.ts voiceKey rule:
 *  the id whose name the files speak). */
export const planNarrationSetId = (childId: string): string => childId;

/** The `bookAssets` doc that lists a child's narration of one pattern:
 *  `users/{uid}/children/{childId}/bookAssets/{pattern}` (registered in
 *  CHILD_SUBCOLLECTIONS: exported and erased with the child). Its files sit at
 *  `children/{childId}/books/{pattern}/<rel>`. */
export const planNarrationDocId = (pattern: string): string => pattern;

/** The sheetId a narration-only plan doc carries (it has no hero sheet of its
 *  own: the pictures come from the child's shared plan sheet). */
export const PLAN_NARRATION_SHEET_ID = "plan-narration";

/** The relative path of one file inside the pattern's book folder. */
export function planNarrationRel(childId: string, folder: VoiceFolder, file: string): string {
  return `narration/${planNarrationSetId(childId)}/${folder}/${file}`;
}

/** The narration-only doc of one pattern (the first write), with no files yet. */
export function emptyPlanNarrationDoc(childId: string, pattern: string, createdAt: string): BookAssetsDoc {
  const setId = planNarrationSetId(childId);
  return { id: planNarrationDocId(pattern), bookId: pattern, sheetId: PLAN_NARRATION_SHEET_ID, setId, sets: [setId], sheetManifest: { poses: {} }, files: [], bytes: 0, createdAt, narrationText: {} };
}

/** Is `doc` the narration-only doc of a pattern (never a book to open)? */
export const isPlanNarrationDoc = (doc: Pick<BookAssetsDoc, "sheetId"> | null | undefined): boolean => doc?.sheetId === PLAN_NARRATION_SHEET_ID;

/* ── The plan sheet and completeness ─────────────────────────────────────── */

/** The poses a bookAssets doc really has files for (lib/bookAssets sheetPoses). */
export function sheetPosesOf(doc: BookAssetsDoc | null | undefined): string[] | null {
  if (!doc?.sheetManifest?.poses || !Array.isArray(doc.files)) return null;
  return Object.keys(doc.sheetManifest.poses).filter((p) => doc.files.includes(`hero-sheets/${doc.sheetId}/${doc.sheetManifest.poses[p].file}`));
}

/** Does the child's shared plan sheet (`bookAssets/plan-poses`) show this
 *  plan book — the same test the kid shelf applies (lib/bookAssets)? */
export function planSheetCovers(sheet: BookAssetsDoc | null | undefined, book: PlanBook): boolean {
  if (!sheet || sheet.bookId !== PLAN_SHEET_BOOK_ID) return false;
  const poses = sheetPosesOf(sheet);
  return !!poses && missingBookPoses(book, poses).length === 0;
}

/** The stored file (mp3 or wav) of one row in a narration doc, when its
 *  remembered words are the current ones; else null (absent or stale). */
export function storedPlanNarration(doc: BookAssetsDoc | null | undefined, childId: string, folder: VoiceFolder, file: string, textHash: string): string | null {
  if (!doc || !Array.isArray(doc.files)) return null;
  const rel = planNarrationRel(childId, folder, file);
  const wav = rel.replace(/\.mp3$/, ".wav");
  const stored = doc.files.includes(rel) ? rel : doc.files.includes(wav) ? wav : null;
  if (!stored) return null;
  const remembered = doc.narrationText?.[stored];
  // a file that remembers other words is stale; one that remembers none is kept (never re-rendered silently)
  return remembered === undefined || remembered === textHash ? stored : null;
}

/** Every file of the folder stored with the current words? */
export function planNarrationComplete(doc: BookAssetsDoc | null | undefined, book: PlanBook, childId: string, folder: VoiceFolder, firstName: string): boolean {
  return planNarrationFiles(book, folder).every((f) => {
    const req = planNarrationRequest(book, folder, f.file, firstName);
    return !!req && !!storedPlanNarration(doc, childId, folder, f.file, req.textHash);
  });
}

/** The client's idempotency key for one child's plan narration: the folder
 *  and, per plan book, the hashes of every file's words (the name filled).
 *  Equal keys = nothing to ask for. */
export function planNarrationConfiguration(books: readonly PlanBook[], folder: VoiceFolder, firstName: string): string {
  const parts = [...books]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((b) => [b.id, planNarrationFiles(b, folder).map((f) => planNarrationRequest(b, folder, f.file, firstName)?.textHash ?? "")]);
  return JSON.stringify({ v: 1, folder, parts });
}
