/**
 * GameShell — B-KID-74 (lane-C KC-01): ONE shell for every kid game.
 *
 * In Kid Mode a game screen has exactly one top bar — the overlay's: Home ·
 * the game's own name (KID_GAME_TITLE_KEY, never "Playbank") · hear-it ·
 * grown-ups exit. The shell feeds that bar (hear-it = the instruction, via
 * kidChrome) and renders, under it:
 *   - the instruction ONCE on arrival, on a solid token surface, and spoken
 *     once (read-to-me rules: per-child mute, after a gesture — kidReadAloud);
 *   - the world's own scene: the theme's world card (kidThemeManifest) as a
 *     soft, blurred and dimmed backdrop behind the play area (decorative,
 *     aria-hidden, absolutely placed so nothing shifts; text never sits on
 *     the picture — pieces and copy keep their token surfaces);
 *   - the game itself (game logic untouched);
 *   - optional in-world progress as dots, never numerals;
 * and `GameFinish` is the explicit finish screen: the hero cheers, Play again
 * and Home — no stars.
 *
 * Outside Kid Mode (the parent Practice doors) the shell renders today's
 * PlayHeader unchanged, so the parent register does not move.
 */
import React, { useEffect, useSyncExternalStore } from "react";
import { PlayButton, PlayHeader, celebrateBurst } from "../../ui/playkit";
import type { MascotMood } from "../../ui/ArborMascot";
import { HeroAvatar } from "../../ui/HeroAvatar";
import { useLanguage } from "../../../context/LanguageContext";
import { useArborOptional } from "../../../context/ArborContext";
import { isKidModeActive, subscribeKidMode } from "../../../lib/kidModeGate";
import { useKidTheme } from "../../../hooks/useKidTheme";
import { kidArt, worldTileKey, type KidWorldTileId } from "../../../lib/kidThemeManifest";
import { setKidHearIt, useKidHome } from "../kidChrome";
import { autoReadPage } from "../kidReadAloud";
import { stopVoice } from "../../../lib/voice";

export interface GameShellProps {
  /** The world (art key + identity). */
  worldId: KidWorldTileId;
  /** The game's name — the parent header's title (Kid Mode: the top bar's). */
  title: string;
  /** Spoken once on arrival and replayed by the top bar's hear-it. */
  instruction?: string;
  /** In-world progress: `index` of `total` steps done (dots, no numerals). */
  progress?: { index: number; total: number };
  /** Parent-register PlayHeader passthroughs (unchanged parent door). In Kid
   *  Mode `action` is not rendered: a world's header action is its hear-it,
   *  and the top bar carries the ONE hear-it. */
  mood?: MascotMood;
  eyebrow?: string;
  action?: React.ReactNode;
  variant?: "entry" | "compact";
  heroDecorative?: boolean;
  children: React.ReactNode;
}

function useKidModeOn(): boolean {
  return useSyncExternalStore(subscribeKidMode, isKidModeActive, isKidModeActive);
}

export function GameProgressDots({ index, total }: { index: number; total: number }) {
  return (
    <div aria-hidden="true" data-game-progress="" className="flex items-center justify-center gap-2 pt-4">
      {Array.from({ length: Math.max(0, total) }).map((_, i) => (
        <span
          key={i}
          style={{
            inlineSize: i === index ? 14 : 10,
            blockSize: i === index ? 14 : 10,
            borderRadius: 999,
            background: i < index ? "var(--arbor-green-ink)" : i === index ? "var(--arbor-sky-ink)" : "var(--arbor-rule-strong)",
            transition: "inline-size 160ms, block-size 160ms",
          }}
        />
      ))}
    </div>
  );
}

export function GameShell({ worldId, title, instruction, progress, mood, eyebrow, action, variant = "compact", heroDecorative, children }: GameShellProps) {
  const kid = useKidModeOn();
  const { uiLang } = useLanguage();
  const arbor = useArborOptional();
  const childId = arbor?.childProfile?.id ?? "";
  const theme = useKidTheme();
  const lang: "en" | "he" = uiLang === "he" ? "he" : "en";

  // Kid Mode: the instruction is the bar's hear-it, and it is spoken once.
  useEffect(() => {
    if (!kid || !instruction) return;
    setKidHearIt({ text: instruction, lang });
    const timer = setTimeout(() => { autoReadPage(childId, instruction, lang); }, 400);
    return () => { clearTimeout(timer); stopVoice(); setKidHearIt(null); };
  }, [kid, instruction, lang, childId]);

  if (!kid) {
    return (
      <div className="space-y-6">
        <PlayHeader title={title} say={instruction} mood={mood} worldId={worldId} variant={variant} eyebrow={eyebrow} action={action} heroDecorative={heroDecorative} />
        {children}
      </div>
    );
  }

  const art = kidArt(theme, worldTileKey(worldId));
  return (
    // `.arbor-play`: the kid type scale, also when a surface mounts a game
    // directly (the overlay's feelings view), not only inside the arcade.
    <div data-game-shell={worldId} className="arbor-play relative" style={{ isolation: "isolate" }}>
      {art && (
        <div aria-hidden="true" data-game-backdrop="" className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: -1, borderRadius: 28 }}>
          <img
            src={art.src480}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: art.objectPosition, filter: "blur(14px) saturate(0.9)", opacity: 0.3, transform: "scale(1.12)" }}
          />
        </div>
      )}
      <div className="space-y-4 p-1">
        {instruction && (
          <p
            dir="auto"
            data-game-instruction=""
            className="font-extrabold"
            style={{ margin: 0, fontSize: 18, lineHeight: 1.35, color: "var(--arbor-ink)", background: "var(--arbor-paper-elevated)", border: "var(--comic-line)", borderRadius: 18, paddingInline: 16, paddingBlock: 10 }}
          >
            {instruction}
          </p>
        )}
        {children}
        {progress && <GameProgressDots index={progress.index} total={progress.total} />}
      </div>
    </div>
  );
}

/** The explicit finish screen of a kid game: the hero cheers; Play again and
 *  Home (the overlay's, when Kid Mode is open). No stars, no counts. */
export function GameFinish({ title, subtitle, onPlayAgain, playAgainLabel, homeLabel }: { title: string; subtitle?: string; onPlayAgain: () => void; playAgainLabel: string; homeLabel: string }) {
  const goHome = useKidHome();
  useEffect(() => { celebrateBurst(); }, []);
  return (
    <div className="text-center py-6 play-pop-in" data-game-finish="">
      <div className="mx-auto w-fit play-cheer"><HeroAvatar size={132} mood="cheer" animate /></div>
      <h2 className="text-[1.6rem] font-extrabold mt-2" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)", textWrap: "balance" }}>{title}</h2>
      {subtitle && <p className="mt-1 text-[16px] font-bold" style={{ color: "var(--arbor-ink-soft)" }}>{subtitle}</p>}
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <PlayButton tone="clay" onClick={onPlayAgain}>{playAgainLabel}</PlayButton>
        {goHome && <PlayButton tone="clay" variant="soft" onClick={goHome}>{homeLabel}</PlayButton>}
      </div>
    </div>
  );
}
