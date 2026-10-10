/** History limits count source rows, never a child's ability or progress. */
export function historyWindow<T>(rows: readonly T[], size: number): { rows: T[]; more: boolean } {
  return { rows: rows.slice(0, size), more: rows.length > size };
}

export function nextHistoryWindow(size: number): number { return size + 200; }

/** Compare a live sandbox context with disk without changing either. Object
 * key order and collection order are irrelevant; record content is not. */
export function sameLocalHistoryRows(rows: readonly unknown[], raw: string): boolean {
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, normalize(child)]));
    return value;
  };
  const serialize = (values: readonly unknown[]) => values.map(value => JSON.stringify(normalize(value))).sort();
  try {
    const stored: unknown = JSON.parse(raw);
    return Array.isArray(stored) && JSON.stringify(serialize(rows)) === JSON.stringify(serialize(stored));
  } catch { return false; }
}
