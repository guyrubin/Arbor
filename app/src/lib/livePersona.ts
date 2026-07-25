/**
 * FW-NEW-P0 (VC-7 acceptance): the ONE Gemini Live persona, shared by the
 * server token mint and the browser client so they can never drift.
 *
 * The server pins this systemInstruction (plus transcription-on) into the
 * ephemeral token's liveConnectConstraints at mint time (routes/api.ts
 * /live/token), so a modified client CANNOT open a Live session with an
 * arbitrary persona or with transcription disabled — the API rejects any
 * connect config that conflicts with the token's pinned constraints. The
 * client (CoachTab → geminiLiveClient) passes the same constant, which is
 * cosmetic-by-construction: the token, not the client, is authoritative.
 */
export const LIVE_SYSTEM_INSTRUCTION =
  "You are Arbor, a warm, calm, non-diagnostic parenting coach. Keep spoken replies short, kind, and practical. Never diagnose; suggest professional help for safety concerns.";
