/**
 * lib/library/plans/planBookDoc — B-BOOK-75 (standard §7): the per-child PLAN
 * book as it is STORED — `users/{uid}/children/{childId}/books/{bookId}`, the
 * `books` subcollection registered in CHILD_SUBCOLLECTIONS (exported and erased
 * with the child; guard: lib/childData.subcollections.test.ts).
 *
 * The document holds the parent's choices, never the text: the words are
 * recomposed from the pattern registry on every read, so a reviewed wording
 * reaches every family's book (and, because the edition hashes the composed
 * book, a changed wording restarts the bookmark at the cover — immutable
 * edition resume, as for every other book). The child's taps are not here:
 * the kid side writes only its bookmark.
 *
 * Written by the server compose route (server/plans.ts) in a Firebase build;
 * in the local sandbox by the device after the server's visibility answer.
 */
import { composePlanBook, OWN_STEP, validatePlanComposition, type OwnStep, type PlanComposition } from "./composePlanBook";
import { getPattern } from "./planBooks";
import { isPatternId } from "./planVisibility";
import type { BookLang, PatternId, PlanBook } from "../types";

export interface PlanBookDoc extends PlanComposition {
  /** = bookId (the collection's row id). */
  id: string;
  kind: "plan";
  pattern: PatternId;
  /** The language the parent composed and approved in (the signature is per language). */
  lang: BookLang;
  createdAt: string;
  updatedAt: string;
  /** "active" while the plan sits first in Tonight; "closed" after the parent closes it (B-BOOK-78). */
  status: "active" | "closed";
  /** B-BOOK-78: the LOCAL day keys (YYYY-MM-DD) the parent confirmed the plan
   *  happened (a sit, a night) — a COUNT on the parent's shelf, never a rate,
   *  a streak or a verdict; nothing the child sees. */
  nights?: string[];
  /** ISO time the parent closed the plan (status "closed"). */
  closedAt?: string;
}

export const PLAN_BOOKS_COLLECTION = "books";

const line = (v: unknown): v is { en: string; he: { m: string; f: string } } =>
  !!v && typeof v === "object" && typeof (v as { en?: unknown }).en === "string" && !!(v as { he?: unknown }).he && typeof (v as { he: { m?: unknown } }).he.m === "string" && typeof (v as { he: { f?: unknown } }).he.f === "string";

/** The own-words step of a stored row, or null when malformed. */
export function readOwnStep(raw: unknown): OwnStep | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.slot !== 1 && r.slot !== 2 && r.slot !== 3) return null;
  if (typeof r.sourceText !== "string" || !line(r.text) || r.aiPhrased !== true) return null;
  return { slot: r.slot, sourceText: r.sourceText.slice(0, 400), text: r.text, aiPhrased: true, ...(typeof r.approvedAt === "string" && r.approvedAt ? { approvedAt: r.approvedAt } : {}) };
}

/** The one book id a child has per pattern. */
export const planBookId = (pattern: PatternId, childId: string) => `${pattern}.${childId}`;

const str = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 200;

/** A stored row as a PlanBookDoc, or null when it is not one (untrusted data). */
export function readPlanBookDoc(raw: unknown): PlanBookDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.kind !== "plan" || !isPatternId(r.pattern) || !str(r.id) || !str(r.bookId) || r.id !== r.bookId) return null;
  if (!Array.isArray(r.stepMenuIds) || r.stepMenuIds.length !== 3 || !r.stepMenuIds.every(str)) return null;
  if (typeof r.minutes !== "number" || typeof r.durationDays !== "number" || !str(r.time)) return null;
  if (!Array.isArray(r.boxItemIds) || !r.boxItemIds.every(str)) return null;
  if (!str(r.approvedAt) || !str(r.approvedBy) || (r.lang !== "en" && r.lang !== "he")) return null;
  const ownStep = readOwnStep(r.ownStep);
  if (r.stepMenuIds.includes(OWN_STEP) && !ownStep) return null;
  const nights = Array.isArray(r.nights) ? r.nights.filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) : [];
  return {
    ...(ownStep ? { ownStep } : {}),
    ...(nights.length ? { nights: [...new Set(nights)].sort() } : {}),
    ...(str(r.closedAt) ? { closedAt: r.closedAt } : {}),
    id: r.id,
    kind: "plan",
    pattern: r.pattern,
    bookId: r.bookId,
    stepMenuIds: r.stepMenuIds as [string, string, string],
    minutes: r.minutes,
    time: r.time,
    boxItemIds: r.boxItemIds as string[],
    durationDays: r.durationDays,
    approvedAt: r.approvedAt,
    approvedBy: r.approvedBy,
    lang: r.lang,
    createdAt: str(r.createdAt) ? r.createdAt : r.approvedAt,
    updatedAt: str(r.updatedAt) ? r.updatedAt : r.approvedAt,
    status: r.status === "closed" ? "closed" : "active",
  };
}

/** The book a stored document composes, or null when its pattern is not
 *  authored or its choices no longer fit the pattern's menu. */
export function planBookFromDoc(doc: PlanBookDoc): PlanBook | null {
  const def = getPattern(doc.pattern);
  if (!def || validatePlanComposition(def, doc).length) return null;
  return composePlanBook(def, doc);
}
