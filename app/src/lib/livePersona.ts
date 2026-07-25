/**
 * AI-V9 (2026-07-25 AI-excellence): the ONE spoken-coach persona, shared by
 * /voice (routes/api.ts) and the Gemini Live instruction so the two spoken
 * paths can never drift. FW-NEW-P0 / AI-V9 firewall condition 2: the server
 * pins the Live systemInstruction (plus transcription-on and the per-language
 * speechConfig) into the ephemeral token's liveConnectConstraints at mint time
 * (routes/api.ts /live/token), so a modified client CANNOT open a Live session
 * with an arbitrary persona, a different voice, or transcription disabled —
 * the client receives the pinned instruction back in the token response and
 * passes it verbatim, which is cosmetic-by-construction: the token, not the
 * client, is authoritative.
 *
 * NOTE (firewall AI-V9 condition 1): this prompt-level contract is NOT a
 * screening substitute. The fail-closed screens are the liveTurnGuard
 * (lexical + POST /api/live/turn server verdict) — never this text.
 */
import { NON_DIAGNOSTIC_CONTRACT } from "../contracts/coach.js";

export type SpokenLanguage = "en" | "he";

/** The one spoken-coach persona line (also the /voice prompt's opening). */
export const SPOKEN_COACH_PERSONA =
  "You are Arbor, a warm, calm parenting coach speaking OUT LOUD to a parent.";

/** aiLang-driven spoken-language directive — byte-shared with /voice. */
export const HE_SPOKEN_DIRECTIVE = " Reply in warm, natural spoken Hebrew.";

export const spokenLanguageDirective = (language: unknown): string =>
  language === "he" ? HE_SPOKEN_DIRECTIVE : "";

/** Normalize an untrusted request `language` field to a spoken language. */
export const toSpokenLanguage = (language: unknown): SpokenLanguage =>
  language === "he" ? "he" : "en";

/**
 * The full Live systemInstruction: non-diagnostic contract + spoken persona +
 * spoken-reply format + the aiLang-driven language directive.
 */
export const buildLiveSystemInstruction = (language: unknown): string =>
  `${NON_DIAGNOSTIC_CONTRACT}
${SPOKEN_COACH_PERSONA} Keep spoken replies short (2 to 4 sentences), kind, and practical: briefly acknowledge, then give one concrete thing to try, in plain everyday language. No markdown, no headings, no bullet points, no emojis. Observations only — never a diagnosis. If there's a safety concern, gently suggest professional help.${spokenLanguageDirective(language)}`;

/** The default (EN) instruction — kept as a named constant for the token-pin tests. */
export const LIVE_SYSTEM_INSTRUCTION = buildLiveSystemInstruction("en");

/**
 * Per-language Live speechConfig (AI-V9): a voice + languageCode appropriate
 * for the session language, pinned into the token constraints at mint time so
 * a Hebrew-mode parent's "HD" session speaks Hebrew, not English.
 */
export const liveSpeechConfig = (language: unknown) => ({
  languageCode: toSpokenLanguage(language) === "he" ? "he-IL" : "en-US",
  voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
});
