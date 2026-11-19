import { describe, expect, it } from 'vitest';
import { iceAgeCycleSteps } from './kids-maker-cycle-browser.mjs';

const allSteps = ['frost', 'hello', 'trace', 'brush', 'feed', 'part', 'scout', 'walk', 'low'];
const withoutBrush = allSteps.filter(step => step !== 'brush');
const brushSample = { at: 13812, adventure: 'ice-age-friend', iafPhase: 'play', iafStep: 'brush' };

describe('Ice Age first-cycle DOM observations', () => {
  it('keeps the brush phase actually seen after input between native-clock loop reads', () => {
    // c7 phone HE saw brush at13812, then the pause at14812. The next loop
    // read alone missed it even though the original DOM trace retained it.
    const trace = [brushSample, { at: 14812, adventure: 'ice-age-friend', iafPhase: 'play', iafStep: '' }];
    expect(new Set(iceAgeCycleSteps(withoutBrush, trace))).toEqual(new Set(allSteps));
  });

  it('still rejects every genuinely unobserved required step', () => {
    for (const missing of allSteps) {
      expect(() => iceAgeCycleSteps(allSteps.filter(step => step !== missing), []))
        .toThrow(`Played mammoth ${missing}`);
    }
  });

  it('does not credit another game or an opening-state label as brush play', () => {
    for (const invalid of [
      { ...brushSample, adventure: 'another-game' },
      { ...brushSample, iafPhase: 'opening' },
      { ...brushSample, iafStep: '' },
    ]) expect(() => iceAgeCycleSteps(withoutBrush, [invalid])).toThrow('Played mammoth brush');
  });

  it('deduplicates repeated observations and preserves a fully observed sitting', () => {
    expect(iceAgeCycleSteps(allSteps, [])).toEqual(allSteps);
    expect(iceAgeCycleSteps(withoutBrush, [brushSample, brushSample])).toHaveLength(9);
  });
});
