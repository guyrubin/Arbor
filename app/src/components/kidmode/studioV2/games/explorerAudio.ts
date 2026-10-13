import { kidAudioAllowed, kidAudioContext, onKidHush } from "../../audio/kidAudio";
import { EXPLORER_CLIPS, EXPLORER_SOUNDS, type ExplorerSound } from "./gameRules";

export interface ExplorerAudio {
  load(): Promise<boolean>;
  play(sound: ExplorerSound): boolean;
  stop(): void;
  dispose(): void;
}

/** Use the existing per-child audio bus, but own every scheduled foley node:
 * mute, hidden-tab, navigation and child changes cancel even future footsteps. */
export function createExplorerAudio(): ExplorerAudio {
  const buffers = new Map<ExplorerSound, AudioBuffer>();
  const sources = new Map<AudioBufferSourceNode, GainNode>();
  const controller = new AbortController();
  let disposed = false;
  let generation = 0;
  let loading: Promise<boolean> | null = null;
  const stop = () => {
    generation++;
    for (const [source, gain] of sources) {
      try { source.stop(); } catch { /* already stopped */ }
      try { source.disconnect(); gain.disconnect(); } catch { /* already released */ }
    }
    sources.clear();
  };
  const unhush = onKidHush(stop);
  const onVisibility = () => { if (globalThis.document?.visibilityState === "hidden") stop(); };
  globalThis.document?.addEventListener?.("visibilitychange", onVisibility);
  return {
    load() {
      if (loading) return loading;
      loading = (async () => {
        if (disposed) return false;
        const context = kidAudioContext();
        if (!context || typeof fetch !== "function") return false;
        const timeout = setTimeout(() => controller.abort(), 10_000);
        try {
          await Promise.all(EXPLORER_SOUNDS.map(async sound => {
            try {
              const response = await fetch(EXPLORER_CLIPS[sound], { signal: controller.signal });
              if (!response.ok || disposed) return;
              const data = await response.arrayBuffer();
              if (disposed) return;
              const buffer = await new Promise<AudioBuffer>((resolve, reject) => {
                const promise = context.decodeAudioData(data, resolve, reject);
                promise?.then(resolve, reject);
              });
              if (!disposed) buffers.set(sound, buffer);
            } catch { /* Each round always has its non-audio clue. */ }
          }));
          return !disposed && buffers.size === EXPLORER_SOUNDS.length;
        } finally { clearTimeout(timeout); }
      })();
      return loading;
    },
    play(sound) {
      stop();
      if (disposed || !kidAudioAllowed()) return false;
      const context = kidAudioContext(), buffer = buffers.get(sound);
      if (!context || !buffer) return false;
      const token = generation;
      try {
        // Only called from the child's Hear button. Loading never starts sound.
        const resumed = context.resume?.();
        resumed?.catch?.(() => { if (token === generation) stop(); });
        const repeats = sound === "steps" ? 3 : 1;
        for (let index = 0; index < repeats; index++) {
          const source = context.createBufferSource();
          const gain = context.createGain();
          source.buffer = buffer; gain.gain.value = 0.7;
          source.connect(gain); gain.connect(context.destination);
          source.onended = () => { sources.delete(source); try { source.disconnect(); gain.disconnect(); } catch { /* released */ } };
          sources.set(source, gain);
          source.start(context.currentTime + index * 0.32);
        }
        return true;
      } catch { stop(); return false; }
    },
    stop,
    dispose() { disposed = true; stop(); buffers.clear(); controller.abort(); unhush(); globalThis.document?.removeEventListener?.("visibilitychange", onVisibility); },
  };
}
