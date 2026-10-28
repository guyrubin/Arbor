/**
 * B-PROV-12 — the client half of the runtime voice provider notice.
 *
 * The server names the notice of the route a Talk tap would take
 * (ai/voiceProviderNotice.ts → `/live/availability` `notice`). This module
 * holds the APPROVED copy for each notice id (the B-VOICE-06 line and its
 * residency clause, EN/HE) and the per-device acknowledgement. A notice id
 * with no approved copy here is treated as unapproved: Live is not started,
 * and the device speech notice applies to the browser voice loop.
 *
 * Acknowledgement is one tap on the voice button while the notice shows,
 * remembered per device and PER NOTICE ID: a new provider, region or purpose
 * arrives with a new id and is shown again. A storage failure reads as "not
 * acknowledged" — a notice shown twice is the safe failure.
 */

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** The device-only route (no Live): the browser's speech service turns words
 *  into text and only the text reaches Arbor, exactly like typing. */
export const DEVICE_VOICE_NOTICE_ID = "device-speech-v1";

/** notice id → its approved copy (keys in i18nElevation/wave2Daily + coachcontract):
 *  the full B-VOICE-06 line (capture bar, first use) and the one-line form the
 *  voice button shows under the composer. Both say the same three things:
 *  who hears the words, where, and that no recording is kept. */
export const VOICE_NOTICE_COPY: Readonly<Record<string, { lineKey: string; residencyKey?: string; shortKey: string }>> = Object.freeze({
  "google-global-realtime-v1": { lineKey: "elev.wave2Daily.capture.voice.dataUse", residencyKey: "elev.coachcontract.uses.liveResidencyUndated", shortKey: "elev.wave2Daily.capture.voice.noticeGoogleGlobal" },
  "google-eu-realtime-v1": { lineKey: "elev.wave2Daily.capture.voice.dataUse", residencyKey: "elev.coachcontract.uses.liveResidencyEu", shortKey: "elev.wave2Daily.capture.voice.noticeGoogleEu" },
  [DEVICE_VOICE_NOTICE_ID]: { lineKey: "elev.wave2Daily.capture.voice.dataUseDevice", shortKey: "elev.wave2Daily.capture.voice.noticeDevice" },
});

/** The notice id from a `/live/availability` answer, only when Live is on and
 *  the id has approved copy here; otherwise null (the device route applies). */
export function liveNoticeIdFrom(availability: { available?: unknown; notice?: unknown } | null | undefined): string | null {
  if (!availability || availability.available !== true) return null;
  const id = (availability.notice as { id?: unknown } | undefined)?.id;
  return typeof id === "string" && id !== DEVICE_VOICE_NOTICE_ID && VOICE_NOTICE_COPY[id] ? id : null;
}

/** The notice a Talk tap would run under right now. */
export const runtimeVoiceNoticeId = (liveNoticeId: string | null): string => liveNoticeId ?? DEVICE_VOICE_NOTICE_ID;

/** The approved line for a notice id (the device line for anything unknown). */
export function voiceNoticeLine(t: Translate, noticeId: string): string {
  const copy = VOICE_NOTICE_COPY[noticeId] ?? VOICE_NOTICE_COPY[DEVICE_VOICE_NOTICE_ID];
  return t(copy.lineKey, copy.residencyKey ? { residency: t(copy.residencyKey) } : undefined);
}

/** The one-line form of the same approved notice (the composer's line slot). */
export function voiceNoticeShortLine(t: Translate, noticeId: string): string {
  return t((VOICE_NOTICE_COPY[noticeId] ?? VOICE_NOTICE_COPY[DEVICE_VOICE_NOTICE_ID]).shortKey);
}

/**
 * One tap on the voice button, decided before any audio is processed:
 *  - "show": the notice is not acknowledged and not yet on screen → show it;
 *    nothing starts (a cancel or a decline — leaving, a new thread, typing
 *    instead — clears what is showing, so the next tap shows it again);
 *  - "acknowledge_and_start": this same notice is on screen → this tap is the
 *    acknowledgement (remembered) and voice starts;
 *  - "start": already acknowledged on this device → a start or a retry goes
 *    straight on. A different notice id (provider, region or purpose changed)
 *    is never covered by an earlier acknowledgement.
 */
export function voiceNoticeTap(noticeId: string, pendingId: string | null, acknowledged: boolean): "show" | "acknowledge_and_start" | "start" {
  if (acknowledged) return "start";
  return pendingId === noticeId ? "acknowledge_and_start" : "show";
}

/** The residency clause of a Live notice (the data-use panel's spoken line). */
export function voiceNoticeResidencyKey(noticeId: string | null): string | undefined {
  return noticeId ? VOICE_NOTICE_COPY[noticeId]?.residencyKey : undefined;
}

export const VOICE_NOTICE_ACK_KEY = "arbor.voiceNotice.acknowledged";
type StorageLike = Pick<Storage, "getItem" | "setItem">;
const store = (storage?: StorageLike | null) => (storage === undefined ? globalThis.localStorage : storage);

function readAcks(storage?: StorageLike | null): string[] {
  try {
    const parsed: unknown = JSON.parse(store(storage)?.getItem(VOICE_NOTICE_ACK_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export const voiceNoticeAcknowledged = (noticeId: string, storage?: StorageLike | null): boolean =>
  readAcks(storage).includes(noticeId);

/** Acknowledge a notice. Every Live notice also names the device speech
 *  fallback the voice loop takes when Live fails, so it covers that one too. */
export function acknowledgeVoiceNotice(noticeId: string, storage?: StorageLike | null): void {
  try {
    const acks = readAcks(storage);
    const covered = noticeId === DEVICE_VOICE_NOTICE_ID ? [noticeId] : [noticeId, DEVICE_VOICE_NOTICE_ID];
    const next = [...acks, ...covered.filter((id) => !acks.includes(id))];
    if (next.length !== acks.length) store(storage)?.setItem(VOICE_NOTICE_ACK_KEY, JSON.stringify(next.slice(-10)));
  } catch {
    /* the notice simply shows again next time */
  }
}
