import React, { useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { PlayShell, PlayHeader, PlayButton, PlayPanel } from "../ui/playkit";
import { HeroAvatar, useHeroAvatar } from "../ui/HeroAvatar";
import { ComicReader } from "../stories/ComicReader";
import {
  ADVENTURES,
  adventureTitle,
  comicKey,
  getAdventure,
  rehydrateSavedPages,
  toSavedComicMeta,
  type HeroComic,
  type SavedComicMeta,
} from "../../lib/heroComics";
import { getScene } from "../../lib/sceneCache";
import type { HeroPackId } from "../../types";

/**
 * ComicsTab (p1-comic-reader) — the bookshelf host for the `comics` route.
 * The shelf lists every canon ADVENTURE as a comic BOOK: saved books re-open
 * instantly from their cached pages ("Read again"), unread adventures invite
 * a fresh build ("Make this comic"). Opening a book mounts ComicReader, which
 * owns the whole multi-page experience (cover-first streaming build, RTL page
 * turns, per-page retry, save/share).
 *
 * COST GUARD: the shelf itself never generates anything — a book build (up to
 * ~6 image-gen calls, throttled by lib/sceneCache) starts only when the parent
 * explicitly opens a book. Saved books replay from the in-session cache with
 * zero new calls; in a new session the art rebuilds on open.
 *
 * W5.4: the shelf is durable — saved books persist as METADATA ONLY through the
 * GDPR-registered "savedComics" child collection (Firestore + realtime, or the
 * localStorage sandbox). Art data-URLs are never persisted (Firestore 1MB doc
 * cap; localStorage image persistence is a banned regression — lib/sceneCache);
 * cross-session art durability is the separate Guy-gated Firebase Storage layer.
 */

/** Comic-world skin per pack (matches HeroJourneyTab + the Hero Arcade layer). */
const PACK_WORLD: Record<HeroPackId, { bg: string; ink: string; label: string; labelHe: string }> = {
  courage: { bg: "var(--arbor-peach)", ink: "var(--arbor-peach-ink)", label: "Courage", labelHe: "אומץ" },
  responsibility: { bg: "var(--arbor-yellow)", ink: "var(--arbor-yellow-ink)", label: "Responsibility", labelHe: "אחריות" },
  growth: { bg: "var(--arbor-primary)", ink: "var(--arbor-primary-deep)", label: "Growth", labelHe: "צמיחה" },
  wisdom: { bg: "var(--arbor-sky)", ink: "var(--arbor-sky-ink)", label: "Wisdom", labelHe: "חוכמה" },
  truth: { bg: "var(--arbor-pack-truth)", ink: "var(--arbor-pack-truth)", label: "Truth", labelHe: "אמת" },
};

/** Per-story scene prop, so an unread book still shows the hero in-world. */
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

export default function ComicsTab() {
  const { childProfile, setActiveTab, openPaywall } = useArbor();
  const { aiLang } = useLanguage();
  const { url: heroUrl, hasHero, name } = useHeroAvatar();

  // The durable shelf: one metadata doc per saved adventure (doc id = adventureId).
  const savedCol = useChildCollection<SavedComicMeta>(childProfile.id, "savedComics");
  const savedByAdventure = useMemo(
    () => Object.fromEntries(savedCol.items.map((m) => [m.adventureId, m])) as Record<string, SavedComicMeta>,
    [savedCol.items]
  );
  // The adventure currently open in the reader (null = bookshelf).
  const [openId, setOpenId] = useState<string | null>(null);

  const he = aiLang === "he";
  const heroDataUrl = heroUrl && heroUrl.startsWith("data:") ? heroUrl : undefined;
  // Must match generatePage's cache-key token so rehydration finds its pages.
  const avatarKeyToken = heroDataUrl || "no-hero";
  const savedCount = savedCol.items.length;

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
            <Icon name="auto_awesome" size={16} /> Create {name}&apos;s hero
          </PlayButton>
        </PlayPanel>
      </PlayShell>
    );
  }

  // ── Reader view — one open book ────────────────────────────────────────────
  const openAdventure = openId ? getAdventure(openId) : undefined;
  if (openAdventure) {
    // Re-open a saved book in the CURRENT language: fully cached pages hydrate
    // instantly (zero calls); a cache miss (e.g. a new session) hands ComicReader
    // an empty pageUrls so it falls back to a fresh build. `createdAt` carries
    // over so re-saving upserts the same shelf slot.
    const meta = savedByAdventure[openAdventure.id];
    const savedBook: HeroComic | undefined = meta
      ? {
          id: meta.id,
          adventureId: meta.adventureId,
          title: adventureTitle(openAdventure, aiLang),
          lang: aiLang,
          pageUrls: rehydrateSavedPages(openAdventure.id, aiLang, avatarKeyToken),
          createdAt: meta.createdAt,
        }
      : undefined;
    return (
      <PlayShell>
        <ComicReader
          adventure={openAdventure}
          lang={aiLang}
          heroName={name}
          heroDataUrl={heroDataUrl}
          saved={savedBook}
          onSave={(comic) => { void savedCol.upsert(toSavedComicMeta(comic)); }}
          onClose={() => setOpenId(null)}
          // Paywall stop: open the upgrade sheet and return to the shelf — the
          // stopped build would otherwise leave un-generated pages spinning.
          onPaywall={(err) => {
            setOpenId(null);
            openPaywall(err.feature || "heroComic", err.plan);
          }}
        />
      </PlayShell>
    );
  }

  // ── Bookshelf view ─────────────────────────────────────────────────────────
  return (
    <PlayShell>
      <PlayHeader
        title="Hero Comics"
        say={he ? `כל הרפתקה היא ספר קומיקס שלם — בכיכוב ${name}!` : `Every adventure is a whole comic book — starring ${name}!`}
        mood="cheer"
      />

      {/* Shelf summary */}
      <PlayPanel tone="clay">
        <p className="text-[1.05rem] font-extrabold leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }} dir="auto">
          {he ? `מדף הקומיקס של ${name}` : `${name}'s comic bookshelf`}
        </p>
        <p className="text-[12.5px] mt-0.5" style={{ color: "var(--arbor-muted)" }} dir="auto">
          {he ? `${savedCount} מתוך ${ADVENTURES.length} ספרים על המדף` : `${savedCount} of ${ADVENTURES.length} books on the shelf`}
        </p>
      </PlayPanel>

      {/* Book grid — every canon adventure as a multi-page comic book */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
        {ADVENTURES.map((a) => {
          const w = PACK_WORLD[a.pack];
          const emoji = STORY_EMOJI[a.id] ?? "⭐";
          const saved = savedByAdventure[a.id];
          // In-session cover thumbnail only (art is never persisted): current
          // lang first, then the lang the book was saved in; else the hero card.
          const coverThumb = saved
            ? getScene(comicKey(avatarKeyToken, a.id, aiLang, 0)) ?? getScene(comicKey(avatarKeyToken, a.id, saved.lang, 0))
            : undefined;
          const title = adventureTitle(a, aiLang);
          return (
            <div key={a.id} className="comic-panel overflow-hidden">
              {/* Book cover: the saved cover art, or the hero waiting in this world */}
              <div className="relative" style={{ aspectRatio: "3 / 2", borderBottom: "var(--comic-line)" }}>
                <button
                  onClick={() => setOpenId(a.id)}
                  aria-label={saved
                    ? (he ? `לקרוא שוב: ${title}` : `Read again: ${title}`)
                    : (he ? `צרו קומיקס: ${title}` : `Make this comic: ${title}`)}
                  className="absolute inset-0 grid place-items-center"
                  style={coverThumb ? undefined : { background: w.bg }}
                >
                  {coverThumb ? (
                    <img src={coverThumb} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="comic-halftone absolute inset-0 grid place-items-center">
                      <div className="flex items-center gap-1.5">
                        <HeroAvatar size={74} ring animate={false} decorative />
                        <span style={{ fontSize: 42, filter: "drop-shadow(2px 2px 0 rgba(23,27,34,.3))" }} aria-hidden="true">{emoji}</span>
                      </div>
                    </div>
                  )}
                  <span
                    className="absolute bottom-2 inline-flex items-center gap-1 text-[12px] font-black rounded-full px-3 py-1"
                    style={{ insetInlineStart: 8, background: "#fff", border: "var(--comic-line)", color: "var(--arbor-ink)" }}
                  >
                    <Icon name={saved ? "menu_book" : "auto_awesome"} size={14} /> {saved ? (he ? "לקרוא שוב" : "Read again") : (he ? "צרו את הקומיקס" : "Make this comic")}
                  </span>
                </button>
              </div>

              {/* Caption */}
              <div className="p-3.5">
                <div className="flex items-center gap-2">
                  <span className="font-black text-[15px] leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }} dir="auto">
                    {title}
                  </span>
                  <span className="ms-auto inline-block text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ border: "2px solid var(--comic-ink)", color: w.ink }}>
                    {he ? w.labelHe : w.label}
                  </span>
                </div>
                {saved && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-black mt-2" style={{ color: "var(--arbor-green-ink)" }}>
                    <Icon name="check" size={14} /> {he ? "על המדף" : "On the shelf"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl p-3.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-ink)" }}>
        <span className="font-extrabold inline-flex items-center gap-1.5" style={{ color: "var(--arbor-green-ink)" }}><Icon name="verified_user" size={16} /> Safe &amp; private</span>
        <span style={{ color: "var(--arbor-muted)" }}>Comics use {name}&apos;s saved cartoon hero — never a real photo. Images are AI-made and provenance-watermarked.</span>
      </div>
    </PlayShell>
  );
}
