import { kidAudioAllowed, kidAudioContext, onKidHush } from '../../../audio/kidAudio';
import { LOOP_STEPS, validMove, validTempo, type DanceLoop, type MoveId } from './heroBandRules';

export interface BandRun {
  tempo: number;
  /** Read at every step, so a move placed mid-loop plays on the next pass. */
  loop: () => DanceLoop;
  /** Fires once per step. `quiet` = the child just played this step by hand. */
  onStep: (step: number, absolute: number, quiet: boolean) => void;
  /** Stop by itself after this many steps (a shown phrase, a performance). */
  steps?: number;
  onEnd?: () => void;
}
export interface BandEngine {
  /** One move's sound now, inside the tap gesture. False = no sound was made. */
  hit(move: MoveId): boolean;
  /** Start the beat. False = the beat runs silently (sound off or unavailable);
   * the steps still fire, so the whole game plays by sight. */
  start(run: BandRun): boolean;
  /** Milliseconds since the beat started, on the clock the steps use. */
  elapsed(): number;
  running(): boolean;
  /** True while the beat is actually sounding. */
  audible(): boolean;
  /** The child played this absolute step by hand: do not sound it twice. */
  played(absolute: number): void;
  stop(): void;
  dispose(): void;
}

/** Pentatonic, so any order of moves sounds like a tune. */
const TONES: readonly { type: OscillatorType; from: number; to?: number; length: number }[] = [
  { type: 'triangle', from: 783.99, length: 0.3 },
  { type: 'sawtooth', from: 392, to: 880, length: 0.2 },
  { type: 'triangle', from: 523.25, length: 0.3 },
  { type: 'sine', from: 220, to: 110, length: 0.24 },
  { type: 'triangle', from: 659.25, length: 0.16 },
  { type: 'sine', from: 880, to: 1318.5, length: 0.34 },
];
const TICK_MS = 25;
const LOOKAHEAD_MS = 110;

/** Local synthesis on Arbor's one kid audio bus: the child's Sound switch,
 * hidden-tab hush and leaving Kid Mode all silence it. No network, no file. */
export function createBandEngine(now: () => number = () => performance.now()): BandEngine {
  const sources = new Map<OscillatorNode, GainNode>();
  let disposed = false, epoch = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let run: BandRun | null = null;
  let context: AudioContext | null = null;
  let startMs = 0, startAudio = 0, nextSound = 0, nextStep = 0;
  const handPlayed = new Set<number>();

  const release = (source: OscillatorNode, gain: GainNode) => {
    sources.delete(source);
    try { source.disconnect(); } catch { /* Already released. */ }
    try { gain.disconnect(); } catch { /* Already released. */ }
  };
  const silence = () => {
    epoch++;
    for (const [source, gain] of sources) {
      try { source.stop(); } catch { /* An ended source must still disconnect. */ }
      release(source, gain);
    }
  };
  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null; run = null; context = null; handPlayed.clear();
    silence();
  };
  const unhush = onKidHush(stop);
  const gestureContext = () => {
    if (disposed || !kidAudioAllowed()) return null;
    const ac = kidAudioContext();
    if (!ac) return null;
    const current = epoch;
    void ac.resume?.().catch(() => { if (current === epoch) silence(); });
    return ac;
  };
  const voice = (ac: AudioContext, type: OscillatorType, from: number, to: number | undefined, when: number, length: number, level: number) => {
    const source = ac.createOscillator();
    let gain: GainNode;
    try { gain = ac.createGain(); } catch (error) { source.disconnect(); throw error; }
    sources.set(source, gain);
    source.type = type;
    source.frequency.setValueAtTime(from, when);
    if (to) source.frequency.exponentialRampToValueAtTime(to, when + length * 0.7);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(level, when + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
    source.connect(gain); gain.connect(ac.destination);
    source.onended = () => release(source, gain);
    source.start(when); source.stop(when + length + 0.03);
  };
  const moveVoice = (ac: AudioContext, move: MoveId, when: number) => {
    const tone = TONES[move];
    voice(ac, tone.type, tone.from, tone.to, when, tone.length, tone.type === 'sawtooth' ? 0.05 : 0.1);
  };
  /** The band behind the hero: a soft drum on one and five, a tick between. */
  const bed = (ac: AudioContext, step: number, when: number) => {
    if (step % 4 === 0) voice(ac, 'sine', 130, 48, when, 0.2, 0.12);
    else voice(ac, 'square', 1760, undefined, when, 0.03, 0.012);
  };
  const tick = () => {
    const current = run; if (!current) return;
    // A context that never starts running (blocked autoplay, a failed resume)
    // must not freeze the dance: carry on by the wall clock, silently.
    if (context && now() - startMs - engine.elapsed() > 350) {
      const at = Math.max(0, engine.elapsed());
      context = null; silence(); startMs = now() - at;
    }
    const elapsed = engine.elapsed();
    const last = current.steps ?? Infinity;
    if (context) {
      try {
        while (nextSound < last && nextSound * current.tempo < elapsed + LOOKAHEAD_MS) {
          const when = Math.max(context.currentTime, startAudio + nextSound * current.tempo / 1000);
          const step = nextSound % LOOP_STEPS;
          bed(context, step, when);
          const move = current.loop()[step];
          if (validMove(move) && !handPlayed.has(nextSound)) moveVoice(context, move, when);
          nextSound++;
        }
      } catch { context = null; silence(); }
    }
    // A stalled tab catches up to the present step; it never replays a burst.
    const due = Math.min(last - 1, Math.floor(elapsed / current.tempo));
    if (due >= nextStep) {
      nextStep = due + 1;
      const quiet = handPlayed.delete(due);
      current.onStep(due % LOOP_STEPS, due, quiet);
    }
    if (run === current && elapsed >= last * current.tempo) { stop(); current.onEnd?.(); }
  };
  const engine: BandEngine = {
    hit(move) {
      if (!validMove(move)) return false;
      try {
        const ac = gestureContext(); if (!ac) return false;
        moveVoice(ac, move, ac.currentTime); return true;
      } catch { silence(); return false; }
    },
    start(next) {
      stop();
      if (disposed || !validTempo(next.tempo)) return false;
      run = next; nextSound = 0; nextStep = 0;
      try { context = gestureContext(); } catch { context = null; }
      startMs = now(); startAudio = context ? context.currentTime + 0.03 : 0;
      timer = setInterval(tick, TICK_MS);
      tick();
      return !!context;
    },
    elapsed() {
      if (!run) return 0;
      return context ? (context.currentTime - startAudio) * 1000 : now() - startMs;
    },
    running: () => !!run,
    audible: () => !!run && !!context,
    played(absolute) { if (run && absolute >= nextStep) handPlayed.add(absolute); },
    stop,
    dispose() { if (disposed) return; disposed = true; stop(); unhush(); },
  };
  return engine;
}
