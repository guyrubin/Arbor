/** History limits count source rows, never a child's ability or progress. */
export function historyWindow<T>(rows: readonly T[], size: number): { rows: T[]; more: boolean } {
  return { rows: rows.slice(0, size), more: rows.length > size };
}

export function nextHistoryWindow(size: number): number { return size + 200; }
