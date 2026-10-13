/** Private reading position only. A committed branch is needed to reopen the
 * authored path; taps, repair history and preferences are never recorded. */
import { COVER, END, initialBookFlow, readPath, type BookFlowState } from "./bookFlow";
import type { BookAssetsDoc } from "./bookAssetPaths";
import type { Book } from "./types";

export type BookProgressPosition = Pick<BookFlowState, "at" | "choiceId">;
export interface BookBookmark {
  id: string;
  v: 1;
  edition: string;
  pageId: string;
  branchId: string | null;
}

const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
};

/** Bound to this authored book and its saved asset edition, never the current
 * profile avatar. Existing historical books are neither changed nor rebuilt. */
export function bookEdition(book: Book, assets: BookAssetsDoc): string {
  const source = stable([book, assets]);
  let a = 2166136261, b = 5381;
  for (let i = 0; i < source.length; i++) {
    a = Math.imul(a ^ source.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ source.charCodeAt(i);
  }
  return `v1-${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}`;
}

export function resumeBook(book: Book, edition: string, value: unknown): BookFlowState {
  const cover = initialBookFlow();
  if (!value || typeof value !== "object") return cover;
  const row = value as Partial<BookBookmark>;
  if (row.v !== 1 || row.id !== book.id || row.edition !== edition || typeof row.pageId !== "string") return cover;
  const branch = row.branchId;
  if (branch !== null && (typeof branch !== "string" || !book.decision.choices.some(c => c.id === branch))) return cover;
  const path = readPath(book, branch);
  if (row.pageId === END ? branch === null || !path.length : row.pageId !== COVER && !path.some(p => p.id === row.pageId)) return cover;
  // Repairs must be played again, never inferred from a saved assessment.
  return { ...cover, at: row.pageId, choiceId: branch, selected: row.pageId === book.decision.pageId ? branch : null };
}

export function bookmarkFor(book: Book, edition: string, position: BookProgressPosition): BookBookmark {
  const row: BookBookmark = { id: book.id, v: 1, edition, pageId: position.at, branchId: position.choiceId };
  const valid = resumeBook(book, edition, row);
  return { ...row, pageId: valid.at, branchId: valid.choiceId };
}
