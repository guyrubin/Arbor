/* recapEmail — W2 2.2 client side of the weekly-email seam (fail-closed).
 *
 * The opt-in is REAL and stored per account under ONE localStorage key
 * (`arbor.recap.emailOptIn`, a {accountId: true} map); the delivery channel
 * ships only when a server-side provider is configured (Guy decision — no
 * fake sends, honest "coming soon" copy meanwhile). The enabled/disabled
 * state comes from GET /api/digest/email-status, which reflects
 * server/emailProvider.ts — the client NEVER assumes the channel exists. */
import { authHeaders } from "../../lib/api";

export const EMAIL_OPTIN_KEY = "arbor.recap.emailOptIn";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const defaultStorage = (): StorageLike | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

function readMap(storage: StorageLike): Record<string, boolean> {
  try {
    const raw = storage.getItem(EMAIL_OPTIN_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, boolean>)
      : {};
  } catch {
    return {};
  }
}

/** Whether this account opted into the weekly recap email. */
export function readEmailOptIn(accountId: string, storage: StorageLike | null = defaultStorage()): boolean {
  if (!storage) return false;
  return readMap(storage)[accountId] === true;
}

/** Persist the account's opt-in choice (per-account entry, single key). */
export function writeEmailOptIn(accountId: string, on: boolean, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try {
    const map = readMap(storage);
    if (on) map[accountId] = true;
    else delete map[accountId];
    storage.setItem(EMAIL_OPTIN_KEY, JSON.stringify(map));
  } catch {
    /* best-effort */
  }
}

export type DigestEmailStatus = { enabled: boolean; provider: string | null };

/** Fail-closed status probe: any error reads as "channel not available". */
export async function fetchDigestEmailStatus(): Promise<DigestEmailStatus> {
  try {
    const res = await fetch("/api/digest/email-status", { headers: await authHeaders() });
    if (!res.ok) return { enabled: false, provider: null };
    const data = (await res.json()) as Partial<DigestEmailStatus>;
    return { enabled: data.enabled === true, provider: data.provider ?? null };
  } catch {
    return { enabled: false, provider: null };
  }
}
