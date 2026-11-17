/** Next Studio games switch. On by default for every child since Guy's
 * switch-on, 16 Nov (B-GAME-39). A device opts out with
 * localStorage["arbor.flags.studioNext"] = "0", or by opening the app once
 * with ?studioNext=0 (and back in with ?studioNext=1). Without browser
 * storage (the node test runner) it stays off, so the legacy games keep
 * their own tests. On, four tiles open the Bop games (Wobbly Delivery,
 * Five-Friend Sun, Oops Button, Rover Delivery) and Sound Orbit opens Hero Band,
 * and the makers (studioCatalog STUDIO_MAKER_IDS) join their worlds. */
export const STUDIO_NEXT_FLAG_KEY = 'arbor.flags.studioNext';
let cached: boolean | null = null;
export function studioNextFlagOn(): boolean {
  if (cached !== null) return cached;
  try {
    if (typeof localStorage === 'undefined') return cached = false;
    const asked = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('studioNext');
    if (asked === '1' || asked === '0') localStorage.setItem(STUDIO_NEXT_FLAG_KEY, asked);
    cached = localStorage.getItem(STUDIO_NEXT_FLAG_KEY) !== '0';
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
