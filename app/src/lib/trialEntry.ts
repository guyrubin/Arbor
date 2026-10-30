import { track } from "./analytics";
import { isKidModeActive } from "./kidModeGate";

/** A short-lived navigation intent, not a child profile or a billing grant. */
export const TRIAL_ENTRY_KEY = "arbor.trialEntry";
export const TRIAL_ENTRY_TTL = 30 * 60 * 1000;
type TrialEntry = { lang: "en" | "he"; at: number; recorded?: boolean };

export function trialLanguage(search: string): "en" | "he" | null {
  const query = new URLSearchParams(search);
  if (query.get("entry") !== "landing" || query.get("start") !== "trial") return null;
  const lang = query.get("lang");
  return lang === "en" || lang === "he" ? lang : null;
}

export function readTrialEntry(now = Date.now()): TrialEntry | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(TRIAL_ENTRY_KEY) || "null");
    if (!value || !["en", "he"].includes(value.lang) || !Number.isFinite(value.at) || value.at > now || now - value.at >= TRIAL_ENTRY_TTL) return null;
    return { lang: value.lang, at: value.at, recorded: value.recorded === true };
  } catch { return null; }
}

export function captureTrialEntry(search: string, now = Date.now()): void {
  const lang = trialLanguage(search);
  if (!lang) return;
  const prior = readTrialEntry(now);
  // Auth redirects/reloads retain the same entry. No example selection or prose.
  try { sessionStorage.setItem(TRIAL_ENTRY_KEY, JSON.stringify({ lang, at: prior?.at ?? now, recorded: prior?.recorded ?? false })); } catch { /* optional continuity */ }
}

/** Count a signed-in arrival, never a signup or a trial granted by a URL. */
export function recordLandingEntry(uid: string): void {
  const entry = readTrialEntry();
  if (!entry || entry.recorded || !uid || uid === "local-sandbox" || isKidModeActive()) return;
  track("landing_entry", { landing_version: "v12", locale: entry.lang });
  try { sessionStorage.setItem(TRIAL_ENTRY_KEY, JSON.stringify({ ...entry, recorded: true })); } catch { /* navigation still works */ }
}
