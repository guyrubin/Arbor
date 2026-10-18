/**
 * CARE-7 — per-audience consult-export history.
 *
 * Stores ONLY export metadata (audience → ISO timestamp of the last export)
 * per child, on the parent's own device (localStorage). This is not child
 * capture data and adds no capture path: its single consumer is the computed
 * "Since the last export" delta section in `consult/packet.ts`, which runs
 * through the same fail-closed ceiling guards as every other packet section.
 *
 * Fail quiet by design: storage being unavailable (SSR, node tests, private
 * browsing) or corrupt means "no prior export" — the delta section simply
 * does not render, and an export is never blocked on bookkeeping.
 */

type ExportHistory = Partial<Record<string, string>>;

const storageKey = (childId: string) => `arbor.consultExports.${childId}`;

const getStore = (): Storage | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

const readHistory = (store: Storage, childId: string): ExportHistory => {
  try {
    const raw = store.getItem(storageKey(childId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as ExportHistory) : {};
  } catch {
    return {};
  }
};

/** ISO timestamp of the last export to this audience, or null when none
 *  exists (first export → no delta section). */
export function getLastExportedAt(childId: string, audience: string): string | null {
  const store = getStore();
  if (!store || !childId) return null;
  const v = readHistory(store, childId)[audience];
  return typeof v === "string" && Number.isFinite(new Date(v).getTime()) ? v : null;
}

/** v4 (Care › Past exports): every recorded export on this device for this
 *  child, newest first — the audience (or a report slot such as
 *  "reports-weekly") and when. Metadata only; the documents themselves are
 *  never stored, so a row can re-open the builder but never the old text.
 *  Unparseable timestamps are dropped. */
export function listExports(childId: string): { audience: string; at: string }[] {
  const store = getStore();
  if (!store || !childId) return [];
  return Object.entries(readHistory(store, childId))
    .filter((entry): entry is [string, string] => typeof entry[1] === "string" && Number.isFinite(new Date(entry[1]).getTime()))
    .map(([audience, at]) => ({ audience, at }))
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/** Record a successful export to this audience. Never throws. */
export function recordExport(childId: string, audience: string, when: string = new Date().toISOString()): void {
  const store = getStore();
  if (!store || !childId) return;
  try {
    store.setItem(storageKey(childId), JSON.stringify({ ...readHistory(store, childId), [audience]: when }));
  } catch {
    /* metadata only — never block an export on storage failure */
    return;
  }
  // v4: Care's Past exports card re-reads the history when one is recorded.
  try {
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") window.dispatchEvent(new CustomEvent(CONSULT_EXPORTS_EVENT, { detail: { childId } }));
  } catch {
    /* no listener is ever load-bearing */
  }
}

/** v4: fired on window after an export is recorded (detail: { childId }). */
export const CONSULT_EXPORTS_EVENT = "arbor:consult-export-recorded";
