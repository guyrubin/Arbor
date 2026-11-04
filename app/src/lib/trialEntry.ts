import { track } from "./analytics";
import { isKidModeActive } from "./kidModeGate";

/** A short-lived navigation intent, not a child profile or a billing grant.
 *  `moment` is the landing situation id. `kept` means the parent asked to
 *  review that situation's illustrative example. Never prose, never a name. */
export const TRIAL_ENTRY_KEY = "arbor.trialEntry";
export const TRIAL_ENTRY_TTL = 30 * 60 * 1000;
export const SITUATION_MOMENTS = ["bedtime", "feelings", "play"] as const;
export type SituationMoment = (typeof SITUATION_MOMENTS)[number];
type TrialEntry = { lang: "en" | "he"; at: number; recorded?: boolean; moment?: SituationMoment; kept?: boolean };

export function situationMoment(value: unknown): SituationMoment | undefined {
  return value === "bedtime" || value === "feelings" || value === "play" ? value : undefined;
}

export function trialLanguage(search: string): "en" | "he" | null {
  const query = new URLSearchParams(search);
  if (query.get("entry") !== "landing" || query.get("start") !== "trial") return null;
  const lang = query.get("lang");
  return lang === "en" || lang === "he" ? lang : null;
}

function storedEntry(value: unknown, now: number): TrialEntry | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as { lang?: unknown; at?: unknown; recorded?: unknown; moment?: unknown; kept?: unknown };
  if ((entry.lang !== "en" && entry.lang !== "he") || !Number.isFinite(entry.at) || (entry.at as number) > now || now - (entry.at as number) >= TRIAL_ENTRY_TTL) return null;
  const moment = situationMoment(entry.moment);
  const kept = entry.kept === true && !!moment;
  return { lang: entry.lang, at: entry.at as number, recorded: entry.recorded === true, ...(moment ? { moment } : {}), ...(kept ? { kept: true } : {}) };
}

export function readTrialEntry(now = Date.now()): TrialEntry | null {
  try {
    return storedEntry(JSON.parse(sessionStorage.getItem(TRIAL_ENTRY_KEY) || "null"), now);
  } catch { return null; }
}

export function captureTrialEntry(search: string, now = Date.now()): void {
  const lang = trialLanguage(search);
  if (!lang) return;
  const prior = readTrialEntry(now);
  const query = new URLSearchParams(search);
  const explicit = situationMoment(query.get("moment"));
  // A later auth reload often drops the query. Keep the situation already stored.
  // An explicit new moment replaces it, and only that visit's kept=1 counts.
  const moment = explicit ?? prior?.moment;
  const kept = explicit ? query.get("kept") === "1" : prior?.kept === true && !!moment;
  try {
    sessionStorage.setItem(TRIAL_ENTRY_KEY, JSON.stringify({
      lang, at: prior?.at ?? now, recorded: prior?.recorded ?? false,
      ...(moment ? { moment } : {}),
      ...(kept && moment ? { kept: true } : {}),
    }));
  } catch { /* optional continuity */ }
}

/** The example was approved or left out. The situation itself stays. */
export function clearSituationKept(now = Date.now()): void {
  const entry = readTrialEntry(now);
  if (!entry?.kept) return;
  try {
    const { kept: _kept, ...rest } = entry;
    sessionStorage.setItem(TRIAL_ENTRY_KEY, JSON.stringify(rest));
  } catch { /* the review can still finish */ }
}

/** Count a signed-in arrival, never a signup or a trial granted by a URL. */
export function recordLandingEntry(uid: string): void {
  const entry = readTrialEntry();
  if (!entry || entry.recorded || !uid || uid === "local-sandbox" || isKidModeActive()) return;
  track("landing_entry", { landing_version: "v12", locale: entry.lang });
  try { sessionStorage.setItem(TRIAL_ENTRY_KEY, JSON.stringify({ ...entry, recorded: true })); } catch { /* navigation still works */ }
}
