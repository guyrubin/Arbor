/**
 * AI-V5 (voice-cadence, 2026-07-25): short-TTL screened-sentence tokens for
 * /api/tts.
 *
 * /voice screens every sentence (cumulative alias-restored text) before it is
 * emitted, then mints one of these tokens per screened sentence. /api/tts
 * accepts the token as proof of provenance and skips ONLY the model re-screen
 * (screenModelOutputSemantic) — the synchronous lexical floor still runs
 * UNCONDITIONALLY on every /api/tts call (firewall condition 3: belt for HMAC
 * bugs). Anything with an absent / invalid / expired token, or text altered by
 * even one character, gets the FULL screen — fail closed, only slower.
 *
 * Token shape: `${expiryEpochMs}.${hmacHex}` where
 *   hmac = HMAC-SHA256(secret, sha256(exact text) | lang | expiry)
 * Verification is constant-time (crypto.timingSafeEqual).
 *
 * The secret is PROCESS-LOCAL random bytes: tokens never need to survive a
 * restart (TTL is minutes), and in a multi-instance deployment a token minted
 * by another instance simply fails verification and falls back to the full
 * screen — a latency cost, never a safety cost.
 */
import crypto from "node:crypto";

const SECRET = crypto.randomBytes(32);

/** Long enough to cover playback of a long multi-sentence answer, short enough
 *  to be useless as a durable capability. */
export const TTS_TOKEN_TTL_MS = 5 * 60 * 1000;

const signature = (text: string, lang: string, expiresAt: number): string =>
  crypto
    .createHmac("sha256", SECRET)
    .update(crypto.createHash("sha256").update(text, "utf8").digest())
    .update(`|${lang}|${expiresAt}`)
    .digest("hex");

/** Mint a token proving `text` (exact bytes) passed the /voice output screen. */
export function mintTtsToken(text: string, lang: string, now: number = Date.now()): string {
  const expiresAt = now + TTS_TOKEN_TTL_MS;
  return `${expiresAt}.${signature(text, lang, expiresAt)}`;
}

/** Constant-time verification. False on ANY defect (shape, expiry, text or
 *  lang mismatch) — the caller must then run the full screen. */
export function verifyTtsToken(token: unknown, text: string, lang: string, now: number = Date.now()): boolean {
  if (typeof token !== "string" || !token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const expiresAt = Number(token.slice(0, dot));
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return false;
  const given = Buffer.from(token.slice(dot + 1), "utf8");
  const expected = Buffer.from(signature(text, lang, expiresAt), "utf8");
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}
