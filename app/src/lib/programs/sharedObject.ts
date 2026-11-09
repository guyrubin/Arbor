/**
 * B-PROG-16 — one shared object for the program week, and the next-day
 * book handback.
 *
 * A shared object is a book the parent and child already share (an Everyday
 * Plan pattern: cover line, "one thing for tomorrow", ask-after). Nothing
 * here authors a new sentence. A week matches at most ONE eligible object:
 *
 *  1. an explicit id, when that object is eligible and sits on the week's shelf;
 *  2. otherwise the parent's own single active plan on that shelf;
 *  3. otherwise the shelf's only eligible object.
 *
 * Two or more candidates, a week shelf that disagrees with the focus shelf,
 * or a missing language is a FALLBACK: the week's own skill line (already on
 * Today), never a guessed book. No week in the catalogue is given an id —
 * that mapping waits on B-GA-02 — so a program week matches only by (2) or (3).
 *
 * The handback is the NEXT local day after that object was read to the end.
 * It carries the cover words, tomorrow, and ask-after. It does not read a
 * path, a choice, or a score (the read ledger has none of those).
 *
 * DARK until `arbor.flags.programSharedObject` is "1". Off, Now mounts nothing.
 */
import { dayKey } from "./enrolment";
import { planShelf } from "../plans/planWeek";
import { authoredPatterns } from "../library/plans/planBooks";
import { fillHero, heGender, labelFor, lineFor } from "../library/bookText";
import { childScopedKey } from "../childLocalState";
import type { PatternDef } from "../library/plans/patterns";
import type { BookLabel, BookLine } from "../library/types";
import type { ShelfId } from "../shelves/registry";

export const PROGRAM_SHARED_OBJECT_FLAG = "arbor.flags.programSharedObject";

type StorageLike = { getItem(key: string): string | null; setItem?(key: string, value: string): void } | null | undefined;

const deviceStorage = (): StorageLike => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

/** Off unless the pilot flag says "1". Fails closed. */
export function programSharedObjectOn(storage?: StorageLike): boolean {
  const store = storage === undefined ? deviceStorage() : storage;
  try {
    return store?.getItem(PROGRAM_SHARED_OBJECT_FLAG) === "1";
  } catch {
    return false;
  }
}

export interface SharedObject {
  id: string;
  /** Null for the body-domain door (not one of the nine shelves; not matched here). */
  shelf: ShelfId | null;
  title: BookLabel;
  coverLine: BookLabel;
  tomorrow: BookLabel;
  askAfter: BookLine;
}

const filled = (s: string | undefined): boolean => !!s && s.trim().length > 0;

/** EN and both Hebrew genders, on every line the handback shows. */
export function sharedObjectEligible(o: SharedObject): boolean {
  return filled(o.title.en) && filled(o.title.he)
    && filled(o.coverLine.en) && filled(o.coverLine.he)
    && filled(o.tomorrow.en) && filled(o.tomorrow.he)
    && filled(o.askAfter.en) && filled(o.askAfter.he.m) && filled(o.askAfter.he.f);
}

export function sharedObjectFromPattern(def: PatternDef): SharedObject | null {
  const object: SharedObject = {
    id: def.id,
    shelf: planShelf(def),
    title: def.title,
    coverLine: def.coverLine,
    tomorrow: def.parent.tomorrow,
    askAfter: def.parent.askAfter,
  };
  return sharedObjectEligible(object) ? object : null;
}

export function catalogueSharedObjects(defs: readonly PatternDef[] = authoredPatterns()): SharedObject[] {
  return defs.flatMap((d) => {
    const o = sharedObjectFromPattern(d);
    return o ? [o] : [];
  });
}

export type SharedMatch =
  | { kind: "object"; via: "named" | "chosen" | "only"; object: SharedObject }
  | { kind: "fallback"; reason: "focus" | "many" | "none"; text: string };

/** One eligible object for this week and focus, or the week's own skill as fallback. */
export function matchSharedObject(input: {
  weekShelf: ShelfId;
  /** When set and different from the week shelf, the two do not agree: fallback. */
  focusShelf?: ShelfId | null;
  /** A reviewed id. None of the program weeks set one (B-GA-02). */
  objectId?: string | null;
  /** Pattern ids the PARENT already has running on this shelf. */
  chosenIds?: readonly string[];
  objects: readonly SharedObject[];
  /** The week's skill in the parent's language. The fallback text. */
  weekSkill: string;
}): SharedMatch {
  const skill = input.weekSkill.trim();
  const fallback = (reason: "focus" | "many" | "none"): SharedMatch => ({ kind: "fallback", reason, text: skill });
  if (input.focusShelf && input.focusShelf !== input.weekShelf) return fallback("focus");
  const onShelf = input.objects.filter((o) => o.shelf === input.weekShelf && sharedObjectEligible(o));
  const named = (input.objectId ?? "").trim();
  if (named) {
    const hit = onShelf.find((o) => o.id === named);
    if (hit) return { kind: "object", via: "named", object: hit };
  }
  const chosen = onShelf.filter((o) => (input.chosenIds ?? []).includes(o.id));
  if (chosen.length === 1) return { kind: "object", via: "chosen", object: chosen[0] };
  if (chosen.length > 1) return fallback("many");
  if (onShelf.length === 1) return { kind: "object", via: "only", object: onShelf[0] };
  if (onShelf.length === 0) return fallback("none");
  return fallback("many");
}

export interface BookHandback {
  /** Dismiss key: object id + the day it was finished. */
  key: string;
  objectId: string;
  title: string;
  coverLine: string;
  tomorrow: string;
  askAfter: string;
}

const shiftDay = (day: string, delta: number): string => {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return dayKey(d);
};

/** The handback for yesterday's finished read of the matched object, or the fallback. */
export function bookHandback(input: {
  weekShelf: ShelfId;
  focusShelf?: ShelfId | null;
  objectId?: string | null;
  chosenIds?: readonly string[];
  objects: readonly SharedObject[];
  reads: readonly { bookId?: string; finishedAt?: string }[];
  now: Date;
  lang: "en" | "he";
  gender?: "boy" | "girl" | string | null;
  childName: string;
  dismissed?: readonly string[];
  weekSkill: string;
}): BookHandback | (SharedMatch & { kind: "fallback" }) {
  const match = matchSharedObject(input);
  if (match.kind !== "object") return match;
  const yesterday = shiftDay(dayKey(input.now), -1);
  let best = -Infinity;
  let hit = false;
  for (const read of input.reads) {
    if (read.bookId !== match.object.id || typeof read.finishedAt !== "string") continue;
    const at = Date.parse(read.finishedAt);
    if (!Number.isFinite(at) || dayKey(new Date(at)) !== yesterday || at < best) continue;
    best = at;
    hit = true;
  }
  if (!hit) return { kind: "fallback", reason: "none", text: input.weekSkill.trim() };
  const key = `${match.object.id}:${yesterday}`;
  if ((input.dismissed ?? []).includes(key)) return { kind: "fallback", reason: "none", text: input.weekSkill.trim() };
  const g = heGender(input.gender === "girl" ? "girl" : input.gender === "boy" ? "boy" : undefined);
  const name = input.childName.trim();
  const line = (label: BookLabel) => fillHero(labelFor(label, input.lang), name, input.lang).trim();
  return {
    key,
    objectId: match.object.id,
    title: line(match.object.title),
    coverLine: line(match.object.coverLine),
    tomorrow: line(match.object.tomorrow),
    askAfter: fillHero(lineFor(match.object.askAfter, input.lang, g), name, input.lang).trim(),
  };
}

const dismissKey = (childId: string, ownerId: string) => childScopedKey(`programHandback.${encodeURIComponent(ownerId)}`, childId);

export function readDismissedHandbacks(storage: StorageLike, childId: string, ownerId = "local-sandbox"): string[] {
  if (!childId || !ownerId.trim()) return [];
  try {
    // Legacy owner-less dismissals cannot be attributed to the signed-in family.
    const raw = storage?.getItem(dismissKey(childId, ownerId));
    const parsed = raw ? JSON.parse(raw) as unknown : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length < 120) : [];
  } catch {
    return [];
  }
}

export function dismissHandback(storage: StorageLike, childId: string, key: string, ownerId = "local-sandbox"): string[] {
  if (!childId || !ownerId.trim()) return [];
  const next = [...new Set([...readDismissedHandbacks(storage, childId, ownerId), key])].slice(-40);
  try {
    storage?.setItem?.(dismissKey(childId, ownerId), JSON.stringify(next));
  } catch {
    /* a full or private store still hides the card for this render */
  }
  return next;
}
