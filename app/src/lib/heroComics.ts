/**
 * Hero Comics — the shared model + book orchestration for the Comic Reader
 * (p1-comic-reader). The `comics` tab is the single home for a real, re-openable
 * multi-page comic book that stars the child's saved stylized hero avatar
 * (privacy-first; never a photo).
 *
 * This module is intentionally pure (no React, no DOM): the adventure catalog,
 * the per-page comic copy, the durable cache-key helper, the page-turn math
 * (LTR/RTL aware), and the build-a-book orchestration that generates pages
 * sequentially through an in-flight dedupe map so one failed page never blocks
 * the rest of the book. HeroScenePlayer and ComicReader both build on it.
 */
import { api, PaywallError } from "./api";
import { HERO_STORIES } from "./heroJourneys";
import { resolveScene } from "./sceneCache";
import type { HeroStorySpec } from "../types";

/** Per-story viral comic copy (bilingual): the heroic panel cue, a shout, and SFX. */
export type ComicCopy = {
  theme: string;
  themeHe: string;
  dialogue: string;
  dialogueHe: string;
  sfx: string[];
  sfxHe: string[];
};

/** The canon adventures a child can star in. Keyed by HERO_STORIES id. */
export const STORY_COMIC: Record<string, ComicCopy> = {
  "david-and-goliath": {
    theme: "a small but mighty young hero standing fearlessly before a towering giant, slingshot raised high, glowing with courage",
    themeHe: "גיבור קטן ואדיר עומד ללא פחד מול ענק מתנשא, רוגטקה מורמת גבוה, זוהר באומץ",
    dialogue: "I'm small but I'm brave!", dialogueHe: "אני קטן אבל אמיץ!",
    sfx: ["BOOM!", "WHOOSH!", "ZING!"], sfxHe: ["בום!", "ואוש!", "זינג!"],
  },
  "moses-and-pharaoh": {
    theme: "a brave young hero standing tall before a mighty king's golden throne, speaking up boldly and bright",
    themeHe: "גיבור צעיר ואמיץ עומד זקוף מול כס המלך המוזהב, מדבר באומץ ובביטחון",
    dialogue: "Let my people go!", dialogueHe: "שלח את עמי!",
    sfx: ["BOOM!", "ECHO!", "WHAM!"], sfxHe: ["בום!", "הד!", "טראח!"],
  },
  "the-lion-who-was-afraid": {
    theme: "a brave child hero with a glowing friendly lion taking one bold step into a magical starry night",
    themeHe: "גיבור ילד אמיץ עם אריה זוהר וידידותי צועד צעד אמיץ אל תוך לילה קסום וזרוע כוכבים",
    dialogue: "One brave step!", dialogueHe: "צעד אמיץ אחד!",
    sfx: ["ROAR!", "WHOOSH!", "TWINKLE!"], sfxHe: ["שאגה!", "ואוש!", "נצנוץ!"],
  },
  "noahs-ark": {
    theme: "a determined young hero building a giant ark with cheerful animals as the first rain falls and a rainbow rises",
    themeHe: "גיבור צעיר ונחוש בונה תיבה ענקית עם חיות עליזות כשהגשם הראשון יורד וקשת עולה",
    dialogue: "Everyone's safe with me!", dialogueHe: "כולם בטוחים איתי!",
    sfx: ["BANG!", "SPLASH!", "HOORAY!"], sfxHe: ["באנג!", "שלאמפ!", "הידד!"],
  },
  "jonah-and-the-great-fish": {
    theme: "a brave hero riding a friendly giant fish through sparkling ocean waves, turning back to do what's right",
    themeHe: "גיבור אמיץ רוכב על דג ענק וידידותי בין גלי ים נוצצים, חוזר לעשות את הדבר הנכון",
    dialogue: "I'm turning back!", dialogueHe: "אני חוזר!",
    sfx: ["SPLASH!", "WHOOSH!", "GULP!"], sfxHe: ["שלאמפ!", "ואוש!", "גלופ!"],
  },
  "the-dragon-of-responsibility": {
    theme: "a caring young hero feeding a tiny friendly dragon's flame to light up a cozy village glowing at night",
    themeHe: "גיבור צעיר ואכפתי מזין את להבת הדרקון הקטן והחמוד ומאיר כפר נעים וזוהר בלילה",
    dialogue: "Job first, then play!", dialogueHe: "קודם עבודה, אחר כך משחק!",
    sfx: ["FWOOSH!", "SPARKLE!", "TA-DA!"], sfxHe: ["פוווש!", "ניצוץ!", "טה-דה!"],
  },
  "joseph-and-his-brothers": {
    theme: "a hopeful hero in a colorful coat opening their arms wide to forgive, warm golden light bursting all around",
    themeHe: "גיבור מלא תקווה במעיל צבעוני פותח את זרועותיו לסליחה, אור זהוב וחמים מתפרץ מסביב",
    dialogue: "I forgive you!", dialogueHe: "אני סולח לך!",
    sfx: ["GLOW!", "HUG!", "SHINE!"], sfxHe: ["זוהר!", "חיבוק!", "ברק!"],
  },
  "jacob-wrestling-the-angel": {
    theme: "a determined hero holding on with all their might through the night until a glowing sunrise breaks the sky",
    themeHe: "גיבור נחוש שאוחז בכל כוחו לאורך הלילה עד שזריחה זוהרת בוקעת בשמיים",
    dialogue: "I won't give up!", dialogueHe: "אני לא מוותר!",
    sfx: ["WHAM!", "HOLD!", "DAWN!"], sfxHe: ["טראח!", "חזק!", "זריחה!"],
  },
  "the-garden-of-forgotten-seeds": {
    theme: "a patient young hero watering a magical garden that bursts into giant colorful flowers and sparkles",
    themeHe: "גיבור צעיר וסבלני משקה גן קסום שמתפוצץ בפרחים ענקיים וצבעוניים ובניצוצות",
    dialogue: "Look — it's growing!", dialogueHe: "תראו — זה גדל!",
    sfx: ["POP!", "BLOOM!", "SPARKLE!"], sfxHe: ["פופ!", "פריחה!", "ניצוץ!"],
  },
  "king-solomons-choice": {
    theme: "a wise young hero-king on a golden throne glowing with clever ideas, making a fair and kind choice",
    themeHe: "גיבור-מלך צעיר וחכם על כס זהב, זוהר ברעיונות נבונים, מקבל החלטה הוגנת וטובה",
    dialogue: "I know what's fair!", dialogueHe: "אני יודע מה הוגן!",
    sfx: ["AHA!", "DING!", "SHINE!"], sfxHe: ["אהה!", "דינג!", "ברק!"],
  },
};

/** One adventure the child can turn into a comic book (story spec + comic copy). */
export interface Adventure {
  id: string;
  title: string;
  titleHe: string;
  pack: HeroStorySpec["pack"];
  copy: ComicCopy;
}

/** The adventure catalog — every canon story that has comic copy authored. */
export const ADVENTURES: Adventure[] = HERO_STORIES.filter((s) => STORY_COMIC[s.id]).map((s) => ({
  id: s.id,
  title: s.title,
  titleHe: s.titleHe,
  pack: s.pack,
  copy: STORY_COMIC[s.id],
}));

export const getAdventure = (id: string): Adventure | undefined => ADVENTURES.find((a) => a.id === id);

export const adventureTitle = (a: Adventure, lang: ComicLang): string => (lang === "he" ? a.titleHe : a.title);

export type ComicLang = "en" | "he";

/** Status of a single page in a book. */
export type ComicPageStatus = "pending" | "ready" | "error";

/** One page of a comic book (cover or a story beat). */
export interface ComicPageData {
  /** 0 = cover, 1..N = beats. */
  index: number;
  /** Page heading / alt text. */
  title: string;
  /** True for the cover page (no panel art needed to start reading). */
  cover: boolean;
  /** The generated panel data-URL once it resolves. */
  dataUrl?: string;
  status: ComicPageStatus;
}

/** A finished (or in-progress) comic book — a first-class saved artifact. */
export interface HeroComic {
  id: string;
  adventureId: string;
  title: string;
  lang: ComicLang;
  /** The cover panel data-URL — the shareable, viral artifact. */
  coverUrl?: string;
  /** All page data-URLs (index-aligned to pages[]). Cover at [0]. */
  pageUrls: string[];
  createdAt: string;
}

const shortHash = (s: string): string => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
};

/** Stable, durable cache key for a page of an avatar+adventure book in one lang.
 *  Shared by ComicReader pages and HeroScenePlayer beats so cache hits cross over.
 *  `avatarHash` should be `shortHash(avatarDataUrl)`; pass the data-URL to hash it. */
export function comicKey(avatarOrHash: string, adventureId: string, lang: ComicLang, pageIndex = 0): string {
  // Accept either a raw avatar data-URL or an already-hashed token.
  const h = avatarOrHash.startsWith("data:") ? shortHash(avatarOrHash) : avatarOrHash;
  return `comic3|${adventureId}|${lang}|${pageIndex}|${h}`;
}

export const avatarHash = (avatarDataUrl: string): string => shortHash(avatarDataUrl);

/* ── Page-turn math (LTR + RTL aware) ──────────────────────────────────────
   Page order in the model is always 0..total-1. In RTL the *visual* flip
   direction inverts, but the logical next/prev still walk 0→total-1, so callers
   only need RTL handling for the swipe/tap mapping (see swipeToDelta). */

export const clampPage = (index: number, total: number): number =>
  Math.max(0, Math.min(total - 1, index));

export const nextPageIndex = (index: number, total: number): number => clampPage(index + 1, total);
export const prevPageIndex = (index: number, total: number): number => clampPage(index - 1, total);

/** Map a raw horizontal swipe delta-x to a page step (+1 next, -1 prev, 0 ignore),
 *  honoring RTL inversion and a vertical-dominance guard (preserves iOS edge-back). */
export function swipeToDelta(dx: number, dy: number, rtl: boolean, threshold = 60): -1 | 0 | 1 {
  if (Math.abs(dx) < threshold) return 0;
  if (Math.abs(dy) > Math.abs(dx)) return 0; // vertical scroll dominates → ignore
  // Drag LEFT (dx<0) means "advance" in LTR, "go back" in RTL.
  const advance = rtl ? dx > 0 : dx < 0;
  return advance ? 1 : -1;
}

/** Map a tap x-position within the panel width to a page step, RTL-aware.
 *  Left third = prev (LTR) / next (RTL); right third = next (LTR) / prev (RTL);
 *  middle third = 0 (no-op, lets the child rest on a page). */
export function tapToDelta(xRatio: number, rtl: boolean): -1 | 0 | 1 {
  if (xRatio > 1 / 3 && xRatio < 2 / 3) return 0;
  const right = xRatio >= 2 / 3;
  const advance = rtl ? !right : right;
  return advance ? 1 : -1;
}

/** The pages of a book before any art is generated: cover + one page per beat
 *  (excluding the `decision` beat, which is interactive in Journeys, not comics). */
export function planPages(adventure: Adventure, lang: ComicLang, beatTitles: string[]): ComicPageData[] {
  const name = "{name}"; // caller substitutes; kept lang-neutral here
  void name;
  const cover: ComicPageData = {
    index: 0,
    title: adventureTitle(adventure, lang),
    cover: true,
    status: "pending",
  };
  const beats: ComicPageData[] = beatTitles.map((t, i) => ({
    index: i + 1,
    title: t,
    cover: false,
    status: "pending",
  }));
  return [cover, ...beats];
}

export interface GeneratePageArgs {
  adventure: Adventure;
  lang: ComicLang;
  heroName: string;
  heroDataUrl?: string;
  page: ComicPageData;
  beatPrompt?: string;
}

/** Generate (or reuse a cached/in-flight) panel for one page. Resolves to a
 *  data-URL or rejects. The cover uses a title-card theme; beats use the beat
 *  prompt. Results are cached + concurrent identical requests deduped via the
 *  shared persistent scene cache (lib/sceneCache). */
export async function generatePage(args: GeneratePageArgs): Promise<string> {
  const { adventure, lang, heroName, heroDataUrl, page, beatPrompt } = args;
  const he = lang === "he";
  const baseTheme = he ? adventure.copy.themeHe : adventure.copy.theme;
  const key = comicKey(heroDataUrl || "no-hero", adventure.id, lang, page.index);

  const theme = page.cover
    ? `${baseTheme} — dramatic comic-book COVER with the title, no panels`
    : beatPrompt || baseTheme;

  // S3: persist generated pages (and dedupe concurrent identical requests) via
  // the shared scene cache, so re-opening a book never re-pays generation.
  return resolveScene(key, () =>
    api
      .generateComic({
        ...(heroDataUrl ? { avatar: { dataUrl: heroDataUrl } } : {}),
        heroName,
        theme,
        ...(page.cover ? { cover: true } : { dialogue: he ? adventure.copy.dialogueHe : adventure.copy.dialogue }),
        sfx: he ? adventure.copy.sfxHe : adventure.copy.sfx,
        style: "comichero",
        pageIndex: page.index,
      })
      .then((r) => r.dataUrl),
  );
}

/** Build a whole book by generating pages sequentially, reporting each as it
 *  resolves (or fails) via `onPage`. One failed page is marked `error` and the
 *  build continues — the book is never blocked on a single smudged page.
 *  Returns the final page list (with statuses + data-URLs).
 *
 *  EXCEPTION: a `PaywallError` is a conversion moment, not a smudged page — the
 *  build STOPS (no further paid generations) and rejects with the typed error so
 *  the host can open the paywall instead of rendering per-page error tiles. */
export async function buildComicBook(
  adventure: Adventure,
  lang: ComicLang,
  heroName: string,
  heroDataUrl: string | undefined,
  pages: ComicPageData[],
  beatPrompts: Record<number, string>,
  onPage: (page: ComicPageData) => void,
): Promise<ComicPageData[]> {
  const out = pages.map((p) => ({ ...p }));
  for (const page of out) {
    try {
      const dataUrl = await generatePage({
        adventure,
        lang,
        heroName,
        heroDataUrl,
        page,
        beatPrompt: beatPrompts[page.index],
      });
      page.dataUrl = dataUrl;
      page.status = "ready";
    } catch (err) {
      // Paywall ≠ page failure: stop the whole build and surface it typed.
      if (err instanceof PaywallError) throw err;
      page.status = "error";
    }
    onPage({ ...page });
  }
  return out;
}
