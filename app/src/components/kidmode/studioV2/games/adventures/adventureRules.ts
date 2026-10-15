import { stageFor, type AgedChild } from '../../../../../lib/age/forChild';

export type Challenge = 'gentle' | 'explore';
export type NoteId = 0 | 1 | 2;
export function defaultChallenge(child: AgedChild | null | undefined): Challenge {
  return stageFor(child) === 'school' ? 'explore' : 'gentle';
}
export function shuffled<T>(items: readonly T[], random = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export interface RiverMap { size: number; start: number; dock: number; rocks: readonly number[]; parcels: readonly number[]; solution: readonly number[] }
const MAPS: readonly RiverMap[] = [
  { size: 3, start: 6, dock: 2, rocks: [0, 8], parcels: [4], solution: [6, 3, 4, 1, 2] },
  { size: 4, start: 12, dock: 3, rocks: [0, 2, 14, 15], parcels: [5, 11], solution: [12, 8, 9, 5, 6, 10, 11, 7, 3] },
  { size: 5, start: 20, dock: 4, rocks: [0, 2, 10, 12, 22, 24], parcels: [6, 18], solution: [20, 15, 16, 11, 6, 7, 8, 13, 18, 19, 14, 9, 4] },
];
/** Rotate/reflection preserves every route and physical direction in RTL. */
export function makeRiverMap(challenge: Challenge, round: number, variation: number): RiverMap {
  const base = MAPS[challenge === 'gentle' ? (round === 2 ? 1 : 0) : (round === 0 ? 1 : 2)];
  const turns = Math.abs(Math.trunc(variation)) % 4;
  const transform = (cell: number) => {
    let x = cell % base.size, y = Math.floor(cell / base.size);
    if (Math.floor(Math.abs(variation) / 4) % 2) x = base.size - 1 - x;
    for (let i = 0; i < turns; i++) [x, y] = [base.size - 1 - y, x];
    return y * base.size + x;
  };
  return { size: base.size, start: transform(base.start), dock: transform(base.dock), rocks: base.rocks.map(transform), parcels: base.parcels.map(transform), solution: base.solution.map(transform) };
}
export function adjacent(a: number, b: number, size: number): boolean {
  return Math.abs(a % size - b % size) + Math.abs(Math.floor(a / size) - Math.floor(b / size)) === 1;
}
export type RiverMove = 'ok' | 'near' | 'used' | 'rock' | 'parcels';
export function riverMove(map: RiverMap, path: readonly number[], cell: number): RiverMove {
  if (!Number.isInteger(cell) || cell < 0 || cell >= map.size * map.size || map.rocks.includes(cell)) return 'rock';
  if (path.includes(cell)) return 'used';
  if (!path.length || !adjacent(path[path.length - 1], cell, map.size)) return 'near';
  if (cell === map.dock && !map.parcels.every(p => path.includes(p))) return 'parcels';
  return 'ok';
}
export function riverComplete(map: RiverMap, path: readonly number[]): boolean {
  if (path[0] !== map.start || path[path.length - 1] !== map.dock) return false;
  return path.slice(1).every((cell, i) => riverMove(map, path.slice(0, i + 1), cell) === 'ok');
}
/** Search from the child's actual route, so a hint never assumes the authored path. */
export function riverHint(map: RiverMap, path: readonly number[]): number | null {
  if (!path.length || riverComplete(map, path)) return null;
  const visit = (route: readonly number[]): number[] | null => {
    if (riverComplete(map, route)) return [...route];
    const last = route[route.length - 1];
    for (const next of [last - map.size, last + 1, last + map.size, last - 1]) {
      if (riverMove(map, route, next) !== 'ok') continue;
      const found = visit([...route, next]);
      if (found) return found;
    }
    return null;
  };
  return visit(path)?.[path.length] ?? null;
}
export function melodyFor(challenge: Challenge, round: number, random = Math.random): NoteId[] {
  const length = (challenge === 'gentle' ? 2 : 3) + Math.min(2, round);
  const first = shuffled<NoteId>([0, 1, 2], random);
  return Array.from({ length }, (_, i) => first[(i + (i > 2 ? Math.floor(random() * 3) : 0)) % 3]);
}
export function melodyMatches(target: readonly NoteId[], played: readonly NoteId[]): boolean {
  return target.length === played.length && target.every((note, i) => note === played[i]);
}
