import { GUIDE_ART_SHIPPED, guideArtFor, guideTopicFor, type GuideArt, type GuideTopic } from "../../lib/guideArt";

/**
 * v3 F-NOW-1: the face a parent's question gives the Now plan card and its
 * chip — the guide topic's glyph (every one of them in the shipped icon
 * subset) and, once VIS-05 ships that topic's picture, the picture itself.
 * A question no guide topic matches has no face: callers keep their own.
 * Shapes and objects only, never the child and never a verdict.
 */
export const GUIDE_TOPIC_GLYPH: Readonly<Record<GuideTopic, string>> = {
  mornings: "wb_sunny",
  "drop-off": "waving_hand",
  "big-feelings": "mood",
  sharing: "diversity_1",
  bedtime: "bedtime",
  screens: "devices",
  meals: "restaurant",
  "tidy-up": "cleaning_services",
  siblings: "diversity_3",
  "new-words": "forum",
  "outdoor-play": "park",
  "calm-corner": "spa",
};

export interface GuideFace {
  topic?: GuideTopic;
  glyph?: string;
  /** Present only for a topic whose art has shipped (lib/guideArt GUIDE_ART_SHIPPED). */
  art?: GuideArt;
}

export function guideFaceFor(question: string | null | undefined, lang: "en" | "he", shipped: ReadonlySet<GuideTopic> = GUIDE_ART_SHIPPED): GuideFace {
  const topic = question ? guideTopicFor({ title: question }) : undefined;
  if (!topic) return {};
  return { topic, glyph: GUIDE_TOPIC_GLYPH[topic], art: guideArtFor(topic, lang, shipped) };
}
