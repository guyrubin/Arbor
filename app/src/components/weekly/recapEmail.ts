/* recapEmail — W2 2.2 client side of the weekly-email seam (fail-closed).
 *
 * The opt-in is REAL and stored per account under ONE localStorage key
 * (`arbor.recap.emailOptIn`, a {accountId: true} map); the delivery channel
 * ships only when a server-side provider is configured (Guy decision — no
 * fake sends, honest "coming soon" copy meanwhile). The enabled/disabled
 * state comes from GET /api/digest/email-status, which reflects
 * server/emailProvider.ts — the client NEVER assumes the channel exists.
 *
 * N1-07: the opt-in is now MIRRORED to a server row (`digestOptIn/{uid}`), and
 * the local key stays the render source so the toggle is still instant. Before
 * this the list existed only in this browser, which is why the send lane had
 * nobody to send to. The mirror carries no address — the server takes it from
 * the authenticated, verified identity. */
import { authHeaders } from "../../lib/api";
import { trackDigestEmailOptIn } from "../../lib/kpiEvents";

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

/** Persist the account's opt-in choice (per-account entry, single key).
 *
 *  N1-07: the local key stays the RENDER source — the toggle must flip
 *  instantly and offline — and the server row is mirrored best-effort behind
 *  it. The mirror never blocks, never throws and never reverses the local
 *  state: the server row governs DELIVERY, the local key governs the toggle,
 *  and the send lane is fail-closed anyway, so a lost mirror can only mean a
 *  mail that is not sent. The reverse direction (server → client) is
 *  deliberately absent; this module's existing contract is local-authoritative. */
export function writeEmailOptIn(
  accountId: string,
  on: boolean,
  storage: StorageLike | null = defaultStorage(),
  mirror: (on: boolean) => void = mirrorEmailOptIn,
): void {
  if (storage) {
    try {
      const map = readMap(storage);
      if (on) map[accountId] = true;
      else delete map[accountId];
      storage.setItem(EMAIL_OPTIN_KEY, JSON.stringify(map));
    } catch {
      /* best-effort */
    }
  }
  mirror(on);
}

/** The server half of the toggle: POST creates the row from the parent's own
 *  VERIFIED address (the server reads it from the authenticated identity — this
 *  request carries no address), DELETE removes it. Fire-and-forget; the KPI
 *  event is emitted either way because the opt-in INTENT is the measurement. */
export function mirrorEmailOptIn(on: boolean): void {
  trackDigestEmailOptIn(on);
  void (async () => {
    try {
      await fetch("/api/digest/email-optin", {
        method: on ? "POST" : "DELETE",
        headers: await authHeaders(),
        body: on ? JSON.stringify({ language: digestLanguage() }) : undefined,
      });
    } catch {
      /* best-effort: the local toggle already rendered */
    }
  })();
}

/** Which localisation the parent reads the app in, for the mail body. */
function digestLanguage(): "en" | "he" {
  try {
    return document.documentElement.lang === "he" ? "he" : "en";
  } catch {
    return "en";
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

/* B-INF-02: the hand trigger (`window.__arborDigestSend` → POST
 * /api/digest/email-send) is gone. The weekly send is the scheduled job
 * (POST /api/jobs/weekly-digest, server/digestJob.ts, infra/scheduler.yaml),
 * and the admin route stays callable for a one-off server-side test. */
