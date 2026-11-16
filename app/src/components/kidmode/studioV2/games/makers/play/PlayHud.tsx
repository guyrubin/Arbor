import { useEffect, useRef, useState, type ReactNode } from 'react';
import { studioMakerArt } from '../../../../../../lib/kidThemeManifest';

/** The one HUD of the twelve makers: frosted glass on the scene, v30 tokens
 * only. Every piece places itself inside `<PlayStage>`'s HUD layer, so the
 * order a game renders them in does not matter. Words come from the game (in
 * the child's language); the HUD follows the reading direction it inherits. */

export type CoachWho = 'aya' | 'chock' | 'pep' | 'bebe' | 'gobgob';
export type CoachMood = 'idle' | 'happy' | 'curious' | 'wow';
/** The shared kit library's expression heads (KIT-LIBRARY.md), by mood. Where
 * the library has no head for a mood, the nearest one it has stands in. */
export const COACH_HEADS: Readonly<Record<CoachWho, Readonly<Record<CoachMood, string>>>> = {
  aya: { idle: 'kit-aya-inquisitive', happy: 'kit-aya-delighted', curious: 'kit-aya-inquisitive', wow: 'kit-aya-delighted' },
  chock: { idle: 'kit-chock-attentive', happy: 'kit-chock-relieved', curious: 'kit-chock-uncertain', wow: 'kit-chock-relieved' },
  pep: { idle: 'kit-pep-playful', happy: 'kit-pep-playful', curious: 'kit-pep-playful', wow: 'kit-pep-playful' },
  bebe: { idle: 'kit-bebe-face-smile', happy: 'kit-bebe-face-smile', curious: 'kit-bebe-face-curious', wow: 'kit-bebe-face-curious' },
  gobgob: { idle: 'kit-gobgob-face-patient', happy: 'kit-gobgob-face-delighted', curious: 'kit-gobgob-face-curious', wow: 'kit-gobgob-face-delighted' },
};
export function coachHead(who: CoachWho, mood: CoachMood): string { return (COACH_HEADS[who] ?? COACH_HEADS.aya)[mood] ?? COACH_HEADS[who].idle; }

export interface HudCoachProps {
  who: CoachWho;
  mood: CoachMood;
  /** One short line (eight words or fewer reads best). */
  line: string;
  /** Which inline edge the portrait sits on. Default `start`. */
  side?: 'start' | 'end';
  /** Tapping the portrait (a toy: the host answers). */
  onPoke?: () => void;
  /** The portrait button's accessible name, when `onPoke` is given. */
  pokeLabel?: string;
  /** Hide the bubble and keep the portrait (the opening, the set-piece). */
  quiet?: boolean;
}
export function HudCoach({ who, mood, line, side = 'start', onPoke, pokeLabel, quiet = false }: HudCoachProps) {
  const stem = coachHead(who, mood);
  // The bubble re-animates when the line changes: the key restarts its CSS entrance.
  const [beat, setBeat] = useState(0);
  const lastLine = useRef(line);
  useEffect(() => { if (lastLine.current !== line) { lastLine.current = line; setBeat(n => n + 1); } }, [line]);
  const head = <span className="play-coach__head" data-mood={mood} key={stem}>
    <img src={studioMakerArt(`${stem}-480`)} alt="" draggable={false} decoding="async" />
  </span>;
  return <div className="play-coach" data-play-coach={who} data-mood={mood} data-side={side} data-quiet={quiet || undefined}>
    {onPoke
      ? <button type="button" className="play-coach__portrait" onClick={onPoke} aria-label={pokeLabel}>{head}</button>
      : <span className="play-coach__portrait" aria-hidden="true">{head}</span>}
    <p className="play-coach__bubble" aria-live="polite" data-beat={beat % 2 ? 'b' : 'a'} hidden={quiet || !line}>
      <span key={beat} className="play-coach__line">{line}</span>
    </p>
  </div>;
}

export interface HudQuestStep { key: string; label: string; done: boolean; icon?: ReactNode }
export interface HudQuestProps {
  steps: readonly HudQuestStep[];
  /** Index of the step in play (-1 or `steps.length` when none is). */
  current: number;
  /** The strip's accessible name (the game's own words, e.g. "Three jobs"). */
  label?: string;
}
/** The chapter strip: things done, as pips or small icons. Never a score: no
 * numerals, no fraction, and the accessible text is the names of the steps. */
export function HudQuest({ steps, current, label }: HudQuestProps) {
  return <ol className="play-quest" data-play-quest="" aria-label={label}>
    {steps.map((step, index) => {
      const state = step.done ? 'done' : index === current ? 'now' : 'next';
      return <li key={step.key} className="play-quest__step" data-state={state} aria-current={state === 'now' ? 'step' : undefined}>
        <span className="play-quest__pip" aria-hidden="true">
          {step.icon ?? <span className="play-quest__dot" />}
          {step.done && <svg className="play-quest__tick" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.4l3 3 6-6.6" /></svg>}
        </span>
        <span className="play-quest__label">{step.label}</span>
      </li>;
    })}
  </ol>;
}

export interface HudDockProps {
  children?: ReactNode;
  /** Where the dock sits on wide screens. Phones always get the bottom centre. */
  align?: 'center' | 'end' | 'start';
  label?: string;
}
/** The bottom dock: at most one primary action, plus quiet ones beside it. */
export function HudDock({ children, align = 'center', label }: HudDockProps) {
  return <div className="play-dock" data-play-dock="" data-align={align} role="group" aria-label={label}>{children}</div>;
}

export interface HudButtonProps {
  label: string;
  icon?: ReactNode;
  /** `go` = the one primary action (graphite); `paper` = quiet; `chosen` = on (teal). */
  tone?: 'go' | 'paper' | 'chosen';
  size?: 'm' | 'l';
  onClick: () => void;
  disabled?: boolean;
  /** Icon only: the label stays as the accessible name. */
  iconOnly?: boolean;
  /** A lit "next" cue: a signal ring that marks, never fills. */
  cue?: boolean;
  /** Passed through as `data-*` for tests and drivers, e.g. `{ 'data-mb-next': '' }`. */
  data?: Readonly<Record<`data-${string}`, string>>;
}
export function HudButton({ label, icon, tone = 'paper', size = 'm', onClick, disabled, iconOnly, cue, data }: HudButtonProps) {
  return <button type="button" className="play-button" data-tone={tone} data-size={size} data-cue={cue || undefined} data-icon-only={iconOnly || undefined}
    aria-pressed={tone === 'chosen' ? true : undefined} aria-label={iconOnly ? label : undefined} disabled={disabled} onClick={onClick} {...data}>
    {icon && <span className="play-button__icon" aria-hidden="true">{icon}</span>}
    {!iconOnly && <span className="play-button__label">{label}</span>}
  </button>;
}

export interface HudChipProps {
  children: ReactNode;
  icon?: ReactNode;
  tone?: 'paper' | 'chosen' | 'signal';
  /** With `onClick` the chip is a real button (and a full touch target). */
  onClick?: () => void;
  label?: string;
}
/** A small frosted tag: the name of the place, a tool in hand, a found secret. */
export function HudChip({ children, icon, tone = 'paper', onClick, label }: HudChipProps) {
  const body = <>{icon && <span className="play-chip__icon" aria-hidden="true">{icon}</span>}<span className="play-chip__label">{children}</span></>;
  return onClick
    ? <button type="button" className="play-chip" data-tone={tone} data-press="" onClick={onClick} aria-label={label}>{body}</button>
    : <span className="play-chip" data-tone={tone} aria-label={label}>{body}</span>;
}

export interface HudToastProps { show: boolean; children: ReactNode; /** Where it appears. Default under the top row. */ place?: 'top' | 'middle' }
/** A short word on the glass. It is announced politely and never blocks a touch. */
export function HudToast({ show, children, place = 'top' }: HudToastProps) {
  return <div className="play-toast" data-play-toast="" data-show={show} data-place={place} role="status" aria-live="polite">
    {show && <span className="play-toast__body">{children}</span>}
  </div>;
}
