/**
 * B-VOICE-06 — the capture bar's Voice door.
 *
 * The Voice tile opens a two-way choice: "Note something" (the capture sheet's
 * dictation, unchanged) or "Talk it through" (the conversation's Talk path,
 * unchanged). The FIRST time the choice opens it carries one line on what
 * happens to the audio; once the parent has picked either door the line is
 * not shown again on this device.
 *
 * Storage failure reads as "not seen yet": a data-use line shown twice is the
 * safe failure, a line never shown is not.
 */
export const VOICE_DOOR_NOTICE_KEY = "arbor.voiceDoor.dataUseSeen";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function voiceDoorNoticeSeen(storage?: StorageLike | null): boolean {
  try {
    const store = storage === undefined ? globalThis.localStorage : storage;
    return store?.getItem(VOICE_DOOR_NOTICE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markVoiceDoorNoticeSeen(storage?: StorageLike | null): void {
  try {
    const store = storage === undefined ? globalThis.localStorage : storage;
    store?.setItem(VOICE_DOOR_NOTICE_KEY, "1");
  } catch {
    /* the line simply shows again next time */
  }
}
