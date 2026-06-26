import React, { lazy, Suspense, useMemo, useState } from "react";
import {
  Mic, Smile, HeartPulse, Map as MapIcon, Brain, BookOpen, Music, PersonStanding, Shapes,
  ArrowLeft, Star, Flame, Lock, Camera, type LucideIcon,
} from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { usePracticeData } from "../../practice/usePracticeData";
import { evaluateCosmetics, type CosmeticStats } from "../../practice/cosmetics";
import { HeroAvatar, useHeroAvatar } from "../ui/HeroAvatar";
import HeroCrest from "../ui/HeroCrest";
import { ArborMascot } from "../ui/ArborMascot";
import { TabSkeleton } from "../ui/Skeleton";

/* HeroArcade — the comic-book Playbank home. The child's generated hero is the
   protagonist; each skill is a themed "world". Replaces the flat tab strip with
   a world picker, then renders the existing game tabs as the world's panel.
   New worlds (Beat Keeper / Hero Pose / Pattern Power) and the comic-share loop
   land in later waves; they show here as "soon" so the full map is visible. */

const SpeechCoachTab = lazy(() => import("./SpeechCoachTab"));
const MimicStudioTab = lazy(() => import("./MimicStudioTab"));
const FeelingsLabTab = lazy(() => import("./FeelingsLabTab"));
const AdventuresTab = lazy(() => import("./AdventuresTab"));
import WorldScene from "./WorldScene";
const MindVaultWorld = lazy(() => import("./MindVaultWorld"));
const SpellForgeWorld = lazy(() => import("./SpellForgeWorld"));
const BeatKeeperWorld = lazy(() => import("./BeatKeeperWorld"));
const HeroPoseWorld = lazy(() => import("./HeroPoseWorld"));
const PatternPowerWorld = lazy(() => import("./PatternPowerWorld"));
const WordWorldTab = lazy(() => import("./WordWorldTab"));

const READING_KINDS = new Set(["phonics", "sight-word", "letter-trace"]);

type WorldColor = "sky" | "lav" | "pink" | "peach" | "yellow" | "clay";

interface World {
  id: string;
  name: string;
  tag: string;
  icon: LucideIcon;
  color: WorldColor;
  /** Scene description for the illustrated card — the hero is composited in (I1). */
  imagePrompt: string;
  Comp?: React.ComponentType;
  count?: (d: ReturnType<typeof usePracticeData>) => number;
  isNew?: boolean;
}

const COLOR: Record<WorldColor, { bg: string; ink: string }> = {
  sky: { bg: "var(--arbor-sky)", ink: "var(--arbor-sky-ink)" },
  lav: { bg: "var(--arbor-lav)", ink: "var(--arbor-lav-ink)" },
  pink: { bg: "var(--arbor-pink)", ink: "var(--arbor-pink-ink)" },
  peach: { bg: "var(--arbor-peach)", ink: "var(--arbor-peach-ink)" },
  yellow: { bg: "var(--arbor-yellow)", ink: "var(--arbor-yellow-ink)" },
  clay: { bg: "var(--arbor-clay)", ink: "var(--arbor-clay-deep)" },
};

const WORLDS: World[] = [
  { id: "speech", name: "Sound Lab", tag: "Speech", icon: Mic, color: "sky", imagePrompt: "a bright sound-and-music studio with a big microphone, floating letters and musical notes", Comp: SpeechCoachTab, count: (d) => d.speech.items.length },
  { id: "feelings", name: "Mood Mountain", tag: "Feelings", icon: HeartPulse, color: "lav", imagePrompt: "a friendly mountain landscape with cheerful emotion characters (happy, sad, calm) and a warm sky", Comp: FeelingsLabTab, count: (d) => d.events.items.length },
  { id: "adventures", name: "Story Quest", tag: "Adventure", icon: MapIcon, color: "peach", imagePrompt: "an adventurous storybook landscape, holding a treasure map with a compass on a cliff", Comp: AdventuresTab, count: (d) => d.adventures.items.length },
  { id: "mimic", name: "Mimic Studio", tag: "Mimic", icon: Smile, color: "clay", imagePrompt: "a playful mirror studio making a silly happy face, sparkles around", Comp: MimicStudioTab, count: (d) => d.mimic.items.length },
  { id: "memory", name: "Mind Vault", tag: "Memory", icon: Brain, color: "pink", imagePrompt: "opening a glowing memory vault full of colorful matching cards", Comp: MindVaultWorld, count: (d) => d.events.items.filter((e) => e.kind === "memory").length },
  { id: "reading", name: "Spell Forge", tag: "Reading", icon: BookOpen, color: "yellow", imagePrompt: "a magical letter forge where glowing letters become words", Comp: SpellForgeWorld, count: (d) => d.events.items.filter((e) => READING_KINDS.has(e.kind)).length },
  { id: "beat", name: "Beat Keeper", tag: "Rhythm", icon: Music, color: "clay", imagePrompt: "a colorful music stage with drums, rhythm bars and bouncing musical notes", isNew: true, Comp: BeatKeeperWorld, count: (d) => d.events.items.filter((e) => e.kind === "rhythm").length },
  { id: "pose", name: "Hero Pose", tag: "Move", icon: PersonStanding, color: "sky", imagePrompt: "a dynamic superhero action pose with bold motion lines", isNew: true, Comp: HeroPoseWorld, count: (d) => d.events.items.filter((e) => e.kind === "pose").length },
  { id: "pattern", name: "Pattern Power", tag: "Logic", icon: Shapes, color: "lav", imagePrompt: "a puzzle world of glowing shapes arranged in patterns", isNew: true, Comp: PatternPowerWorld, count: (d) => d.events.items.filter((e) => e.kind === "pattern").length },
  { id: "word-world", name: "Word World", tag: "Language", icon: BookOpen, color: "sky", imagePrompt: "a warm cozy reading nook with open books, speech bubbles, and colorful letters floating gently", isNew: true, Comp: WordWorldTab, count: (d) => d.events.items.filter((e) => e.kind === "lang-strategy").length },
];

function Stars({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5 mt-2" aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <Star key={i} className="w-3.5 h-3.5" style={{ color: i < n ? "var(--arbor-yellow)" : "#cdc8bd" }}
          fill={i < n ? "var(--arbor-yellow)" : "none"} strokeWidth={2.5} aria-hidden="true" />
      ))}
    </div>
  );
}

export default function HeroArcade() {
  const { childProfile, setActiveTab } = useArbor();
  const data = usePracticeData(childProfile.id);
  const hero = useHeroAvatar();
  const [openId, setOpenId] = useState<string | null>(null);

  const stats: CosmeticStats = useMemo(() => ({
    totalSessions:
      data.speech.items.length + data.mimic.items.length + data.adventures.items.length +
      data.events.items.length + data.missions.items.filter((m) => m.completed).length,
    streakDays: data.streak,
    domainsTouched: data.week.domainsTouched.length,
  }), [data]);

  const { unlocked, next, activeFrame } = useMemo(() => evaluateCosmetics(stats), [stats]);
  const badges = useMemo(() => unlocked.filter((c) => c.kind === "badge"), [unlocked]);
  const title = useMemo(() => unlocked.filter((c) => c.kind === "title").slice(-1)[0] ?? null, [unlocked]);
  const level = 1 + Math.floor(stats.totalSessions / 5);
  const powerPct = Math.round(((stats.totalSessions % 5) / 5) * 100);

  const open = openId ? WORLDS.find((w) => w.id === openId) : null;
  if (open?.Comp) {
    const Comp = open.Comp;
    return (
      <div className="arbor-play space-y-4">
        <button onClick={() => setOpenId(null)}
          className="play-pressable inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-extrabold"
          style={{ background: "var(--arbor-paper-elevated)", border: "var(--comic-line)", boxShadow: "var(--comic-pop)" }}>
          <ArrowLeft className="w-4 h-4" /> All worlds
        </button>
        <Suspense fallback={<TabSkeleton />}><Comp /></Suspense>
      </div>
    );
  }

  return (
    <div className="arbor-play space-y-6">
      {/* HERO PANEL */}
      <section className="comic-panel p-5 sm:p-6 flex items-center gap-4 sm:gap-6" aria-label="Your hero">
        <HeroCrest size={104} frame={activeFrame} badges={badges}>
          <HeroAvatar size={104} mood="cheer" />
        </HeroCrest>
        <div className="flex-1 min-w-0">
          <div className="inline-flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[12px] font-black text-white rounded-full px-2.5 py-0.5"
              style={{ background: "var(--arbor-lav)", border: "var(--comic-line)" }}>LVL {level}</span>
            {title ? (
              <span className="text-[12px] font-black rounded-full px-2.5 py-0.5"
                style={{ background: "var(--arbor-yellow-soft)", color: "var(--arbor-yellow-ink)", border: "var(--comic-line)" }}>
                <span aria-hidden="true">{title.emoji}</span> {title.label}
              </span>
            ) : (
              <span className="text-[13px] font-extrabold" style={{ color: "var(--arbor-lav-ink)" }}>Hero of the week</span>
            )}
          </div>
          <h1 className="font-black leading-none truncate" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(24px,5vw,40px)" }}>
            {hero.name === "your child" ? "Your hero" : `${hero.name} the Brave`}
          </h1>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <div className="flex-1 min-w-[180px]">
              <div className="flex justify-between text-[12px] font-extrabold mb-1" style={{ color: "var(--arbor-ink-soft)" }}>
                <span>Power level</span><span>{powerPct}%</span>
              </div>
              <div className="h-5 rounded-full overflow-hidden" style={{ background: "#fff", border: "var(--comic-line)" }}>
                <div className="power-fill" style={{ width: `${powerPct}%` }} />
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-2xl px-3 py-2"
              style={{ background: "#fff", border: "var(--comic-line)", boxShadow: "var(--comic-pop)" }}>
              <Flame className="w-5 h-5" style={{ color: "var(--arbor-peach)" }} fill="var(--arbor-peach)" />
              <b className="text-[18px]" style={{ fontFamily: "var(--font-display)" }}>{data.streak}</b>
              <span className="text-[12px] font-extrabold" style={{ color: "var(--arbor-ink-soft)" }}>day streak</span>
            </div>
          </div>
        </div>
      </section>

      {/* SPROUT COACH */}
      <div className="flex items-end gap-3">
        <ArborMascot size={52} mood="wave" animate className="flex-shrink-0" />
        <div className="relative comic-panel px-4 py-3 text-[14px] font-extrabold" style={{ boxShadow: "var(--comic-pop)" }}>
          Pick a world, hero. Every win powers up {hero.name === "your child" ? "your hero" : hero.name}!
        </div>
      </div>

      {/* WORLDS */}
      <div>
        <h2 className="font-black mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(18px,3.4vw,24px)" }}>Choose your world</h2>
        <div className="grid gap-3 sm:gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
          {WORLDS.map((w) => {
            const Icon = w.icon;
            const live = !!w.Comp;
            const stars = w.count ? Math.min(3, Math.floor(w.count(data) / 3)) : 0;
            const c = COLOR[w.color];
            return (
              <button key={w.id} className="world-tile text-start relative" aria-disabled={!live}
                aria-label={`${w.name}, ${w.tag}${live ? "" : ", coming soon"}`}
                onClick={() => live && setOpenId(w.id)}>
                {w.isNew && (
                  <span className="absolute top-0 left-0 z-[2] text-[11px] font-black text-white px-2.5 py-1"
                    style={{ background: "var(--arbor-pink)", border: "var(--comic-line)", borderTopLeftRadius: "var(--play-radius)", borderBottomRightRadius: "12px" }}>NEW</span>
                )}
                <div className="comic-halftone relative overflow-hidden" style={{ height: 120, background: c.bg, borderBottom: "var(--comic-line)" }}>
                  <WorldScene worldId={w.id} imagePrompt={w.imagePrompt} heroUrl={hero.url ?? undefined}>
                    <Icon className="w-12 h-12" style={{ color: "#fff", filter: "drop-shadow(2px 2px 0 rgba(23,27,34,.35))" }} strokeWidth={2.5} aria-hidden="true" />
                  </WorldScene>
                </div>
                <div className="p-3">
                  <p className="font-black text-[16px] leading-none mb-2" style={{ fontFamily: "var(--font-display)" }}>{w.name}</p>
                  <span className="inline-block text-[10.5px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full"
                    style={{ border: "2px solid var(--comic-ink)", color: c.ink }}>{w.tag}</span>
                  {live ? <Stars n={stars} /> : (
                    <span className="flex items-center gap-1 mt-2 text-[12px] font-bold" style={{ color: "var(--arbor-muted)" }}>
                      <Lock className="w-3.5 h-3.5" aria-hidden="true" /> Soon
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* HERO GEAR (cosmetics earned through play) */}
      <div>
        <h2 className="font-black mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(18px,3.4vw,24px)" }}>Your hero gear</h2>
        {unlocked.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {unlocked.map((c) => (
              <span key={c.id} title={c.requirement}
                className="inline-flex items-center gap-1.5 text-[13px] font-black px-3 py-2 rounded-2xl"
                style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "var(--comic-line)", boxShadow: "var(--comic-pop)" }}>
                <span aria-hidden="true">{c.emoji}</span> {c.label}
              </span>
            ))}
            {next && (
              <span className="inline-flex items-center gap-1.5 text-[13px] font-bold px-3 py-2 rounded-2xl"
                style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "3px dashed var(--comic-ink)" }}>
                <Lock className="w-3.5 h-3.5" aria-hidden="true" /> {next.cosmetic.label} · {next.cosmetic.requirement}
              </span>
            )}
          </div>
        ) : (
          <p className="text-[13px] font-bold" style={{ color: "var(--arbor-muted)" }}>
            Play a world to earn {hero.name}&apos;s first gear.
          </p>
        )}
      </div>

      {/* VIRAL COMIC CTA (share loop wired in a later wave) */}
      <section className="comic-panel p-5 sm:p-6 text-center" style={{ background: "var(--arbor-lav)", color: "#fff" }}>
        <h3 className="font-black mb-1.5" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(20px,4vw,30px)" }}>
          Make {hero.name === "your child" ? "your" : `${hero.name}'s`} comic!
        </h3>
        <p className="font-bold text-[14px] mb-4 opacity-95 max-w-[44ch] mx-auto">
          {hero.hasHero
            ? "Turn your hero into a comic page, ready to share with the family."
            : `Create ${hero.name === "your child" ? "your child's" : `${hero.name}'s`} hero, then star them in a shareable comic.`}
        </p>
        <button onClick={() => setActiveTab("comics")}
          className="play-pressable inline-flex items-center gap-2 rounded-full px-6 py-3 font-black text-[16px]"
          style={{ background: "var(--arbor-yellow)", color: "var(--arbor-ink)", border: "var(--comic-line)", boxShadow: "0 6px 0 0 var(--comic-ink)", fontFamily: "var(--font-display)" }}>
          <Camera className="w-5 h-5" /> {hero.hasHero ? "Create comic page" : "Create my hero"}
        </button>
      </section>
    </div>
  );
}
