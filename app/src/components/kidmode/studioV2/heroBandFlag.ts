/** Hero Band proof switch. Off by default everywhere: the Sound Orbit tile, its
 * tests and its browser checks are untouched until the slice is accepted.
 * A device opts in with localStorage["arbor.flags.heroBand"] = "1", or by
 * opening the app once with ?heroBand=1 (and out again with ?heroBand=0). */
export const HERO_BAND_FLAG_KEY = 'arbor.flags.heroBand';
let cached: boolean | null = null;
export function heroBandFlagOn(): boolean {
  if (cached !== null) return cached;
  try {
    if (typeof localStorage === 'undefined') return cached = false;
    const asked = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('heroBand');
    if (asked === '1') localStorage.setItem(HERO_BAND_FLAG_KEY, '1');
    if (asked === '0') localStorage.removeItem(HERO_BAND_FLAG_KEY);
    cached = localStorage.getItem(HERO_BAND_FLAG_KEY) === '1';
  } catch {
    cached = false;
  }
  return cached;
}
export function resetHeroBandFlagForTests(): void { cached = null; }
