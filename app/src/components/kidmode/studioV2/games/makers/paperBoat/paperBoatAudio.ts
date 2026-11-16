import { kidAudioAllowed, kidAudioContext, kidSfx, onKidHush } from '../../../../audio/kidAudio';

/** The Paper Boat's sounds, synthesised on Arbor's one kid audio bus: the
 * child's Sound switch, the hidden-tab hush and leaving Kid Mode silence them.
 * No files, no network. Everything is soft (peak gain ≤ 0.08) and a game step
 * never waits for a sound. The rain is the only loop; it plays only while the
 * storm spread is open and stops with any hush. */
export interface BoatAudio {
  swish(): void;
  /** A wooden ratchet tick of the paper wheel. */
  tick(): void;
  lap(): void;
  /** A reed arch passed: two soft rising notes. */
  chime(step: number): void;
  bump(): void;
  gust(): void;
  rumble(): void;
  bell(): void;
  lamp(index: number): void;
  /** The rain's loudness, 0 … 1 (0 stops it). */
  rain(level: number): void;
  stopAll(): void;
  dispose(): void;
}

type Voice = { stop(): void };
const CHIME = [523.25, 587.33, 659.25, 783.99, 880];

export function createBoatAudio(): BoatAudio {
  const voices = new Set<Voice>();
  let disposed = false, noise: AudioBuffer | null = null;
  let rainVoice: { gain: GainNode; voice: Voice } | null = null;
  let lastTick = 0;

  const ready = (): AudioContext | null => {
    if (disposed || !kidAudioAllowed()) return null;
    const context = kidAudioContext(); if (!context) return null;
    void context.resume?.().catch(() => undefined);
    return context;
  };
  const noiseBuffer = (context: AudioContext) => {
    if (noise && noise.sampleRate === context.sampleRate) return noise;
    const length = Math.floor(context.sampleRate * 2);
    noise = context.createBuffer(1, length, context.sampleRate);
    const data = noise.getChannelData(0);
    // A fixed-seed generator, so the texture is the same every time.
    let seed = 7;
    for (let i = 0; i < length; i++) { seed = (seed * 16807) % 2147483647; data[i] = (seed / 2147483647) * 2 - 1; }
    return noise;
  };
  /** Keeps a node chain until it ends, so stopAll can silence it. */
  const keep = (sources: AudioScheduledSourceNode[], nodes: AudioNode[], until: number, context: AudioContext): Voice => {
    let done = false;
    const voice: Voice = {
      stop() {
        if (done) return; done = true; voices.delete(voice);
        for (const source of sources) { try { source.stop(); } catch { /* already stopped */ } }
        for (const node of [...sources, ...nodes]) { try { node.disconnect(); } catch { /* already released */ } }
      },
    };
    voices.add(voice);
    sources[0].onended = () => voice.stop();
    for (const source of sources) source.stop(until);
    void context;
    return voice;
  };
  const envelope = (context: AudioContext, peak: number, attack: number, length: number, at = context.currentTime) => {
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    return gain;
  };
  const tone = (context: AudioContext, type: OscillatorType, from: number, to: number | null, peak: number, length: number, delay = 0) => {
    const at = context.currentTime + delay;
    const source = context.createOscillator();
    source.type = type; source.frequency.setValueAtTime(from, at);
    if (to !== null) source.frequency.exponentialRampToValueAtTime(to, at + length);
    const gain = envelope(context, peak, 0.012, length, at);
    source.connect(gain); gain.connect(context.destination);
    source.start(at); keep([source], [gain], at + length + 0.03, context);
  };
  const hiss = (context: AudioContext, filter: BiquadFilterType, from: number, to: number, q: number, peak: number, attack: number, length: number) => {
    const at = context.currentTime;
    const source = context.createBufferSource(); source.buffer = noiseBuffer(context);
    const shape = context.createBiquadFilter(); shape.type = filter; shape.Q.value = q;
    shape.frequency.setValueAtTime(from, at); shape.frequency.exponentialRampToValueAtTime(to, at + length);
    const gain = envelope(context, peak, attack, length, at);
    source.connect(shape); shape.connect(gain); gain.connect(context.destination);
    source.start(at, Math.random() * 1.5); keep([source], [shape, gain], at + length + 0.03, context);
  };
  const safely = (run: (context: AudioContext) => void) => () => {
    const context = ready(); if (!context) return;
    try { run(context); } catch { /* sound is never load-bearing */ }
  };

  const stopAll = () => {
    for (const voice of [...voices]) voice.stop();
    rainVoice = null;
  };
  const unhush = onKidHush(stopAll);

  return {
    swish() { if (!disposed) kidSfx('pageTurn', 0.8); },
    tick: () => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now - lastTick < 45) return; lastTick = now;
      safely(context => { hiss(context, 'bandpass', 2600, 1800, 6, 0.06, 0.002, 0.03); tone(context, 'triangle', 950, 620, 0.035, 0.035); })();
    },
    lap: safely(context => { hiss(context, 'lowpass', 900, 260, 0.8, 0.05, 0.08, 0.55); }),
    chime(step) { safely(context => { const base = CHIME[Math.max(0, Math.min(CHIME.length - 2, step))]; tone(context, 'sine', base, null, 0.06, 0.28); tone(context, 'sine', CHIME[Math.min(CHIME.length - 1, step + 1)], null, 0.055, 0.42, 0.11); })(); },
    bump: safely(context => { tone(context, 'sine', 190, 120, 0.06, 0.24); hiss(context, 'lowpass', 500, 200, 0.7, 0.03, 0.01, 0.3); }),
    gust: safely(context => { hiss(context, 'bandpass', 380, 900, 0.9, 0.035, 0.35, 1.1); }),
    rumble: safely(context => { hiss(context, 'lowpass', 160, 70, 0.7, 0.05, 0.45, 1.8); tone(context, 'sine', 58, 46, 0.03, 1.6); }),
    bell: safely(context => {
      // A small harbour bell: a few inharmonic partials, a long soft decay.
      for (const [ratio, peak] of [[1, 0.06], [2.01, 0.03], [2.76, 0.022], [5.4, 0.01]] as const) tone(context, 'sine', 392 * ratio, null, peak, 2.4);
    }),
    lamp(index) { safely(context => { tone(context, 'sine', 1046.5 * (1 + index * 0.122), null, 0.03, 0.22); })(); },
    rain(level) {
      const amount = Math.max(0, Math.min(1, Number.isFinite(level) ? level : 0));
      if (amount <= 0.02) { rainVoice?.voice.stop(); rainVoice = null; return; }
      const context = ready(); if (!context) { rainVoice?.voice.stop(); rainVoice = null; return; }
      try {
        if (rainVoice) { rainVoice.gain.gain.setTargetAtTime(0.022 * amount, context.currentTime, 0.4); return; }
        const source = context.createBufferSource(); source.buffer = noiseBuffer(context); source.loop = true;
        const high = context.createBiquadFilter(); high.type = 'highpass'; high.frequency.value = 900;
        const soft = context.createBiquadFilter(); soft.type = 'lowpass'; soft.frequency.value = 5200;
        const gain = context.createGain(); gain.gain.setValueAtTime(0.0001, context.currentTime); gain.gain.setTargetAtTime(0.022 * amount, context.currentTime, 0.6);
        source.connect(high); high.connect(soft); soft.connect(gain); gain.connect(context.destination);
        source.start();
        let done = false;
        const voice: Voice = { stop() { if (done) return; done = true; voices.delete(voice); try { source.stop(); } catch { /* stopped */ } for (const node of [source, high, soft, gain]) { try { node.disconnect(); } catch { /* released */ } } } };
        voices.add(voice); rainVoice = { gain, voice };
      } catch { rainVoice = null; }
    },
    stopAll,
    dispose() { if (disposed) return; stopAll(); disposed = true; unhush(); },
  };
}
