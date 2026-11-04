import { useEffect, useSyncExternalStore } from "react";
import { useLanguage } from "../context/LanguageContext";
import {
  PAUSE_EVENT,
  PAUSE_KEY,
  parsePause,
  pauseRecordFor,
  pauseStillOn,
  type PauseRecord,
  type PauseStretch,
} from "./pauseArbor";

/**
 * Device-local pause flag. getServerSnapshot is the stable null: a static
 * render (and the first server pass) shows Arbor as not paused. The browser
 * reads localStorage on the client snapshot, so a parent who already paused
 * does not see a suggestion flash in before the flag loads.
 */

let cacheRaw: string | null = null;
let cacheRecord: PauseRecord | null = null;

function readRaw(): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(PAUSE_KEY);
  } catch {
    return null;
  }
}

function getSnapshot(): PauseRecord | null {
  const raw = readRaw();
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    cacheRecord = parsePause(raw);
  }
  if (!cacheRecord || !pauseStillOn(cacheRecord, new Date())) return null;
  return cacheRecord;
}

function getServerSnapshot(): PauseRecord | null {
  return null;
}

function emit(): void {
  cacheRaw = null;
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PAUSE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onPause = () => {
    cacheRaw = null;
    onChange();
  };
  window.addEventListener(PAUSE_EVENT, onPause);
  return () => {
    window.removeEventListener(PAUSE_EVENT, onPause);
  };
}

export function startPause(stretch: PauseStretch, now: Date, lang: "en" | "he"): void {
  try {
    localStorage.setItem(PAUSE_KEY, JSON.stringify(pauseRecordFor(stretch, now, lang)));
  } catch {
    return;
  }
  emit();
}

/** No-op when nothing is stored, so an expiry timer cannot loop the event. */
export function resumePause(): void {
  try {
    if (typeof localStorage === "undefined" || localStorage.getItem(PAUSE_KEY) == null) return;
    localStorage.removeItem(PAUSE_KEY);
  } catch {
    return;
  }
  emit();
}

export function useArborPause() {
  const { uiLang } = useLanguage();
  const record = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const lang = uiLang === "he" ? "he" : "en";
  useEffect(() => {
    if (!record?.until || typeof window === "undefined") return;
    const delay = Math.max(0, Date.parse(record.until) - Date.now());
    const id = window.setTimeout(() => resumePause(), delay);
    return () => window.clearTimeout(id);
  }, [record]);
  return {
    paused: record != null,
    record,
    start: (stretch: PauseStretch) => startPause(stretch, new Date(), lang),
    resume: resumePause,
  };
}
