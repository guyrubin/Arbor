/* B-CAREPRO-27 — Consult's teacher branch hands its note to the School Brief.
 *
 * Coach's "note for the teacher" lands in Consult (audience: teacher) through
 * the prefill seam. A teacher's one document is the School Brief, so the
 * teacher branch carries that note across the route change: one in-memory,
 * one-shot value — never stored, never sent. The brief editor takes it on
 * open and places it in the draft the parent then reviews line by line; the
 * export scan and the per-export approval stay the gate. */

let pending: string | null = null;

/** Hand a note to the next School Brief that opens (blank clears it). */
export function handTeacherNote(note: string): void {
  const trimmed = note.trim();
  pending = trimmed ? trimmed : null;
}

/** Take the handed note once; a second read returns null. */
export function takeTeacherNote(): string | null {
  const note = pending;
  pending = null;
  return note;
}
