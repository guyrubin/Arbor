import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { motion } from 'motion/react';
import './makerPlay.css';
import { cameraTransform, releaseHitPause, spring, usePointerParallax, useReducedMotion, type PlayCamera } from './playJuice';

export type PlayGrade = 'day' | 'dusk' | 'night' | 'warm' | 'cool';
export interface PlayStageProps {
  /** The activity's catalogue id (`mend-bowl`). */
  id: string;
  /** A colour grade laid over the world (the HUD is never graded). */
  grade?: PlayGrade;
  /** Stage-relative focus (0..1) and scale (1..3). Animated; a change is a camera move. */
  camera?: PlayCamera;
  /** Bump the number to play one short shake. */
  shake?: number;
  /** Pointer and tilt parallax: sets `--play-px` / `--play-py` (-1..1) on the stage. */
  parallax?: boolean;
  /** The scene layers. They are moved by the camera; position them with
   * `position: absolute` inside the world, which is exactly the stage's box. */
  world: ReactNode;
  /** The HUD (coach, quest, dock, toasts, opening). Not moved by the camera. */
  children?: ReactNode;
  /** Widens the frame for the finale: letterbox bars slide in and the HUD dims (see `PlaySetPiece`). */
  setPiece?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** The full-bleed world. It fills the Studio's play view from the top bar
 * down, edge to edge (makerPlay.css removes the play view's padding, column
 * and blurred backdrop for any view that holds a stage), respects the safe
 * areas, and exposes `--play-w`, `--play-h` (the stage's size in px) and
 * `--play-safe-b` (the bottom inset the HUD keeps clear) to everything in it. */
export function PlayStage({ id, grade = 'day', camera, shake = 0, parallax = false, world, children, setPiece = false, className, style }: PlayStageProps) {
  const reduced = useReducedMotion();
  const stageRef = usePointerParallax<HTMLDivElement>({ enabled: parallax && !reduced });
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = stageRef.current; if (!el) return;
    const measure = () => { const w = el.clientWidth, h = el.clientHeight; if (w && h) setSize(prev => (prev && prev.w === w && prev.h === h ? prev : { w, h })); };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(el);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); releaseHitPause(); };
  }, [stageRef]);
  // One shake per bump: the attribute alternates so the CSS animation restarts.
  const firstShake = useRef(shake);
  const shaking = shake !== firstShake.current ? (shake % 2 ? 'a' : 'b') : undefined;
  const move = cameraTransform(camera);
  const orient = size ? (size.w >= size.h ? 'landscape' : 'portrait') : undefined;
  const vars = { ...(size ? { '--play-w': `${size.w}px`, '--play-h': `${size.h}px` } : null), ...style } as CSSProperties;
  return <div ref={stageRef} className={`play-stage${className ? ` ${className}` : ''}`} data-play-stage={id} data-grade={grade} data-orient={orient}
    data-set-piece={setPiece || undefined} data-reduced={reduced || undefined} style={vars}>
    <motion.div className="play-stage__camera" initial={false} animate={{ x: `${move.x}%`, y: `${move.y}%`, scale: move.scale }} transition={reduced ? spring.cut : spring.camera}>
      <div className="play-stage__world" data-shake={shaking} data-play-world="">{world}</div>
    </motion.div>
    <div className="play-stage__grade" aria-hidden="true" />
    <div className="play-stage__bars" aria-hidden="true" />
    <div className="play-stage__hud" data-play-hud="">{children}</div>
  </div>;
}
