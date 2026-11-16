import { kidAudioAllowed, kidAudioContext, onKidHush } from '../../../../audio/kidAudio';

/** Wind-up Racer sounds, synthesised on Arbor's one kid audio bus (the
 * child's Sound switch, hidden-tab hush and leaving Kid Mode silence it).
 * No files, no network. Sound is always an extra: play never waits on it. */
export interface RacerSound {
  /** One ratchet click; `tension` 0..1 raises its pitch. */
  tick(tension: number): void;
  /** The key will not turn further. */
  stop(): void;
  /** A soft knock (the pencil bump, the settle). */
  knock(level?: number): void;
  /** One domino clacks onto the next. */
  clack(index: number): void;
  /** A soft thump into wool, paper or the cushion. */
  thump(): void;
  /** The tin bell at the flag. */
  bell(): void;
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
    void ac.resume?.().catch(() => undefined);
    return ac;
  };
  const noiseBuffer = (ac: AudioContext) => {
    if (noise && noise.sampleRate === ac.sampleRate) return noise;
    const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.25), ac.sampleRate);
    const data = buffer.getChannelData(0);
    // A fixed pseudo-random hiss, so a click always sounds the same.
    let seed = 7;
    for (let i = 0; i < data.length; i++) { seed = (seed * 16807) % 2147483647; data[i] = seed / 1073741823.5 - 1; }
    noise = buffer; return buffer;
  };
  const tone = (ac: AudioContext, type: OscillatorType, from: number, to: number | null, length: number, level: number, when = ac.currentTime) => {
    const source = ac.createOscillator(), gain = ac.createGain();
    source.type = type;
    source.frequency.setValueAtTime(from, when);
    if (to) source.frequency.exponentialRampToValueAtTime(to, when + length * 0.8);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(level, when + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
    source.connect(gain); gain.connect(ac.destination);
    const voice = { source, nodes: [gain] }; voices.add(voice);
    source.onended = () => release(voice);
    source.start(when); source.stop(when + length + 0.02);
  };
  const hiss = (ac: AudioContext, centre: number, q: number, length: number, level: number, when = ac.currentTime) => {
    const source = ac.createBufferSource(), filter = ac.createBiquadFilter(), gain = ac.createGain();
    source.buffer = noiseBuffer(ac);
    filter.type = 'bandpass'; filter.frequency.value = centre; filter.Q.value = q;
    gain.gain.setValueAtTime(level, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
    source.connect(filter); filter.connect(gain); gain.connect(ac.destination);
    const voice = { source, nodes: [filter, gain] }; voices.add(voice);
    source.onended = () => release(voice);
    source.start(when); source.stop(when + length + 0.02);
  };
  const safely = (play: (ac: AudioContext) => void) => {
    try { const ac = context(); if (ac) play(ac); } catch { quiet(); }
  };

  return {
    tick(tension) {
      const t = Math.max(0, Math.min(1, Number.isFinite(tension) ? tension : 0));
      safely(ac => { hiss(ac, 2600 + 2400 * t, 6, 0.035, 0.22); tone(ac, 'triangle', 1400 + 900 * t, 900 + 600 * t, 0.05, 0.05); });
    },
    stop() { safely(ac => { tone(ac, 'sine', 220, 150, 0.12, 0.09); hiss(ac, 900, 3, 0.05, 0.08); }); },
    knock(level = 1) { safely(ac => { tone(ac, 'sine', 180, 90, 0.12, 0.12 * level); hiss(ac, 1200, 2, 0.04, 0.06 * level); }); },
    clack(index) {
      const lift = 1 + (Number.isFinite(index) ? index % 6 : 0) * 0.04;
      safely(ac => { tone(ac, 'triangle', 1050 * lift, 700 * lift, 0.06, 0.08); hiss(ac, 3000 * lift, 4, 0.03, 0.12); });
    },
    thump() { safely(ac => { tone(ac, 'sine', 140, 70, 0.18, 0.12); hiss(ac, 500, 1, 0.08, 0.05); }); },
    bell() {
      safely(ac => {
        const now = ac.currentTime;
        // A small tin bell: inharmonic partials, two strikes.
        for (const [at, scale] of [[0, 1], [0.16, 0.7]] as const) {
          tone(ac, 'sine', 1318.5, null, 1.3, 0.11 * scale, now + at);
          tone(ac, 'sine', 1318.5 * 2.76, null, 0.7, 0.04 * scale, now + at);
          tone(ac, 'sine', 1318.5 * 5.4, null, 0.35, 0.02 * scale, now + at);
        }
      });
    },
    whirr(speed, spring) {
      const sp = Math.max(0, Math.min(1, Number.isFinite(speed) ? speed : 0)), sg = Math.max(0, Math.min(1, Number.isFinite(spring) ? spring : 0));
      const level = Math.min(0.05, 0.012 + 0.05 * sp) * (sp > 0.02 ? 1 : 0);
      if (level <= 0) { stopMotor(); return; }
      try {
        const ac = context(); if (!ac) return;
        if (!motor) {
          const osc = ac.createOscillator(), buzz = ac.createOscillator(), filter = ac.createBiquadFilter(), gain = ac.createGain();
          osc.type = 'sawtooth'; buzz.type = 'sawtooth';
          filter.type = 'lowpass'; filter.Q.value = 3;
          gain.gain.value = 0.0001;
          osc.connect(filter); buzz.connect(filter); filter.connect(gain); gain.connect(ac.destination);
          osc.start(); buzz.start();
          motor = { osc, buzz, filter, gain };
        }
        const now = ac.currentTime;
        // The gears sing with the wheels; a wound spring adds a buzz on top.
        motor.osc.frequency.setTargetAtTime(70 + 260 * sp, now, 0.05);
        motor.buzz.frequency.setTargetAtTime(140 + 420 * sp + 120 * sg, now, 0.05);
        motor.filter.frequency.setTargetAtTime(500 + 1800 * sp, now, 0.05);
        motor.gain.gain.setTargetAtTime(level, now, 0.05);
      } catch { quiet(); }
    },
    quiet,
    dispose() { if (disposed) return; disposed = true; quiet(); unhush(); },
  };
}
