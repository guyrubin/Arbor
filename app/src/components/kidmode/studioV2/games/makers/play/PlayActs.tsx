import { useEffect, useRef, type ReactNode } from 'react';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { prefersReducedMotion } from './playJuice';

/** The opening shot and the set-piece: the two ends of every maker's arc. */

export const OPENING_MS = 2800;
export const OPENING_REDUCED_MS = 1400;
const TAP = { en: 'Tap to begin', he: 'נוגעים ומתחילים' } as const;

export interface PlayOpeningProps {
  /** The activity's title, set on the picture. */
  title: string;
  /** The place in Horizon Valley ("Wonderworks · the bowl table"). */
  place: string;
  /** Called once: when the shot has run, or the child taps to skip it. */
  onDone: () => void;
  /** How long the shot holds, in ms (default 2800; shorter under reduced motion). */
  holdMs?: number;
  /** Anything extra on the title card (a host line is better said by `HudCoach`). */
  children?: ReactNode;
}
/** The title lockup over the opening shot. The whole stage is the skip
 * button (a real `<button>`); it ends by a timer, never by an animation event. */
export function PlayOpening({ title, place, onDone, holdMs, children }: PlayOpeningProps) {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en';
  const done = useRef(false), onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const finish = () => { if (done.current) return; done.current = true; onDoneRef.current(); };
  useEffect(() => {
    const ms = holdMs ?? (prefersReducedMotion() ? OPENING_REDUCED_MS : OPENING_MS);
    const timer = setTimeout(finish, Math.max(0, ms));
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdMs]);
  return <div className="play-opening" data-play-opening="">
    <button type="button" className="play-opening__skip" onClick={finish} aria-label={TAP[lang]} data-play-skip="" />
    <div className="play-opening__lockup">
      <p className="play-opening__place">{place}</p>
      <h2 className="play-opening__title">{title}</h2>
      {children}
      <p className="play-opening__hint" aria-hidden="true"><span>{TAP[lang]}</span><svg viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></p>
    </div>
  </div>;
}

export interface PlaySetPieceProps {
  /** True for the finale's ten seconds. */
  active: boolean;
  /** HUD-layer content for the finale (a caption, a single quiet action). */
  children?: ReactNode;
  /** A line shown low on the frame, like a film caption. */
  caption?: string;
}
/** The finale's frame. While it is active the stage widens to a film frame
 * (bars slide in), every other HUD piece dims out of the way and stops taking
 * touches, and the camera is the game's to hold. It marks the stage through a
 * data attribute, so it works wherever it sits inside `<PlayStage>`. */
export function PlaySetPiece({ active, children, caption }: PlaySetPieceProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const stage = ref.current?.closest<HTMLElement>('[data-play-stage]');
    if (!stage || !active) return;
    stage.setAttribute('data-set-piece', 'true');
    return () => stage.removeAttribute('data-set-piece');
  }, [active]);
  return <div ref={ref} className="play-setpiece" data-play-setpiece="" data-active={active}>
    {active && caption && <p className="play-setpiece__caption" aria-live="polite">{caption}</p>}
    {active && children}
  </div>;
}
