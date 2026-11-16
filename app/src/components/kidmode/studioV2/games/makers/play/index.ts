/** The makers' shared play kit (the Game Cut, B-GAME-40 round 3): one stage,
 * one HUD, one particle layer, one synth and one set of juice helpers for the
 * twelve Studio maker activities. Imported only from maker chunks, so Studio
 * Home never loads it. Directors import from `'../play'`. */
export { PlayStage } from './PlayStage';
export type { PlayStageProps, PlayGrade } from './PlayStage';
export { PlayFx } from './PlayFx';
export type { PlayFxHandle, PlayFxProps, FxKind, FxOptions } from './PlayFx';
export { HudCoach, HudQuest, HudDock, HudButton, HudChip, HudToast, COACH_HEADS, coachHead } from './PlayHud';
export type { CoachWho, CoachMood, HudCoachProps, HudQuestProps, HudQuestStep, HudDockProps, HudButtonProps, HudChipProps, HudToastProps } from './PlayHud';
export { PlayOpening, PlaySetPiece, OPENING_MS, OPENING_REDUCED_MS } from './PlayActs';
export type { PlayOpeningProps, PlaySetPieceProps } from './PlayActs';
export {
  useShake, usePointerParallax, useReducedMotion, prefersReducedMotion, hitPause, releaseHitPause, spring, springFor,
  cameraTransform, CAMERA_HOME, clamp, lerp, seededRandom, roundSeed, pick, shuffled,
} from './playJuice';
export type { PlayCamera, SpringName, ParallaxOptions } from './playJuice';
export { createPlaySound, playNote, chainStep, PLAY_AMBIENCE, PLAY_ROOTS, PLAY_PEAK, PLAY_BED_PEAK, PLAY_STEPS } from './playSound';
export type { PlaySound, PlayKey, PlayAmbience } from './playSound';
