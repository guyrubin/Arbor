import { kidAudioAllowed, kidAudioContext, onKidHush } from '../../../../audio/kidAudio';

/** The Maker Desk's small sounds, synthesised on Arbor's one kid audio bus:
 * the child's Sound switch, the hidden-tab hush and leaving Kid Mode all
 * silence them. No files, no network. Sound is always an extra: play never
 * waits for a tone, and every call returns false when nothing sounded. */
export interface DeskAudio {
  /** A soft key click (terminal typing, desktop icons). */
  key(): boolean;
  /** The ball meets a wall or the paddle. */
  tok(high?: boolean): boolean;
  /** A lantern lights: each one a step higher on a pentatonic ladder. */
  chime(step: number): boolean;
  /** The ball sinks into the cloud and floats back. */
  boop(): boolean;
  /** The computer warms up. */
  power(): boolean;
  /** The terminal's `beep`. */
  beep(): boolean;
  /** The terminal does not know a word: one low, soft note. */
  hm(): boolean;
  /** All lanterns, or all three stickers. */
  fanfare(): boolean;
  /** The very quiet CRT hum, while the computer is on. */
  hum(on: boolean): void;
  stop(): void;
  dispose(): void;
}

/** G A C D E, climbing: fifteen lanterns, three octaves of one toy scale. */
const LADDER = [392, 440, 523.25, 587.33, 659.25];
export const chimeHz = (step: number) => LADDER[step % LADDER.length] * 2 ** Math.floor(step / LADDER.length) / 1.5;

export function createDeskAudio(): DeskAudio {
  const sources = new Map<AudioScheduledSourceNode, AudioNode[]>();
  let disposed = false, epoch = 0;
  let humNodes: { osc: OscillatorNode[]; gain: GainNode } | null = null;
  const release = (source: AudioScheduledSourceNode) => {
    for (const node of sources.get(source) ?? []) { try { node.disconnect(); } catch { /* Already released. */ } }
    try { source.disconnect(); } catch { /* Already released. */ }
    sources.delete(source);
  };
  const stopHum = () => {
    const nodes = humNodes; humNodes = null;
    if (!nodes) return;
    for (const osc of nodes.osc) { try { osc.stop(); } catch { /* Ended. */ } try { osc.disconnect(); } catch { /* Released. */ } }
    try { nodes.gain.disconnect(); } catch { /* Released. */ }
  };
  const stop = () => {
    epoch++;
    for (const source of [...sources.keys()]) { try { source.stop(); } catch { /* An ended source must still disconnect. */ } release(source); }
    stopHum();
  };
  const unhush = onKidHush(stop);
  const context = (): AudioContext | null => {
    if (disposed || !kidAudioAllowed()) return null;
    const ac = kidAudioContext(); if (!ac) return null;
    const current = epoch;
    void ac.resume?.().catch(() => { if (current === epoch) stop(); });
    return ac;
  };
  /** One enveloped oscillator note. */
  const note = (ac: AudioContext, type: OscillatorType, from: number, to: number | null, at: number, length: number, level: number) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    sources.set(osc, [gain]);
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, at + length * 0.8);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(level, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    osc.connect(gain); gain.connect(ac.destination);
    osc.onended = () => release(osc);
    osc.start(at); osc.stop(at + length + 0.03);
  };
  const play = (draw: (ac: AudioContext, now: number) => void) => {
    try { const ac = context(); if (!ac) return false; draw(ac, ac.currentTime); return true; } catch { stop(); return false; }
  };
  return {
    key: () => play((ac, t) => note(ac, 'triangle', 2400 + Math.random() * 300, 900, t, 0.03, 0.018)),
    tok: (high = false) => play((ac, t) => note(ac, 'triangle', high ? 660 : 520, high ? 520 : 400, t, 0.07, 0.07)),
    chime: step => play((ac, t) => {
      const hz = chimeHz(Math.max(0, Math.trunc(step)));
      note(ac, 'triangle', hz, null, t, 0.42, 0.08); note(ac, 'sine', hz * 2, null, t + 0.01, 0.3, 0.025);
    }),
    boop: () => play((ac, t) => { note(ac, 'sine', 330, 180, t, 0.22, 0.09); note(ac, 'sine', 260, 440, t + 0.22, 0.3, 0.07); }),
    power: () => play((ac, t) => { note(ac, 'sine', 140, 520, t, 0.5, 0.05); note(ac, 'triangle', 783.99, null, t + 0.42, 0.5, 0.06); note(ac, 'triangle', 1046.5, null, t + 0.56, 0.6, 0.05); }),
    beep: () => play((ac, t) => { note(ac, 'sawtooth', 880, null, t, 0.12, 0.03); note(ac, 'sawtooth', 660, null, t + 0.16, 0.14, 0.03); }),
    hm: () => play((ac, t) => note(ac, 'sine', 300, 240, t, 0.25, 0.05)),
    fanfare: () => play((ac, t) => { [523.25, 659.25, 783.99, 1046.5].forEach((hz, i) => note(ac, 'triangle', hz, null, t + i * 0.12, 0.38 + (i === 3 ? 0.4 : 0), 0.07)); }),
    hum(on) {
      if (!on) { stopHum(); return; }
      if (humNodes) return;
      try {
        const ac = context(); if (!ac) return;
        const gain = ac.createGain();
        gain.gain.setValueAtTime(0.0001, ac.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.004, ac.currentTime + 0.8);
        const osc = [60, 120.5].map(hz => { const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = hz; o.connect(gain); o.start(); return o; });
        gain.connect(ac.destination);
        humNodes = { osc, gain };
      } catch { stopHum(); }
    },
    stop,
    dispose() { if (disposed) return; disposed = true; stop(); unhush(); },
  };
}
