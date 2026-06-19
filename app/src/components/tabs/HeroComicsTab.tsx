import React, { useMemo, useState } from "react";
import { Sparkles, ShieldCheck, BookOpen } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { useHeroAvatar } from "../ui/HeroAvatar";
import { PlayShell, PlayHeader, PlayButton, PlayPanel } from "../ui/playkit";
import { ComicReader } from "../stories/ComicReader";
import { ADVENTURES, getAdventure, adventureTitle, type Adventure, type HeroComic } from "../../lib/heroComics";

/**
 * Comic Studio (Academy › `comics`) — the single home for the Comic Reader.
 * The child picks an adventure → an N-page comic BOOK is generated (cover + beats)
 * and read in a page-turn reader (ComicReader). Finished books are saved per child
 * (the `heroComics` collection) and re-open instantly from the Bookshelf — a
 * durable, longitudinal artifact that feeds the memory moat and the growth loop.
 *
 * Privacy-first: the hero is always the child's saved stylized avatar (data-URL),
 * never a real photo; generated images are provenance-watermarked.
 */

const PACK_COLORS: Record<Adventure["pack"], string> = {
  courage: "var(--arbor-clay)",
  responsibility: "var(--arbor-peach)",
  growth: "var(--arbor-green-ink)",
  wisdom: "var(--arbor-sky)",
};

export default function HeroComicsTab() {
  const { childProfile, setActiveTab } = useArbor();
  const { aiLang } = useLanguage();
  const { url: heroUrl, hasHero, name } = useHeroAvatar();

  const lang = aiLang === "he" ? "he" : "en";
  const heroDataUrl = heroUrl && heroUrl.startsWith("data:") ? heroUrl : undefined;

  // Durable per-child bookshelf (Firestore when signed-in; localStorage in sandbox).
  const bookshelf = useChildCollection<HeroComic>(childProfile.id, "heroComics", {
    orderByField: "createdAt",
    orderDir: "desc",
  });

  // The active reader: a fresh build (adventure) or a re-opened saved book.
  const [active, setActive] = useState<{ adventure: Adventure; saved?: HeroComic } | null>(null);

  const savedByAdventure = useMemo(() => {
    const m = new Map<string, HeroComic>();
    for (const c of bookshelf.items) if (!m.has(c.adventureId)) m.set(c.adventureId, c);
    return m;
  }, [bookshelf.items]);

  // ── No-hero gate ──────────────────────────────────────────────────────────
  if (!hasHero) {
    return (
      <PlayShell>
        <PlayHeader title="Comic Studio" say={`Turn ${name} into the star of their own comic book.`} mood="cheer" />
        <PlayPanel tone="lav" className="text-center">
          <p className="text-[1.3rem] font-extrabold mb-2" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
            First, create {name}&apos;s hero
          </p>
          <p className="text-sm mb-5 max-w-md mx-auto" style={{ color: "var(--arbor-muted)" }}>
            Make {name} into their own comic superhero — then they star in every comic and adventure across Arbor.
          </p>
          <PlayButton tone="clay" onClick={() => setActiveTab("profile")}>
            <Sparkles className="w-4 h-4" /> Create {name}&apos;s hero
          </PlayButton>
        </PlayPanel>
      </PlayShell>
    );
  }

  // ── Reader ────────────────────────────────────────────────────────────────
  if (active) {
    return (
      <PlayShell>
        <ComicReader
          adventure={active.adventure}
          lang={lang}
          heroName={name}
          heroDataUrl={heroDataUrl}
          saved={active.saved}
          onSave={(comic) => { void bookshelf.upsert(comic); }}
          onClose={() => setActive(null)}
        />
      </PlayShell>
    );
  }

  // ── Catalog ───────────────────────────────────────────────────────────────
  return (
    <PlayShell>
      <PlayHeader title="Comic Studio" say={`Pick an adventure — ${name} stars in their own comic book!`} mood="cheer" />

      {/* Bookshelf — saved books re-open instantly from cache. */}
      {bookshelf.loaded && bookshelf.items.length > 0 && (
        <PlayPanel tone="clay">
          <p className="text-[1.05rem] font-extrabold leading-tight mb-3" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
            {name}&apos;s bookshelf ({bookshelf.items.length})
          </p>
          <div className="flex flex-wrap gap-3">
            {bookshelf.items.map((c) => (
              <button
                key={c.id}
                onClick={() => { const a = getAdventure(c.adventureId); if (a) setActive({ adventure: a, saved: c }); }}
                className="play-pressable rounded-[14px] overflow-hidden text-left bg-white shadow-[0_4px_14px_rgba(41,51,63,0.08)]"
                style={{ width: 132, border: "2.5px solid var(--arbor-ink)" }}
                aria-label={`Re-open ${c.title}`}
              >
                <div className="aspect-[3/2] w-full" style={{ background: "var(--arbor-paper-deep)" }}>
                  {c.coverUrl ? (
                    <img src={c.coverUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full grid place-items-center"><BookOpen className="w-6 h-6" style={{ color: "var(--arbor-muted)" }} /></div>
                  )}
                </div>
                <p className="px-2 py-1.5 text-[11px] font-extrabold leading-tight" style={{ color: "var(--arbor-ink)" }}>{c.title}</p>
              </button>
            ))}
          </div>
        </PlayPanel>
      )}

      {/* Empty bookshelf nudge. */}
      {bookshelf.loaded && bookshelf.items.length === 0 && (
        <PlayPanel tone="lav" className="text-center">
          <BookOpen className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--arbor-lav-ink, var(--arbor-muted))" }} />
          <p className="text-sm font-bold" style={{ color: "var(--arbor-ink-soft)" }}>
            Pick an adventure to make your first comic.
          </p>
        </PlayPanel>
      )}

      {/* Adventure picker. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {ADVENTURES.map((a) => {
          const color = PACK_COLORS[a.pack];
          const saved = savedByAdventure.get(a.id);
          return (
            <button
              key={a.id}
              onClick={() => setActive({ adventure: a, saved })}
              className="play-pressable rounded-[var(--play-radius)] p-3.5 bg-white shadow-[0_4px_16px_rgba(41,51,63,0.06)] text-left flex items-center gap-3"
              style={{ border: "2.5px solid transparent" }}
            >
              <span className="grid place-items-center rounded-[12px] flex-shrink-0" style={{ width: 48, height: 48, background: `${color}1f` }}>
                <BookOpen className="w-6 h-6" style={{ color }} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] font-extrabold leading-tight" style={{ color: "var(--arbor-ink)" }}>
                  {adventureTitle(a, lang)}
                </span>
                <span className="block text-[11.5px] mt-0.5" style={{ color: "var(--arbor-muted)" }}>
                  {saved ? "Saved — tap to re-open" : "Make this comic"}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl p-3.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-ink)" }}>
        <span className="font-extrabold inline-flex items-center gap-1.5" style={{ color: "var(--arbor-green-ink)" }}><ShieldCheck className="w-4 h-4" /> Safe &amp; private</span>
        <span style={{ color: "var(--arbor-muted)" }}>Comics use {name}&apos;s saved cartoon hero — never a real photo. Images are AI-made and provenance-watermarked.</span>
      </div>
    </PlayShell>
  );
}
