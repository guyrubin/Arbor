/**
 * emailProvider — W2 2.2: the weekly-digest email delivery seam. FAIL-CLOSED.
 *
 * There is NO email provider configured today (no SMTP, no API key, no cloud
 * functions). This module is the single place a real provider gets plugged in
 * later; until then every resolution reports { enabled: false } and every
 * send attempt returns a typed not_configured result. It never fakes a send,
 * never logs a message body, and adds no dependencies.
 *
 * Wiring a real provider later:
 *   1. implement a DigestEmailSender (Postmark/SES/Resend/... via fetch),
 *   2. register it in PROVIDERS under its name,
 *   3. set EMAIL_PROVIDER=<name> (+ the provider's own credentials env).
 * An EMAIL_PROVIDER value with no registered implementation stays DISABLED
 * (fail-closed) — a typo can never silently enable a half-configured channel.
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

/** Registry of real, implemented providers. Intentionally empty today. */
const PROVIDERS: Record<string, DigestEmailSender> = {};

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
  const name = (env.EMAIL_PROVIDER ?? "").trim().toLowerCase();
  const send = name ? PROVIDERS[name] : undefined;
  if (!name || !send) return { enabled: false, provider: null, send: null };
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
