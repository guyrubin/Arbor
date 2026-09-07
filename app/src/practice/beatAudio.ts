/**
 * KID-27 — Beat Keeper's click.
 *
 * The world is a rhythm game and it was SILENT: the beat existed only as a
 * scaling circle, so a child who looked away, or who reads rhythm by ear
 * rather than by eye, had nothing to keep time with. `<audio>` files would
 * mean shipping assets and a load race with the first beat, so the click is
 * synthesised: one short sine burst with a fast decay envelope, through a
 * single shared AudioContext.
 *
 * Fail-quiet by design. An AudioContext that cannot be created (unsupported,
 * or created outside a user gesture on iOS) must never break the game — the
 * visual pulse is still there, and the child never sees an error about audio.
 */

let ctx: AudioContext | null = null;
let unavailable = false;

type AudioCtor = new () => AudioContext;

function audioContext(): AudioContext | null {
  if (unavailable) return null;
  if (ctx) return ctx;
  try {
    const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) {
      unavailable = true;
      return null;
    }
    ctx = new Ctor();
    return ctx;
  } catch {
    unavailable = true;
    return null;
  }
}

/** One short click on the beat. Silent (and harmless) where audio is not available. */
export function beatClick(freq = 880, ms = 45): void {
  const ac = audioContext();
  if (!ac) return;
  try {
    // Autoplay policies suspend a context created before the first gesture;
    // resuming is a no-op when it is already running.
    void ac.resume?.();
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    // A percussive envelope: instant attack, exponential decay. A flat gate
    // would click twice (once at each edge) and read as a glitch, not a beat.
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.28, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + ms / 1000);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + ms / 1000 + 0.02);
  } catch {
    /* fail quiet — the visual pulse still carries the beat */
  }
}

/** Release the shared context (world unmount). Safe to call repeatedly. */
export function closeBeatAudio(): void {
  const live = ctx;
  ctx = null;
  try {
    void live?.close?.();
  } catch {
    /* ignore */
  }
}

/** Test seam: forget the cached context and the unsupported latch. */
export function resetBeatAudioForTests(): void {
  ctx = null;
  unavailable = false;
}
