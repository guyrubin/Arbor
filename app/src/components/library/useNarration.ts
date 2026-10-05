/**
 * useNarration — B-BOOK-04/12: plays a page's pre-rendered narration FILE on
 * page show (RULINGS BR8: whole-page files with the child's name inside;
 * reading never calls a voice service). No file, a missing file, Sound off, no
 * user gesture yet, or a hidden tab = silence, never an error.
 *
 * - One HTMLAudioElement per page show; the previous one is paused on change.
 * - A path that failed once is not asked again this session.
 * - `settled` turns true when the narration ends, fails, or never starts.
 * - `revealed` (fix round 1, ruling 5 — p9's dust on "BOOM"): with audio,
 *   at `revealAt` seconds if given, else REVEAL_LEAD_S before the end when the
 *   duration is known, else on `ended`; with no audio (Sound off, no file, no
 *   gesture), `silentRevealMs` after the page shows. The reader adds "a tap /
 *   the first Next reveals" on top.
 * - `playClip(src)` plays a short one-off (a choice label, a repair line, a
 *   prompt, the cover title) under the same Sound rule, pausing the page
 *   narration; a page part that starts while a clip plays waits for its end.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { pageHasUserGesture } from "../kidmode/audio/kidAudio";

const failed = new Set<string>();

export interface NarrationState {
  /** The page narration finished, failed, or never started. */
  settled: boolean;
  /** Audio actually started on this page show. */
  playing: boolean;
  /** The reveal moment has come (see the module note). */
  revealed: boolean;
  playClip: (src: string | null | undefined) => void;
}

/** Seconds before the end of the narration at which the reveal starts. */
export const REVEAL_LEAD_S = 1.2;
/** The reveal on a silent page. */
export const SILENT_REVEAL_MS = 5000;

export function useNarration(
  src: string | null,
  opts: { showKey: string; muted: boolean; enabled: boolean; revealAt?: number; silentRevealMs?: number },
): NarrationState {
  const { showKey, muted, enabled, revealAt, silentRevealMs = SILENT_REVEAL_MS } = opts;
  const pageAudio = useRef<HTMLAudioElement | null>(null);
  const clipAudio = useRef<HTMLAudioElement | null>(null);
  const [settled, setSettled] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setSettled(false);
    setPlaying(false);
    setRevealed(false);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reveal = () => !cancelled && setRevealed(true);
    const finish = (heard: boolean) => {
      if (cancelled) return;
      setSettled(true);
      setPlaying(false);
      if (heard) reveal();
      else timer = setTimeout(reveal, silentRevealMs);
    };
    const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
    if (!enabled || !src || muted || failed.has(src) || !pageHasUserGesture() || hidden || typeof Audio === "undefined") {
      finish(false);
      return () => {
        cancelled = true;
        if (timer) clearTimeout(timer);
      };
    }
    const audio = new Audio(src);
    pageAudio.current = audio;
    audio.preload = "auto";
    audio.onended = () => finish(true);
    audio.onerror = () => {
      failed.add(src);
      finish(false);
    };
    audio.ontimeupdate = () => {
      if (cancelled) return;
      const at = revealAt ?? (Number.isFinite(audio.duration) && audio.duration > 0 ? Math.max(0, audio.duration - REVEAL_LEAD_S) : Infinity);
      if (audio.currentTime >= at) setRevealed(true);
    };
    const start = () => {
      if (cancelled) return;
      audio
        .play()
        .then(() => !cancelled && setPlaying(true))
        .catch(() => finish(false));
    };
    // A tap's clip (a repair item's line) finishes before the next part starts.
    const clip = clipAudio.current;
    let wait: ReturnType<typeof setTimeout> | undefined;
    const onClipEnd = () => {
      if (wait) clearTimeout(wait);
      start();
    };
    if (clip && !clip.paused && !clip.ended) {
      wait = setTimeout(onClipEnd, 6000);
      clip.addEventListener("ended", onClipEnd, { once: true });
    } else start();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (wait) clearTimeout(wait);
      clip?.removeEventListener("ended", onClipEnd);
      audio.onended = null;
      audio.onerror = null;
      audio.ontimeupdate = null;
      audio.pause();
      if (pageAudio.current === audio) pageAudio.current = null;
    };
  }, [src, showKey, muted, enabled, revealAt, silentRevealMs]);

  // Sound turned off mid-page: stop at once.
  useEffect(() => {
    if (muted) {
      pageAudio.current?.pause();
      clipAudio.current?.pause();
    }
  }, [muted]);

  const playClip = useCallback(
    (clip: string | null | undefined) => {
      if (!clip || muted || failed.has(clip) || typeof Audio === "undefined") return;
      pageAudio.current?.pause();
      clipAudio.current?.pause();
      const a = new Audio(clip);
      clipAudio.current = a;
      a.onerror = () => failed.add(clip);
      a.play().catch(() => {});
    },
    [muted],
  );

  useEffect(
    () => () => {
      clipAudio.current?.pause();
    },
    [],
  );

  return { settled, playing, revealed, playClip };
}
