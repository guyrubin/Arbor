import { kidAudioAllowed, kidAudioContext, onKidHush } from '../../../../audio/kidAudio';

/** Wind-up Racer sounds, synthesised on Arbor's one kid audio bus (the
 * child's Sound switch, hidden-tab hush and leaving Kid Mode silence it).
 * No files, no network. Sound is always an extra: play never waits on it.
 *
 * One scale for the whole toy box: D major pentatonic (D E F♯ A B). Every
 * pitched sound (the ratchet's climb, the dominoes' run, the books, the bell,
 * the horn, the spring stars) takes its note from it, so sounds that overlap
 * are consonant. Attacks are soft (6 ms and up), every voice peaks well under
 * a tenth of full scale, and the one sustained sound (the gear whirr) stays
 * under four hundredths. A few cents of drift on each note keep repeats from
 * sounding stamped out. */

/** Semitones above D for the five notes of the scale. */
export const RACER_SCALE = [0, 2, 4, 7, 9] as const;
const D4 = 293.665;
/** The pitch of scale step `step` (0 = D4, 5 = D5, …; negative steps go down). */
export function noteHz(step: number): number {
  const n = Number.isFinite(step) ? Math.round(step) : 0;
  const octave = Math.floor(n / RACER_SCALE.length), degree = n - octave * RACER_SCALE.length;
  return D4 * 2 ** (octave + RACER_SCALE[degree] / 12);
}
/** The ratchet's note for click number `click` (1..12): one step up each click. */
export const clickStep = (click: number) => Math.max(0, Math.min(11, Math.round(click) - 1));
/** The horn's two notes: a fourth or a fifth inside the scale, three voicings. */
export const HORN_VOICINGS: readonly (readonly [number, number])[] = [[3, 5], [4, 6], [2, 4]];

export interface RacerSound {
  /** A fine ratchet tooth while the key is being turned (unpitched, tiny). */
  tooth(): void;
  /** One full click of the key: `click` 1..12 climbs the scale. */
  tick(click: number): void;
  /** The key will not turn further. */
  stop(): void;
  /** The held breath before the car lets go. */
  crouch(): void;
  /** The spring lets go. */
  sproing(): void;
  /** A soft knock (the pencil bump, the settle). */
  knock(level?: number): void;
  /** Domino `index` clacks onto the next: the row plays a rising run. */
  clack(index: number): void;
  /** A soft thump into wool, paper or the cushion. */
  thump(): void;
  /** The tin bell at the flag. */
  bell(): void;
  /** The toy horn; `echo` repeats it down the paper tunnel. */
  horn(echo?: boolean): void;
  /** A book tapped like a bar of a xylophone. */
  plink(step: number): void;
  /** The alarm clock's little bell. */
  ring(): void;
  /** Marbles in the jar. */
  rattle(): void;
  /** Leaves, paper, wool. */
  rustle(): void;
  /** A coiled spring pops up. */
  boing(step: number): void;
  /** The paper mouse. */
  squeak(): void;
  /** Chalk on the table. */
  chalk(): void;
  /** The finish: the bell plays up the scale. */
  fanfare(): void;
  /** The gear whirr while the car runs: speed and spring are 0..1. */
  whirr(speed: number, spring: number): void;
  quiet(): void;
  dispose(): void;
}

type Voice = { source: AudioScheduledSourceNode; nodes: AudioNode[] };

export function createRacerSound(): RacerSound {
  const voices = new Set<Voice>();
  let disposed = false;
  let motor: { osc: OscillatorNode; buzz: OscillatorNode; filter: BiquadFilterNode; gain: GainNode } | null = null;
  let noise: AudioBuffer | null = null;
  let lastTooth = -1, lastHorn = -1, hornTurn = 0;

  const release = (voice: Voice) => {
    voices.delete(voice);
    for (const node of [voice.source, ...voice.nodes]) { try { node.disconnect(); } catch { /* released */ } }
  };
  const stopMotor = () => {
    const live = motor; motor = null;
    if (!live) return;
    try {
      const ac = live.gain.context as AudioContext, now = ac.currentTime;
      live.gain.gain.cancelScheduledValues(now);
      live.gain.gain.setTargetAtTime(0.0001, now, 0.03);
      live.osc.stop(now + 0.15); live.buzz.stop(now + 0.15);
    } catch { /* already stopped */ }
    setTimeout(() => { for (const node of [live.osc, live.buzz, live.filter, live.gain]) { try { node.disconnect(); } catch { /* released */ } } }, 250);
  };
  const quiet = () => {
    stopMotor();
    for (const voice of [...voices]) { try { voice.source.stop(); } catch { /* ended */ } release(voice); }
  };
  const unhush = onKidHush(quiet);
  const context = (): AudioContext | null => {
    if (disposed || !kidAudioAllowed()) { if (motor) stopMotor(); return null; }
    const ac = kidAudioContext(); if (!ac) return null;
    void ac.resume?.()?.catch?.(() => undefined);
    return ac;
  };
  const noiseBuffer = (ac: AudioContext) => {
    if (noise && noise.sampleRate === ac.sampleRate) return noise;
    const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.4), ac.sampleRate);
    const data = buffer.getChannelData(0);
    // A fixed pseudo-random hiss (no Math.random in the buffer: one grain for every click).
    let seed = 7;
    for (let i = 0; i < data.length; i++) { seed = (seed * 16807) % 2147483647; data[i] = seed / 1073741823.5 - 1; }
    noise = buffer; return buffer;
  };
  /** A few cents either way, so a repeated note is never the identical note. */
  const drift = () => 2 ** ((Math.random() - 0.5) * 14 / 1200);
  /** One enveloped oscillator. `attack` is never shorter than 6 ms. */
  const tone = (ac: AudioContext, type: OscillatorType, from: number, to: number | null, length: number, level: number, when = ac.currentTime, attack = 0.006) => {
    const source = ac.createOscillator(), gain = ac.createGain();
    source.type = type;
    source.frequency.setValueAtTime(from, when);
    if (to) source.frequency.exponentialRampToValueAtTime(to, when + length * 0.8);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), when + Math.max(0.006, attack));
    gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
    source.connect(gain); gain.connect(ac.destination);
    const voice = { source, nodes: [gain] }; voices.add(voice);
    source.onended = () => release(voice);
    source.start(when); source.stop(when + length + 0.02);
    return source;
  };
  const hiss = (ac: AudioContext, centre: number, q: number, length: number, level: number, when = ac.currentTime, sweepTo: number | null = null) => {
    const source = ac.createBufferSource(), filter = ac.createBiquadFilter(), gain = ac.createGain();
    source.buffer = noiseBuffer(ac);
    filter.type = 'bandpass'; filter.frequency.setValueAtTime(centre, when); filter.Q.value = q;
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, when + length);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), when + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
    source.connect(filter); filter.connect(gain); gain.connect(ac.destination);
    const voice = { source, nodes: [filter, gain] }; voices.add(voice);
    source.onended = () => release(voice);
    source.start(when); source.stop(when + length + 0.02);
  };
  /** A struck tin bell: the note, and two quiet inharmonic partials above it. */
  const strike = (ac: AudioContext, hz: number, level: number, when: number, length = 1.1) => {
    tone(ac, 'sine', hz, null, length, level, when);
    tone(ac, 'sine', hz * 2.76, null, length * 0.5, level * 0.3, when);
    tone(ac, 'sine', hz * 5.4, null, length * 0.25, level * 0.14, when);
  };
  const safely = (play: (ac: AudioContext) => void) => {
    try { const ac = context(); if (ac) play(ac); } catch { quiet(); }
  };

  return {
    tooth() {
      safely(ac => {
        if (ac.currentTime - lastTooth < 0.028) return;
        lastTooth = ac.currentTime;
        hiss(ac, 3400, 7, 0.022, 0.05);
      });
    },
    tick(click) {
      const step = clickStep(Number.isFinite(click) ? click : 1), hz = noteHz(step) * drift();
      // The pawl's click, then the note the tightening spring sings: one step up each click.
      safely(ac => { hiss(ac, 2400 + 180 * step, 6, 0.035, 0.15); tone(ac, 'triangle', hz, null, 0.11, 0.06); tone(ac, 'sine', hz * 2, null, 0.07, 0.018); });
    },
    stop() { safely(ac => { tone(ac, 'sine', noteHz(-5), noteHz(-7), 0.14, 0.08); hiss(ac, 900, 3, 0.05, 0.06); }); },
    crouch() { safely(ac => { hiss(ac, 420, 1.2, 0.36, 0.04, ac.currentTime, 1500); tone(ac, 'sine', noteHz(-2), noteHz(0), 0.34, 0.03, ac.currentTime, 0.12); }); },
    sproing() { safely(ac => { tone(ac, 'triangle', noteHz(8), noteHz(0), 0.2, 0.06); hiss(ac, 1800, 1.5, 0.09, 0.07); }); },
    knock(level = 1) {
      const l = Math.max(0, Math.min(1, Number.isFinite(level) ? level : 1));
      safely(ac => { tone(ac, 'sine', noteHz(-5), noteHz(-7), 0.12, 0.1 * l); hiss(ac, 1200, 2, 0.04, 0.05 * l); });
    },
    clack(index) {
      const i = Number.isFinite(index) ? Math.max(0, Math.round(index)) % 8 : 0, hz = noteHz(5 + i) * drift();
      safely(ac => { tone(ac, 'triangle', hz, hz * 0.94, 0.07, 0.07); hiss(ac, 2800, 4, 0.03, 0.09); });
    },
    thump() { safely(ac => { tone(ac, 'sine', noteHz(-7), noteHz(-10), 0.18, 0.1); hiss(ac, 500, 1, 0.08, 0.04); }); },
    bell() {
      safely(ac => {
        const now = ac.currentTime;
        // Ding-ding: a rising fourth, the second strike softer.
        strike(ac, noteHz(8) * drift(), 0.09, now); strike(ac, noteHz(10) * drift(), 0.065, now + 0.17);
      });
    },
    horn(echo = false) {
      safely(ac => {
        const now = ac.currentTime;
        if (now - lastHorn < 0.12) return;
        lastHorn = now;
        const [low, high] = HORN_VOICINGS[hornTurn++ % HORN_VOICINGS.length], bend = drift();
        // A rubber-bulb toot: two reedy notes through a low-pass, swelling in over 14 ms.
        const toot = (when: number, level: number, length: number) => {
          for (const step of [low, high]) {
            const source = ac.createOscillator(), filter = ac.createBiquadFilter(), gain = ac.createGain(), hz = noteHz(step) * bend;
            source.type = 'sawtooth';
            source.frequency.setValueAtTime(hz * 0.97, when); source.frequency.exponentialRampToValueAtTime(hz, when + 0.04);
            filter.type = 'lowpass'; filter.frequency.value = 1500; filter.Q.value = 1.2;
            gain.gain.setValueAtTime(0.0001, when);
            gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), when + 0.014);
            gain.gain.setValueAtTime(Math.max(0.0002, level), when + length * 0.6);
            gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
            source.connect(filter); filter.connect(gain); gain.connect(ac.destination);
            const voice = { source, nodes: [filter, gain] }; voices.add(voice);
            source.onended = () => release(voice);
            source.start(when); source.stop(when + length + 0.02);
          }
        };
        toot(now, 0.04, 0.17);
        if (echo) for (let k = 1; k <= 3; k++) toot(now + k * 0.21, 0.04 * 0.45 ** k, 0.15);
      });
    },
    plink(step) {
      const hz = noteHz(Number.isFinite(step) ? step : 0) * drift();
      safely(ac => { tone(ac, 'sine', hz, null, 0.42, 0.075); tone(ac, 'triangle', hz * 3, null, 0.09, 0.02); hiss(ac, 1500, 2, 0.02, 0.03); });
    },
    ring() {
      safely(ac => {
        const now = ac.currentTime;
        for (let i = 0; i < 9; i++) tone(ac, 'sine', noteHz(i % 2 ? 12 : 10) * 2, null, 0.09, 0.03, now + i * 0.062);
      });
    },
    rattle() {
      safely(ac => {
        const now = ac.currentTime;
        for (let i = 0; i < 4; i++) { const at = now + i * 0.045 + Math.random() * 0.03; tone(ac, 'sine', noteHz(12 + Math.floor(Math.random() * 5)), null, 0.07, 0.028, at); hiss(ac, 4200, 5, 0.018, 0.02, at); }
      });
    },
    rustle() { safely(ac => { hiss(ac, 2200, 0.8, 0.2, 0.035, ac.currentTime, 3200); }); },
    boing(step) {
      const hz = noteHz(Number.isFinite(step) ? step : 5) * drift();
      safely(ac => {
        const now = ac.currentTime, source = tone(ac, 'sine', hz * 0.55, null, 0.5, 0.065, now, 0.01);
        // The coil overshoots its note and settles onto it.
        source.frequency.exponentialRampToValueAtTime(hz * 1.2, now + 0.09);
        source.frequency.exponentialRampToValueAtTime(hz * 0.94, now + 0.2);
        source.frequency.exponentialRampToValueAtTime(hz, now + 0.32);
      });
    },
    squeak() { safely(ac => { const now = ac.currentTime; tone(ac, 'sine', noteHz(13), noteHz(15), 0.09, 0.03, now, 0.012); tone(ac, 'sine', noteHz(14), noteHz(16), 0.08, 0.025, now + 0.13, 0.012); }); },
    chalk() { safely(ac => { hiss(ac, 1900, 1.4, 0.13, 0.03, ac.currentTime, 2600); }); },
    fanfare() {
      safely(ac => {
        const now = ac.currentTime;
        // D, F sharp, A, D: up the scale on the tin bell, then the top two notes together.
        [5, 7, 8, 10].forEach((step, i) => strike(ac, noteHz(step), 0.065, now + i * 0.13, 0.8));
        strike(ac, noteHz(10), 0.06, now + 0.62, 1.5); strike(ac, noteHz(13), 0.045, now + 0.62, 1.5);
        for (let i = 0; i < 5; i++) hiss(ac, 3400, 7, 0.022, 0.035, now + 0.62 + i * 0.05);
      });
    },
    whirr(speed, spring) {
      const sp = Math.max(0, Math.min(1, Number.isFinite(speed) ? speed : 0)), sg = Math.max(0, Math.min(1, Number.isFinite(spring) ? spring : 0));
      const level = sp > 0.02 ? Math.min(0.038, 0.01 + 0.04 * sp) : 0;
      if (level <= 0) { stopMotor(); return; }
      try {
        const ac = context(); if (!ac) return;
        if (!motor) {
          const osc = ac.createOscillator(), buzz = ac.createOscillator(), filter = ac.createBiquadFilter(), gain = ac.createGain();
          osc.type = 'sawtooth'; buzz.type = 'triangle';
          filter.type = 'lowpass'; filter.Q.value = 2;
          gain.gain.value = 0.0001;
          osc.connect(filter); buzz.connect(filter); filter.connect(gain); gain.connect(ac.destination);
          osc.start(); buzz.start();
          motor = { osc, buzz, filter, gain };
        }
        const now = ac.currentTime;
        // The gears sing with the wheels (D2 at a crawl, two octaves up flat out);
        // the buzz sits a fifth above while the spring still pushes.
        const hz = noteHz(-10) * 2 ** (2 * sp);
        motor.osc.frequency.setTargetAtTime(hz, now, 0.05);
        motor.buzz.frequency.setTargetAtTime(hz * (1.5 + 0.5 * sg), now, 0.05);
        motor.filter.frequency.setTargetAtTime(420 + 1500 * sp, now, 0.05);
        motor.gain.gain.setTargetAtTime(level, now, 0.06);
      } catch { quiet(); }
    },
    quiet,
    dispose() { if (disposed) return; disposed = true; quiet(); unhush(); },
  };
}
