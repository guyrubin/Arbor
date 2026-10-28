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

/** notice id → its approved copy (keys in i18nElevation/wave2Daily + coachcontract). */
export const VOICE_NOTICE_COPY: Readonly<Record<string, { lineKey: string; residencyKey?: string }>> = Object.freeze({
  "google-global-realtime-v1": { lineKey: "elev.wave2Daily.capture.voice.dataUse", residencyKey: "elev.coachcontract.uses.liveResidencyUndated" },
  "google-eu-realtime-v1": { lineKey: "elev.wave2Daily.capture.voice.dataUse", residencyKey: "elev.coachcontract.uses.liveResidencyEu" },
  [DEVICE_VOICE_NOTICE_ID]: { lineKey: "elev.wave2Daily.capture.voice.dataUseDevice" },
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

export function acknowledgeVoiceNotice(noticeId: string, storage?: StorageLike | null): void {
  try {
    const acks = readAcks(storage);
    if (!acks.includes(noticeId)) store(storage)?.setItem(VOICE_NOTICE_ACK_KEY, JSON.stringify([...acks, noticeId].slice(-10)));
  } catch {
    /* the notice simply shows again next time */
  }
}
