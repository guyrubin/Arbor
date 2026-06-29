/**
 * KidDashboard — the personalized Kid Mode home (viral redesign P0 shell + P1
 * avatar-in-scene art, see docs/KID-MODE-VIRAL-REDESIGN-PLAN.md). Renders the
 * greeting header, the Today's-adventure banner, the four growth-adventure tiles
 * and the games grid. Every tile is a navigation entry that opens an EXISTING
 * surface unchanged — re-shell, never rewrite.
 *
 * Avatar-everywhere (P1): each tile + the banner use <WorldScene> — the same
 * production component HeroArcade ships — to generate a themed scene STARRING the
 * child's hero (the avatar is the consistency reference). Generation is lazy
 * (IntersectionObserver), cached (sceneCache cost-guard) and degrades gracefully
 * to the themed icon tile when there is no hero / it's still loading / it fails.
 * So a child with no generated avatar (e.g. before AvatarCreator) sees the clean
 * themed icon tiles — zero regression, never a blank or a blocked first paint.
 *
 * Still deferred: the unified theme registry (P2), the bounded daily quest +
 * per-game levels (P3), the parent-mediated share loop (P4). The quest banner
 * therefore shows no fabricated progress and tiles carry no fake level badges.
 *
 * Firewall: the star reads a MONOTONIC field (lifetime sessions), never a
 * streak. Styling is token-only and RTL-safe (logical CSS properties).
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Gamepad2, HeartPulse, Palette, Sparkles, Star, ChevronRight } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useHeroAvatar, HeroAvatar } from "../ui/HeroAvatar";
import { usePracticeData } from "../../practice/usePracticeData";
import WorldScene from "../practice/WorldScene";
import { HoldExitButton } from "./HoldExitButton";

export type KidSurface = "journeys" | "arcade" | "feelings";

type Accent = "green" | "clay" | "lav" | "peach" | "sky";
const ACCENT_BG: Record<Accent, string> = {
  green: "var(--arbor-green-soft)",
  clay: "var(--arbor-clay-soft)",
  lav: "var(--arbor-lav-soft)",
  peach: "var(--arbor-peach-soft)",
  sky: "var(--arbor-sky-soft)",
};
const ACCENT_INK: Record<Accent, string> = {
  green: "var(--arbor-green-ink)",
  clay: "var(--arbor-clay)",
  lav: "var(--arbor-lav-ink)",
  peach: "var(--arbor-peach-ink)",
  sky: "var(--arbor-sky-ink)",
};

interface AdventureDef {
  id: string;
  worldId: string;
  title: string;
  sub: string;
  accent: Accent;
  imagePrompt: string;
  Icon: React.ComponentType<{ className?: string }>;
  surface: KidSurface;
}

// The four growth adventures. `surface` routes into an existing tab. Studio maps
// to the arcade for now; the exact games↔worlds mapping is a confirmed-with-Guy
// decision (plan §9.5) before per-game deep-links land.
const ADVENTURES: AdventureDef[] = [
  { id: "playbank", worldId: "kid-playbank", title: "Playbank", sub: "Play, learn & grow", accent: "green", Icon: Gamepad2, surface: "arcade", imagePrompt: "a joyful playroom full of colorful building blocks, learning toys and a friendly little dinosaur" },
  { id: "hero", worldId: "kid-hero", title: "Hero Stories", sub: "You're the star", accent: "clay", Icon: BookOpen, surface: "journeys", imagePrompt: "an epic storybook castle on a hill with a glowing open magic book and a brave flowing cape" },
  { id: "feelings", worldId: "kid-feelings", title: "Feelings", sub: "Explore & understand", accent: "lav", Icon: HeartPulse, surface: "feelings", imagePrompt: "a gentle dreamy landscape of friendly emotion characters under a warm glowing sky" },
  { id: "studio", worldId: "kid-studio", title: "Studio", sub: "Create & express", accent: "peach", Icon: Palette, surface: "arcade", imagePrompt: "a bright art studio with paints, a tall easel and a colorful rocket-ship drawing" },
];

// Games grid. In the shell every game opens the arcade; per-game deep-links land
// once the games↔worlds mapping is confirmed. No level badges yet (P3).
interface GameDef { id: string; worldId: string; title: string; sub: string; accent: Accent; imagePrompt: string }
const GAMES: GameDef[] = [
  { id: "memory-match", worldId: "kid-memory", title: "Memory Match", sub: "Find the pairs", accent: "sky", imagePrompt: "a table of glowing colorful matching picture cards" },
  { id: "feelings-detective", worldId: "kid-detective", title: "Feelings Detective", sub: "Spot the feeling", accent: "green", imagePrompt: "a playful detective scene spotting cheerful emoji feelings with a big magnifying glass" },
  { id: "mimic-studio", worldId: "kid-mimic", title: "Mimic Studio", sub: "Copy the moves", accent: "lav", imagePrompt: "a fun mirror studio copying silly happy poses, sparkles all around" },
  { id: "sound-explorer", worldId: "kid-sound", title: "Sound Explorer", sub: "Listen & match", accent: "peach", imagePrompt: "a bright sound studio with big headphones and floating musical notes" },
  { id: "sequence-quest", worldId: "kid-sequence", title: "Sequence Quest", sub: "What comes next?", accent: "clay", imagePrompt: "glowing stars, moons and shapes arranged in a magical sequence" },
  { id: "calm-builder", worldId: "kid-calm", title: "Calm Builder", sub: "Design your space", accent: "sky", imagePrompt: "a cozy blanket-fort calm corner glowing with warm fairy lights" },
  { id: "rhythm-hero", worldId: "kid-rhythm", title: "Rhythm Hero", sub: "Tap the beat", accent: "lav", imagePrompt: "a colorful music stage with drums and bouncing musical notes" },
  { id: "puzzle-planet", worldId: "kid-puzzle", title: "Puzzle Planet", sub: "Piece it together", accent: "green", imagePrompt: "a friendly planet made of colorful glowing jigsaw pieces in space" },
];

/** A calm, one-shot count-up of an already-earned number. Reveals on mount only —
 *  never a live ticker. Respects prefers-reduced-motion (snaps to the total). */
function StarMeter({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || value <= 0) {
      setShown(value);
      return;
    }
    const start = Date.now();
    const DURATION = 600;
    setShown(0);
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / DURATION);
      setShown(Math.round(p * value));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value]);

  return (
    <span
      aria-label={`${value} stars earned`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        paddingInline: "12px",
        paddingBlock: "6px",
        borderRadius: "999px",
        background: "var(--arbor-peach-soft)",
        color: "var(--arbor-peach-ink)",
        fontWeight: 800,
        fontSize: "var(--t-sm)",
        whiteSpace: "nowrap",
      }}
    >
      <Star className="w-4 h-4" aria-hidden="true" />
      {shown}
    </span>
  );
}

/** A themed tile whose background is an avatar-in-scene render (WorldScene),
 *  degrading to a centered themed icon. A bottom ink scrim keeps the title
 *  legible over both the generated art and the icon fallback. */
function SceneTile({
  worldId,
  accent,
  Icon,
  title,
  sub,
  imagePrompt,
  heroUrl,
  onClick,
  big,
  index,
}: {
  worldId: string;
  accent: Accent;
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  sub: string;
  imagePrompt: string;
  heroUrl?: string;
  onClick: () => void;
  big?: boolean;
  index: number;
}) {
  return (
    <button
      className="world-tile play-pop-in"
      onClick={onClick}
      style={{
        appearance: "none",
        position: "relative",
        overflow: "hidden",
        textAlign: "start",
        cursor: "pointer",
        padding: 0,
        background: ACCENT_BG[accent],
        minBlockSize: big ? "150px" : "118px",
        animationDelay: `${index * 40}ms`,
      }}
    >
      {/* Avatar-in-scene art (or the themed icon fallback). */}
      <WorldScene worldId={worldId} imagePrompt={imagePrompt} heroUrl={heroUrl}>
        <span aria-hidden="true" style={{ color: ACCENT_INK[accent], opacity: 0.9 }}>
          <Icon className={big ? "w-10 h-10" : "w-8 h-8"} />
        </span>
      </WorldScene>
      {/* Legibility scrim — dark at the bottom so white text reads over art OR icon. */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(to top, color-mix(in oklab, ${ACCENT_INK[accent]} 90%, transparent), color-mix(in oklab, ${ACCENT_INK[accent]} 30%, transparent) 38%, transparent 64%)`,
        }}
      />
      {/* Title block. */}
      <span style={{ position: "absolute", insetInline: 0, insetBlockEnd: 0, padding: big ? "14px" : "11px" }}>
        <span style={{ display: "block", fontWeight: 900, fontSize: big ? "var(--t-lg)" : "var(--t-base)", color: "var(--arbor-on-accent)", lineHeight: 1.12 }}>
          {title}
        </span>
        <span style={{ display: "block", fontSize: "var(--t-sm)", color: "var(--arbor-on-accent)", opacity: 0.88, marginBlockStart: "1px" }}>{sub}</span>
      </span>
    </button>
  );
}

export default function KidDashboard({
  onOpenSurface,
  onExit,
}: {
  onOpenSurface: (s: KidSurface) => void;
  onExit: () => void;
}) {
  const { childProfile } = useArbor();
  const hero = useHeroAvatar();
  const data = usePracticeData(childProfile.id);

  // Monotonic star total — lifetime sessions across modules. Never a streak.
  const stars = useMemo(
    () =>
      data.speech.items.length +
      data.mimic.items.length +
      data.adventures.items.length +
      data.events.items.length +
      data.missions.items.filter((m) => m.completed).length,
    [data.speech.items, data.mimic.items, data.adventures.items, data.events.items, data.missions.items],
  );

  return (
    <div style={{ maxInlineSize: "1100px", marginInline: "auto", display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* ── Greeting header ─────────────────────────────────────────────── */}
      <header style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <HeroAvatar size={56} mood="wave" ring decorative />
        <div style={{ minInlineSize: 0 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "var(--t-2xl)", color: "var(--arbor-clay)", lineHeight: 1.05 }}>
            Hi {hero.name}!
          </div>
          <div style={{ fontSize: "var(--t-sm)", color: "var(--arbor-muted)" }}>You're doing amazing today</div>
        </div>
        <div style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: "12px" }}>
          <StarMeter value={stars} />
          <HoldExitButton onExit={onExit} idleLabel="Back to parent" ariaIdle="Hold to go back to parent" />
        </div>
      </header>

      {/* ── Today's adventure banner ────────────────────────────────────── */}
      {/* P3 adds the bounded daily quest + real progress. Shell shows no
          fabricated progress numerals. */}
      <button
        className="world-tile play-pop-in"
        onClick={() => onOpenSurface("journeys")}
        style={{
          appearance: "none",
          position: "relative",
          overflow: "hidden",
          textAlign: "start",
          cursor: "pointer",
          padding: 0,
          background: "var(--arbor-clay-soft)",
          minBlockSize: "190px",
        }}
      >
        <WorldScene worldId="kid-quest" imagePrompt="building a glowing blanket-fort calm corner with warm fairy lights, cozy and magical" heroUrl={hero.url ?? undefined}>
          <span aria-hidden="true" style={{ color: "var(--arbor-clay)", opacity: 0.9 }}>
            <Sparkles className="w-10 h-10" />
          </span>
        </WorldScene>
        <span
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, color-mix(in oklab, var(--arbor-clay) 92%, transparent), color-mix(in oklab, var(--arbor-clay) 35%, transparent) 42%, transparent 70%)" }}
        />
        <span style={{ position: "absolute", insetInline: 0, insetBlockEnd: 0, padding: "18px", display: "flex", alignItems: "flex-end", gap: "14px" }}>
          <span style={{ flex: 1, minInlineSize: 0 }}>
            <span style={{ display: "block", fontSize: "var(--t-xs)", letterSpacing: "0.08em", fontWeight: 800, color: "var(--arbor-on-accent)", opacity: 0.9 }}>TODAY'S ADVENTURE</span>
            <span style={{ display: "block", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "var(--t-2xl)", color: "var(--arbor-on-accent)", lineHeight: 1.08 }}>Start a hero story</span>
            <span style={{ display: "block", fontSize: "var(--t-sm)", color: "var(--arbor-on-accent)", opacity: 0.88 }}>Pick a world and you're the star</span>
          </span>
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", paddingInline: "16px", paddingBlock: "10px", borderRadius: "999px", background: "var(--arbor-peach)", color: "var(--arbor-on-accent)", fontWeight: 800, whiteSpace: "nowrap", flexShrink: 0 }}
          >
            Let's go <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </span>
        </span>
      </button>

      {/* ── My growth adventures ────────────────────────────────────────── */}
      <section aria-label="My growth adventures">
        <h2 style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "var(--t-base)", fontWeight: 900, color: "var(--arbor-ink)", marginBlockEnd: "10px" }}>
          <Sparkles className="w-4 h-4" aria-hidden="true" style={{ color: "var(--arbor-green-ink)" }} />
          My growth adventures
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
          {ADVENTURES.map((a, i) => (
            <SceneTile key={a.id} worldId={a.worldId} accent={a.accent} Icon={a.Icon} title={a.title} sub={a.sub} imagePrompt={a.imagePrompt} heroUrl={hero.url ?? undefined} big index={i} onClick={() => onOpenSurface(a.surface)} />
          ))}
        </div>
      </section>

      {/* ── Games ───────────────────────────────────────────────────────── */}
      <section aria-label="Games">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBlockEnd: "10px" }}>
          <h2 style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "var(--t-base)", fontWeight: 900, color: "var(--arbor-ink)" }}>
            <Gamepad2 className="w-4 h-4" aria-hidden="true" style={{ color: "var(--arbor-lav-ink)" }} />
            Games
          </h2>
          <button
            onClick={() => onOpenSurface("arcade")}
            style={{ appearance: "none", background: "transparent", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "var(--t-sm)", fontWeight: 700, color: "var(--arbor-muted)" }}
          >
            See all games <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "12px" }}>
          {GAMES.map((g, i) => (
            <SceneTile key={g.id} worldId={g.worldId} accent={g.accent} Icon={Gamepad2} title={g.title} sub={g.sub} imagePrompt={g.imagePrompt} heroUrl={hero.url ?? undefined} index={i} onClick={() => onOpenSurface("arcade")} />
          ))}
        </div>
      </section>
    </div>
  );
}
