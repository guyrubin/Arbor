/**
 * kidVoicePlayer — the kid register's two voice channels: "page" (a book
 * page's narration, a read-aloud line) and "clip" (a tapped card's label, a
 * repair line, the cover title). Each channel is ONE reused HTMLAudioElement.
 *
 * Why (10 Oct 2026, Guy on his iPhone: "the dubbing does not work"): iOS
 * Safari lets an <audio> element start only inside a user gesture until that
 * same element has once been played inside one. The book reader starts a
 * page's narration from an effect after the page turn, a repair prompt after
 * the page settles, and the read-aloud 400 ms after a page opens, so a fresh
 * `new Audio()` per page was refused on an iPhone and the book stayed silent
 * (desktop browsers allow it after any tap, which is where it was checked).
 * The fix is the standard one: the child's first tap in Kid Mode plays a
 * silent sound on both channels (`blessKidVoice`), and every later page sets
 * the src of the same element and plays it without a gesture.
 *
 * Fail-quiet: no Audio = null, and every caller stays silent.
 */

type Channel = "page" | "clip";
const CHANNELS: readonly Channel[] = ["page", "clip"];

/** 0.05 s of 8 kHz, 8-bit mono silence as a WAV data URL, played un-muted to bless. */
export const SILENT_WAV = (() => {
  const n = 400;
  const u32 = (v: number) => String.fromCharCode(v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255);
  const u16 = (v: number) => String.fromCharCode(v & 255, (v >> 8) & 255);
  const wav = "RIFF" + u32(36 + n) + "WAVEfmt " + u32(16) + u16(1) + u16(1) + u32(8000) + u32(8000) + u16(1) + u16(8) + "data" + u32(n) + String.fromCharCode(128).repeat(n);
  const b64 = typeof btoa === "function" ? btoa(wav) : "";
  return `data:audio/wav;base64,${b64}`;
})();

const elements = new Map<Channel, HTMLAudioElement>();
const blessed = new Set<Channel>();

/** The channel's one element (created on first use), or null without Audio. */
export function kidVoiceElement(channel: Channel): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  let el = elements.get(channel);
  if (!el) {
    try {
      el = new Audio();
    } catch {
      return null;
    }
    el.preload = "auto";
    el.setAttribute("playsinline", "");
    elements.set(channel, el);
  }
  return el;
}

/** True once both channels have been played inside a gesture. */
export function kidVoiceBlessed(): boolean {
  return CHANNELS.every((c) => blessed.has(c));
}

/** Call INSIDE a user gesture: play a silent sound on each channel not yet
 *  blessed, so iOS lets it play later without one. A channel already playing
 *  (a real clip started by this same tap) counts as blessed and is left alone. */
export function blessKidVoice(): void {
  for (const channel of CHANNELS) {
    if (blessed.has(channel)) continue;
    const el = kidVoiceElement(channel);
    if (!el) return;
    if (!el.paused) {
      blessed.add(channel);
      continue;
    }
    try {
      el.src = SILENT_WAV;
      // iOS lifts the element's gesture rule at this call; the promise only
      // says whether the silence itself played.
      blessed.add(channel);
      const p = el.play();
      if (p && typeof p.then === "function") {
        p.then(
          () => {
            if (el.src === SILENT_WAV) el.pause();
          },
          () => {
            // refused (no gesture after all): try again on the next tap
            if (el.src === SILENT_WAV) blessed.delete(channel);
          },
        );
      }
    } catch {
      blessed.delete(channel);
    }
  }
}

// iOS grants a media gesture on touchend and click (never touchstart); the
// overlay owns every document keydown listener, so keys are not used here.
const UNLOCK_EVENTS = ["touchend", "pointerup", "click"] as const;

/** While Kid Mode (or the dev book route) is open: bless the channels on the
 *  first gesture that reaches the document (capture, before React's handlers
 *  run the tap that opens a book). Returns the uninstall. */
export function installKidVoiceUnlock(): () => void {
  if (typeof document === "undefined") return () => {};
  const onGesture = () => {
    blessKidVoice();
    if (kidVoiceBlessed()) remove();
  };
  const remove = () => {
    for (const type of UNLOCK_EVENTS) document.removeEventListener(type, onGesture, true);
  };
  if (kidVoiceBlessed()) return () => {};
  for (const type of UNLOCK_EVENTS) document.addEventListener(type, onGesture, true);
  return remove;
}

/** Stop both channels (Kid Mode closed, Sound turned off, a hidden tab). */
export function stopKidVoice(): void {
  for (const el of elements.values()) {
    el.onended = null;
    el.onerror = null;
    el.ontimeupdate = null;
    try {
      el.pause();
    } catch {
      /* ignore */
    }
  }
}

/** Test seam. */
export function resetKidVoiceForTest(): void {
  stopKidVoice();
  elements.clear();
  blessed.clear();
}
