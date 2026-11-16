import { kidAudioAllowed, kidAudioContext, onKidHush } from '../../../../audio/kidAudio';

export type CrankChime = 'earned' | 'aha' | 'open' | 'shut' | 'swap' | 'finish';
export type CrankToy = 'boing' | 'peek' | 'woof' | 'giggle' | 'pod' | 'ink' | 'knock';
export interface CrankSound {
  /** A soft mechanical tick at top dead centre; pace (0..1) lifts the pitch. */
  tick(pace: number): boolean;
  /** The lower answer at bottom dead centre: tick, tock. */
  tock(pace: number): boolean;
  /** A little bell: the flower opening at the top of its stroke. */
  bell(): boolean;
  /** One soft stop of a hand-turned wheel, as a step of the stroke (0 bottom … 4 top). */
  step(degree: number): boolean;
  /** One note of the scale (a part chosen, a control pressed). */
  note(degree: number): boolean;
  /** A short authored phrase for a moment that matters. */
  chime(kind: CrankChime): boolean;
  /** The sound a toy in the scene makes when it is tapped. */
  toy(kind: CrankToy): boolean;
  stop(): void;
  dispose(): void;
}

/* Everything is drawn from one scale, C major pentatonic, so sounds that
   overlap are consonant. Degree 0 is C4; five degrees to the octave. */
const SCALE = [0, 2, 4, 7, 9];
const C4 = 261.63;
export function degreeHz(degree: number): number {
  const d = Math.round(degree), octave = Math.floor(d / SCALE.length), semitone = SCALE[d - octave * SCALE.length] + 12 * octave;
  return C4 * 2 ** (semitone / 12);
}
/** Partials of a small bell: a fundamental and three inharmonic overtones. */
const BELL: readonly { ratio: number; level: number; length: number }[] = [
  { ratio: 1, level: 0.05, length: 1.2 },
  { ratio: 2.32, level: 0.022, length: 0.8 },
  { ratio: 3.76, level: 0.013, length: 0.5 },
  { ratio: 5.4, level: 0.007, length: 0.28 },
];
/** Sounds of one kind closer together than this merge into one (a fast fling). */
const MIN_GAP = 0.07;
/** Never more voices than this at once: a fling cannot pile sound up. */
const MAX_VOICES = 18;
/** Repeats never sound identical: a few cents either way, in a fixed round. */
const DRIFT = [1, 1.004, 0.997, 1.002, 0.995, 1.006, 0.999];
const PHRASES: Readonly<Record<CrankChime, readonly { degree: number; at: number; length: number; level: number }[]>> = {
  earned: [{ degree: 7, at: 0, length: 0.32, level: 0.04 }, { degree: 9, at: 0.1, length: 0.5, level: 0.045 }],
  aha: [{ degree: 5, at: 0, length: 0.5, level: 0.04 }, { degree: 7, at: 0.14, length: 0.5, level: 0.04 }, { degree: 8, at: 0.28, length: 0.5, level: 0.04 }, { degree: 10, at: 0.42, length: 0.9, level: 0.045 }, { degree: 8, at: 0.74, length: 0.5, level: 0.03 }, { degree: 10, at: 0.9, length: 1, level: 0.035 }],
  open: [{ degree: 5, at: 0, length: 0.3, level: 0.035 }, { degree: 8, at: 0.09, length: 0.3, level: 0.035 }, { degree: 10, at: 0.18, length: 0.55, level: 0.04 }],
  shut: [{ degree: 10, at: 0, length: 0.25, level: 0.03 }, { degree: 8, at: 0.08, length: 0.25, level: 0.03 }, { degree: 5, at: 0.16, length: 0.45, level: 0.035 }],
  swap: [{ degree: 3, at: 0, length: 0.16, level: 0.04 }, { degree: 7, at: 0.07, length: 0.36, level: 0.035 }],
  finish: [{ degree: 5, at: 0, length: 0.5, level: 0.04 }, { degree: 7, at: 0.16, length: 0.5, level: 0.04 }, { degree: 8, at: 0.32, length: 0.5, level: 0.04 }, { degree: 10, at: 0.48, length: 0.6, level: 0.04 }, { degree: 12, at: 0.64, length: 0.7, level: 0.04 }, { degree: 10, at: 1.1, length: 1.4, level: 0.03 }, { degree: 12, at: 1.1, length: 1.4, level: 0.03 }, { degree: 15, at: 1.1, length: 1.6, level: 0.032 }],
};

/** Local synthesis on Arbor's one kid audio bus: the child's Sound switch,
 * the hidden-tab hush and leaving Kid Mode all silence it. No network, no
 * file, no looping bed, and the machine never waits for a sound. Peaks stay
 * modest: no voice is louder than 0.07, and attacks are never instant. */
export function createCrankSound(): CrankSound {
  const sources = new Map<OscillatorNode, GainNode>();
  const last: Record<string, number> = {};
  let disposed = false, epoch = 0, round = 0;
  const release = (source: OscillatorNode, gain: GainNode) => {
    sources.delete(source);
    try { source.disconnect(); } catch { /* Already released. */ }
    try { gain.disconnect(); } catch { /* Already released. */ }
  };
  const stop = () => {
    epoch++;
    for (const [source, gain] of sources) {
      try { source.stop(); } catch { /* An ended source must still disconnect. */ }
      release(source, gain);
    }
  };
  const unhush = onKidHush(stop);
  const context = () => {
    if (disposed || !kidAudioAllowed()) return null;
    const ac = kidAudioContext();
    if (!ac) return null;
    const current = epoch;
    void ac.resume?.().catch(() => { if (current === epoch) stop(); });
    return ac;
  };
  const drift = () => DRIFT[round++ % DRIFT.length];
  const voice = (ac: AudioContext, type: OscillatorType, from: number, to: number | null, when: number, length: number, level: number, attack = 0.006) => {
    if (sources.size >= MAX_VOICES) return;
    const source = ac.createOscillator();
    let gain: GainNode;
    try { gain = ac.createGain(); } catch (error) { source.disconnect(); throw error; }
    sources.set(source, gain);
    source.type = type;
    source.frequency.setValueAtTime(from, when);
    if (to) source.frequency.exponentialRampToValueAtTime(to, when + length * 0.8);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.min(0.07, level), when + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
    source.connect(gain); gain.connect(ac.destination);
    source.onended = () => release(source, gain);
    source.start(when); source.stop(when + length + 0.02);
  };
  /** Run a sound unless one of its kind has only just played. */
  const play = (kind: string, gap: number, make: (ac: AudioContext, when: number) => void): boolean => {
    try {
      const ac = context(); if (!ac) return false;
      const when = ac.currentTime;
      if (kind in last && when - last[kind] < gap) return true;
      last[kind] = when;
      make(ac, when);
      return true;
    } catch { stop(); return false; }
  };
  const pace01 = (pace: number) => Math.max(0, Math.min(1, Number.isFinite(pace) ? pace : 0));
  return {
    tick(pace) {
      return play('tick', MIN_GAP, (ac, when) => {
        // A wooden "tock" (G3 … C4, by speed) under a small bright click an octave and more above.
        const p = pace01(pace), base = degreeHz(-2 + Math.round(p * 2)) * drift();
        voice(ac, 'sine', base, base * 0.62, when, 0.08, 0.06);
        voice(ac, 'triangle', base * 8, base * 5, when, 0.035, 0.028, 0.004);
      });
    },
    tock(pace) {
      return play('tock', MIN_GAP, (ac, when) => {
        const p = pace01(pace), base = degreeHz(-5 + Math.round(p * 2)) * drift();
        voice(ac, 'sine', base, base * 0.6, when, 0.09, 0.05);
      });
    },
    bell() {
      return play('bell', MIN_GAP * 2, (ac, when) => {
        const root = degreeHz(10) * drift();
        for (const part of BELL) voice(ac, 'sine', root * part.ratio, null, when, part.length, part.level);
      });
    },
    step(degree) {
      return play('stepNote', 0.045, (ac, when) => {
        const hz = degreeHz(5 + degree) * drift();
        voice(ac, 'sine', hz, null, when, 0.16, 0.03, 0.008);
        voice(ac, 'triangle', hz * 3, hz * 2.4, when, 0.03, 0.01, 0.004);
      });
    },
    note(degree) {
      return play('plainNote', 0.03, (ac, when) => {
        const hz = degreeHz(5 + degree) * drift();
        voice(ac, 'sine', hz, null, when, 0.42, 0.045, 0.012);
        voice(ac, 'sine', hz * 2, null, when, 0.2, 0.012, 0.012);
      });
    },
    chime(kind) {
      return play(`chime-${kind}`, 0.3, (ac, when) => {
        for (const n of PHRASES[kind]) voice(ac, 'sine', degreeHz(n.degree), null, when + n.at, n.length, n.level, 0.014);
      });
    },
    toy(kind) {
      return play(`toy-${kind}`, 0.12, (ac, when) => {
        const d = drift();
        if (kind === 'boing') { voice(ac, 'sine', degreeHz(2) * d, degreeHz(7), when, 0.26, 0.05, 0.01); voice(ac, 'sine', degreeHz(7), degreeHz(5), when + 0.12, 0.3, 0.03, 0.02); }
        else if (kind === 'peek') { voice(ac, 'sine', degreeHz(8) * d, degreeHz(12), when, 0.16, 0.035, 0.01); voice(ac, 'sine', degreeHz(12), null, when + 0.1, 0.4, 0.03, 0.012); }
        else if (kind === 'woof') { voice(ac, 'triangle', 196 * d, 131, when, 0.16, 0.06, 0.012); voice(ac, 'sine', 392 * d, 262, when, 0.12, 0.025, 0.012); }
        else if (kind === 'giggle') { for (let i = 0; i < 3; i++) voice(ac, 'sine', degreeHz(10 + i * 2) * d, degreeHz(11 + i * 2), when + i * 0.08, 0.12, 0.03, 0.01); }
        else if (kind === 'pod') { voice(ac, 'sine', degreeHz(7), null, when, 0.14, 0.04, 0.008); voice(ac, 'sine', degreeHz(10), null, when + 0.12, 0.3, 0.04, 0.008); }
        else if (kind === 'ink') { voice(ac, 'sine', degreeHz(9) * d, degreeHz(5), when, 0.2, 0.04, 0.01); }
        else { voice(ac, 'sine', 174.6 * d, 110, when, 0.07, 0.05); voice(ac, 'sine', 164.8 * d, 104, when + 0.11, 0.07, 0.04); }
      });
    },
    stop,
    dispose() { if (disposed) return; disposed = true; stop(); unhush(); },
  };
}
