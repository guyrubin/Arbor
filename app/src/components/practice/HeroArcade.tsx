import React, { lazy, Suspense, useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { usePracticeData } from "../../practice/usePracticeData";
import { evaluateCosmetics, lifetimeDomains, type CosmeticStats } from "../../practice/cosmetics";
import { HeroAvatar, useHeroAvatar } from "../ui/HeroAvatar";
import { isolate } from "../../lib/i18n";
import HeroCrest from "../ui/HeroCrest";
import { ArborMascot } from "../ui/ArborMascot";
import { TabSkeleton } from "../ui/Skeleton";
import { useKidSafeNav } from "../kidmode/useKidSafeNav";

/* HeroArcade — the comic-book Playbank home. The child's generated hero is the
   protagonist; each skill is a themed "world". Replaces the flat tab strip with
   a world picker, then renders the existing game tabs as the world's panel.
   New worlds (Beat Keeper / Hero Pose / Pattern Power) and the comic-share loop
   land in later waves; they show here as "soon" so the full map is visible.

   Kid register (lane K): the hero panel shows LEVEL + five star pips toward the
   next level (KID-16 — never a % bar that drops to 0 after a win); every badge
   keys on a lifetime metric (KID-02); every literal is an elev.play.arcade.*
   key; colours are tokens; the comics CTA renders only when the parent shell is
   reachable (KID-05, useKidSafeNav). */

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
  /** Material Symbols glyph name for the world's icon. */
  icon: string;
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
  { id: "speech", name: "Sound Lab", tag: "Speech", icon: "mic", color: "sky", imagePrompt: "a bright sound-and-music studio with a big microphone, floating letters and musical notes", Comp: SpeechCoachTab, count: (d) => d.speech.items.length },
  { id: "feelings", name: "Mood Mountain", tag: "Feelings", icon: "favorite", color: "lav", imagePrompt: "a friendly mountain landscape with cheerful emotion characters (happy, sad, calm) and a warm sky", Comp: FeelingsLabTab, count: (d) => d.events.items.length },
  { id: "adventures", name: "Story Quest", tag: "Adventure", icon: "map", color: "peach", imagePrompt: "an adventurous storybook landscape, holding a treasure map with a compass on a cliff", Comp: AdventuresTab, count: (d) => d.adventures.items.length },
  { id: "mimic", name: "Mimic Studio", tag: "Mimic", icon: "mood", color: "clay", imagePrompt: "a playful mirror studio making a silly happy face, sparkles around", Comp: MimicStudioTab, count: (d) => d.mimic.items.length },
  { id: "memory", name: "Mind Vault", tag: "Memory", icon: "psychology", color: "pink", imagePrompt: "opening a glowing memory vault full of colorful matching cards", Comp: MindVaultWorld, count: (d) => d.events.items.filter((e) => e.kind === "memory").length },
  { id: "reading", name: "Spell Forge", tag: "Reading", icon: "menu_book", color: "yellow", imagePrompt: "a magical letter forge where glowing letters become words", Comp: SpellForgeWorld, count: (d) => d.events.items.filter((e) => READING_KINDS.has(e.kind)).length },
  { id: "beat", name: "Beat Keeper", tag: "Rhythm", icon: "music_note", color: "clay", imagePrompt: "a colorful music stage with drums, rhythm bars and bouncing musical notes", isNew: true, Comp: BeatKeeperWorld, count: (d) => d.events.items.filter((e) => e.kind === "rhythm").length },
  { id: "pose", name: "Hero Pose", tag: "Move", icon: "accessibility_new", color: "sky", imagePrompt: "a dynamic superhero action pose with bold motion lines", isNew: true, Comp: HeroPoseWorld, count: (d) => d.events.items.filter((e) => e.kind === "pose").length },
  { id: "pattern", name: "Pattern Power", tag: "Logic", icon: "category", color: "lav", imagePrompt: "a puzzle world of glowing shapes arranged in patterns", isNew: true, Comp: PatternPowerWorld, count: (d) => d.events.items.filter((e) => e.kind === "pattern").length },
  { id: "word-world", name: "Word World", tag: "Language", icon: "menu_book", color: "sky", imagePrompt: "a warm cozy reading nook with open books, speech bubbles, and colorful letters floating gently", isNew: true, Comp: WordWorldTab, count: (d) => d.events.items.filter((e) => e.kind === "lang-strategy").length },
];

/** Sessions per level — the level is monotonic; the pips fill toward the next. */
const SESSIONS_PER_LEVEL = 5;

function Stars({ n, aria }: { n: number; aria: string }) {
  return (
    <div className="flex gap-0.5 mt-2" aria-label={aria}>
      {[0, 1, 2].map((i) => (
        <Icon key={i} name="star" size={14} fill={i < n ? 1 : 0}
          style={{ color: i < n ? "var(--arbor-yellow)" : "var(--arbor-rule-strong)" }} />
      ))}
    </div>
  );
}

/** KID-16: five star pips toward the next level. Filled n/5, never a numeral,
 *  never a bar that visibly empties — a fresh level simply starts a new row. */
function LevelPips({ filled, aria }: { filled: number; aria: string }) {
  return (
    <div className="flex items-center gap-1.5" role="img" aria-label={aria}>
      {Array.from({ length: SESSIONS_PER_LEVEL }).map((_, i) => (
        <Icon key={i} name="star" size={22} fill={i < filled ? 1 : 0}
          style={{ color: i < filled ? "var(--arbor-yellow)" : "var(--arbor-rule-strong)" }} />
      ))}
    </div>
  );
}

export default function HeroArcade({ initialWorldId }: { initialWorldId?: string } = {}) {
  const { childProfile } = useArbor();
  const { t } = useLanguage();
  const data = usePracticeData(childProfile.id);
  const hero = useHeroAvatar();
  // KID-05: the comics CTA needs the parent shell; while Kid Mode is active the
  // navigator is null and the CTA is not rendered at all (never a dead button).
  const nav = useKidSafeNav();
  const hasName = hero.name !== "your child";
  // E8/F-10: hero.name itself stays raw (it is compared against the "your
  // child" sentinel); display copy isolates it through t()'s interpolation.
  const heroName = isolate(hero.name);
  // KID-4: a kid-dashboard game tile named after a world opens the arcade with
  // that world pre-selected (only ids that resolve to a playable world count).
  const [openId, setOpenId] = useState<string | null>(
    () => (initialWorldId && WORLDS.some((w) => w.id === initialWorldId && !!w.Comp) ? initialWorldId : null),
  );

  // KID-02: every cosmetic metric is LIFETIME — nothing here can ever go down.
  const stats: CosmeticStats = useMemo(() => ({
    totalSessions:
      data.speech.items.length + data.mimic.items.length + data.adventures.items.length +
      data.events.items.length + data.missions.items.filter((m) => m.completed).length,
    daysPracticed: data.daysPracticed,
    domainsEverTouched: lifetimeDomains({
      speech: data.speech.items,
      mimic: data.mimic.items,
      adventures: data.adventures.items,
      events: data.events.items,
      missions: data.missions.items,
    }).length,
  }), [data]);

  const { unlocked, next, activeFrame } = useMemo(() => evaluateCosmetics(stats), [stats]);
  const badges = useMemo(() => unlocked.filter((c) => c.kind === "badge"), [unlocked]);
  const title = useMemo(() => unlocked.filter((c) => c.kind === "title").slice(-1)[0] ?? null, [unlocked]);
  const level = 1 + Math.floor(stats.totalSessions / SESSIONS_PER_LEVEL);
  const pipsFilled = stats.totalSessions % SESSIONS_PER_LEVEL;
  const cosmeticLabel = (id: string) => t(`elev.play.cosmetic.${id}.label`);
  const cosmeticReq = (id: string) => t(`elev.play.cosmetic.${id}.req`);

  const open = openId ? WORLDS.find((w) => w.id === openId) : null;
  if (open?.Comp) {
    const Comp = open.Comp;
    return (
      <div className="arbor-play space-y-4">
        {/* KID-4 honest arrival: the opened world announces its own name, so a
            tile named "Beat Keeper" lands on a surface that SAYS Beat Keeper. */}
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => setOpenId(null)}
            className="play-pressable inline-flex items-center gap-2 rounded-full px-4 min-h-[44px] text-[13px] font-extrabold"
            style={{ background: "var(--arbor-paper-elevated)", border: "var(--comic-line)", boxShadow: "var(--comic-pop)" }}>
            <Icon name="arrow_back" size={16} /> {t("elev.play.arcade.allWorlds")}
          </button>
          <h1 className="font-black leading-none" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(20px,4vw,28px)" }}>
            {open.name}
          </h1>
        </div>
        <Suspense fallback={<TabSkeleton />}><Comp /></Suspense>
      </div>
    );
  }

  return (
    <div className="arbor-play space-y-6">
      {/* HERO PANEL */}
      <section className="comic-panel p-5 sm:p-6 flex items-center gap-4 sm:gap-6" aria-label={t("aria.yourHero")}>
        <HeroCrest size={104} frame={activeFrame} badges={badges}>
          <HeroAvatar size={104} mood="cheer" />
        </HeroCrest>
        <div className="flex-1 min-w-0">
          <div className="inline-flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[12px] font-black rounded-full px-2.5 py-0.5"
              style={{ background: "var(--arbor-lav)", color: "var(--arbor-on-accent)", border: "var(--comic-line)" }}>{t("elev.play.arcade.level", { n: level })}</span>
            {title ? (
              <span className="text-[12px] font-black rounded-full px-2.5 py-0.5"
                style={{ background: "var(--arbor-yellow-soft)", color: "var(--arbor-yellow-ink)", border: "var(--comic-line)" }}>
                <span aria-hidden="true">{title.emoji}</span> {cosmeticLabel(title.id)}
              </span>
            ) : (
              <span className="text-[13px] font-extrabold" style={{ color: "var(--arbor-lav-ink)" }}>{t("elev.play.arcade.heroOfWeek")}</span>
            )}
          </div>
          <h1 className="font-black leading-none truncate" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(24px,5vw,40px)" }}>
            {hasName ? t("elev.play.arcade.heroBrave", { name: hero.name }) : t("elev.play.arcade.yourHero")}
          </h1>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <div className="flex-1 min-w-[180px]">
              <div className="text-[12px] font-extrabold mb-1" style={{ color: "var(--arbor-ink-soft)" }}>{t("elev.play.arcade.nextLevel")}</div>
              <LevelPips filled={pipsFilled} aria={t("elev.play.arcade.nextLevelAria", { n: pipsFilled })} />
            </div>
            {/* KID-6: monotonic days-practiced counter — only ever grows, never
                resets. Streaks are loss-framed and NEVER shown to the child
                (practice/signals.ts doctrine). */}
            <div className="inline-flex items-center gap-1.5 rounded-2xl px-3 py-2"
              style={{ background: "var(--arbor-paper-elevated)", border: "var(--comic-line)", boxShadow: "var(--comic-pop)" }}>
              <Icon name="event_available" size={20} fill={1} style={{ color: "var(--arbor-peach)" }} />
              <b className="text-[18px]" style={{ fontFamily: "var(--font-display)" }}>{data.daysPracticed}</b>
              <span className="text-[12px] font-extrabold" style={{ color: "var(--arbor-ink-soft)" }}>{t("elev.play.arcade.daysPracticed")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* SPROUT COACH */}
      <div className="flex items-end gap-3">
        <ArborMascot size={52} mood="wave" animate className="flex-shrink-0" />
        <div className="relative comic-panel px-4 py-3 text-[14px] font-extrabold" style={{ boxShadow: "var(--comic-pop)" }}>
          {hasName ? t("elev.play.arcade.coachSay", { hero: hero.name }) : t("elev.play.arcade.coachSayGeneric")}
        </div>
      </div>

      {/* WORLDS */}
      <div>
        <h2 className="font-black mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(18px,3.4vw,24px)" }}>{t("elev.play.arcade.chooseWorld")}</h2>
        <div className="grid gap-3 sm:gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
          {WORLDS.filter((w) => !w.isNew).map((w) => {
            const glyph = w.icon;
            const live = !!w.Comp;
            const stars = w.count ? Math.min(3, Math.floor(w.count(data) / 3)) : 0;
            const c = COLOR[w.color];
            return (
              <button key={w.id} className="world-tile text-start relative" aria-disabled={!live}
                aria-label={live ? t("elev.play.arcade.worldAria", { world: w.name, tag: w.tag }) : t("elev.play.arcade.comingSoonAria", { world: w.name, tag: w.tag })}
                onClick={() => live && setOpenId(w.id)}>
                {w.isNew && (
                  <span className="absolute top-0 left-0 z-[2] text-[11px] font-black px-2.5 py-1"
                    style={{ background: "var(--arbor-pink)", color: "var(--arbor-on-accent)", border: "var(--comic-line)", borderTopLeftRadius: "var(--play-radius)", borderBottomRightRadius: "12px" }}>{t("elev.play.arcade.new")}</span>
                )}
                <div className="comic-halftone relative overflow-hidden" style={{ height: 120, background: c.bg, borderBottom: "var(--comic-line)" }}>
                  <WorldScene worldId={w.id} imagePrompt={w.imagePrompt} heroUrl={hero.url ?? undefined}>
                    <Icon name={glyph} size={48} fill={1} style={{ color: "var(--arbor-on-accent)", filter: "drop-shadow(2px 2px 0 rgba(23,27,34,.35))" }} />
                  </WorldScene>
                </div>
                <div className="p-3">
                  <p className="font-black text-[16px] leading-none mb-2" style={{ fontFamily: "var(--font-display)" }}>{w.name}</p>
                  <span className="inline-block text-[10.5px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full"
                    style={{ border: "2px solid var(--comic-ink)", color: c.ink }}>{w.tag}</span>
                  {live ? <Stars n={stars} aria={t("elev.play.arcade.starsAria", { n: stars })} /> : (
                    <span className="flex items-center gap-1 mt-2 text-[12px] font-bold" style={{ color: "var(--arbor-muted)" }}>
                      <Icon name="lock" size={14} /> {t("elev.play.arcade.soon")}
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
        <h2 className="font-black mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(18px,3.4vw,24px)" }}>{t("elev.play.arcade.gear")}</h2>
        {unlocked.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {unlocked.map((c) => (
              <span key={c.id} title={cosmeticReq(c.id)}
                className="inline-flex items-center gap-1.5 text-[13px] font-black px-3 py-2 rounded-2xl"
                style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "var(--comic-line)", boxShadow: "var(--comic-pop)" }}>
                <span aria-hidden="true">{c.emoji}</span> {cosmeticLabel(c.id)}
              </span>
            ))}
            {next && (
              <span className="inline-flex items-center gap-1.5 text-[13px] font-bold px-3 py-2 rounded-2xl"
                style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "3px dashed var(--comic-ink)" }}>
                <Icon name="lock" size={14} /> {cosmeticLabel(next.cosmetic.id)} · {cosmeticReq(next.cosmetic.id)}
              </span>
            )}
          </div>
        ) : (
          <p className="text-[13px] font-bold" style={{ color: "var(--arbor-muted)" }}>
            {hasName ? t("elev.play.arcade.firstGear", { name: hero.name }) : t("elev.play.arcade.firstGearGeneric")}
          </p>
        )}
      </div>

      {/* VIRAL COMIC CTA (share loop wired in a later wave). KID-05: rendered
          only when the parent shell is reachable — inside Kid Mode the tap
          would be a frozen no-op, so the panel is simply absent. */}
      {nav && (
        <section className="comic-panel p-5 sm:p-6 text-center" style={{ background: "var(--arbor-lav)", color: "var(--arbor-on-accent)" }}>
          <h3 className="font-black mb-1.5" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(20px,4vw,30px)" }}>
            {hasName ? t("elev.play.arcade.comic.title", { name: hero.name }) : t("elev.play.arcade.comic.titleGeneric")}
          </h3>
          <p className="font-bold text-[14px] mb-4 opacity-95 max-w-[44ch] mx-auto">
            {hero.hasHero
              ? t("elev.play.arcade.comic.bodyHero")
              : t("elev.play.arcade.comic.bodyNoHero", { name: hasName ? hero.name : heroName })}
          </p>
          <button onClick={() => nav("comics")}
            className="play-pressable inline-flex items-center gap-2 rounded-full px-6 py-3 font-black text-[16px]"
            style={{ background: "var(--arbor-yellow)", color: "var(--arbor-ink)", border: "var(--comic-line)", boxShadow: "0 6px 0 0 var(--comic-ink)", fontFamily: "var(--font-display)" }}>
            <Icon name="photo_camera" size={20} /> {hero.hasHero ? t("elev.play.arcade.comic.ctaHero") : t("elev.play.arcade.comic.ctaNoHero")}
          </button>
        </section>
      )}
    </div>
  );
}
