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

/** Host tile → the cover picture of the game it opens while the switch is on.
 * Shared pictures only: the child's hero is never part of a cover. */
const COVERS = { memory: 'card-delivery', pattern: 'card-sun', puzzle: 'card-oops', 'river-rescue': 'card-rover' } as const;
export type StudioNextHost = keyof typeof COVERS;
export const STUDIO_NEXT_HOSTS = Object.keys(COVERS) as StudioNextHost[];
export interface StudioNextCover { src: string; src480: string; srcSet: string }
export function studioNextCover(id: string): StudioNextCover | null {
  if (!Object.hasOwn(COVERS, id) || !studioNextFlagOn()) return null;
  const base = `/visuals/studio-v2/bop/${COVERS[id as StudioNextHost]}`;
  return { src: `${base}.webp`, src480: `${base}-480.webp`, srcSet: `${base}-480.webp 480w, ${base}.webp 1024w` };
}
