/**
 * emailProvider — W2 2.2: the weekly-digest email delivery seam. FAIL-CLOSED.
 *
 * A Resend adapter IS implemented (zero-dependency: one HTTPS POST). The
 * channel nonetheless stays OFF until it is explicitly configured, so nothing
 * can ship to a parent by accident. To turn it on, set BOTH:
 *   EMAIL_PROVIDER=resend
 *   RESEND_API_KEY=<key>   EMAIL_FROM=<verified sender, e.g. Arbor <hello@…>>
 * That is the entire remaining step — no code change is required.
 *
 * Fail-closed on three axes: an unset EMAIL_PROVIDER, a name with no
 * implementation (typo-proof), and a named provider whose own credentials are
 * missing all resolve to { enabled: false }. Nothing ever fakes a send, and a
 * message body is never logged (it summarizes a real child's week).
 *
 * Adding another provider (Postmark/SES/…): write a factory, register it in
 * PROVIDERS, set the env. Nothing else in the app changes.
 *
 * Content rule: whatever is sent must pass the same clinical firewall as the
 * in-app digest — counts only, no trend deltas (buildDigestEmail in digest.ts
 * is the only sanctioned body renderer).
 */

export type DigestEmailMessage = {
  to: string;
  subject: string;
  preheader: string;
  bodyText: string;
};

export type DigestEmailSender = (msg: DigestEmailMessage) => Promise<{ sent: true; id?: string }>;

/**
 * A provider factory returns a sender ONLY when its own credentials are fully
 * present. Missing/partial credentials return null, which keeps the channel
 * disabled — the fail-closed rule applies to configuration, not just to the
 * provider name: EMAIL_PROVIDER=resend with no key must never half-enable.
 */
type DigestEmailProviderFactory = (env: Record<string, string | undefined>) => DigestEmailSender | null;

const trimmed = (v: string | undefined): string => (v ?? "").trim();

/**
 * Resend (https://resend.com) — chosen because it needs no SDK: one HTTPS POST
 * with a bearer token, so the zero-dependency rule holds. Requires
 * RESEND_API_KEY and EMAIL_FROM (a verified sender on the account).
 *
 * The message body is NEVER logged: a failure reports status + the provider's
 * error id only, because the body is a summary of a real child's week.
 */
const resendProvider: DigestEmailProviderFactory = (env) => {
  const apiKey = trimmed(env.RESEND_API_KEY);
  const from = trimmed(env.EMAIL_FROM);
  if (!apiKey || !from) return null;
  return async (msg) => {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [msg.to],
        subject: msg.subject,
        text: msg.bodyText,
        headers: { "X-Entity-Ref-ID": "arbor-weekly-digest" },
      }),
    });
    if (!res.ok) {
      // Surface the status, never the payload.
      throw new Error(`resend send failed: HTTP ${res.status}`);
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { sent: true, id: data.id };
  };
};

/**
 * Registry of real, implemented providers. Adding a provider is: write a
 * factory above, register it here, then set EMAIL_PROVIDER=<name> plus that
 * provider's credentials. Nothing else in the app changes.
 */
const PROVIDERS: Record<string, DigestEmailProviderFactory> = {
  resend: resendProvider,
};

export type EmailProviderResolution =
  | { enabled: true; provider: string; send: DigestEmailSender }
  | { enabled: false; provider: null; send: null };

/**
 * Resolve the configured provider from the environment. Enabled ONLY when
 * EMAIL_PROVIDER names a provider that is actually implemented above.
 */
export function resolveEmailProvider(
  env: Record<string, string | undefined> = process.env
): EmailProviderResolution {
  const name = trimmed(env.EMAIL_PROVIDER).toLowerCase();
  const factory = name ? PROVIDERS[name] : undefined;
  if (!name || !factory) return { enabled: false, provider: null, send: null };
  // Credentials are part of "configured": a named provider whose own env is
  // missing stays disabled rather than throwing at send time.
  const send = factory(env);
  if (!send) return { enabled: false, provider: null, send: null };
  return { enabled: true, provider: name, send };
}

export type SendDigestEmailResult =
  | { sent: true; id?: string }
  | { sent: false; reason: "not_configured" };

/**
 * Send a weekly digest email through the configured provider. Fail-closed:
 * with no (implemented) provider this returns { sent: false } — it never
 * pretends the message left the building.
 */
export async function sendWeeklyDigestEmail(
  msg: DigestEmailMessage,
  env: Record<string, string | undefined> = process.env
): Promise<SendDigestEmailResult> {
  const resolution = resolveEmailProvider(env);
  if (!resolution.enabled) return { sent: false, reason: "not_configured" };
  return resolution.send(msg);
}
