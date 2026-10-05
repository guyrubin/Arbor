/**
 * kidReadAloud — B-KID-76 (b): the picture-book reader reads each page aloud
 * by itself, with ONE per-child mute in the Kid Mode top bar.
 *
 * - The setting is per child and device-local UI state (like kidModeGate's
 *   persisted view): `arbor.kid.readAloud.muted.<childId>`. Storage can be
 *   missing or throw (private window); the in-memory value still works.
 * - Autoplay rule: speech starts only after the page has had a user gesture
 *   (`navigator.userActivation.hasBeenActive`) — the tap that opened the book
 *   counts; a reload straight into a book stays silent until the child taps.
 * - Speech goes through the existing voice path (lib/voice speakText, the
 *   same engine SpeakButton uses). If speech is unavailable nothing renders
 *   broken: the toggle hides and pages simply stay silent.
 */
import { speakText, voiceSupported } from "../../lib/voice";
import { kidsStoriesText } from "../../lib/i18nElevation/kidsStories";
import { useKidHearIt } from "./kidChrome";
import { isKidReadAloudMuted, kidSay, pageHasUserGesture, setKidReadAloudMuted, useKidReadAloudMuted } from "./audio/kidAudio";

// B-KID-73: the per-child mute store and the voice path live in the ONE kid
// audio module (audio/kidAudio.ts); these names stay for their callers.
export { isKidReadAloudMuted, pageHasUserGesture, setKidReadAloudMuted, useKidReadAloudMuted };

/** Speak a page when read-aloud is on, the device can speak and a gesture has
 *  happened. Returns the utterance id (0 = not spoken). B-KID-73: the ONE
 *  kid voice path (kidSay); a list of lines is spoken as a queue. */
export function autoReadPage(childId: string, text: string | readonly string[], lang: "en" | "he"): number {
  return kidSay(childId, text, lang);
}

/** B-KID-73: the ONE per-child Sound control in the kid top bar (44 px):
 *  off silences the voice AND the effects, and persists. Hidden only when the
 *  device can neither speak nor play audio. */
export function KidSoundToggle({ childId, lang }: { childId: string; lang: "en" | "he" }) {
  const muted = useKidReadAloudMuted(childId);
  const canAudio = typeof (globalThis as { AudioContext?: unknown }).AudioContext !== "undefined";
  if (!voiceSupported() && !canAudio) return null;
  const label = kidsStoriesText("kidAudio.sound", lang);
  return (
    <button
      type="button"
      onClick={() => setKidReadAloudMuted(childId, !muted)}
      aria-pressed={!muted}
      aria-label={label}
      data-kid-read-aloud=""
      data-kid-sound=""
      style={{ appearance: "none", display: "inline-grid", placeItems: "center", inlineSize: 44, blockSize: 44, borderRadius: 999, cursor: "pointer", background: muted ? "var(--arbor-paper-deep)" : "var(--arbor-sky-soft)", color: muted ? "var(--arbor-muted)" : "var(--arbor-sky-ink)", border: "2px solid var(--comic-ink)", flexShrink: 0 }}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
        {muted
          ? <path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
          : <path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />}
      </svg>
    </button>
  );
}

/** The read-aloud toggle IS the Sound control (B-KID-73). */
export const KidReadAloudToggle = KidSoundToggle;

/** B-KID-74 (KC-01): the top bar's ONE hear-it while a game is open — replays
 *  the game's instruction (an explicit tap, so no mute or gesture check). */
export function KidHearItButton() {
  const hearIt = useKidHearIt();
  if (!hearIt || !voiceSupported()) return null;
  return (
    <button
      type="button"
      onClick={() => { speakText(hearIt.text, {}, hearIt.lang); }}
      aria-label={kidsStoriesText("kidGame.hearIt", hearIt.lang)}
      data-kid-hear-it=""
      style={{ appearance: "none", display: "inline-grid", placeItems: "center", inlineSize: 44, blockSize: 44, borderRadius: 999, cursor: "pointer", background: "var(--arbor-sky-soft)", color: "var(--arbor-sky-ink)", border: "2px solid var(--comic-ink)", flexShrink: 0 }}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>
    </button>
  );
}
