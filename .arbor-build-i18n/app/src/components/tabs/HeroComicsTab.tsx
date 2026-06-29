import React, { useMemo, useState } from "react";
import { Sparkles, Wand2, Download, RefreshCw, ShieldCheck, Layers, Check } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { api, PaywallError } from "../../lib/api";
import { track } from "../../lib/analytics";
import { runInstrumented } from "../../hooks/useAsyncAction";
import { HERO_STORIES } from "../../lib/heroJourneys";
import type { HeroPackId } from "../../types";
import { PlayShell, PlayHeader, PlayButton, PlayPanel } from "../ui/playkit";
import { HeroAvatar, useHeroAvatar } from "../ui/HeroAvatar";
import { downloadHeroAvatarCanvas } from "../../lib/heroAvatarCanvas";

/**
 * Hero Comics (Academy) — the child is the STAR of their own comic book for every
 * Academy story. Each of the canon Hero-Journey stories is rendered as a dynamic,
 * viral cel-shaded comic panel via /api/generate-comic, featuring the child's saved
 * hero avatar (name on the suit, big SFX, a speech bubble). Parents can generate one
 * story at a time, or tap "Generate all" to make the whole set and save/share them.
 *
 * Comic images are large data URLs, so they live in component state for the session
 * and are saved to disk on demand (the share/viral loop) — never persisted to the
 * per-child Firestore doc.
 */

/** Per-story viral comic copy (bilingual): the heroic panel cue, a shout, and SFX. */
type ComicCopy = { theme: string; themeHe: string; dialogue: string; dialogueHe: string; sfx: string[]; sfxHe: string[] };
const STORY_COMIC: Record<string, ComicCopy> = {
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

/** Comic-world skin per pack (matches HeroJourneyTab + the Hero Arcade layer). */
const PACK_WORLD: Record<HeroPackId, { bg: string; ink: string; label: string; labelHe: string }> = {
  courage: { bg: "var(--arbor-peach)", ink: "var(--arbor-peach-ink)", label: "Courage", labelHe: "אומץ" },
  responsibility: { bg: "var(--arbor-yellow)", ink: "var(--arbor-yellow-ink)", label: "Responsibility", labelHe: "אחריות" },
  growth: { bg: "var(--arbor-clay)", ink: "var(--arbor-clay-deep)", label: "Growth", labelHe: "צמיחה" },
  wisdom: { bg: "var(--arbor-sky)", ink: "var(--arbor-sky-ink)", label: "Wisdom", labelHe: "חוכמה" },
  truth: { bg: "var(--arbor-pack-truth)", ink: "var(--arbor-pack-truth)", label: "Truth", labelHe: "אמת" },
};

/** Per-story scene prop, so an un-generated card still shows the hero in-world. */
const STORY_EMOJI: Record<string, string> = {
  "david-and-goliath": "🛡️",
  "moses-and-pharaoh": "👑",
  "the-lion-who-was-afraid": "🦁",
  "noahs-ark": "🌈",
  "jonah-and-the-great-fish": "🐋",
  "the-dragon-of-responsibility": "🐉",
  "joseph-and-his-brothers": "🧥",
  "jacob-wrestling-the-angel": "🌅",
  "the-garden-of-forgotten-seeds": "🌻",
  "king-solomons-choice": "⚖️",
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function HeroComicsTab() {
  const { childProfile, setActiveTab, openPaywall } = useArbor();
  const { aiLang } = useLanguage();
  const { url: heroUrl, hasHero, name } = useHeroAvatar();

  // storyId → generated comic data URL (session-only; large data URLs aren't persisted)
  const [comics, setComics] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const he = aiLang === "he";
  const heroDataUrl = heroUrl && heroUrl.startsWith("data:") ? heroUrl : undefined;

  const stories = useMemo(
    () => HERO_STORIES.filter((s) => STORY_COMIC[s.id]),
    [],
  );
  const madeCount = Object.keys(comics).length;

  /** Core generator: one story → a viral hero comic. Returns an explicit status so
   *  a batch run can stop cleanly on a paywall or a hard error (no stale-state guess). */
  const generate = async (storyId: string): Promise<"ok" | "paywall" | "error"> => {
    const copy = STORY_COMIC[storyId];
    if (!copy) return "error";
    try {
      const res = await runInstrumented("hero_comic", () =>
        api.generateComic({
          ...(heroDataUrl ? { avatar: { dataUrl: heroDataUrl } } : {}),
          heroName: name,
          theme: he ? copy.themeHe : copy.theme,
          dialogue: he ? copy.dialogueHe : copy.dialogue,
          sfx: he ? copy.sfxHe : copy.sfx,
          style: "comichero",
        }),
      );
      setComics((c) => ({ ...c, [storyId]: res.dataUrl }));
      track("hero_comic_generated", { story: storyId });
      return "ok";
    } catch (err) {
      if (err instanceof PaywallError) {
        openPaywall(err.feature || "heroComic", err.plan);
        return "paywall";
      }
      const msg = err instanceof Error && err.message ? err.message : "Couldn't create that comic — please try again.";
      setError(msg);
      return "error";
    }
  };

  const makeOne = async (storyId: string) => {
    setError(null);
    setBusyId(storyId);
    await generate(storyId);
    setBusyId(null);
  };

  // Generate ALL stories the child hasn't made yet, in order, with live progress.
  const makeAll = async () => {
    setError(null);
    const todo = stories.filter((s) => !comics[s.id]);
    if (todo.length === 0) return;
    setBatch({ done: 0, total: todo.length });
    track("hero_comic_batch_started", { count: todo.length });
    let made = 0;
    for (let i = 0; i < todo.length; i++) {
      setBusyId(todo[i].id);
      const status = await generate(todo[i].id);
      setBusyId(null);
      setBatch({ done: i + 1, total: todo.length });
      if (status === "ok") made += 1;
      // A paywall or hard error stops the run so we don't hammer the API.
      else break;
    }
    setBatch(null);
    track("hero_comic_batch_finished", { made });
  };

  // AP-050: routes through the shared HeroAvatarCanvas module ("comic" template).
  // comic → renderShareCard("story", opts) → renderStoryCard: output is identical
  // to the pre-migration direct anchor-download of the raw API data URL, with the
  // added Arbor brand card frame applied consistently with all other surfaces.
  const download = (storyId: string, title: string) => {
    const url = comics[storyId];
    if (!url) return;
    void downloadHeroAvatarCanvas(
      "comic",
      { imageUrl: url, name, title },
      `${slug(name)}-${slug(title)}-hero-comic.png`,
    );
  };

  const downloadAll = () => {
    stories.forEach((s, i) => {
      if (!comics[s.id]) return;
      // Stagger so the browser doesn't drop simultaneous downloads.
      setTimeout(() => download(s.id, he ? s.titleHe : s.title), i * 350);
    });
  };

  const busy = busyId != null || batch != null;

  // No hero yet → invite the parent to create one (cross-domain entry point).
  if (!hasHero) {
    return (
      <PlayShell>
        <PlayHeader title="Hero Comics" say={`Turn ${name} into the star of their own comic book.`} mood="cheer" />
        <PlayPanel tone="lav" className="text-center">
          <p className="text-[1.3rem] font-extrabold mb-2" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
            First, create {name}&apos;s hero
          </p>
          <p className="text-sm mb-5 max-w-md mx-auto" style={{ color: "var(--arbor-muted)" }}>
            Make {name} into their own comic superhero — then they star in every Academy story, comic and adventure across Arbor.
          </p>
          <PlayButton tone="clay" onClick={() => setActiveTab("profile")}>
            <Sparkles className="w-4 h-4" /> Create {name}&apos;s hero
          </PlayButton>
        </PlayPanel>
      </PlayShell>
    );
  }

  return (
    <PlayShell>
      <PlayHeader title="Hero Comics" say={`Every Academy story — starring ${name}!`} mood="cheer" />

      {/* Generate-all hero bar */}
      <PlayPanel tone="clay">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[1.05rem] font-extrabold leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
              {name}&apos;s hero comic collection
            </p>
            <p className="text-[12.5px] mt-0.5" style={{ color: "var(--arbor-muted)" }}>
              {madeCount} of {stories.length} stories made
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <PlayButton tone="clay" onClick={makeAll} disabled={busy || madeCount >= stories.length}>
              {batch ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Drawing {batch.done}/{batch.total}…</>
              ) : (
                <><Layers className="w-4 h-4" /> Generate all {stories.length}</>
              )}
            </PlayButton>
            {madeCount > 1 && (
              <PlayButton variant="soft" tone="clay" onClick={downloadAll} disabled={busy}>
                <Download className="w-4 h-4" /> Save all
              </PlayButton>
            )}
          </div>
        </div>
        {batch && (
          <div className="mt-3 h-2 w-full rounded-full overflow-hidden" style={{ background: "var(--arbor-paper-deep)" }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(batch.done / batch.total) * 100}%`, background: "var(--arbor-clay)" }} />
          </div>
        )}
      </PlayPanel>

      {/* Story grid — each canon Academy story as a hero comic */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
        {stories.map((s) => {
          const w = PACK_WORLD[s.pack];
          const emoji = STORY_EMOJI[s.id] ?? "⭐";
          const comic = comics[s.id];
          const isBusy = busyId === s.id;
          return (
            <div key={s.id} className="comic-panel overflow-hidden">
              {/* Comic stage: the generated page, or the hero waiting in this world */}
              <div className="relative" style={{ aspectRatio: "3 / 2", borderBottom: "var(--comic-line)" }}>
                {comic ? (
                  <img src={comic} alt={`${name}'s ${he ? s.titleHe : s.title} comic`} className="w-full h-full object-cover" />
                ) : isBusy ? (
                  <div className="comic-halftone absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ background: w.bg }}>
                    <Wand2 className="w-9 h-9 animate-pulse" style={{ color: "#fff", filter: "drop-shadow(2px 2px 0 rgba(23,27,34,.35))" }} />
                    <p className="text-[12.5px] font-black" style={{ color: "#fff" }} dir="auto">{he ? `מצייר את ${name}…` : `Drawing ${name}…`}</p>
                  </div>
                ) : (
                  <button
                    onClick={() => makeOne(s.id)}
                    disabled={busy}
                    aria-label={he ? `צרו קומיקס: ${s.titleHe}` : `Make comic: ${s.title}`}
                    className="comic-halftone absolute inset-0 grid place-items-center disabled:opacity-60"
                    style={{ background: w.bg }}
                  >
                    <div className="flex items-center gap-1.5">
                      <HeroAvatar size={74} ring animate={false} />
                      <span style={{ fontSize: 42, filter: "drop-shadow(2px 2px 0 rgba(23,27,34,.3))" }} aria-hidden="true">{emoji}</span>
                    </div>
                    <span
                      className="absolute bottom-2 inline-flex items-center gap-1 text-[12px] font-black rounded-full px-3 py-1"
                      style={{ insetInlineStart: 8, background: "#fff", border: "var(--comic-line)", color: "var(--arbor-ink)" }}
                    >
                      <Sparkles className="w-3.5 h-3.5" /> {he ? "צרו קומיקס" : "Make comic"}
                    </span>
                  </button>
                )}
              </div>

              {/* Caption + actions */}
              <div className="p-3.5">
                <div className="flex items-center gap-2">
                  <span className="font-black text-[15px] leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }} dir="auto">
                    {he ? s.titleHe : s.title}
                  </span>
                  <span className="ms-auto inline-block text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ border: "2px solid var(--comic-ink)", color: w.ink }}>
                    {he ? w.labelHe : w.label}
                  </span>
                </div>
                {comic && (
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <PlayButton tone="clay" variant="soft" onClick={() => makeOne(s.id)} disabled={busy}>
                      <RefreshCw className="w-3.5 h-3.5" /> {he ? "צייר שוב" : "Redraw"}
                    </PlayButton>
                    <PlayButton tone="clay" variant="soft" onClick={() => download(s.id, he ? s.titleHe : s.title)} disabled={busy}>
                      <Download className="w-3.5 h-3.5" /> {he ? "שמור" : "Save"}
                    </PlayButton>
                    <span className="ms-auto inline-flex items-center gap-1 text-[11px] font-black" style={{ color: "var(--arbor-green-ink)" }}>
                      <Check className="w-3.5 h-3.5" /> {he ? "מוכן" : "Made"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {error && <p className="text-[13px] font-semibold" style={{ color: "var(--arbor-pink-ink)" }}>{error}</p>}

      <div className="rounded-2xl p-3.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-ink)" }}>
        <span className="font-extrabold inline-flex items-center gap-1.5" style={{ color: "var(--arbor-green-ink)" }}><ShieldCheck className="w-4 h-4" /> Safe &amp; private</span>
        <span style={{ color: "var(--arbor-muted)" }}>Comics use {name}&apos;s saved cartoon hero — never a real photo. Images are AI-made and provenance-watermarked.</span>
      </div>
    </PlayShell>
  );
}
