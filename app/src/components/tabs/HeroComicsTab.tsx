import React, { useState } from "react";
import { Sparkles, Wand2, Download, RefreshCw, ShieldCheck, BookOpen } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { api } from "../../lib/api";
import { track } from "../../lib/analytics";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { PlayShell, PlayHeader, PlayButton, PlayPanel } from "../ui/playkit";
import { useHeroAvatar } from "../ui/HeroAvatar";

/**
 * Hero Comics (Academy) — the child is the star of their own comic-book page.
 * Pick an adventure, and the child's saved hero avatar is rendered as the
 * protagonist of a dynamic cel-shaded comic panel via /api/generate-comic.
 * Falls back to a "create your hero" state when no avatar exists yet.
 */
const ADVENTURES: { id: string; emoji: string; title: string; theme: string; dialogue: (n: string) => string; sfx: string[] }[] = [
  { id: "rescue", emoji: "🦸", title: "The big rescue", theme: "a brave superhero rescue — saving a beloved stuffed animal who got lost", dialogue: (n) => `Don't worry — ${n} is on the case!`, sfx: ["KA-POW!", "WHOOSH!", "ZAP!"] },
  { id: "kind", emoji: "💛", title: "Super kindness", theme: "using super-kindness powers to help a friend who feels sad", dialogue: (n) => `${n} is here to help!`, sfx: ["AWW!", "TA-DA!", "ZING!"] },
  { id: "brave", emoji: "🌙", title: "Brave at bedtime", theme: "being brave in a cozy bedroom at night, turning shadows into friendly shapes", dialogue: (n) => `${n} is brave and strong!`, sfx: ["WHOOSH!", "TWINKLE!", "POOF!"] },
  { id: "team", emoji: "🤝", title: "Teamwork time", theme: "teaming up to build the most amazing fort and save the day together", dialogue: (n) => `Teamwork, go!`, sfx: ["BOOM!", "CLICK!", "HOORAY!"] },
  { id: "explorer", emoji: "🗺️", title: "Brave explorer", theme: "a daring explorer discovering a hidden world in the back garden", dialogue: (n) => `Adventure awaits, ${n}!`, sfx: ["WHOOSH!", "AHA!", "SPLASH!"] },
  { id: "calm", emoji: "🧘", title: "Calm-down hero", theme: "using calm-breathing super-powers to turn a big stormy feeling into sunshine", dialogue: (n) => `Breathe in… ${n} has this!`, sfx: ["WHOOSH…", "AHH…", "SHINE!"] },
];

export default function HeroComicsTab() {
  const { childProfile, setActiveTab, openPaywall } = useArbor();
  const { t } = useLanguage();
  const { url: heroUrl, hasHero, name } = useHeroAvatar();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [comic, setComic] = useState<string | null>(null);

  // M4: loading + friendly error + start/success/error analytics ("hero_comic_*").
  // A 402 opens the paywall (conversion moment) instead of an inline error.
  const comicGen = useAsyncAction(
    "hero_comic",
    (adv: (typeof ADVENTURES)[number]) =>
      api.generateComic({
        ...(heroUrl && heroUrl.startsWith("data:") ? { avatar: { dataUrl: heroUrl } } : {}),
        heroName: name,
        theme: adv.theme,
        dialogue: adv.dialogue(name),
        sfx: adv.sfx,
        style: "comichero",
      }),
    {
      fallbackError: t("gen.comic.fail"),
      onPaywall: (err) => openPaywall(err.feature || "heroComic", err.plan),
    },
  );
  const loading = comicGen.loading;
  const error = comicGen.error;

  const make = async (adventureId: string) => {
    const adv = ADVENTURES.find((a) => a.id === adventureId);
    if (!adv) return;
    setActiveId(adventureId);
    setComic(null);
    const res = await comicGen.run(adv);
    if (!res) return;
    setComic(res.dataUrl);
    track("hero_comic_generated", { adventure: adventureId });
  };

  const download = () => {
    if (!comic) return;
    const a = document.createElement("a");
    a.href = comic;
    a.download = `${name}-hero-comic.png`;
    a.click();
  };

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
            Make {name} into their own comic superhero — then they star in every comic, story and adventure across Arbor.
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
      <PlayHeader title="Hero Comics" say={`Pick an adventure — ${name} stars in it!`} mood="cheer" />

      {/* Adventure picker */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {ADVENTURES.map((a) => (
          <button
            key={a.id}
            onClick={() => make(a.id)}
            disabled={loading}
            className={`play-pressable rounded-[var(--play-radius)] p-4 text-center bg-white shadow-[0_4px_16px_rgba(41,51,63,0.06)] disabled:opacity-60 ${activeId === a.id ? "ring-2" : ""}`}
            style={{ border: activeId === a.id ? "2.5px solid var(--arbor-lav-ink)" : "2.5px solid transparent" }}
          >
            <span className="text-4xl block">{a.emoji}</span>
            <span className="text-[13px] font-extrabold block mt-2 leading-tight" style={{ color: "var(--arbor-ink)" }}>{a.title}</span>
          </button>
        ))}
      </div>

      {/* Comic stage */}
      <PlayPanel>
        {loading && (
          <div className="aspect-[3/2] rounded-[var(--play-radius)] flex flex-col items-center justify-center gap-3" style={{ background: "var(--arbor-paper-deep)" }}>
            <Wand2 className="w-9 h-9 animate-pulse" style={{ color: "var(--arbor-lav-ink)" }} />
            <p className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>Drawing {name}&apos;s comic…</p>
            <p className="text-[12px]" style={{ color: "var(--arbor-muted)" }}>This takes a few seconds — superhero work is hard!</p>
          </div>
        )}

        {!loading && comic && (
          <div>
            <img src={comic} alt={`${name}'s hero comic`} className="w-full rounded-[var(--play-radius)] shadow-[0_8px_28px_rgba(41,51,63,0.16)]" style={{ border: "3px solid var(--arbor-ink)" }} />
            <div className="flex flex-wrap items-center gap-2.5 mt-4">
              <PlayButton tone="lav" onClick={() => activeId && make(activeId)}>
                <RefreshCw className="w-4 h-4" /> Make another
              </PlayButton>
              <PlayButton variant="soft" tone="clay" onClick={download}>
                <Download className="w-4 h-4" /> Save comic
              </PlayButton>
            </div>
          </div>
        )}

        {!loading && !comic && (
          <div className="aspect-[3/2] rounded-[var(--play-radius)] flex flex-col items-center justify-center gap-2 text-center px-6" style={{ background: "var(--arbor-paper-deep)" }}>
            <BookOpen className="w-9 h-9" style={{ color: "var(--arbor-lav-ink)" }} />
            <p className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>Pick an adventure above</p>
            <p className="text-[12px] max-w-sm" style={{ color: "var(--arbor-muted)" }}>{name} will become the comic-book hero of the story you choose.</p>
          </div>
        )}

        {error && <p className="text-[13px] font-semibold mt-3" style={{ color: "var(--arbor-pink-ink)" }}>{error}</p>}
      </PlayPanel>

      <div className="rounded-2xl p-3.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-ink)" }}>
        <span className="font-extrabold inline-flex items-center gap-1.5" style={{ color: "var(--arbor-green-ink)" }}><ShieldCheck className="w-4 h-4" /> Safe &amp; private</span>
        <span style={{ color: "var(--arbor-muted)" }}>Comics use {name}&apos;s saved cartoon hero — never a real photo. Images are AI-made and provenance-watermarked.</span>
      </div>
    </PlayShell>
  );
}
