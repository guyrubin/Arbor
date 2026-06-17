import React from "react";
import { motion } from "motion/react";
import confetti from "canvas-confetti";
import { ArborMascot, type MascotMood } from "./ArborMascot";
import { HeroAvatar } from "./HeroAvatar";

/* ════════════════════════════════════════════════════════════════════════════
   PlayKit — the child-facing primitive set for Practice Studio.

   These are deliberately bigger, rounder, and more playful than the calm
   parent-facing `ui/kit.tsx`. Every interactive element clears a 48px touch
   target (most are larger). All visual flourish is scoped under `.arbor-play`
   (see index.css) so parent surfaces stay premium and quiet.
   ════════════════════════════════════════════════════════════════════════════ */

const BRAND_CONFETTI = ["#34b277", "#5fce97", "#d9763f", "#3f8cc9", "#7a6bd8", "#c2882a"];

/** Fire a short, brand-colored confetti burst. Respects reduced-motion. */
export function celebrateBurst(): void {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const fire = (particleRatio: number, opts: confetti.Options) =>
    confetti({ origin: { y: 0.7 }, colors: BRAND_CONFETTI, disableForReducedMotion: true, particleCount: Math.floor(150 * particleRatio), ...opts });
  fire(0.25, { spread: 26, startVelocity: 55 });
  fire(0.2, { spread: 60 });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.9 });
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
}

/** Wrapper that turns a tab into a "play surface" (soft gradient wash + rhythm). */
export function PlayShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={`arbor-play space-y-6 max-w-[1100px] p-1 ${className}`}
    >
      {children}
    </motion.div>
  );
}

const TONE_INK: Record<string, string> = {
  clay: "var(--arbor-clay-deep)",
  lav: "var(--arbor-lav-ink)",
  sky: "var(--arbor-sky-ink)",
  yellow: "var(--arbor-yellow-ink)",
  pink: "var(--arbor-pink-ink)",
  peach: "var(--arbor-peach-ink)",
};
const TONE_SOFT: Record<string, string> = {
  clay: "var(--arbor-green-soft)",
  lav: "var(--arbor-lav-soft)",
  sky: "var(--arbor-sky-soft)",
  yellow: "var(--arbor-yellow-soft)",
  pink: "var(--arbor-pink-soft)",
  peach: "var(--arbor-peach-soft)",
};
export type PlayTone = keyof typeof TONE_INK;

/** Big friendly page header: Sprout + display title + a one-line speech bubble. */
export function PlayHeader({
  title,
  say,
  mood = "wave",
  action,
}: {
  title: string;
  say?: string;
  mood?: MascotMood;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <HeroAvatar size={84} mood={mood} animate className="flex-shrink-0 drop-shadow-sm" />
      <div className="flex-1 min-w-[200px]">
        <h1
          className="text-[1.9rem] md:text-[2.4rem] leading-[1.05]"
          style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)", textWrap: "balance" }}
        >
          {title}
        </h1>
        {say && (
          <div className="relative inline-block mt-2 rounded-2xl rounded-tl-sm px-3.5 py-2 bg-white shadow-[0_2px_10px_rgba(41,51,63,0.06)]">
            <p className="text-sm font-bold leading-snug" style={{ color: "var(--arbor-ink-soft)" }}>{say}</p>
          </div>
        )}
      </div>
      {action}
    </header>
  );
}

/** Sprout saying something inline — used for warm scaffolding and feedback. */
export function MascotSay({
  children,
  mood = "happy",
  tone = "clay",
  size = 56,
}: {
  children: React.ReactNode;
  mood?: MascotMood;
  tone?: PlayTone;
  size?: number;
}) {
  return (
    <div className="flex items-center gap-3 play-pop-in">
      <ArborMascot size={size} mood={mood} className="flex-shrink-0" />
      <div
        className="relative flex-1 rounded-2xl rounded-bl-sm px-4 py-3 text-[15px] font-semibold leading-snug"
        style={{ background: TONE_SOFT[tone], color: "var(--arbor-ink)" }}
      >
        {children}
      </div>
    </div>
  );
}

/** Chunky, friendly action button. Min height 52px. */
export function PlayButton({
  children,
  onClick,
  disabled,
  variant = "primary",
  tone = "clay",
  size = "lg",
  type = "button",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "soft" | "ghost";
  tone?: PlayTone;
  size?: "lg" | "md";
  type?: "button" | "submit";
  className?: string;
}) {
  const pad = size === "lg" ? "px-7 min-h-[54px] text-[16px]" : "px-5 min-h-[46px] text-[14px]";
  const style: React.CSSProperties =
    variant === "primary"
      ? { background: TONE_INK[tone], color: "#fff" }
      : variant === "soft"
        ? { background: TONE_SOFT[tone], color: TONE_INK[tone] }
        : { background: "transparent", color: "var(--arbor-muted)" };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`play-pressable inline-flex items-center justify-center gap-2 rounded-full font-extrabold disabled:opacity-55 disabled:pointer-events-none ${pad} ${variant === "primary" ? "shadow-[0_6px_18px_rgba(41,51,63,0.16)]" : ""} ${className}`}
      style={style}
    >
      {children}
    </button>
  );
}

/** A big tappable choice tile: emoji over label. State drives the feedback ring. */
export function ChoiceTile({
  emoji,
  label,
  onClick,
  disabled,
  state = "idle",
}: {
  emoji?: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  state?: "idle" | "correct" | "wrong" | "dim";
}) {
  const ring =
    state === "correct"
      ? "var(--arbor-clay)"
      : state === "wrong"
        ? "var(--arbor-pink-ink)"
        : "rgba(41,51,63,0.08)";
  const bg =
    state === "correct" ? "var(--arbor-green-soft)" : state === "wrong" ? "var(--arbor-pink-soft)" : "#fff";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={state === "correct" || state === "wrong"}
      className={`play-pressable rounded-[var(--play-radius)] px-4 py-5 text-center min-h-[112px] flex flex-col items-center justify-center gap-2 ${state === "correct" ? "play-correct" : ""} ${state === "wrong" ? "play-nudge" : ""}`}
      style={{
        background: bg,
        border: `2.5px solid ${ring}`,
        opacity: state === "dim" ? 0.5 : 1,
        boxShadow: state === "idle" ? "0 4px 14px rgba(41,51,63,0.06)" : undefined,
      }}
    >
      {emoji != null && <span className="text-[2.6rem] leading-none">{emoji}</span>}
      <span className="text-[15px] font-extrabold leading-tight" style={{ color: "var(--arbor-ink)" }}>{label}</span>
    </button>
  );
}

/** Chunky progress pips — fills as the child advances; current pip is wider. */
export function ProgressPips({ total, current, tone = "lav" }: { total: number; current: number; tone?: PlayTone }) {
  return (
    <div className="flex items-center gap-1.5" role="progressbar" aria-valuenow={current + 1} aria-valuemin={1} aria-valuemax={total}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="h-2.5 rounded-full transition-all duration-300"
          style={{
            width: i === current ? 26 : 10,
            background: i <= current ? TONE_INK[tone] : "rgba(41,51,63,0.14)",
          }}
        />
      ))}
    </div>
  );
}

/** A round, playful stat bubble (replaces flat parent stat cards on play tabs). */
export function StatBubble({ value, label, tone = "clay" }: { value: React.ReactNode; label: string; tone?: PlayTone }) {
  return (
    <div
      className="rounded-[var(--play-radius)] px-5 py-4 text-center"
      style={{ background: TONE_SOFT[tone], border: `1.5px solid ${TONE_INK[tone]}22` }}
    >
      <p className="text-[1.9rem] font-extrabold leading-none" style={{ color: TONE_INK[tone], fontFamily: "var(--font-display)" }}>{value}</p>
      <p className="text-[12px] font-bold mt-1.5" style={{ color: "var(--arbor-ink-soft)" }}>{label}</p>
    </div>
  );
}

/** Win celebration: a cheering Sprout + headline + stars + actions. Fires confetti on mount. */
export function Celebrate({
  title,
  subtitle,
  stars,
  starsTotal,
  children,
}: {
  title: string;
  subtitle?: string;
  stars?: number;
  starsTotal?: number;
  children?: React.ReactNode;
}) {
  React.useEffect(() => {
    celebrateBurst();
  }, []);
  return (
    <div className="text-center py-6 play-pop-in">
      {/* The child's own hero takes the bow (Sprout cheers when no hero yet). */}
      <div className="mx-auto w-fit play-cheer"><HeroAvatar size={132} mood="cheer" animate /></div>
      <h2 className="text-[1.6rem] font-extrabold mt-2" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)", textWrap: "balance" }}>
        {title}
      </h2>
      {typeof stars === "number" && typeof starsTotal === "number" && (
        <div className="flex justify-center gap-1.5 mt-3" aria-label={`${stars} of ${starsTotal} stars`}>
          {Array.from({ length: starsTotal }).map((_, i) => (
            <span key={i} className="text-2xl" style={{ filter: i < stars ? "none" : "grayscale(1)", opacity: i < stars ? 1 : 0.35 }}>
              ⭐
            </span>
          ))}
        </div>
      )}
      {subtitle && <p className="text-sm mt-3 max-w-md mx-auto" style={{ color: "var(--arbor-muted)" }}>{subtitle}</p>}
      {children && <div className="flex flex-wrap justify-center gap-2.5 mt-5">{children}</div>}
    </div>
  );
}

/** A soft rounded panel for grouping play content (lighter than parent SectionCard). */
export function PlayPanel({
  children,
  tone,
  className = "",
}: {
  children: React.ReactNode;
  tone?: PlayTone;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[var(--play-radius-lg)] p-5 sm:p-6 bg-white shadow-[0_4px_20px_rgba(41,51,63,0.06)] ${className}`}
      style={tone ? { background: `color-mix(in oklab, ${TONE_SOFT[tone]} 45%, #fff)` } : undefined}
    >
      {children}
    </section>
  );
}
