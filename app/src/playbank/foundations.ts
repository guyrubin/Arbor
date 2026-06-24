import type { PlayActivity, PlayDomain } from "./content";
import type { PlayCourse } from "./courses";
import { versionedVisual } from "../lib/visualVersion";

export type FoundationPackId = "dylan-cinematic" | "classic-comic";

export interface FoundationPreference {
  avatarStyle?: string;
  avatarSource?: "descriptor" | "photo";
  visualPack?: FoundationPackId;
}

const DEFAULT_PACK: FoundationPackId = "dylan-cinematic";

const GAME_FILE = {
  speech: "game-speech.png",
  feelings: "game-feelings.png",
  adventures: "game-adventures.png",
  mimic: "game-mimic.png",
  memory: "game-memory.png",
  reading: "game-reading.png",
  beat: "game-beat.png",
  pose: "game-pose.png",
  pattern: "game-pattern.png",
  order: "game-order-builder.png",
  truth: "game-truth-compass.png",
  promise: "game-promise-ladder.png",
  courage: "game-courage-steps.png",
  aim: "game-aim-map.png",
} as const;

export type FoundationKey = keyof typeof GAME_FILE;

const PACK_ROOT: Record<FoundationPackId, string> = {
  "dylan-cinematic": "/visuals/cards",
  "classic-comic": "/visuals/cards/packs/classic-comic",
};

const DOMAIN_FOUNDATION: Record<PlayDomain, FoundationKey> = {
  regulation: "feelings",
  language: "speech",
  motor: "pose",
  cognitive: "memory",
  social: "mimic",
};

const COURSE_FOUNDATION: Record<string, FoundationKey> = {
  "big-feelings": "feelings",
  "more-words": "speech",
  "sharing-turns": "mimic",
  "focus-followthrough": "pattern",
  "ready-for-school": "adventures",
  "new-sibling": "feelings",
  "calmer-bedtimes": "feelings",
};

export function foundationPackForPreference(pref?: FoundationPreference): FoundationPackId {
  if (pref?.visualPack) return pref.visualPack;
  if (pref?.avatarSource === "photo") return "dylan-cinematic";

  const style = (pref?.avatarStyle ?? "").toLowerCase();
  if (style.includes("classic") || style.includes("comic")) return "classic-comic";
  return DEFAULT_PACK;
}

export function foundationForGame(key: string, pref?: FoundationPreference): string | undefined {
  if (!(key in GAME_FILE)) return undefined;
  const pack = foundationPackForPreference(pref);
  return versionedVisual(`${PACK_ROOT[pack]}/${GAME_FILE[key as FoundationKey]}`);
}

export function foundationForActivity(activity: Pick<PlayActivity, "domain">, pref?: FoundationPreference): string {
  return foundationForGame(DOMAIN_FOUNDATION[activity.domain], pref) ?? foundationForGame(DOMAIN_FOUNDATION[activity.domain])!;
}

export function foundationForCourse(course: Pick<PlayCourse, "id" | "domain">, pref?: FoundationPreference): string {
  const key = COURSE_FOUNDATION[course.id] ?? DOMAIN_FOUNDATION[course.domain];
  return foundationForGame(key, pref) ?? foundationForGame(key)!;
}
