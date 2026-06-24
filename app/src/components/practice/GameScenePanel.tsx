import React from "react";
import { Sparkles } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useHeroAvatar } from "../ui/HeroAvatar";
import { foundationForGame, type FoundationPreference } from "../../playbank/foundations";
import { versionedVisual } from "../../lib/visualVersion";
import WorldScene from "./WorldScene";

type SceneTone = "sky" | "lav" | "pink" | "peach" | "yellow" | "clay" | "green";

const TONE_BG: Record<SceneTone, string> = {
  sky: "var(--arbor-sky-soft)",
  lav: "var(--arbor-lav-soft)",
  pink: "var(--arbor-pink-soft)",
  peach: "var(--arbor-peach-soft)",
  yellow: "var(--arbor-yellow-soft)",
  clay: "var(--arbor-clay-soft)",
  green: "var(--arbor-green-soft)",
};

const TONE_INK: Record<SceneTone, string> = {
  sky: "var(--arbor-sky-ink)",
  lav: "var(--arbor-lav-ink)",
  pink: "var(--arbor-pink-ink)",
  peach: "var(--arbor-peach-ink)",
  yellow: "var(--arbor-yellow-ink)",
  clay: "var(--arbor-clay-deep)",
  green: "var(--arbor-green-ink)",
};

type MissionCopy = {
  archetype: string;
  conflict: string;
  action: string;
  realWorld: string;
  viral: string;
};

const MISSION_COPY: Record<string, MissionCopy> = {
  speech: {
    archetype: "Voice Hero",
    conflict: "A hard sound becomes a tiny quest instead of a correction.",
    action: "Hear it, say it, record it, then choose the next brave rep.",
    realWorld: "Use the target sound once during dinner, bath, or bedtime.",
    viral: "A saved sound win becomes a family comic moment.",
  },
  feelings: {
    archetype: "Feeling Translator",
    conflict: "Big feelings lose power when the hero can name the weather inside.",
    action: "Spot the feeling, choose the body clue, then practice one calm tool.",
    realWorld: "Use the same calm tool before the next transition.",
    viral: "A regulation win becomes a proud hero badge.",
  },
  adventures: {
    archetype: "Story Pathfinder",
    conflict: "Every story choice trains attention, cause-and-effect, and language.",
    action: "Listen to the scene, choose the helpful path, explain why it worked.",
    realWorld: "Ask one why/what-next question in tonight's book.",
    viral: "The quest ending can be shared as a mini story win.",
  },
  mimic: {
    archetype: "Mirror Hero",
    conflict: "Social imitation becomes playful instead of awkward or forced.",
    action: "Watch the face, copy the signal, then name the social meaning.",
    realWorld: "Try one face-reading moment with a parent or sibling.",
    viral: "A funny imitation win turns into a hero pose.",
  },
  memory: {
    archetype: "Mind Keeper",
    conflict: "Working memory is trained as a treasure vault, not a worksheet.",
    action: "Hold the pattern, flip with focus, recover calmly after misses.",
    realWorld: "Remember one two-step instruction during the day.",
    viral: "A clear run becomes a vault-unlocked moment.",
  },
  reading: {
    archetype: "Word Forger",
    conflict: "Letters become tools the hero can shape into meaning.",
    action: "Trace, sound, blend, then use the word in a tiny sentence.",
    realWorld: "Find the same letter or word in the house.",
    viral: "The forged word becomes a magic-page win.",
  },
  beat: {
    archetype: "Rhythm Keeper",
    conflict: "Impulse becomes timing: wait, listen, tap, recover.",
    action: "Follow the pulse and keep the beat under rising pressure.",
    realWorld: "Clap one routine rhythm before cleanup or bedtime.",
    viral: "A strong beat streak powers up the hero.",
  },
  pose: {
    archetype: "Body Hero",
    conflict: "Imitation and body awareness become a safe action scene.",
    action: "Study the pose, copy it, freeze, then celebrate the effort.",
    realWorld: "Use one hero pose before trying something hard.",
    viral: "The pose is ready for a shareable comic page.",
  },
  pattern: {
    archetype: "Pattern Seer",
    conflict: "Chaos becomes predictable when the hero finds the hidden rule.",
    action: "Read the sequence, predict the next symbol, explain the pattern.",
    realWorld: "Find one pattern in clothes, blocks, music, or steps.",
    viral: "A solved pattern becomes a logic-power badge.",
  },
  order: {
    archetype: "Order Builder",
    conflict: "A messy scene becomes manageable when the hero finds the next right step.",
    action: "Choose first, then next, then finish without fighting the whole mess.",
    realWorld: "Name the next right step before a real cleanup.",
    viral: "The before/after moment is a perfect family win.",
  },
  truth: {
    archetype: "Truth Compass",
    conflict: "The hero must tell the truth without breaking connection.",
    action: "Choose words that are honest, kind, and repair-oriented.",
    realWorld: "Practice one true sentence with a warm tone.",
    viral: "A brave true sentence becomes a trust badge.",
  },
  promise: {
    archetype: "Promise Keeper",
    conflict: "Responsibility becomes visible only when a small job is finished.",
    action: "Break the promise into steps and let a grown-up witness the finish.",
    realWorld: "Pick one helper job that has a clear finish line.",
    viral: "A kept promise becomes a hero certificate.",
  },
  courage: {
    archetype: "Courage Walker",
    conflict: "Fear is not erased; it is carried through one doable step.",
    action: "Name the body cue, choose the tiny step, then move before fear gets the vote.",
    realWorld: "Try one small brave step in the next hard moment.",
    viral: "A tiny brave step becomes the story worth sharing.",
  },
  aim: {
    archetype: "Aim Mapper",
    conflict: "A wish becomes meaningful only when it turns into a concrete action.",
    action: "Choose the best aim, then pick the smallest useful next step.",
    realWorld: "Draw one goal arrow: aim -> step -> when.",
    viral: "A clear aim becomes a map page for the hero.",
  },
};

export default function GameScenePanel({
  gameId,
  foundationUrl,
  imagePrompt,
  eyebrow,
  title,
  prompt,
  tone = "green",
  sfx,
  children,
}: {
  gameId: string;
  foundationUrl: string;
  imagePrompt: string;
  eyebrow: string;
  title: React.ReactNode;
  prompt?: React.ReactNode;
  tone?: SceneTone;
  sfx?: string;
  children?: React.ReactNode;
}) {
  const { childProfile } = useArbor();
  const hero = useHeroAvatar();
  const preference: FoundationPreference = {
    avatarStyle: childProfile.avatar?.style,
    avatarSource: childProfile.avatar?.source,
  };
  const resolvedFoundation = foundationForGame(gameId, preference) ?? versionedVisual(foundationUrl);
  const mission = MISSION_COPY[gameId] ?? {
    archetype: "Hero Mission",
    conflict: "The practice becomes a clear story challenge.",
    action: "Choose, act, reflect, and turn the win into growth.",
    realWorld: "Use the same tiny skill once today.",
    viral: "Save the win as a family hero moment.",
  };

  return (
    <section className="comic-panel overflow-hidden" style={{ background: "var(--arbor-paper-elevated)", boxShadow: "var(--comic-pop)" }}>
      <div className="relative visual-scene-stage min-h-[250px] sm:min-h-[330px] overflow-hidden" style={{ background: TONE_BG[tone] }}>
        <WorldScene
          worldId={`mission-${gameId}`}
          imagePrompt={imagePrompt}
          heroUrl={hero.url ?? undefined}
          foundationUrl={resolvedFoundation}
        >
          <Sparkles className="w-14 h-14 text-white" strokeWidth={2.8} style={{ filter: "drop-shadow(3px 3px 0 rgba(23,27,34,.35))" }} aria-hidden="true" />
        </WorldScene>
        {sfx && (
          <span className="comic-sfx absolute top-4 left-4 z-[4] text-[28px] -rotate-6" aria-hidden="true">
            {sfx}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 z-[3] p-4 sm:p-6" style={{ background: "linear-gradient(0deg, rgba(23,27,34,.78), rgba(23,27,34,.08))" }}>
          <span className="inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide" style={{ background: TONE_BG[tone], color: TONE_INK[tone], border: "2px solid var(--comic-ink)" }}>
            {eyebrow}
          </span>
          <h2 className="mt-2 font-black leading-tight text-white" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(25px,5vw,44px)", textShadow: "3px 3px 0 rgba(23,27,34,.55)" }} dir="auto">
            {title}
          </h2>
          {prompt && (
            <p className="mt-2 max-w-[62ch] text-[14px] sm:text-[16px] font-extrabold text-white/95" dir="auto">
              {prompt}
            </p>
          )}
        </div>
      </div>
      <div className="p-4 sm:p-5 space-y-4">
        <div className="grid gap-3 lg:grid-cols-[1.05fr,1fr]">
          <div className="rounded-3xl p-4" style={{ background: TONE_BG[tone], border: "var(--comic-line)" }}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide" style={{ background: "#fff", color: TONE_INK[tone], border: "2px solid var(--comic-ink)" }}>
                Next-gen mission engine
              </span>
              <span className="rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide" style={{ background: "var(--arbor-yellow)", color: "var(--arbor-ink)", border: "2px solid var(--comic-ink)" }}>
                {mission.archetype}
              </span>
            </div>
            <p className="mt-3 text-[15px] font-black leading-snug" style={{ color: "var(--arbor-ink)" }} dir="auto">
              {mission.conflict}
            </p>
            <p className="mt-2 text-[13px] font-bold leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }} dir="auto">
              {mission.action}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-2xl px-4 py-3" style={{ background: "var(--arbor-paper-deep)", border: "2px solid rgba(41,51,63,.12)" }}>
              <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: "var(--arbor-green-ink)" }}>Real-world bridge</p>
              <p className="mt-1 text-[13px] font-extrabold leading-snug" style={{ color: "var(--arbor-ink)" }} dir="auto">{mission.realWorld}</p>
            </div>
            <div className="rounded-2xl px-4 py-3" style={{ background: "var(--arbor-yellow-soft)", border: "2px solid rgba(41,51,63,.12)" }}>
              <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: "var(--arbor-yellow-ink)" }}>Viral win loop</p>
              <p className="mt-1 text-[13px] font-extrabold leading-snug" style={{ color: "var(--arbor-ink)" }} dir="auto">{mission.viral}</p>
            </div>
          </div>
        </div>
        {children}
      </div>
    </section>
  );
}
