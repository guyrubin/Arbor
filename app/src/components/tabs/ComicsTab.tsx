import React, { useState } from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { PlayShell, PlayHeader, PlayButton, PlayPanel } from "../ui/playkit";
import { HeroAvatar, useHeroAvatar } from "../ui/HeroAvatar";
import { ComicReader } from "../stories/ComicReader";
import { ADVENTURES, adventureTitle, getAdventure, type HeroComic } from "../../lib/heroComics";
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
 * explicitly opens a book. Saved books replay from cache with zero new calls.
 *
 * Saved books live in component state for the session (large data URLs are
 * never persisted to the per-child Firestore doc); W5.4 adds durable shelves.
 */

/** Comic-world skin per pack (matches HeroJourneyTab + the Hero Arcade layer). */
const PACK_WORLD: Record<HeroPackId, { bg: string; ink: string; label: string; labelHe: string }> = {
  courage: { bg: "var(--arbor-peach)", ink: "var(--arbor-peach-ink)", label: "Courage", labelHe: "אומץ" },
  responsibility: { bg: "var(--arbor-yellow)", ink: "var(--arbor-yellow-ink)", label: "Responsibility", labelHe: "אחריות" },
  growth: { bg: "var(--arbor-clay)", ink: "var(--arbor-clay-deep)", label: "Growth", labelHe: "צמיחה" },
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
  const { setActiveTab, openPaywall } = useArbor();
  const { aiLang } = useLanguage();
  const { url: heroUrl, hasHero, name } = useHeroAvatar();

  // adventureId → saved book (session-only; W5.4 persists the shelf).
  const [savedComics, setSavedComics] = useState<Record<string, HeroComic>>({});
  // The adventure currently open in the reader (null = bookshelf).
  const [openId, setOpenId] = useState<string | null>(null);

  const he = aiLang === "he";
  const heroDataUrl = heroUrl && heroUrl.startsWith("data:") ? heroUrl : undefined;
  const savedCount = Object.keys(savedComics).length;

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
    return (
      <PlayShell>
        <ComicReader
          adventure={openAdventure}
          lang={aiLang}
          heroName={name}
          heroDataUrl={heroDataUrl}
          saved={savedComics[openAdventure.id]}
          onSave={(comic) => setSavedComics((c) => ({ ...c, [comic.adventureId]: comic }))}
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
          const saved = savedComics[a.id];
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
                  style={saved?.coverUrl ? undefined : { background: w.bg }}
                >
                  {saved?.coverUrl ? (
                    <img src={saved.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
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
