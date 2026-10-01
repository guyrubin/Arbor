/* i18nElevation/keptinsight — B-AI-04, a kept insight becomes a thread row.
 *
 * "Keep this" on a #/behaviors suggestion writes an `insights` row of kind
 * `kept-insight` (TJB-04). Until B-AI-04 nothing read it. The thread row says
 * who acted — the PARENT kept the line — and renders the line verbatim as its
 * detail. No claim about the child, no AI framing, no verdict.
 *
 * Hebrew = calm Israeli-parent register; flagged for native review.
 */
export const en: Record<string, string> = {
  "elev.kept.thread.title": "You kept",
  "elev.kept.thread.kind": "Kept",
  "elev.kept.thread.filter": "Kept",
};

export const he: Record<string, string> = {
  "elev.kept.thread.title": "שמרתם",
  "elev.kept.thread.kind": "נשמר",
  "elev.kept.thread.filter": "נשמרו",
};
