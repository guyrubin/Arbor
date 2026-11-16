import { kidAudioAllowed, kidAudioContext, onKidHush } from '../../../../audio/kidAudio';

/** The steppe's sounds, synthesised on Arbor's one kid audio bus (so the
 * child's Sound switch, a hidden tab and leaving Kid Mode silence them): wind
 * as filtered noise that follows the gusts, a soft rustle while the fur is
 * stroked, and one gentle trumpet call at the end. No files, no network.
 * Sound is always an extra: nothing in the game waits for it. */
export interface MammothSound {
  /** Starts the wind bed; call inside a gesture. False when sound is off or unavailable. */
  start(): boolean;
  /** Wind strength 0..1, followed smoothly. */
  wind(level: number): void;
  /** Stroke speed 0..1; the rustle fades by itself when strokes stop. */
  rustle(level: number): void;
  /** The mammoth's call. False = no sound was made. */
  trumpet(): boolean;
  stop(): void;
  dispose(): void;
}

export function createMammothSound(): MammothSound {
  let context: AudioContext | null = null;
  let windGain: GainNode | null = null, windFilter: BiquadFilterNode | null = null, rustleGain: GainNode | null = null;
  const nodes: AudioNode[] = [];
  const sources: AudioScheduledSourceNode[] = [];
  let disposed = false;

  const stop = () => {
    for (const source of sources.splice(0)) { try { source.stop(); } catch { /* already stopped */ } }
    for (const node of nodes.splice(0)) { try { node.disconnect(); } catch { /* already released */ } }
    windGain = null; windFilter = null; rustleGain = null; context = null;
  };
  const unhush = onKidHush(stop);
  const noise = (ac: AudioContext, seconds: number) => {
    const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate);
    const data = buffer.getChannelData(0);
    // Brownish noise: softer than white, closer to moving air.
    let last = 0;
    for (let i = 0; i < data.length; i++) { last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.02; data[i] = last * 3.2; }
    const source = ac.createBufferSource(); source.buffer = buffer; source.loop = true;
    return source;
  };
  const ready = () => {
    if (disposed || !kidAudioAllowed()) return null;
    const ac = kidAudioContext();
    if (!ac) return null;
    void ac.resume?.().catch(() => stop());
    return ac;
  };

  return {
    start() {
      if (context) return true;
      try {
        const ac = ready(); if (!ac) return false;
        context = ac;
        const now = ac.currentTime;
        const air = noise(ac, 3);
        windFilter = ac.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.setValueAtTime(420, now); windFilter.Q.setValueAtTime(0.6, now);
        const soften = ac.createBiquadFilter(); soften.type = 'lowpass'; soften.frequency.setValueAtTime(1300, now);
        windGain = ac.createGain(); windGain.gain.setValueAtTime(0.0001, now); windGain.gain.linearRampToValueAtTime(0.02, now + 1.2);
        air.connect(windFilter); windFilter.connect(soften); soften.connect(windGain); windGain.connect(ac.destination);
        const brush = noise(ac, 2);
        const high = ac.createBiquadFilter(); high.type = 'highpass'; high.frequency.setValueAtTime(1600, now);
        const band = ac.createBiquadFilter(); band.type = 'bandpass'; band.frequency.setValueAtTime(3400, now); band.Q.setValueAtTime(0.7, now);
        rustleGain = ac.createGain(); rustleGain.gain.setValueAtTime(0.0001, now);
        brush.connect(high); high.connect(band); band.connect(rustleGain); rustleGain.connect(ac.destination);
        air.start(now); brush.start(now, 0.7);
        sources.push(air, brush); nodes.push(air, windFilter, soften, windGain, brush, high, band, rustleGain);
        return true;
      } catch { stop(); return false; }
    },
    wind(level) {
      if (!context || !windGain || !windFilter) return;
      const now = context.currentTime, on = kidAudioAllowed();
      const k = Math.max(0, Math.min(1, level));
      windGain.gain.setTargetAtTime(on ? 0.008 + 0.034 * k : 0.0001, now, 0.4);
      windFilter.frequency.setTargetAtTime(320 + 620 * k, now, 0.5);
    },
    rustle(level) {
      if (!context || !rustleGain) return;
      const now = context.currentTime, on = kidAudioAllowed();
      const k = Math.max(0, Math.min(1, level));
      rustleGain.gain.cancelScheduledValues(now);
      rustleGain.gain.setTargetAtTime(on ? 0.05 * k : 0.0001, now, 0.03);
      rustleGain.gain.setTargetAtTime(0.0001, now + 0.12, 0.16);
    },
    trumpet() {
      try {
        const ac = ready(); if (!ac) return false;
        const now = ac.currentTime + 0.02, end = now + 1.9;
        const out = ac.createGain();
        out.gain.setValueAtTime(0.0001, now);
        out.gain.linearRampToValueAtTime(0.07, now + 0.16);
        out.gain.setValueAtTime(0.07, now + 1.25);
        out.gain.exponentialRampToValueAtTime(0.0001, end);
        // A warm, round brass: two detuned saws, gently filtered, with a slow vibrato.
        const tone = ac.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.setValueAtTime(700, now); tone.frequency.linearRampToValueAtTime(1500, now + 0.35); tone.frequency.linearRampToValueAtTime(1000, end); tone.Q.setValueAtTime(3, now);
        const vibrato = ac.createOscillator(); vibrato.frequency.setValueAtTime(5.2, now);
        const depth = ac.createGain(); depth.gain.setValueAtTime(0, now); depth.gain.linearRampToValueAtTime(7, now + 0.6);
        vibrato.connect(depth);
        const voices = [-7, 7].map(cents => {
          const osc = ac.createOscillator(); osc.type = 'sawtooth'; osc.detune.setValueAtTime(cents, now);
          osc.frequency.setValueAtTime(240, now);
          osc.frequency.exponentialRampToValueAtTime(430, now + 0.32);
          osc.frequency.exponentialRampToValueAtTime(400, now + 1.1);
          osc.frequency.exponentialRampToValueAtTime(330, end);
          depth.connect(osc.frequency); osc.connect(tone);
          return osc;
        });
        tone.connect(out); out.connect(ac.destination);
        for (const osc of [...voices, vibrato]) { osc.start(now); osc.stop(end + 0.05); sources.push(osc); }
        nodes.push(out, tone, vibrato, depth, ...voices);
        return true;
      } catch { return false; }
    },
    stop,
    dispose() { if (disposed) return; disposed = true; stop(); unhush(); },
  };
}
