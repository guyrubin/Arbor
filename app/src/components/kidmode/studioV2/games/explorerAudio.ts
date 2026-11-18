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
  // A failed first load (offline, unavailable audio context, or timeout) is retryable.
  // Never reuse an aborted signal or discard clips which already decoded.
  let controller: AbortController | null = null;
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
      if (disposed) return Promise.resolve(false);
      const attempt = (async () => {
        const context = kidAudioContext();
        if (!context || typeof fetch !== "function") return false;
        const currentController = new AbortController();
        controller = currentController;
        const timeout = setTimeout(() => currentController.abort(), 10_000);
        try {
          await Promise.all(EXPLORER_SOUNDS.filter(sound => !buffers.has(sound)).map(async sound => {
            try {
              const response = await fetch(EXPLORER_CLIPS[sound], { signal: currentController.signal });
              if (!response.ok || disposed || currentController.signal.aborted) return;
              const data = await response.arrayBuffer();
              if (disposed || currentController.signal.aborted) return;
              const buffer = await new Promise<AudioBuffer>((resolve, reject) => {
                const promise = context.decodeAudioData(data, resolve, reject);
                promise?.then(resolve, reject);
              });
              if (!disposed && !currentController.signal.aborted) buffers.set(sound, buffer);
            } catch { /* Failed clip retains its visual clue; a later Hear tap retries. */ }
          }));
          return !disposed && buffers.size === EXPLORER_SOUNDS.length;
        } finally {
          clearTimeout(timeout);
          if (controller === currentController) controller = null;
        }
      })();
      loading = attempt;
      // Preserve successful decoded audio; release a failed attempt so it can
      // retry after a network/device recovery without remounting Kid Mode.
      void attempt.then(
        ready => { if (!ready && loading === attempt) loading = null; },
        () => { if (loading === attempt) loading = null; },
      );
      return attempt;
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
    dispose() { disposed = true; stop(); buffers.clear(); controller?.abort(); unhush(); globalThis.document?.removeEventListener?.("visibilitychange", onVisibility); },
  };
}
