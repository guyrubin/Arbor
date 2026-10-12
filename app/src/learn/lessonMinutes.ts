/**
 * v3 F-FORYOU-1 (reviewer r1) — the minutes beside each lesson in today's
 * pick on For you, the parent.
 *
 * A course carries ONE authored duration (durationMin), not one per lesson.
 * The course's own minutes are shared out across its lessons in proportion to
 * each lesson's length, counted on its English body so both languages show
 * the same figures: whole minutes, at least one each, adding up to the
 * course's duration exactly (largest remainder, ties to the earlier lesson).
 *
 * A reading-time fact about the course. Nothing here reads the child, the
 * parent or what has been read: no state, no "done", no progress.
 */
export function lessonMinutes(totalMin: number, lessonBodies: readonly string[]): number[] {
  const n = lessonBodies.length;
  if (n === 0) return [];
  const total = Math.max(Math.round(totalMin), n);
  const words = lessonBodies.map((b) => Math.max(1, b.trim().split(/\s+/).filter(Boolean).length));
  const sum = words.reduce((a, w) => a + w, 0);
  // Every lesson gets one minute; the rest is shared out by length.
  const spare = total - n;
  const exact = words.map((w) => (w / sum) * spare);
  const out = exact.map((x) => Math.floor(x));
  let left = spare - out.reduce((a, m) => a + m, 0);
  const order = exact
    .map((x, i) => ({ i, rest: x - Math.floor(x) }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    out[i] += 1;
    left -= 1;
  }
  return out.map((m) => m + 1);
}
