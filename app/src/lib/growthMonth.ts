/** Legacy month-review storage-key compatibility. The count-based month
 * object and its surface retired in B-ASKJB-37. Keep this exact key shape for
 * the child-local-state sweep guard; no writer, deletion or migration runs. */
export function monthReviewSeenKey(childId: string, monthKey: string): string {
  return `arbor.growth.month.seen.${monthKey}.${childId}`;
}
