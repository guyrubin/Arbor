/** Wobbly Delivery's voice files (B-GAME-38): every line the game can say has
 * a clip in both languages, a stitched request reads as the heading's own
 * sentence, and the files on disk are the lines the copy writes today. */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { KidSoundBank } from '../../../audio/kidSoundBank';
import type { Challenge } from './adventureRules';
import { WOBBLY_DELIVERY_COPY, requestLine } from './wobblyDeliveryCopy';
import { DELIVERY_FRIENDS, DELIVERY_ITEMS, DELIVERY_ROUNDS, leadsFor, requestLength, shelfFor, type DeliveryItem } from './wobblyDeliveryRules';
import { VOICE_GAP_MS, createWobblyVoice, requestClips, voiceLines, voicePlan } from './wobblyDeliveryVoice';

const LANGS = ['en', 'he'] as const;
const CHALLENGES: readonly Challenge[] = ['gentle', 'explore'];
const AUDIO = new URL('../../../../../../public/audio/kid/delivery/', import.meta.url);
const read = (name: string) => JSON.parse(readFileSync(new URL(name, AUDIO), 'utf8'));

/** Every order of `length` different things from `from`. */
function orders(length: number, from: readonly DeliveryItem[]): DeliveryItem[][] {
  return length === 0 ? [[]] : from.flatMap(item => orders(length - 1, from.filter(other => other !== item)).map(rest => [item, ...rest]));
}
/** Every request the game can make: each challenge, each round, any order on that round's shelf that starts with one of its leads. */
function everyRequest(): { round: number; request: DeliveryItem[] }[] {
  const all: { round: number; request: DeliveryItem[] }[] = [];
  for (const challenge of CHALLENGES) for (let round = 0; round < DELIVERY_ROUNDS; round++) {
    const leads = leadsFor(round);
    for (const request of orders(requestLength(challenge, round), shelfFor(challenge, round))) if (leads.includes(request[0])) all.push({ round, request });
  }
  return all;
}

describe.each(LANGS)('Wobbly Delivery voice lines (%s)', lang => {
  const w = WOBBLY_DELIVERY_COPY[lang], lines = voiceLines(w);

  it('stitches every request the game can make from clips that exist, into the heading sentence', () => {
    const requests = everyRequest();
    expect(requests.length).toBeGreaterThan(100);
    for (const { round, request } of requests) {
      const ids = requestClips(round, request);
      expect(ids).toHaveLength(request.length);
      for (const id of ids) expect(lines[id], id).toBeTruthy();
      expect(ids.map(id => lines[id]).join(' ')).toBe(requestLine(w, round, request));
    }
  });

  it('has a line for every other prompt the game speaks, word for word from the copy', () => {
    expect(lines).toMatchObject({ 'line-ready': w.ready, 'fetch-next': w.fetchNext, 'fetch-last': w.fetchLast, 'not-yet': w.notYet, 'good-asking': w.goodAsking });
    DELIVERY_FRIENDS.forEach((name, friend) => expect(lines[`fetch-first-${name}`]).toBe(w.fetchFirst[friend]));
    // 5 prompts, 3 first questions, a first part per friend and thing, a middle and a last part per thing.
    expect(Object.keys(lines)).toHaveLength(5 + 3 + 3 * DELIVERY_ITEMS.length + 2 * DELIVERY_ITEMS.length);
  });

  it('ships a clip with a length for every line, and no other', () => {
    const manifest = read('manifest.json');
    expect(manifest.ext).toBe('m4a');
    expect(Object.keys(manifest[lang]).sort()).toEqual(Object.keys(lines).sort());
    for (const [id, ms] of Object.entries(manifest[lang] as Record<string, number>)) {
      expect(ms, id).toBeGreaterThan(600); expect(ms, id).toBeLessThan(6000);
      const file = new URL(`${lang}/${id}.m4a`, AUDIO);
      expect(existsSync(file), id).toBe(true);
      expect(statSync(file).size, id).toBeGreaterThan(4000);
    }
  });

  it('was rendered from the copy as it reads today (re-render when a line changes)', () => {
    // scripts/render-delivery-voice.py writes lines.json beside the clips.
    expect(read('lines.json')[lang]).toEqual(lines);
  });
});

describe('Wobbly Delivery voice timing', () => {
  it('starts each part after the last one and a short gap', () => {
    const ms: Record<string, number> = { a: 1000, b: 500, c: 800 };
    expect(voicePlan(['a', 'b', 'c'], id => ms[id])).toEqual({ starts: [0, 1000 + VOICE_GAP_MS, 1500 + 2 * VOICE_GAP_MS], endMs: 2300 + 2 * VOICE_GAP_MS });
    expect(voicePlan(['a'], id => ms[id])).toEqual({ starts: [0], endMs: 1000 });
  });
  it('has no timing for nothing, or for a part without a length', () => {
    expect(voicePlan([], () => 1000)).toBeNull();
    expect(voicePlan(['a', 'x'], id => (id === 'a' ? 1000 : 0))).toBeNull();
    expect(voicePlan(['a'], () => Number.NaN)).toBeNull();
  });
});

describe('Wobbly Delivery voice player', () => {
  function fakeBank(lengths: Record<string, number>) {
    const bank = { load: vi.fn(async () => true), play: vi.fn<KidSoundBank['play']>(() => true), has: (id: string) => id in lengths, durationMs: (id: string) => lengths[id] ?? 0, unlock: vi.fn(), stopVoice: vi.fn(), dispose: vi.fn() };
    return bank as typeof bank & KidSoundBank;
  }
  function clock() {
    const due: { at: number; run: () => void }[] = [];
    return { later: (run: () => void, ms: number) => { due.push({ at: ms, run }); }, runAll: () => due.sort((x, y) => x.at - y.at).forEach(job => job.run()), due };
  }

  it('plays the parts in order: the first cuts what was speaking, the rest follow it', () => {
    const bank = fakeBank({ 'aya-item-can': 2000, 'then-item-lamp': 1200, 'last-item-disc': 1300 }), voice = createWobblyVoice('en', bank), time = clock();
    const plan = voice.speak(['aya-item-can', 'then-item-lamp', 'last-item-disc'], time.later, () => true);
    expect(plan).toEqual({ starts: [0, 2000 + VOICE_GAP_MS, 3200 + 2 * VOICE_GAP_MS], endMs: 4500 + 2 * VOICE_GAP_MS });
    expect(time.due.map(job => job.at)).toEqual(plan!.starts);
    time.runAll();
    expect(bank.play.mock.calls).toEqual([
      ['aya-item-can', { kind: 'voice', mode: 'cut' }], ['then-item-lamp', { kind: 'voice', mode: 'queue' }], ['last-item-disc', { kind: 'voice', mode: 'queue' }]]);
  });

  it('says nothing, and plans nothing, when a part is missing', () => {
    const bank = fakeBank({ 'aya-item-can': 2000 }), voice = createWobblyVoice('he', bank), time = clock();
    expect(voice.covers(['aya-item-can'])).toBe(true);
    expect(voice.covers(['aya-item-can', 'last-item-lamp'])).toBe(false);
    expect(voice.covers([])).toBe(false);
    expect(voice.speak(['aya-item-can', 'last-item-lamp'], time.later, () => true)).toBeNull();
    expect(time.due).toHaveLength(0); expect(bank.play).not.toHaveBeenCalled();
  });

  it('checks the sound is still allowed before each part', () => {
    const bank = fakeBank({ 'pep-item-can': 2000, 'last-item-lamp': 1200 }), voice = createWobblyVoice('en', bank), time = clock();
    let allowed = true;
    voice.speak(['pep-item-can', 'last-item-lamp'], time.later, () => allowed);
    time.due[0].run(); allowed = false; time.due[1].run();
    expect(bank.play.mock.calls.map(call => call[0])).toEqual(['pep-item-can']);
  });

  it('passes load, unlock, stop and dispose to the bank', async () => {
    const bank = fakeBank({}), voice = createWobblyVoice('en', bank);
    await expect(voice.load()).resolves.toBe(true);
    voice.unlock(); voice.stop(); voice.dispose();
    expect(bank.unlock).toHaveBeenCalledTimes(1); expect(bank.stopVoice).toHaveBeenCalledTimes(1); expect(bank.dispose).toHaveBeenCalledTimes(1);
  });
});
