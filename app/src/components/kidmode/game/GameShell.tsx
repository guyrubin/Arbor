/**
 * GameShell — B-KID-74 (lane-C KC-01): ONE shell for every kid game.
 *
 * In Kid Mode a game screen has exactly one top bar — the overlay's: Home ·
 * the game's own name (KID_GAME_TITLE_KEY, never "Playbank") · hear-it ·
 * grown-ups exit. The shell feeds that bar (hear-it = the instruction, via
 * kidChrome) and renders, under it:
 *   - the instruction ONCE on arrival, on a solid token surface, and spoken
 *     once (read-to-me rules: per-child mute, after a gesture — kidReadAloud);
 *   - the world's own scene: B-KID-133 (D-01) the shell names its world as the
 *     overlay's Stage (kidChrome setKidStage) — the card fills the screen
 *     behind the view, crisp at the top on a phone; text never sits on the
 *     picture (pieces and copy keep their token surfaces);
 *   - the game itself (game logic untouched);
 *   - optional in-world progress as dots, never numerals;
 * and `GameFinish` is the explicit finish screen: the hero cheers, Play again
 * and Home — no stars.
 *
 * Outside Kid Mode (the parent Practice doors) the shell renders today's
 * PlayHeader unchanged, so the parent register does not move.
 */
import React, { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import { PlayButton, PlayHeader, celebrateBurst } from "../../ui/playkit";
import type { MascotMood } from "../../ui/ArborMascot";
import { useLanguage } from "../../../context/LanguageContext";
import { useArborOptional } from "../../../context/ArborContext";
import { isKidModeActive, subscribeKidMode } from "../../../lib/kidModeGate";
import type { KidWorldTileId } from "../../../lib/kidThemeManifest";
import { setKidHearIt, setKidStage, useKidHome } from "../kidChrome";
import { autoReadPage, KidHearItButton } from "../kidReadAloud";
import { stopVoice } from "../../../lib/voice";
import { kidSfx } from "../audio/kidAudio";
import { KidFinishMoment } from "../rewards/KidSouvenir";

/** B-KID-94: the world a finish screen belongs to (its souvenir), provided by
 *  the shell so every GameFinish inside it knows without a prop. */
const GameWorldContext = createContext<KidWorldTileId | null>(null);

/** B-KID-73: a tap on any piece (a button) inside a kid game makes the soft
 *  tap sound — one shared seam, no per-world wiring. */
export function onGamePiecePointerDown(e: { target: EventTarget | null }): void {
  const el = e.target as (Element & { closest?: (s: string) => Element | null }) | null;
  if (el?.closest?.("button:not([disabled])")) kidSfx("tap");
}

export interface GameShellProps {
  /** The world (art key + identity). */
  worldId: KidWorldTileId;
  /** The game's name — the parent header's title (Kid Mode: the top bar's). */
  title: string;
  /** Spoken once on arrival and replayed by the top bar's hear-it. */
  instruction?: string;
  /** What the bar's hear-it says when it is more than the instruction (e.g.
   *  the instruction + this round's cue). Defaults to the instruction. */
  hearIt?: string;
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

export function GameShell({ worldId, title, instruction, hearIt, progress, mood, eyebrow, action, variant = "compact", heroDecorative, children }: GameShellProps) {
  const kid = useKidModeOn();
  const { uiLang } = useLanguage();
  const arbor = useArborOptional();
  const childId = arbor?.childProfile?.id ?? "";
  const lang: "en" | "he" = uiLang === "he" ? "he" : "en";

  // Kid Mode: the bar's hear-it replays the instruction (or `hearIt`) …
  const hearText = hearIt ?? instruction;
  useEffect(() => {
    if (!kid || !hearText) return;
    setKidHearIt({ text: hearText, lang });
    return () => setKidHearIt(null);
  }, [kid, hearText, lang]);
  // B-KID-133 (D-01): the world IS the stage — the overlay paints this
  // world's card behind the whole view (crisp top band on a phone), so the
  // shell no longer crops it into a banner strip.
  useEffect(() => {
    if (!kid) return;
    setKidStage({ kind: "world", worldId });
    return () => setKidStage(null);
  }, [kid, worldId]);
  // … and the instruction is spoken ONCE, on arrival.
  useEffect(() => {
    if (!kid || !instruction) return;
    const timer = setTimeout(() => { autoReadPage(childId, instruction, lang); }, 400);
    return () => { clearTimeout(timer); stopVoice(); };
  }, [kid, instruction, lang, childId]);

  if (!kid) {
    return (
      <div className="space-y-6">
        <PlayHeader title={title} say={instruction} mood={mood} worldId={worldId} variant={variant} eyebrow={eyebrow} action={action} heroDecorative={heroDecorative} />
        {children}
      </div>
    );
  }

  return (
    // `.arbor-play`: the kid type scale, also when a surface mounts a game
    // directly (the overlay's feelings view), not only inside the arcade.
    <GameWorldContext.Provider value={worldId}>
    <div data-game-shell={worldId} className="arbor-play relative" style={{ isolation: "isolate" }} onPointerDownCapture={onGamePiecePointerDown}>
      <div className="relative space-y-4 p-1">
        {instruction && (
          <p
            dir="auto"
            data-game-instruction=""
            className="font-extrabold"
            style={{ margin: 0, fontSize: 18, lineHeight: 1.35, color: "var(--arbor-ink)", background: "var(--arbor-paper-elevated)", border: "var(--comic-line)", borderRadius: 18, paddingInline: 16, paddingBlock: 10, display: "flex", alignItems: "center", gap: 10 }}
          >
            <span style={{ flex: "1 1 0%", minInlineSize: 0 }}>{instruction}</span>
            {/* B-KID-73: hear-it beside the words it repeats (its own glyph). */}
            <KidHearItButton />
          </p>
        )}
        {children}
        {progress && <GameProgressDots index={progress.index} total={progress.total} />}
      </div>
    </div>
    </GameWorldContext.Provider>
  );
}

/** The explicit finish screen of a kid game — B-KID-94: the ONE finish moment.
 *  The hero cheers, the world's souvenir sticker is awarded (once, kept for
 *  good), the finish sound plays; Play again and Home (the overlay's, when
 *  Kid Mode is open). No stars, no counts, no streak. */
export function GameFinish({ title, subtitle, onPlayAgain, playAgainLabel, homeLabel, worldId }: { title: string; subtitle?: string; onPlayAgain: () => void; playAgainLabel: string; homeLabel: string; worldId?: KidWorldTileId }) {
  const goHome = useKidHome();
  const shellWorld = useContext(GameWorldContext);
  const world = worldId ?? shellWorld ?? undefined;
  const childId = useArborOptional()?.childProfile?.id ?? "";
  const { uiLang } = useLanguage();
  // B-KID-73: the finish fanfare with the burst (silent when Sound is off).
  useEffect(() => { celebrateBurst(); kidSfx("finish"); }, []);
  return (
    <div className="text-center py-6 play-pop-in" data-game-finish="">
      <KidFinishMoment childId={childId} kind="world" refId={world} lang={uiLang === "he" ? "he" : "en"} />
      <h2 className="text-[1.6rem] font-extrabold mt-2" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)", textWrap: "balance" }}>{title}</h2>
      {subtitle && <p className="mt-1 text-[16px] font-bold" style={{ color: "var(--arbor-ink-soft)" }}>{subtitle}</p>}
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <PlayButton tone="clay" onClick={onPlayAgain}>{playAgainLabel}</PlayButton>
        {goHome && <PlayButton tone="clay" variant="soft" onClick={goHome}>{homeLabel}</PlayButton>}
      </div>
    </div>
  );
}
