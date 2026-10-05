/**
 * kidSoundBank — B-GAME-08a: pre-rendered sound FILES for a kid game (ruling
 * G13: recorded neural voice + foley; no synthesised beep and no device
 * text-to-speech inside a scene).
 *
 * A game's sounds live in one folder:
 *   <base>/manifest.json   { "ext": "m4a" | "wav",
 *                            "he": { <id>: <durationMs> }, "en": {…}, "foley": {…} }
 *   <base>/he/<id>.<ext>   voice, Hebrew
 *   <base>/en/<id>.<ext>   voice, English
 *   <base>/foley/<id>.<ext>
 *
 * Clips are fetched once and decoded (`decodeAudioData`) on the ONE kid
 * AudioContext that kidAudio.ts owns, so the per-child Sound control, the
 * Kid-Mode-only gate, the hidden-tab suspend and close-on-exit all apply.
 *
 * play(id, { kind, rate, gain, mode }):
 *   - ~60 ms de-dupe per id (two events in one frame never double a clip);
 *   - foley gets a ±3 % random rate (steps never sound like a loop);
 *   - VOICE NEVER OVERLAPS: a "cut" line (a count word) stops the current
 *     voice clip and drops anything queued; any other line queues behind
 *     the current one (at most ONE queued — a newer line replaces it);
 *   - kidHush (mute, navigation, hidden tab, exit) stops the voice.
 * unlock(): call from the first pointerdown — resumes the context inside the
 *   gesture (autoplay policy; iOS also wants a buffer started in the gesture).
 *
 * Failure-tolerant: no manifest, a missing file, a decode error or no audio
 * support = that clip is silent. Nothing here throws and nothing blocks play.
 */
import { kidAudioAllowed, kidAudioContext, onKidHush } from "./kidAudio";

export type SoundKind = "voice" | "foley";
export type SoundLang = "en" | "he";

export interface SoundManifest {
  ext: "m4a" | "wav";
  he: Record<string, number>;
  en: Record<string, number>;
  foley: Record<string, number>;
}

export interface PlayOptions {
  /** Default "foley". */
  kind?: SoundKind;
  /** Playback rate (default 1). Foley adds ±3 % on top. */
  rate?: number;
  /** Linear gain (default 1). */
  gain?: number;
  /** Voice only: "cut" stops the current line (count words); default "queue". */
  mode?: "cut" | "queue";
}

export interface KidSoundBank {
  /** Fetch + decode the manifest's clips for the language and the foley.
   *  Resolves true when a manifest was read (some clips may still be missing). */
  load(): Promise<boolean>;
  /** Play a clip; false when it did not start (silent, missing, de-duped, queued
   *  lines return true). Never throws. */
  play(id: string, opts?: PlayOptions): boolean;
  /** True once the clip is decoded. */
  has(id: string, kind?: SoundKind): boolean;
  /** The clip's length in ms, as manifest.json declares it (else the decoded
   *  length; 0 when absent). */
  durationMs(id: string, kind?: SoundKind): number;
  /** Resume the shared context inside a user gesture. */
  unlock(): void;
  /** Stop the voice clip and drop the queue. */
  stopVoice(): void;
  /** Stop and release listeners (unmount). */
  dispose(): void;
}

export const DEDUPE_MS = 60;
export const FOLEY_RATE_JITTER = 0.03;

const ID_OK = /^[a-z0-9][a-z0-9-]{0,40}$/i;

/** Validate a manifest; anything malformed is null (the game stays silent). */
export function parseSoundManifest(raw: unknown): SoundManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.ext !== "m4a" && r.ext !== "wav") return null;
  const table = (v: unknown): Record<string, number> => {
    const out: Record<string, number> = {};
    if (!v || typeof v !== "object") return out;
    for (const [k, d] of Object.entries(v as Record<string, unknown>)) {
      if (ID_OK.test(k) && typeof d === "number" && Number.isFinite(d) && d >= 0) out[k] = d;
    }
    return out;
  };
  return { ext: r.ext, he: table(r.he), en: table(r.en), foley: table(r.foley) };
}

/** The url of one clip. */
export function clipUrl(base: string, folder: SoundLang | "foley", id: string, ext: SoundManifest["ext"]): string {
  return `${base.replace(/\/+$/, "")}/${folder}/${id}.${ext}`;
}

function decode(ac: AudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    try {
      // Callback form for older WebKit; the promise form everywhere else.
      const p = ac.decodeAudioData(data, resolve, reject) as Promise<AudioBuffer> | undefined;
      if (p && typeof p.then === "function") p.then(resolve, reject);
    } catch (e) {
      reject(e);
    }
  });
}

type Fetcher = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown>; arrayBuffer(): Promise<ArrayBuffer> }>;

export interface SoundBankOptions {
  /** Folder of the game's sounds, e.g. "/audio/kid/sneak". */
  base: string;
  lang: SoundLang;
  /** Test seams. */
  fetcher?: Fetcher;
  random?: () => number;
  now?: () => number;
}

interface Playing { src: AudioBufferSourceNode; gain: GainNode; endsAt: number }

/** A cut voice fades out over ~40 ms (no click), then stops. */
const CUT_FADE_S = 0.04;

export function createKidSoundBank(o: SoundBankOptions): KidSoundBank {
  const fetcher: Fetcher | null = o.fetcher ?? (typeof fetch === "function" ? (u) => fetch(u) : null);
  const random = o.random ?? Math.random;
  const now = o.now ?? (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));
  const buffers = new Map<string, AudioBuffer>();
  /** Durations declared by manifest.json, ms. */
  const declared = new Map<string, number>();
  const lastAt = new Map<string, number>();
  let voice: Playing | null = null;
  let queued: { id: string; opts: PlayOptions } | null = null;
  let loading: Promise<boolean> | null = null;
  let disposed = false;

  const key = (kind: SoundKind, id: string) => `${kind}:${id}`;

  const stopVoice = () => {
    queued = null;
    const v = voice;
    voice = null;
    if (v) {
      try { v.src.onended = null; } catch { /* ignore */ }
      try {
        const t = v.src.context.currentTime;
        v.gain.gain.setTargetAtTime(0, t, CUT_FADE_S / 3);
        v.src.stop(t + CUT_FADE_S);
      } catch {
        try { v.src.stop(); } catch { /* already stopped */ }
      }
    }
  };
  const unhush = onKidHush(stopVoice);

  const voiceBusy = (ac: AudioContext): boolean => !!voice && ac.currentTime < voice.endsAt;

  const start = (ac: AudioContext, buffer: AudioBuffer, kind: SoundKind, opts: PlayOptions): Playing | null => {
    try {
      const src = ac.createBufferSource();
      src.buffer = buffer;
      let rate = opts.rate && opts.rate > 0 ? opts.rate : 1;
      if (kind === "foley") rate *= 1 + (random() * 2 - 1) * FOLEY_RATE_JITTER;
      try { src.playbackRate.value = rate; } catch { /* fixed-rate node */ }
      const g = ac.createGain();
      g.gain.value = typeof opts.gain === "number" && opts.gain >= 0 ? opts.gain : 1;
      src.connect(g);
      g.connect(ac.destination);
      if (ac.state === "suspended") void ac.resume?.();
      src.start();
      return { src, gain: g, endsAt: ac.currentTime + buffer.duration / rate };
    } catch {
      return null;
    }
  };

  const startVoice = (ac: AudioContext, buffer: AudioBuffer, opts: PlayOptions): boolean => {
    const p = start(ac, buffer, "voice", opts);
    if (!p) return false;
    voice = p;
    p.src.onended = () => {
      if (voice?.src !== p.src) return;
      voice = null;
      const next = queued;
      queued = null;
      if (!next || disposed || !kidAudioAllowed()) return;
      const buf = buffers.get(key("voice", next.id));
      if (buf) startVoice(ac, buf, next.opts);
    };
    return true;
  };

  function play(id: string, opts: PlayOptions = {}): boolean {
    if (disposed) return false;
    try {
      if (!kidAudioAllowed()) return false;
      const kind: SoundKind = opts.kind ?? "foley";
      const buffer = buffers.get(key(kind, id));
      if (!buffer) return false;
      const t = now();
      const k = key(kind, id);
      const last = lastAt.get(k);
      if (last !== undefined && t - last < DEDUPE_MS) return false;
      lastAt.set(k, t);
      const ac = kidAudioContext();
      if (!ac) return false;
      if (kind === "foley") return !!start(ac, buffer, "foley", opts);
      if (voiceBusy(ac)) {
        if (opts.mode === "cut") {
          stopVoice();
        } else {
          queued = { id, opts };
          return true;
        }
      } else if (opts.mode === "cut") {
        queued = null;
      }
      return startVoice(ac, buffer, opts);
    } catch {
      return false;
    }
  }

  const load = (): Promise<boolean> => {
    if (loading) return loading;
    loading = (async () => {
      if (!fetcher) return false;
      let manifest: SoundManifest | null = null;
      try {
        const res = await fetcher(`${o.base.replace(/\/+$/, "")}/manifest.json`);
        if (!res.ok) return false;
        manifest = parseSoundManifest(await res.json());
      } catch {
        return false;
      }
      if (!manifest) return false;
      const ac = kidAudioContext();
      if (!ac) return true;
      const m = manifest;
      for (const [id, ms] of Object.entries(m[o.lang])) declared.set(key("voice", id), ms);
      for (const [id, ms] of Object.entries(m.foley)) declared.set(key("foley", id), ms);
      const jobs: Promise<void>[] = [];
      const want = (kind: SoundKind, folder: SoundLang | "foley", ids: string[]) => {
        for (const id of ids) {
          jobs.push(
            (async () => {
              try {
                const res = await fetcher(clipUrl(o.base, folder, id, m.ext));
                if (!res.ok) return;
                const buf = await decode(ac, await res.arrayBuffer());
                if (!disposed) buffers.set(key(kind, id), buf);
              } catch {
                /* this clip stays silent */
              }
            })(),
          );
        }
      };
      want("voice", o.lang, Object.keys(m[o.lang]));
      want("foley", "foley", Object.keys(m.foley));
      await Promise.all(jobs);
      return true;
    })();
    return loading;
  };

  return {
    load,
    play,
    has: (id, kind = "foley") => buffers.has(key(kind, id)),
    durationMs: (id, kind = "foley") => {
      if (!buffers.has(key(kind, id))) return 0;
      return declared.get(key(kind, id)) ?? Math.round((buffers.get(key(kind, id))?.duration ?? 0) * 1000);
    },
    unlock: () => {
      try {
        const ac = kidAudioContext();
        if (!ac) return;
        if (ac.state !== "running") void ac.resume?.();
        // iOS: a (silent) buffer started inside the gesture unlocks output.
        const b = ac.createBuffer(1, 1, ac.sampleRate || 22050);
        const s = ac.createBufferSource();
        s.buffer = b;
        s.connect(ac.destination);
        s.start();
      } catch {
        /* never load-bearing */
      }
    },
    stopVoice,
    dispose: () => {
      stopVoice();
      disposed = true;
      unhush();
    },
  };
}
