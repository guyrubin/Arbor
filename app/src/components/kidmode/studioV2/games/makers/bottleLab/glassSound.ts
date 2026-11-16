import { createPlaySound, playNote, type PlayAmbience } from '../play';
import { createBottleAudio } from './bottleAudio';

/** The glassworks' sound: the makers' shared synth (one key for the whole
 * activity, D, so every overlap is consonant) for touches, picks, places,
 * chapter ends, the set-piece and the room's quiet bed, plus Bottle Lab's own
 * glass voices (a ring with its inharmonic partials, a pour, vinyl, fizz) on
 * the same notes. Everything goes through the kid audio seams (the child's
 * Sound switch, the hush, the hidden tab) and is silent until a gesture. */
export interface GlassSound {
  /** A tapped glass: `step` of the D pentatonic scale. */
  ring(step: number, strength?: number): void;
  /** The soft glass crossing into another shape while it is pulled. */
  stretch(step: number): void;
  /** The glass settling on a shape: its note and the fifth above. */
  settle(step: number): void;
  pick(): void;
  /** A thing put where it belongs; `chain` climbs through a run of them. */
  place(chain?: number): void;
  /** The soft return of a thing that was let go nowhere. */
  back(): void;
  /** Colour climbing the glass: `part` 0..4. */
  soak(part: number): void;
  /** A rub on the glass. */
  rub(): void;
  /** The finish changed: frost crackles down the scale, polish rings up it. */
  finish(frost: boolean): void;
  stick(count: number): void;
  peel(): void;
  /** The bottle clicking past an eighth of a turn. */
  turn(step: number): void;
  hop(): void;
  arch(index: number): void;
  secret(): void;
  chapter(): void;
  pour(): void;
  fizz(): void;
  setPiece(): void;
  /** The light swung to a new place in the finale. */
  light(step: number): void;
  ambience(kind: PlayAmbience): void;
  stop(): void;
  dispose(): void;
}

export function createGlassSound(): GlassSound {
  const play = createPlaySound({ key: 'D' }), glass = createBottleAudio();
  const hz = (step: number) => playNote('D', step);
  return {
    ring(step, strength = 1) { glass.play('ring', hz(step), strength); },
    stretch(step) { play.note(step, { gain: 0.03, length: 0.22, attack: 0.02 }); },
    settle(step) { glass.play('ring', hz(step), 0.85); play.note(step + 3, { gain: 0.026, length: 0.6, attack: 0.02, at: 0.09 }); play.note(step + 5, { gain: 0.02, length: 0.7, attack: 0.02, at: 0.18 }); },
    pick() { play.pick(); },
    place(chain) { play.place(chain); },
    back() { play.back(); },
    soak(part) { play.note(5 + part * 2, { gain: 0.034, length: 0.5, attack: 0.03 }); if (part === 0) play.breath({ tone: 1800, gain: 0.016, length: 0.9 }); },
    rub() { play.breath({ tone: 3400, gain: 0.014, length: 0.11 }); },
    finish(frost) { (frost ? [14, 12, 10, 9] : [9, 10, 12, 14]).forEach((step, i) => play.note(step, { gain: 0.03, length: 0.32, attack: 0.012, at: i * 0.06 })); play.breath({ tone: frost ? 5200 : 2600, gain: 0.014, length: 0.4 }); },
    stick(count) { glass.play('thup'); play.place(count); },
    peel() { glass.play('peel'); },
    turn(step) { glass.play('tick', hz(8 + ((step % 5) + 5) % 5)); },
    hop() { glass.play('hop', hz(10)); },
    arch(index) { play.note(index, { gain: 0.04, length: 0.9, attack: 0.02 }); play.note(index + 5, { gain: 0.012, length: 0.5, attack: 0.02 }); },
    secret() { [5, 7, 9, 10, 12, 14, 15, 17].forEach((step, i) => play.note(step, { gain: 0.028, length: 0.8, attack: 0.02, at: i * 0.09 })); },
    chapter() { play.chapter(); },
    pour() { glass.play('pour', hz(4)); },
    fizz() { glass.play('fizz', hz(12), 0.7); },
    setPiece() { play.setPiece(); },
    light(step) { play.note(step, { gain: 0.022, length: 0.7, attack: 0.05 }); },
    ambience(kind) { play.ambience(kind); },
    stop() { play.stop(); glass.stop(); },
    dispose() { play.dispose(); glass.dispose(); },
  };
}
