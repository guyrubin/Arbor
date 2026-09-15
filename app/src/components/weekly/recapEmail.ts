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
import { trackDigestEmailOptIn, trackDigestEmailSend } from "../../lib/kpiEvents";

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

/** The result vocabulary of POST /api/digest/email-send. Mirrors
 *  DIGEST_SEND_RESULTS in lib/kpiEvents.ts and the four fail-closed axes in
 *  server/digestOptIn.ts. */
export type DigestSendOutcome = { sent: boolean; reason?: string };

/**
 * N1-07: trigger this account's own weekly digest send. ADMIN-ONLY server-side
 * (403 for everyone else) — there is no scheduler in this wave, so the lead
 * triggers the first real sends by hand from a signed-in session. The result is
 * reported through the ONE analytics seam so the fail-closed proof is readable
 * in `cohort-report.mjs --events`: with the env unset every trigger must record
 * `digest_email_send { result: "provider_disabled" }` and zero `"sent"`.
 */
export async function requestDigestEmailSend(payload: {
  childProfile?: unknown;
  logs?: unknown[];
  milestones?: unknown[];
}): Promise<DigestSendOutcome> {
  try {
    const res = await fetch("/api/digest/email-send", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify(payload ?? {}),
    });
    // 403 is "you are not the lead", not a send outcome — it never enters the
    // census, because a refusal vocabulary polluted with authorisation noise
    // stops being a fail-closed proof.
    if (res.status === 403) return { sent: false, reason: "forbidden" };
    const data = (await res.json()) as DigestSendOutcome;
    trackDigestEmailSend(data.sent === true ? "sent" : String(data.reason || "send_failed"));
    return { sent: data.sent === true, reason: data.reason };
  } catch {
    trackDigestEmailSend("send_failed");
    return { sent: false, reason: "send_failed" };
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

/**
 * The hand trigger. There is no UI for a send in this wave (and there must not
 * be one: the route is admin-only), so the lead's trigger is this handle on the
 * weekly surface, which this module already backs:
 *
 *   await window.__arborDigestSend({ logs: [], milestones: [] })
 *
 * Exposed unconditionally because the SERVER decides who may send — a non-admin
 * caller gets a 403 and no event. Guarded so a non-browser import (tests, SSR)
 * is a no-op.
 */
try {
  if (typeof window !== "undefined") {
    (window as unknown as Record<string, unknown>).__arborDigestSend = requestDigestEmailSend;
  }
} catch {
  /* non-browser context */
}
