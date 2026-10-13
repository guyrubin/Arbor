import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Armchair, Bell, Circle, Drum, Ear, Fish, Footprints, Hand, LampFloor, Moon, Puzzle, Smile, Square, Sun, TreePine, Waves, type LucideIcon } from "lucide-react";
import { useArbor } from "../../../context/ArborContext";
import { useAuth } from "../../../context/AuthContext";
import { useLanguage } from "../../../context/LanguageContext";
import { noteKidActivity } from "../../../lib/kidModeGate";
import { localizedMimicPacks } from "../../../practice/mimicContent";
import { HeroAvatar } from "../../ui/HeroAvatar";
import { KidStageFallback } from "../KidStageFallback";
import { sneakFreezeFlagOn } from "../kidWorlds";
import { kidSfx } from "../audio/kidAudio";
import { GameFinish, GameShell } from "../game/GameShell";
import { GameCompletionProvider } from "../game/GameSessionContext";
import { KidFinishMoment } from "../rewards/KidSouvenir";
import { studioActivityFits, type StudioActivityId } from "./studioCatalog";
import { studioCopy } from "./studioCopy";

const MemoryMatch = lazy(() => import("../../practice/MindVaultWorld"));
const FeelingsDetective = lazy(() => import("../../practice/FeelingsLabTab"));
const SequenceQuest = lazy(() => import("../../practice/PatternPowerWorld"));
const RhythmHero = lazy(() => import("../../practice/BeatKeeperWorld"));
const SneakFreeze = lazy(() => import("../games/sneakFreeze/SneakFreeze"));
const CalmBuilder = lazy(() => import("./games/CalmBuilder"));
const PuzzlePlanet = lazy(() => import("./games/PuzzlePlanet"));
const SoundExplorer = lazy(() => import("./games/SoundExplorer"));

/** The real mechanics stay lazy; opening the sky does not load every game. */
export const STUDIO_GAME_COMPONENTS: Partial<Record<StudioActivityId, React.ComponentType<{ onBack?: () => void }>>> = {
  memory: MemoryMatch, feelings: FeelingsDetective, mimic: CameraFreeMimic,
  pattern: SequenceQuest, beat: RhythmHero, sneak: SneakFreeze,
  "calm-builder": CalmBuilder, puzzle: PuzzlePlanet, "sound-explorer": SoundExplorer,
};
const DEMOS: Partial<Record<StudioActivityId, readonly LucideIcon[]>> = {
  memory: [Sun, Moon, Sun], feelings: [Ear, Smile, Hand],
  mimic: [Smile, Fish, Smile], pattern: [Circle, Square, Circle, Square],
  beat: [Drum, Hand, Drum], sneak: [Footprints, Hand, Footprints],
  "calm-builder": [TreePine, Armchair, LampFloor], puzzle: [Puzzle, TreePine, Puzzle],
  "sound-explorer": [Ear, Footprints, Bell],
};
const WORDS = {
  en: { start: "Let's play", back: "Back to the world", done: "A little adventure, complete", again: "Play again", unavailable: "Let's choose something else together.", tried: "I tried it", skip: "Try another", mimicDone: "You made those faces your own", mimicPassed: "You can try a face whenever you’re ready" },
  he: { start: "בואו נשחק", back: "בחזרה לעולם", done: "הרפתקה קטנה שהושלמה", again: "לשחק שוב", unavailable: "אפשר לבחור משהו אחר יחד.", tried: "ניסיתי", skip: "ננסה עוד אחת", mimicDone: "ניסית את ההבעות בדרך שלך", mimicPassed: "אפשר לנסות הבעה כשמתאים לך" },
};
const PANEL: React.CSSProperties = {
  maxWidth: 760, margin: "auto", padding: "clamp(20px, 5vw, 40px)",
  borderRadius: 28, color: "var(--arbor-ink)", background: "var(--arbor-paper)",
  textAlign: "center", border: "2px solid var(--arbor-rule)",
};
const ACTION: React.CSSProperties = {
  minHeight: 56, minWidth: 56, padding: "12px 24px", borderRadius: 20,
  border: "2px solid var(--arbor-rule-strong)", background: "var(--arbor-paper-elevated)",
  color: "var(--arbor-ink)", font: "inherit", fontWeight: 800, cursor: "pointer",
};

/** Owner, child and activity changes retire the old play session immediately. */
export function StudioGame({ activityId, onBack }: { activityId: StudioActivityId; onBack: () => void }) {
  const { childProfile } = useArbor();
  const { user } = useAuth();
  return <StudioGameSession key={JSON.stringify([user?.uid ?? "local", childProfile.id, activityId])} activityId={activityId} onBack={onBack} />;
}

export function StudioGameSession({ activityId, onBack }: { activityId: StudioActivityId; onBack: () => void }) {
  const { childProfile } = useArbor();
  const { uiLang } = useLanguage();
  const lang = uiLang === "he" ? "he" : "en";
  const copy = studioCopy(lang).activities[activityId];
  const words = WORDS[lang];
  const [phase, setPhase] = useState<"intro" | "play" | "result">("intro");
  const [round, setRound] = useState(0);
  const complete = useRef(false);
  const activeRound = useRef(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const onComplete = useCallback(() => {
    if (!mounted.current || complete.current || activeRound.current !== round) return;
    complete.current = true;
    setPhase("result");
  }, [round]);
  useEffect(() => { if (phase === "result") kidSfx("finish"); }, [phase]);
  const Component = STUDIO_GAME_COMPONENTS[activityId];
  const eligible = !!Component && studioActivityFits(activityId, childProfile, lang, undefined, { sneakEnabled: sneakFreezeFlagOn() });

  if (!eligible) return <section style={PANEL} data-studio-game-unavailable="" dir={lang === "he" ? "rtl" : "ltr"}>
    <HeroAvatar size={96} mood="wave" decorative />
    <p className="kid-type-label">{words.unavailable}</p>
    <button type="button" style={ACTION} onClick={onBack}>{words.back}</button>
  </section>;

  if (phase === "play") return <div data-studio-game={activityId} data-studio-phase="play" aria-label={copy.title} style={activityId === "sneak" ? { height: "100%", minHeight: 0 } : undefined}>
    <GameCompletionProvider onComplete={onComplete}>
      <Suspense fallback={<KidStageFallback worldId={activityId} />}>
        <Component key={round} {...(activityId === "mimic" ? { onBack } : {})} />
      </Suspense>
    </GameCompletionProvider>
  </div>;

  return <section data-studio-game={activityId} data-studio-phase={phase} style={PANEL} dir={lang === "he" ? "rtl" : "ltr"} aria-label={copy.title}>
    {phase === "intro" ? <>
      <HeroAvatar size={112} mood="wave" decorative />
      <h1 className="kid-type-title">{copy.title}</h1>
      <div aria-hidden="true" style={{ display: "flex", gap: 16, justifyContent: "center", alignItems: "center", flexWrap: "wrap", marginBlock: 24 }}>
        {(DEMOS[activityId] ?? []).map((Glyph, i) => <Glyph key={i} size={48} strokeWidth={1.8} />)}
      </div>
      <p className="kid-type-say" style={{ maxWidth: "30ch", margin: "16px auto 24px" }}>{copy.instruction}</p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <button type="button" data-studio-start="" style={{ ...ACTION, background: "var(--arbor-green-soft)" }} onClick={() => setPhase("play")}>{words.start}</button>
        <button type="button" style={ACTION} onClick={onBack}>{words.back}</button>
      </div>
    </> : <>
      {/* Remains mounted while the owner-scoped ledger hydrates/queues writes. */}
      <KidFinishMoment childId={childProfile.id} kind="world" refId={activityId} lang={lang} />
      <h2 className="kid-type-title">{words.done}</h2>
      <p className="kid-type-label">{copy.title}</p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBlockStart: 24 }}>
        <button type="button" data-studio-replay="" style={{ ...ACTION, background: "var(--arbor-green-soft)" }} onClick={() => { complete.current = false; activeRound.current += 1; setRound(activeRound.current); setPhase("play"); }}>{words.again}</button>
        <button type="button" style={ACTION} onClick={onBack}>{words.back}</button>
      </div>
    </>}
  </section>;
}

/** Authored mimic prompts without capture or grading. A pass never describes
 * ability; passing every prompt offers another try without awarding play. */
export function CameraFreeMimic({ onBack }: { onBack?: () => void } = {}) {
  const { t, uiLang } = useLanguage();
  const lang = uiLang === "he" ? "he" : "en";
  const words = WORDS[lang];
  const copy = studioCopy(lang).activities.mimic;
  const pack = localizedMimicPacks(t).find(item => item.id === "silly-faces")!;
  const [step, setStep] = useState(0);
  const counted = useRef(false);
  const tried = useRef(false);
  const replay = () => { counted.current = false; tried.current = false; setStep(0); };
  const advance = (didTry: boolean) => {
    if (didTry) tried.current = true;
    if (step + 1 === pack.prompts.length && tried.current && !counted.current) { counted.current = true; noteKidActivity(); }
    setStep(Math.min(step + 1, pack.prompts.length));
  };
  return <GameShell worldId="mimic" title={copy.title} instruction={copy.instruction} progress={{ index: step, total: pack.prompts.length }}>
    {step >= pack.prompts.length ? tried.current
      ? <GameFinish title={words.mimicDone} onPlayAgain={replay} playAgainLabel={words.again} homeLabel={words.back} />
      : <div style={{ ...PANEL, padding: 24 }} data-mimic-passed="">
        <Waves size={64} aria-hidden="true" style={{ margin: "auto" }} />
        <p className="kid-type-say">{words.mimicPassed}</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBlockStart: 24 }}>
          <button type="button" data-mimic-replay="" style={ACTION} onClick={replay}>{words.again}</button>
          {onBack && <button type="button" style={ACTION} onClick={onBack}>{words.back}</button>}
        </div>
      </div>
      : <div style={{ ...PANEL, padding: 24 }} data-mimic-prompt={pack.prompts[step].id}>
        <span aria-hidden="true" style={{ fontSize: 80 }}>{pack.prompts[step].emoji}</span>
        <h2 className="kid-type-title">{pack.prompts[step].title}</h2>
        <p className="kid-type-say">{pack.prompts[step].instruction}</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBlockStart: 24 }}>
          <button type="button" style={{ ...ACTION, background: "var(--arbor-green-soft)" }} onClick={() => advance(true)}>{words.tried}</button>
          <button type="button" style={ACTION} onClick={() => advance(false)}>{words.skip}</button>
        </div>
      </div>}
  </GameShell>;
}
export default StudioGame;
