/**
 * useNarration — B-BOOK-04: plays a page's pre-rendered narration FILE on page
 * show (RULINGS BR8: whole-page files with the child's name inside; reading
 * never calls a voice service). No file, a missing file, Sound off, no user
 * gesture yet, or a hidden tab = silence, never an error.
 *
 * - One HTMLAudioElement per page show; the previous one is paused on change.
 * - A path that failed once is not asked again this session.
 * - `settled` turns true when the narration ends, fails, or never starts —
 *   the reader uses it for the "after the narration" reveal (p9's dust cloud:
 *   at `revealAt` seconds, else 1.2 s after the end; a silent page reveals on
 *   a tap instead).
 * - `playClip(src)` plays a short one-off (a choice label, a repair tap sound)
 *   under the same Sound rule, pausing the page narration.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { pageHasUserGesture } from "../kidmode/audio/kidAudio";

const failed = new Set<string>();

export interface NarrationState {
  /** The page narration finished, failed, or never started. */
  settled: boolean;
  /** Audio actually started on this page show. */
  playing: boolean;
  /** The reveal moment has come (revealAt reached, or 1.2 s after the end). */
  revealed: boolean;
  playClip: (src: string | null | undefined) => void;
}

export const REVEAL_DELAY_MS = 1200;

export function useNarration(src: string | null, opts: { showKey: string; muted: boolean; enabled: boolean; revealAt?: number }): NarrationState {
  const { showKey, muted, enabled, revealAt } = opts;
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
    const finish = (heard: boolean) => {
      if (cancelled) return;
      setSettled(true);
      setPlaying(false);
      if (heard) timer = setTimeout(() => !cancelled && setRevealed(true), REVEAL_DELAY_MS);
    };
    const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
    if (!enabled || !src || muted || failed.has(src) || !pageHasUserGesture() || hidden || typeof Audio === "undefined") {
      finish(false);
      return () => {
        cancelled = true;
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
    if (revealAt != null) {
      audio.ontimeupdate = () => {
        if (!cancelled && audio.currentTime >= revealAt) setRevealed(true);
      };
    }
    audio
      .play()
      .then(() => !cancelled && setPlaying(true))
      .catch(() => finish(false));
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      audio.onended = null;
      audio.onerror = null;
      audio.ontimeupdate = null;
      audio.pause();
      if (pageAudio.current === audio) pageAudio.current = null;
    };
  }, [src, showKey, muted, enabled, revealAt]);

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
