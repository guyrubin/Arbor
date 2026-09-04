/* firstComic — MOB-22. ONE definition of the first comic a new account sees.
 *
 * The wow overlay (components/onboarding/WowOnboarding) and the onboarding
 * domain step now both reach for the same page: the domain step starts drawing
 * it while the parent is still choosing, the overlay takes the finished page a
 * minute later. That only works if both sides build the IDENTICAL request —
 * a payload assembled twice is a payload that drifts, and a drifted payload is
 * a prewarm that always misses and always costs. So the request lives here,
 * once, and the prewarm key is derived from the same identity.
 *
 * GATING IS UNCHANGED. This module adds no gate and removes none:
 *  - the face_processing consent that governs an avatar lives inside
 *    AvatarCreator, upstream of any `heroDataUrl` that reaches this file;
 *  - the domain step runs the PLAIN variant (no avatar, therefore no photo and
 *    no face processing at all), and the key records that, so a parent who goes
 *    on to create an avatar gets a fresh generation rather than the plain page;
 *  - a paywall, quota, or safety refusal settles the prewarm to a miss and the
 *    wow step runs its normal path, including its own local fallback.
 * NOTHING IS PERSISTED: the page is held in memory by lib/comicPrewarm and
 * dropped when taken. Art data-URLs never reach a store (W5.4 doctrine).
 */
import { api } from "./api";
import { STORY_COMIC } from "./heroComics";
import { HERO_STORIES } from "./heroJourneys";
import {
  heroFingerprint,
  prewarmComic,
  prewarmKey,
  takePrewarmedComic,
  type PrewarmedComic,
} from "./comicPrewarm";

/** The canon first story — the same one the wow overlay has always used. */
export const FIRST_STORY = HERO_STORIES[0];
const FIRST_STORY_COMIC = STORY_COMIC["david-and-goliath"];

/** The hero name rule, shared with ui/HeroAvatar so both sides agree. */
export function heroFirstName(fullName: string | undefined | null): string {
  return (fullName || "").split(" ")[0] || "your child";
}

export interface FirstComicIdentity {
  /** Already reduced through `heroFirstName`. */
  name: string;
  /** Hebrew page. */
  he: boolean;
  /** A consented avatar data URL, or undefined for the plain page. */
  heroDataUrl?: string;
}

/**
 * The cache key MUST include the hero's name, because generateFirstComic bakes
 * that name into the drawing. Without it, a page generated for one child could
 * be handed to the next: onboard child A (plain page prewarmed), create an
 * avatar so the take misses and the slot survives, later add child B — B's key
 * matched, and B's first comic arrived with A's name on it, seeded into B's
 * shelf. The same slot outlived a sign-out on a shared tab.
 */
export function firstComicKey(id: FirstComicIdentity): string {
  return prewarmKey({
    story: FIRST_STORY.id,
    lang: id.he ? "he" : "en",
    name: id.name,
    hero: heroFingerprint(id.heroDataUrl),
  });
}

/** The one request. Resolves to a page data URL, or throws like any api call. */
export async function generateFirstComic(id: FirstComicIdentity): Promise<string> {
  const res = await api.generateComic({
    ...(id.heroDataUrl ? { avatar: { dataUrl: id.heroDataUrl } } : {}),
    heroName: id.name,
    theme: id.he ? FIRST_STORY_COMIC.themeHe : FIRST_STORY_COMIC.theme,
    dialogue: id.he ? FIRST_STORY_COMIC.dialogueHe : FIRST_STORY_COMIC.dialogue,
    sfx: id.he ? [...FIRST_STORY_COMIC.sfxHe] : [...FIRST_STORY_COMIC.sfx],
    style: "comichero",
  });
  return res.dataUrl;
}

/**
 * Start drawing the first comic now. Fire-and-forget by design: the caller is
 * a surface the parent is still using, and nothing about it may block or fail
 * on this. Safe to call repeatedly — the same identity is only started once.
 */
export function prewarmFirstComic(id: FirstComicIdentity): void {
  prewarmComic(firstComicKey(id), () => generateFirstComic(id));
}

/** Take the prewarmed page for this identity, or null if none matches. */
export function takeFirstComic(id: FirstComicIdentity): Promise<PrewarmedComic> | null {
  return takePrewarmedComic(firstComicKey(id));
}
