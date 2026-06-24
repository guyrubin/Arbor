import type { ActiveTab } from "../context/ArborContext";

export type SectionExperienceId = "today" | "ask" | "child" | "grow" | "care" | "academy";

export type SectionExperience = {
  eyebrow: string;
  headline: string;
  body: string;
  primaryTab: ActiveTab;
  primaryLabel: string;
  proof: string[];
  accent: string;
  accentDeep: string;
  soft: string;
  ink: string;
  sceneImage?: string;
};

export const SECTION_EXPERIENCES: Record<SectionExperienceId, SectionExperience> = {
  today: {
    eyebrow: "Today OS",
    headline: "{name}'s day, distilled",
    body: "Rhythm, play, memory, and care signals become one calm next move.",
    primaryTab: "overview",
    primaryLabel: "Open today",
    proof: ["Rhythm", "Daily play", "Memory"],
    accent: "var(--arbor-clay)",
    accentDeep: "var(--arbor-clay-deep)",
    soft: "var(--arbor-green-soft)",
    ink: "var(--arbor-green-ink)",
  },
  ask: {
    eyebrow: "Ask Arbor",
    headline: "A calm intelligence room",
    body: "Photo, voice, child memory, and scholar lenses turn hard moments into words you can use.",
    primaryTab: "coach",
    primaryLabel: "Ask a question",
    proof: ["Voice", "Vision", "Council"],
    accent: "var(--arbor-lav)",
    accentDeep: "var(--arbor-lav-ink)",
    soft: "var(--arbor-lav-soft)",
    ink: "var(--arbor-lav-ink)",
  },
  child: {
    eyebrow: "My Child",
    headline: "{name}'s living signal map",
    body: "Milestones, moments, language, and approved memory form a story that gets smarter over time.",
    primaryTab: "timeline",
    primaryLabel: "Open story",
    proof: ["Timeline", "Development", "Language"],
    accent: "var(--arbor-sky)",
    accentDeep: "var(--arbor-sky-ink)",
    soft: "var(--arbor-sky-soft)",
    ink: "var(--arbor-sky-ink)",
  },
  grow: {
    eyebrow: "Grow",
    headline: "Play that quietly builds capability",
    body: "Tiny daily missions, practice worlds, and growth plans turn support into a habit.",
    primaryTab: "daily-play",
    primaryLabel: "Start play",
    proof: ["Activities", "Practice", "Plans"],
    accent: "var(--arbor-peach)",
    accentDeep: "var(--arbor-peach-ink)",
    soft: "var(--arbor-peach-soft)",
    ink: "var(--arbor-peach-ink)",
    sceneImage: "/visuals/arbor-academy-play-hero-bg.png",
  },
  care: {
    eyebrow: "Care Network",
    headline: "The right context, shared safely",
    body: "Prepare specialists, teachers, and co-parents with only the details you choose.",
    primaryTab: "consult",
    primaryLabel: "Prepare consult",
    proof: ["Reports", "Sharing", "Safety"],
    accent: "var(--arbor-pink)",
    accentDeep: "var(--arbor-pink-ink)",
    soft: "var(--arbor-pink-soft)",
    ink: "var(--arbor-pink-ink)",
  },
  academy: {
    eyebrow: "Arbor Academy",
    headline: "Stories that become family practice",
    body: "Personalized quests, parent learning, and rituals make growth feel memorable.",
    primaryTab: "stories",
    primaryLabel: "Choose a quest",
    proof: ["Story quests", "Masterclasses", "Rituals"],
    accent: "var(--arbor-yellow)",
    accentDeep: "var(--arbor-yellow-ink)",
    soft: "var(--arbor-yellow-soft)",
    ink: "var(--arbor-yellow-ink)",
    sceneImage: "/visuals/arbor-academy-play-hero-bg.png",
  },
};

export function sectionExperienceFor(id: string): SectionExperience {
  return SECTION_EXPERIENCES[(id as SectionExperienceId)] ?? SECTION_EXPERIENCES.today;
}

export function personalizeSectionCopy(value: string, childName: string): string {
  return value.replace(/\{name\}/g, childName || "your child");
}
