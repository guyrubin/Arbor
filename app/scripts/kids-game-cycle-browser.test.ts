import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { installGameCycleAudioProbe, verifyDefaultGameCycles } from './kids-game-cycle-browser.mjs';

type Probe = { sources: number; silentUnlocks: number; audibleSources: number; media: number; speech: number; captures: number };
type BufferLike = { length: number; numberOfChannels: number; sampleRate: number; getChannelData(channel: number): Float32Array };
type Source = { buffer: BufferLike | null; loop: boolean; start(): void };
let browser: {
  AudioBufferSourceNode: new () => Source;
  OscillatorNode: new () => { start(): void };
  HTMLMediaElement: new () => { play(): Promise<void> };
  SpeechSynthesis: new () => { speak(): void };
  gameCycleAudio: Probe;
  gameCycleAudioDetails: Record<string, unknown>[];
};

const buffer = (...channels: number[][]): BufferLike => ({
  length: channels[0].length, numberOfChannels: channels.length, sampleRate: 48_000,
  getChannelData: channel => Float32Array.from(channels[channel]),
});

beforeEach(() => {
  class ScheduledSource { start() {} }
  class BufferSource extends ScheduledSource {
    buffer: BufferLike | null = null;
    loop = false;
    // Exercise both wrappers as a platform implementation may delegate.
    start() { super.start(); }
  }
  class Oscillator extends ScheduledSource {}
  class Media { async play() {} }
  class Speech { speak() {} }
  browser = {
    AudioScheduledSourceNode: ScheduledSource, AudioBufferSourceNode: BufferSource,
    OscillatorNode: Oscillator, HTMLMediaElement: Media, SpeechSynthesis: Speech,
  } as unknown as typeof browser;
  vi.stubGlobal('window', browser);
  vi.stubGlobal('document', { querySelector: () => ({ getAttribute: () => 'ready' }) });
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn() } });
  installGameCycleAudioProbe();
});
afterEach(() => vi.unstubAllGlobals());

describe('complete game browser audio evidence', () => {
  it('records the exact silent iOS unlock once, including its one zero sample', () => {
    const source = new browser.AudioBufferSourceNode();
    source.buffer = buffer([0]); source.start();
    expect(browser.gameCycleAudio).toEqual({ sources: 1, silentUnlocks: 1, audibleSources: 0, media: 0, speech: 0, captures: 0 });
    expect(browser.gameCycleAudioDetails).toEqual([{
      kind: 'buffer', frames: 1, channels: 1, sampleRate: 48_000, loop: false, sample: 0, silentUnlock: true, phase: 'ready',
    }]);
  });

  it.each([
    ['nonzero sample', buffer([0.000001]), false],
    ['longer zero buffer', buffer([0, 0]), false],
    ['stereo zero buffer', buffer([0], [0]), false],
    ['looping zero buffer', buffer([0]), true],
    ['no decoded buffer', null, false],
  ] as const)('fails the zero-audible-source contract for a %s', (_name, decoded, loop) => {
    const source = new browser.AudioBufferSourceNode();
    source.buffer = decoded; source.loop = loop; source.start();
    expect(browser.gameCycleAudio.sources).toBe(1);
    expect(browser.gameCycleAudio.silentUnlocks).toBe(0);
    expect(browser.gameCycleAudio.audibleSources).toBe(1);
    expect(browser.gameCycleAudioDetails[0].silentUnlock).toBe(false);
  });

  it('does not exempt an oscillator or an unreadable one-frame buffer', () => {
    new browser.OscillatorNode().start();
    const source = new browser.AudioBufferSourceNode();
    source.buffer = { ...buffer([0]), getChannelData: () => { throw new Error('unreadable'); } };
    source.start();
    expect(browser.gameCycleAudio).toMatchObject({ sources: 2, silentUnlocks: 0, audibleSources: 2 });
    expect(browser.gameCycleAudioDetails[0].kind).toBe('oscillator');
  });

  it('still records media, speech and forbidden capture independently', async () => {
    await new browser.HTMLMediaElement().play();
    new browser.SpeechSynthesis().speak();
    await expect(navigator.mediaDevices.getUserMedia({ audio: true })).rejects.toThrow('No capture');
    expect(browser.gameCycleAudio).toMatchObject({ media: 1, speech: 1, captures: 1, silentUnlocks: 0 });
  });
});

it('retains every release cell and fails strictly after the whole matrix is attempted', async () => {
  const output = await mkdtemp(path.join(tmpdir(), 'arbor-game-cycle-gate-'));
  const close = vi.fn(async () => {});
  const page = {
    setDefaultTimeout: () => {}, on: () => {}, screenshot: async () => {}, evaluate: async () => null,
    clock: { install: async () => { throw new Error('Synthetic loading failure'); } },
  };
  const harnessBrowser = { newContext: vi.fn(async () => ({
    route: async () => {}, addInitScript: async () => {}, newPage: async () => page, close,
  })) };
  try {
    const run = verifyDefaultGameCycles({ browser: harnessBrowser, base: 'http://synthetic.invalid', output });
    await expect(run).rejects.toBeInstanceOf(AggregateError);
    const summary = JSON.parse(await readFile(path.join(output, 'game-cycles/summary.json'), 'utf8'));
    expect(summary).toMatchObject({ expectedCells: 20, completedCells: 20, passedCells: 0, failedCells: 20 });
    expect(summary.results).toHaveLength(20);
    expect(new Set(summary.results.map((row: { game: string; viewport: string }) => `${row.game}:${row.viewport}`)).size).toBe(20);
    expect(summary.results.every((row: { passed: boolean; error: string }) => !row.passed && row.error.includes('Synthetic loading failure'))).toBe(true);
    expect(harnessBrowser.newContext).toHaveBeenCalledTimes(20);
    expect(close).toHaveBeenCalledTimes(20);
  } finally { await rm(output, { recursive: true, force: true }); }
});
