/**
 * B-PROV-12 — the voice provider notice is bound to the RUNTIME route.
 *
 * The B-VOICE-06 notice ("No recording is kept … in a Live conversation,
 * Google's model hears them directly … Live runs on Google's global
 * endpoint") named one provider in fixed copy, whatever route the server
 * actually selected. This module is the processor inventory: each realtime
 * route the provider policy can select (ai/liveResidency.ts) maps to exactly
 * one APPROVED notice id, and each notice id has reviewed EN/HE copy on the
 * client (lib/voiceProviderNotice.ts; a guard test keeps the two in step).
 *
 *  - `/live/availability` names the notice of the route a tap would take.
 *  - `/live/token` refuses (428 `voice_notice_required`, nothing reserved or
 *    minted) unless the request acknowledges THAT notice id, so a change of
 *    provider, region or purpose can never ride an earlier acknowledgement.
 *  - A selected route with no approved notice is not offered at all (503
 *    `voice_provider_unapproved`): no silent move to an unreviewed processor.
 *
 * Each Live notice also describes the device speech fallback the client
 * takes when Live fails, so that fallback is covered by the same notice.
 * Bump the version suffix whenever the processor, region, purpose, retention
 * or the approved copy changes: every parent then acknowledges again.
 */
import { LIVE_GLOBAL_PROVIDER, LIVE_VERTEX_EU_PROVIDER, type LiveDecision } from "./liveResidency.js";

/** runtime provider id → region → approved notice id. */
export const VOICE_NOTICE_INVENTORY: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.freeze({
  [LIVE_GLOBAL_PROVIDER]: Object.freeze({ global: "google-global-realtime-v1" }),
  [LIVE_VERTEX_EU_PROVIDER]: Object.freeze({ eu: "google-eu-realtime-v1" }),
});

export const VOICE_NOTICE_REQUIRED = "voice_notice_required";
export const VOICE_PROVIDER_UNAPPROVED = "voice_provider_unapproved";

/** The approved notice for a selected route, or null when none is approved. */
export const voiceNoticeIdFor = (ref: { provider: string; region?: string }): string | null =>
  (ref.region ? VOICE_NOTICE_INVENTORY[ref.provider]?.[ref.region] : undefined) ?? null;

/** The notice of the route a Live tap would take now (null: Live is off or unapproved). */
export const liveVoiceNoticeId = (live: LiveDecision): string | null =>
  live.available && live.decision ? voiceNoticeIdFor(live.decision.selected.ref) : null;
