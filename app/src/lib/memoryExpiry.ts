/* ════════════════════════════════════════════════════════════════════════════
   memoryExpiry — GP-13: when a time-boxed memory actually forgets itself.

   The server has enforced retention on read since N7 (memory/memoryService
   retentionToMs / isMemoryExpired / enforceMemoryRetention), but the parent
   surface only ever showed the RAW retention string in a pink chip — pink
   being the app's delete tone. The safest property the ledger has (it forgets
   on its own) was rendered as danger, and the parent was never told the date.

   This is the client-side twin of the server parser: same grammar, same
   default, no import across the server boundary (memoryService pulls in
   node:crypto). The two are pinned to each other by memoryExpiry.test.ts.

   Retention grammar accepted (mirrors memory/memoryService.parseRetentionMs):
     · permanent / indefinite / ongoing / long-term → never forgets (Infinity)
     · "<n> day|week|month|year(s)"      → that many
     · "session" / "today" / "24h"       → one day
   Anything unparseable falls back to the same default the server uses.
   ════════════════════════════════════════════════════════════════════════════ */

const DAY_MS = 86_400_000;

/** The server's DEFAULT_MEMORY_RETENTION, verbatim. Kept as a literal on
 *  purpose: memory/memoryService is not importable from the browser bundle.
 *  memoryExpiry.test.ts pins this to the server's value — a fact must never be
 *  shown a date longer than the one the server will actually honour. */
export const DEFAULT_MEMORY_RETENTION = "3 months";

function parseRetentionMs(retention: string): number | null {
  const r = retention.trim().toLowerCase();
  if (!r) return null;
  if (/permanent|indefinite|ongoing|long[-\s]?term/.test(r)) return Infinity;
  const m = r.match(/(\d+)\s*(day|week|month|year)/);
  if (m) {
    const n = Number(m[1]);
    const unit = m[2];
    const per = unit === "day" ? DAY_MS : unit === "week" ? 7 * DAY_MS : unit === "month" ? 30 * DAY_MS : 365 * DAY_MS;
    return n * per;
  }
  if (/session|today|24\s*h/.test(r)) return DAY_MS;
  return null;
}

const DEFAULT_RETENTION_MS = parseRetentionMs(DEFAULT_MEMORY_RETENTION) as number;

export function retentionToMs(retention?: string): number {
  if (!retention) return DEFAULT_RETENTION_MS;
  return parseRetentionMs(retention) ?? DEFAULT_RETENTION_MS;
}

/** True when this retention never expires — the chip says "kept until you
 *  forget it", not a date, and no countdown is implied. */
export function isPermanentRetention(retention?: string): boolean {
  return !Number.isFinite(retentionToMs(retention));
}

/**
 * The ISO day this item forgets itself, or null when it never does (or when
 * `createdAt` is unusable — an undated row must never be given an invented
 * expiry).
 */
export function forgetsOnIso(item: { retention?: string; createdAt?: string }): string | null {
  if (!item.createdAt) return null;
  const created = new Date(item.createdAt).getTime();
  if (!Number.isFinite(created)) return null;
  const ms = retentionToMs(item.retention);
  if (!Number.isFinite(ms)) return null;
  return new Date(created + ms).toISOString();
}

/** The three retention choices the parent can pick between (GP-13). The values
 *  are the strings the ledger stores and the server's parser understands. */
export const RETENTION_CHOICES = [
  { value: "3 months", labelKey: "elev.waveR.mem.retention.3months" },
  { value: "1 year", labelKey: "elev.waveR.mem.retention.1year" },
  { value: "permanent", labelKey: "elev.waveR.mem.retention.permanent" },
] as const;

/** Snap an arbitrary stored retention onto the closest offered choice, so the
 *  select never opens showing a value it cannot represent. */
export function nearestRetentionChoice(retention?: string): string {
  if (isPermanentRetention(retention)) return "permanent";
  const ms = retentionToMs(retention);
  const threeMonths = 90 * DAY_MS;
  return ms <= threeMonths ? "3 months" : "1 year";
}
