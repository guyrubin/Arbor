/* comicPrewarm — MOB-22. Draw the first comic while the parent is still typing.
 *
 * THE DEFECT: the wow moment (components/onboarding/WowOnboarding) only STARTS
 * generating the first comic once the parent has reached the comic step, so
 * the very first thing a new account experiences is a spinner on top of an
 * image-generation round trip. Meanwhile the parent has just spent thirty
 * unhurried seconds picking focus domains in onboarding with the network idle.
 *
 * THE FIX: start that same generation during the domain step and hand the
 * finished page to the wow overlay. Nothing about WHAT is generated changes —
 * this module holds a promise, it does not build a prompt.
 *
 * WHAT THIS MODULE WILL NOT DO
 *  - It never persists anything. The page lives in a module variable for the
 *    lifetime of the tab and is dropped on take. No localStorage, no IndexedDB,
 *    no Firestore — a generated page is a photo-derived artifact and the W5.4
 *    doctrine keeps art data-URLs out of every store.
 *  - It never introduces a gate of its own and never bypasses one. The caller
 *    passes the SAME generator the wow step would have run; the face_processing
 *    consent that governs an avatar lives inside AvatarCreator, upstream of any
 *    avatar this could carry, and a paywall or quota rejection is swallowed
 *    into a miss so the wow step simply runs its normal path.
 *  - It never prewarms a variant the parent has not settled. The KEY carries
 *    the hero identity, so a prewarm started with no avatar is discarded (not
 *    shown) if the parent goes on to create one.
 *
 * SINGLE SLOT: one prewarm at a time. A second key replaces the first, because
 * the only thing worth holding is the page about to be shown.
 */

/** What a prewarm settles to. `dataUrl: null` = it missed; run the normal path. */
export interface PrewarmedComic {
  dataUrl: string | null;
}

export interface PrewarmKeyParts {
  /** Canon story id (HERO_STORIES[0].id today). */
  story: string;
  /** "he" | "en" — a Hebrew page is a different page. */
  lang: string;
  /** The hero's name. It is DRAWN INTO the page, so two children with
   *  different names are two different pages even with identical avatars. */
  name: string;
  /** Hero identity: an avatar fingerprint, or "plain" for the no-avatar page. */
  hero: string;
}

/**
 * The identity of a page. Two prewarms with the same key are the same page;
 * anything else is a miss, which is exactly what protects the parent who
 * creates an avatar after the prewarm started.
 */
export function prewarmKey(parts: PrewarmKeyParts): string {
  return `${parts.story}|${parts.lang}|${parts.name}|${parts.hero}`;
}

/** A stable, cheap fingerprint for an avatar data URL (never the URL itself). */
export function heroFingerprint(dataUrl: string | undefined): string {
  if (!dataUrl) return "plain";
  return `avatar:${dataUrl.length}:${dataUrl.slice(-24)}`;
}

interface Slot {
  key: string;
  settled: Promise<PrewarmedComic>;
}

let slot: Slot | null = null;

/**
 * Start drawing `key`'s page, unless it is already in flight. Returns nothing:
 * a prewarm is a side bet, and no caller should ever wait on it.
 */
export function prewarmComic(key: string, generate: () => Promise<string>): void {
  if (slot && slot.key === key) return;
  const settled = (async (): Promise<PrewarmedComic> => {
    try {
      const dataUrl = await generate();
      return { dataUrl: typeof dataUrl === "string" && dataUrl.length > 0 ? dataUrl : null };
    } catch {
      // Paywall, quota, offline, safety refusal — all the same to us: a miss.
      return { dataUrl: null };
    }
  })();
  // The promise is always consumed here too, so a prewarm nobody takes can
  // never surface as an unhandled rejection.
  void settled.catch(() => ({ dataUrl: null }));
  slot = { key, settled };
}

/** Is a prewarm for this exact page in flight or finished? */
export function hasPrewarm(key: string): boolean {
  return slot !== null && slot.key === key;
}

/**
 * Take the prewarmed page for `key`, or null if the slot holds a different
 * page (or none). Taking CLEARS the slot: the page is handed over exactly
 * once and nothing is left holding image bytes.
 */
export function takePrewarmedComic(key: string): Promise<PrewarmedComic> | null {
  if (!slot || slot.key !== key) return null;
  const { settled } = slot;
  slot = null;
  return settled;
}

/** Drop whatever is held. Called on sign-out and by tests. */
export function clearPrewarmedComic(): void {
  slot = null;
  wowPages.clear();
}

/* B-SHELL-10 (framer decision, 1 Oct) — the wow page reaches the shelf.
 *
 * The wow seeds the shelf with a METADATA-ONLY book (`pageUrls: []`, W5.4: art
 * data-URLs never reach a store), so opening it on #/comics rebuilt the whole
 * book and re-generated the very page the parent had just seen — and a page
 * that landed late (after the 8 s box) was simply lost. The real page the wow
 * showed (in time or late) is now held HERE, in memory for the tab's lifetime,
 * keyed by child + story + language, and ComicReader takes it as the cover of
 * that book instead of drawing it again. Same doctrine as the slot above: no
 * store, cleared on sign-out (clearPrewarmedComic), never the composed
 * fallback page (that one is a template, not the child's comic). */
const wowPages = new Map<string, string>();

const wowPageKey = (childId: string, adventureId: string, lang: string): string => `${childId}|${adventureId}|${lang}`;

/** Hold the real first page the wow showed (or the late one that landed after). */
export function holdWowPage(childId: string, adventureId: string, lang: string, dataUrl: string): void {
  if (!childId || !adventureId || !dataUrl) return;
  wowPages.set(wowPageKey(childId, adventureId, lang), dataUrl);
}

/** The held wow page for this child's book in this language, or null. Not
 *  consumed: re-opening the book before it is saved shows the same page. */
export function wowPageFor(childId: string | undefined, adventureId: string, lang: string): string | null {
  if (!childId) return null;
  return wowPages.get(wowPageKey(childId, adventureId, lang)) ?? null;
}
