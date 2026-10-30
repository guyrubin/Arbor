/**
 * Pause Arbor — a parent control on this device.
 *
 * New suggestions and new things to keep wait for a weekend, a week, or
 * until the parent resumes. What they already kept stays readable. Nothing
 * here is a child record: the flag is one localStorage key, not Firestore
 * and not a CHILD_SUBCOLLECTIONS row. The server trusts it only as this
 * device's own request (`paused: true` on the body), never as a credential.
 *
 * No React in this module. Routes and the focus hook import it; the hook
 * that subscribes lives in pauseArborStore.ts.
 */

export const PAUSE_KEY = "arbor.pause";
export const PAUSE_EVENT = "arbor:pause";

/** Stretch ids stay hyphenated so the icon-font guard does not treat them as glyphs. */
export type PauseStretch = "this-weekend" | "seven-days" | "until-resume";

export type PauseRecord = {
  stretch: PauseStretch;
  /** ISO instant. Null means until the parent resumes. */
  until: string | null;
};

const STRETCHES = new Set<PauseStretch>(["this-weekend", "seven-days", "until-resume"]);

/**
 * The end of "this weekend" in the parent's locale, at local midnight.
 * English weeks end Monday morning. Hebrew (Israel) weeks end Sunday morning.
 * Tapped on the end morning itself, the next one — a weekend that already
 * started has a Monday (or Sunday) still ahead, and `|| 7` covers the morning of.
 */
export function weekendEnd(now: Date, lang: "en" | "he"): Date {
  const endDay = lang === "he" ? 0 : 1;
  const delta = (endDay - now.getDay() + 7) % 7 || 7;
  const end = new Date(now.getTime());
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + delta);
  return end;
}

/** Seven calendar days from the tap, same local clock time. */
export function weekLater(now: Date): Date {
  const end = new Date(now.getTime());
  end.setDate(end.getDate() + 7);
  return end;
}

export function pauseRecordFor(stretch: PauseStretch, now: Date, lang: "en" | "he"): PauseRecord {
  if (stretch === "until-resume") return { stretch, until: null };
  const end = stretch === "this-weekend" ? weekendEnd(now, lang) : weekLater(now);
  return { stretch, until: end.toISOString() };
}

export function parsePause(raw: string | null | undefined): PauseRecord | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { stretch?: unknown; until?: unknown };
    if (!value || typeof value !== "object") return null;
    if (typeof value.stretch !== "string" || !STRETCHES.has(value.stretch as PauseStretch)) return null;
    const stretch = value.stretch as PauseStretch;
    if (stretch === "until-resume") {
      if (value.until != null) return null;
      return { stretch, until: null };
    }
    if (typeof value.until !== "string" || Number.isNaN(Date.parse(value.until))) return null;
    return { stretch, until: value.until };
  } catch {
    return null;
  }
}

export function pauseStillOn(record: PauseRecord, now: Date): boolean {
  if (record.until == null) return record.stretch === "until-resume";
  const at = Date.parse(record.until);
  return Number.isFinite(at) && at > now.getTime();
}

/** The parent's own device asked to pause. Absent or any other value is off,
 *  so a request that does not send the flag stays the same request as before. */
export function pauseRequested(body: unknown): boolean {
  return !!body && typeof body === "object" && (body as { paused?: unknown }).paused === true;
}

export function isArborPaused(now: Date = new Date()): boolean {
  try {
    if (typeof localStorage === "undefined") return false;
    const record = parsePause(localStorage.getItem(PAUSE_KEY));
    return !!record && pauseStillOn(record, now);
  } catch {
    return false;
  }
}
