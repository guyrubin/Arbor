/* ════════════════════════════════════════════════════════════════════════════
   firstsKeepsake — GP-31: a note and a date on every fresh milestone.

   WHAT WAS MISSING
   ────────────────
   Marking a milestone wrote a boolean and a timestamp: `checked`,
   `observationStatus`, `observationUpdatedAt`. The thing the parent actually
   wanted to keep — "she let go of the sofa and took three steps to me, on the
   Tuesday after the holiday" — had nowhere to go. The record remembered THAT
   it happened and nothing about WHAT happened.

   A keepsake is therefore: a note in the parent's own words, the day they saw
   it, and — only if they want one — a photo. The note and the date are the
   whole feature; the photo is optional and the keepsake is complete without
   it. lib/firsts.ts (beside this file) owns the week-1 CELEBRATION of a first;
   this module owns the RECORD of one.

   WHERE IT LIVES, AND WHY
   ───────────────────────
   Device-local, at `arbor.firstsKeepsakes.<childId>` — minted through
   `childScopedKey`, so `clearChildLocalState` sweeps it the moment that child
   is deleted (childLocalStateSweep.guard.test.ts covers the shape
   automatically). Deliberately NOT a new Firestore sink: a new per-child
   collection has to be registered in CHILD_SUBCOLLECTIONS or it silently
   escapes both the GDPR export and the erase sweep, and that registry is not
   this wave's to edit.

   A PHOTO IS SWEPT WITH THE CHILD
   ───────────────────────────────
   `photoUrl` is only ever a URL returned by `lib/storage.uploadChildPhoto`,
   which writes `users/{uid}/children/{childId}/photos/…`. Both erase paths
   delete by prefix — `/privacy/erase` removes
   `users/{uid}/children/{childId}/` and `/account/delete` removes
   `users/{uid}/` — so the file is inside the swept subtree by construction.
   firstsKeepsake.test.ts proves that containment against the real source of
   all three paths, and the wiring guard proves the component uploads through
   no other route.

   CLINICAL FIREWALL
   ─────────────────
   A keepsake holds a sentence, a date and maybe a picture. Nothing here is
   scored, ranked, compared to another child, or measured against an age
   expectation, and `keepsakeCount` counts what the PARENT wrote down — never
   how much of a checklist a child has covered.

   Pure + clock-injected; the I/O helpers are best-effort and never throw.
   ════════════════════════════════════════════════════════════════════════════ */
import { childScopedKey } from "./childLocalState";

/** The per-child namespace. `arbor.firstsKeepsakes.<childId>`. */
export const FIRSTS_KEEPSAKE_NAMESPACE = "firstsKeepsakes";

/** The store key for one child — always through the sweepable convention. */
export const firstsKeepsakeKey = (childId: string): string =>
  childScopedKey(FIRSTS_KEEPSAKE_NAMESPACE, childId);

/**
 * The share caption for a keepsake. MANDATORY at the mount: a `growth_card`
 * with no captionKey resolves to "{name}'s progress this month", which on ONE
 * first, on the day it happened, is a claim nobody made. This key is the
 * honest one — "A first for {name}, kept." (i18nElevation/waveE.ts).
 */
export const FIRSTS_KEEPSAKE_CAPTION_KEY = "elev.share.caption.firsts";

/** The share surface id for this keepsake. */
export const FIRSTS_KEEPSAKE_SURFACE = "firsts_keepsake";

/** A note is a sentence or two, not an essay. */
export const KEEPSAKE_NOTE_MAX = 400;

export interface FirstKeepsake {
  /** The milestone this keepsake belongs to. */
  milestoneId: string;
  /** The parent's own words. Required — this IS the keepsake. */
  note: string;
  /** The day the parent saw it, as a local YYYY-MM-DD. Required. */
  noticedOn: string;
  /** Optional. Always a lib/storage.uploadChildPhoto URL under this child's
   *  own Storage prefix, so both erase paths already sweep it. */
  photoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type KeepsakeMap = Record<string, FirstKeepsake>;

export interface KeepsakeDraft {
  milestoneId: string;
  note: string;
  noticedOn: string;
  photoUrl?: string;
}

export type KeepsakeError = "note" | "date" | "future";

/** Copy for each refusal, so the component never invents a sentence. */
export const KEEPSAKE_ERROR_KEYS: Record<KeepsakeError, string> = {
  note: "elev.waveR.keepsake.needNote",
  date: "elev.waveR.keepsake.needDate",
  future: "elev.waveR.keepsake.futureDate",
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Local calendar day as YYYY-MM-DD. Local, never toISOString: a parent in
 *  Israel logging at 23:00 must not have the keepsake dated tomorrow. */
export function localDayKey(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * What is wrong with this draft, or null when it is keepable.
 * The photo is never validated here — a keepsake without one is complete.
 */
export function validateKeepsake(draft: KeepsakeDraft, today: string): KeepsakeError | null {
  if (!draft.note || !draft.note.trim()) return "note";
  if (!draft.noticedOn || !DATE_RE.test(draft.noticedOn)) return "date";
  if (Number.isNaN(Date.parse(draft.noticedOn))) return "date";
  if (draft.noticedOn > today) return "future";
  return null;
}

const isKeepsake = (value: unknown): value is FirstKeepsake => {
  if (!value || typeof value !== "object") return false;
  const k = value as Record<string, unknown>;
  return typeof k.milestoneId === "string" && k.milestoneId.length > 0
    && typeof k.note === "string" && k.note.trim().length > 0
    && typeof k.noticedOn === "string" && DATE_RE.test(k.noticedOn);
};

/** Parse a stored payload defensively — a corrupt store yields no keepsakes. */
export function parseKeepsakes(raw: string | null | undefined): KeepsakeMap {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: KeepsakeMap = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (isKeepsake(value) && value.milestoneId === id) out[id] = value;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Pure upsert. `createdAt` is preserved on an edit — the day the parent first
 * kept this first does not move because they fixed a typo. Input untouched.
 */
export function upsertKeepsake(map: KeepsakeMap, draft: KeepsakeDraft, now: string): KeepsakeMap {
  const existing = map[draft.milestoneId];
  const photoUrl = draft.photoUrl?.trim();
  return {
    ...map,
    [draft.milestoneId]: {
      milestoneId: draft.milestoneId,
      note: draft.note.trim().slice(0, KEEPSAKE_NOTE_MAX),
      noticedOn: draft.noticedOn,
      ...(photoUrl ? { photoUrl } : {}),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    },
  };
}

/** Pure removal. Input untouched. */
export function removeKeepsake(map: KeepsakeMap, milestoneId: string): KeepsakeMap {
  if (!(milestoneId in map)) return map;
  const next = { ...map };
  delete next[milestoneId];
  return next;
}

/**
 * How many firsts the PARENT has written a note against.
 *
 * A count of the parent's own keeping — never a checklist score, and never
 * derived from the child's age band, so it CANNOT fall when a child ages into
 * a new band (the band-window counts elsewhere on the Growth hub can; this one
 * has no band input at all, by construction).
 */
export function keepsakeCount(map: KeepsakeMap): number {
  return Object.keys(map).length;
}

const store = (given?: Storage | null): Storage | null => {
  if (given !== undefined) return given;
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

/** Read one child's keepsakes. Never throws. */
export function readKeepsakes(childId: string, given?: Storage | null): KeepsakeMap {
  const s = store(given);
  if (!s || !childId) return {};
  try {
    return parseKeepsakes(s.getItem(firstsKeepsakeKey(childId)));
  } catch {
    return {};
  }
}

/** Persist one child's keepsakes. Never throws. */
export function writeKeepsakes(childId: string, map: KeepsakeMap, given?: Storage | null): void {
  const s = store(given);
  if (!s || !childId) return;
  try {
    s.setItem(firstsKeepsakeKey(childId), JSON.stringify(map));
  } catch {
    /* quota / private window — the note stays on screen, nothing is lost silently */
  }
}
