/**
 * useNarration — B-BOOK-04/12: plays a page's pre-rendered narration FILE on
 * page show (RULINGS BR8: whole-page files with the child's name inside;
 * reading never calls a voice service). No file, a missing file, Sound off, no
 * user gesture yet, or a hidden tab = silence, never an error.
 *
 * - ONE reused HTMLAudioElement per channel (kidVoicePlayer: "page" for the
 *   narration, "clip" for a tap's one-off), blessed by the child's first tap
 *   so an iPhone plays every later page without a gesture of its own (10 Oct:
 *   a fresh `new Audio()` per page was refused on iOS Safari and the book was
 *   silent there). A page change pauses the channel and detaches its handlers.
 * - A file is tried as `.mp3`, then as `.wav` (a performed reading set may be
 *   delivered as WAV); a path that failed once is not asked again.
 * - `settled` turns true when the narration ends, fails, or never starts.
 * - `heard`: audio actually started on this page show (else the page is
 *   SILENT: the art states use their silent timings). `heard` is keyed by
 *   `showKey`, so a page never sees the previous page's value.
 * - `onClock` (v3, the art-state cues): called with the file's position and
 *   duration on every time update, and once with `ended: true`.
 * - `playClip(src)` plays a short one-off (a choice label, a repair line, a
 *   prompt, the cover title) under the same Sound rule, pausing the page
 *   narration; a page part that starts while a clip plays waits for its end.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { pageHasUserGesture } from "../kidmode/audio/kidAudio";
import { kidVoiceElement } from "../../lib/kidVoicePlayer";
import type { NarrationClock } from "../../lib/library/bookArtStates";

const failed = new Set<string>();

/** The URLs to try for a narration file: the file, then its `.wav` twin. */
export function narrationCandidates(src: string): string[] {
  const out = [src];
  if (/\.mp3$/.test(src)) out.push(src.replace(/\.mp3$/, ".wav"));
  return out.filter((u) => !failed.has(u));
}

export interface NarrationState {
  /** The page narration finished, failed, or never started. */
  settled: boolean;
  /** Audio is playing now. */
  playing: boolean;
  /** Audio started on this page show. */
  heard: boolean;
  playClip: (src: string | null | undefined) => void;
}

export function useNarration(
  src: string | null,
  opts: { showKey: string; muted: boolean; enabled: boolean; onClock?: (c: NarrationClock) => void },
): NarrationState {
  const { showKey, muted, enabled } = opts;
  const onClock = useRef(opts.onClock);
  onClock.current = opts.onClock;
  const pageAudio = useRef<HTMLAudioElement | null>(null);
  const clipAudio = useRef<HTMLAudioElement | null>(null);
  const [settled, setSettled] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [heardFor, setHeardFor] = useState<string | null>(null);

  useEffect(() => {
    setSettled(false);
    setPlaying(false);
    let cancelled = false;
    const finish = () => {
      if (cancelled) return;
      setSettled(true);
      setPlaying(false);
    };
    const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
    const urls = src ? narrationCandidates(src) : [];
    const channel = kidVoiceElement("page");
    if (!enabled || !src || muted || !urls.length || !pageHasUserGesture() || hidden || !channel) {
      finish();
      return () => {
        cancelled = true;
      };
    }
    let audio: HTMLAudioElement | null = null;
    let wait: ReturnType<typeof setTimeout> | undefined;
    const clock = (a: HTMLAudioElement, ended: boolean) =>
      onClock.current?.({ positionMs: a.currentTime * 1000, durationMs: Number.isFinite(a.duration) ? a.duration * 1000 : NaN, ended });
    const play = (i: number) => {
      if (cancelled) return;
      if (i >= urls.length) return finish();
      const a = channel;
      audio = a;
      pageAudio.current = a;
      a.src = urls[i];
      a.onended = () => {
        if (cancelled) return;
        clock(a, true);
        finish();
      };
      a.onerror = () => {
        failed.add(urls[i]);
        play(i + 1);
      };
      a.ontimeupdate = () => !cancelled && clock(a, false);
      a.play()
        .then(() => {
          if (cancelled) return;
          setPlaying(true);
          setHeardFor(showKey);
        })
        .catch((e: unknown) => {
          // not allowed to play (no gesture): silence; a missing or
          // undecodable file is handled by onerror (the next candidate)
          if ((e as { name?: string } | null)?.name === "NotAllowedError") finish();
        });
    };
    // A tap's clip (a repair item's line) finishes before the next part starts.
    const clip = clipAudio.current;
    const onClipEnd = () => {
      if (wait) clearTimeout(wait);
      play(0);
    };
    if (clip && !clip.paused && !clip.ended) {
      wait = setTimeout(onClipEnd, 6000);
      clip.addEventListener("ended", onClipEnd, { once: true });
    } else play(0);
    return () => {
      cancelled = true;
      if (wait) clearTimeout(wait);
      clip?.removeEventListener("ended", onClipEnd);
      const a = audio as HTMLAudioElement | null;
      if (a) {
        a.onended = null;
        a.onerror = null;
        a.ontimeupdate = null;
        a.pause();
        if (pageAudio.current === a) pageAudio.current = null;
      }
    };
  }, [src, showKey, muted, enabled]);

  // Sound turned off mid-page: stop at once.
  useEffect(() => {
    if (muted) {
      pageAudio.current?.pause();
      clipAudio.current?.pause();
    }
  }, [muted]);

  const playClip = useCallback(
    (clip: string | null | undefined) => {
      if (!clip || muted || typeof Audio === "undefined") return;
      const urls = narrationCandidates(clip);
      if (!urls.length) return;
      pageAudio.current?.pause();
      clipAudio.current?.pause();
      const a = kidVoiceElement("clip");
      if (!a) return;
      const tryAt = (i: number) => {
        if (i >= urls.length) return;
        clipAudio.current = a;
        a.src = urls[i];
        a.onerror = () => {
          failed.add(urls[i]);
          tryAt(i + 1);
        };
        a.play().catch(() => {});
      };
      tryAt(0);
    },
    [muted],
  );

  useEffect(
    () => () => {
      clipAudio.current?.pause();
    },
    [],
  );

  return { settled, playing, heard: heardFor === showKey, playClip };
}
