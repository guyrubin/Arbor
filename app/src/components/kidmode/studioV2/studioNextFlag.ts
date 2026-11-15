/** Next Studio games switch. Off by default everywhere: the eight Studio
 * tiles, their tests and their browser checks are untouched until the games
 * are accepted. A device opts in with localStorage["arbor.flags.studioNext"]
 * = "1", or by opening the app once with ?studioNext=1 (and out again with
 * ?studioNext=0). On, four tiles open the Bop games (Wobbly Delivery,
 * Five-Friend Sun, Oops Button, Rover Delivery) and Sound Orbit opens Hero Band. */
export const STUDIO_NEXT_FLAG_KEY = 'arbor.flags.studioNext';
let cached: boolean | null = null;
export function studioNextFlagOn(): boolean {
  if (cached !== null) return cached;
  try {
    if (typeof localStorage === 'undefined') return cached = false;
    const asked = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('studioNext');
    if (asked === '1') localStorage.setItem(STUDIO_NEXT_FLAG_KEY, '1');
    if (asked === '0') localStorage.removeItem(STUDIO_NEXT_FLAG_KEY);
    cached = localStorage.getItem(STUDIO_NEXT_FLAG_KEY) === '1';
  } catch {
    cached = false;
  }
  return cached;
}
export function resetStudioNextFlagForTests(): void { cached = null; }

/** The four host tiles that open a Bop game while the switch is on. Their
 * covers live with the rest of the kid art, in lib/kidThemeManifest. */
export const STUDIO_NEXT_HOSTS = ['memory', 'pattern', 'puzzle', 'river-rescue'] as const;
export type StudioNextHost = typeof STUDIO_NEXT_HOSTS[number];
