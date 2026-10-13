import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, RotateCcw, Waves } from "lucide-react";
import { useArbor } from "../../../context/ArborContext";
import { useAuth } from "../../../context/AuthContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useKidTheme } from "../../../hooks/useKidTheme";
import { kidArt, kidArtSrcSet } from "../../../lib/kidThemeManifest";
import { noteKidActivity } from "../../../lib/kidModeGate";
import { localizedMimicPacks } from "../../../practice/mimicContent";
import { HeroAvatar } from "../../ui/HeroAvatar";
import { KidStageFallback } from "../KidStageFallback";
import { sneakFreezeFlagOn } from "../kidWorlds";
import { kidSfx } from "../audio/kidAudio";
import { GameFinish, GameShell } from "../game/GameShell";
import { GameCompletionProvider } from "../game/GameSessionContext";
import { KidFinishMoment } from "../rewards/KidSouvenir";
import { studioActivity, studioActivityFits, type StudioActivityId } from "./studioCatalog";
import { studioCopy } from "./studioCopy";
import "./studioGame.css";

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
const WORDS = {
  en: { start: "Let's play", back: "Back to the world", done: "A little adventure, complete", again: "Play again", unavailable: "Let's choose something else together.", tried: "I tried it", skip: "Try another", mimicDone: "You made those faces your own", mimicPassed: "You can try a face whenever you’re ready" },
  he: { start: "בואו נשחק", back: "בחזרה לעולם", done: "הרפתקה קטנה שהושלמה", again: "לשחק שוב", unavailable: "אפשר לבחור משהו אחר יחד.", tried: "ניסיתי", skip: "ננסה עוד אחת", mimicDone: "ניסית את ההבעות בדרך שלך", mimicPassed: "אפשר לנסות הבעה כשמתאים לך" },
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
  const labels = studioCopy(lang);
  const copy = labels.activities[activityId];
  const theme = useKidTheme();
  const activity = studioActivity(activityId);
  const candidate = activity ? kidArt(theme, `studio.portal.${activity.worldId}`) : null;
  // Only neutral environments belong behind the canonical profile portrait.
  const art = candidate && !candidate.hasHero ? candidate : null;
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

  const environment = <div className="studio-game-view__environment" aria-hidden="true">
    {art && <img src={art.src480} srcSet={kidArtSrcSet(art)} sizes="100vw" alt="" draggable={false} decoding="async" style={{ objectPosition: art.objectPosition }} />}
  </div>;
  if (!eligible) return <section className="studio-game-view" data-studio-game-unavailable="" dir={lang === "he" ? "rtl" : "ltr"}>
    {environment}
    <div className="studio-game-card studio-game-card--unavailable">
      <HeroAvatar size={112} mood="wave" animate={false} decorative />
      <p className="studio-game-card__instruction">{words.unavailable}</p>
      <button type="button" className="studio-game-button-v2 studio-game-button-v2--primary" onClick={onBack}>{words.back}</button>
    </div>
  </section>;

  if (phase === "play") return <div className={`studio-game-view studio-game-view--play${activityId === "sneak" ? " studio-game-view--full" : ""}`} data-studio-game={activityId} data-studio-phase="play" aria-label={copy.title} dir={lang === "he" ? "rtl" : "ltr"} style={activityId === "sneak" ? { height: "100%", minHeight: 0 } : undefined}>
    {environment}
    <div className="studio-game-view__mechanic">
      <GameCompletionProvider onComplete={onComplete}>
        <Suspense fallback={<KidStageFallback worldId={activityId} />}>
          <Component key={round} {...(activityId === "mimic" ? { onBack } : {})} />
        </Suspense>
      </GameCompletionProvider>
    </div>
  </div>;

  return <section className="studio-game-view" data-studio-game={activityId} data-studio-phase={phase} dir={lang === "he" ? "rtl" : "ltr"} aria-label={copy.title}>
    {environment}
    <div className={`studio-game-card${phase === "result" ? " studio-game-card--result" : ""}`}>
      <div className="studio-game-card__window" aria-hidden="true">
        {art && <img src={art.src480} srcSet={kidArtSrcSet(art)} sizes="(min-width: 700px) 620px, 100vw" alt="" draggable={false} decoding="async" style={{ objectPosition: art.objectPosition }} />}
        {activity && <span className="studio-game-card__world">{labels.worlds[activity.worldId].title}</span>}
        <span className="studio-game-card__portrait"><HeroAvatar size={112} mood={phase === "result" ? "cheer" : "wave"} animate={false} ring={false} decorative /></span>
      </div>
      {phase === "intro" ? <div className="studio-game-card__body">
        <h1 className="studio-game-card__title">{copy.title}</h1>
        <p className="studio-game-card__instruction">{copy.instruction}</p>
        <div className="studio-game-card__actions">
          <button type="button" data-studio-start="" className="studio-game-button-v2 studio-game-button-v2--primary" onClick={() => setPhase("play")}>{words.start}<ArrowRight size={22} aria-hidden="true" /></button>
        </div>
      </div> : <div className="studio-game-card__body">
        <h2 className="studio-game-card__title">{words.done}</h2>
        <p className="studio-game-card__instruction">{copy.title}</p>
        {/* Remains mounted while the owner-scoped ledger hydrates/queues writes.
            The single canonical portrait is already in the environment window. */}
        <div className="studio-game-card__keepsake"><KidFinishMoment childId={childProfile.id} kind="world" refId={activityId} lang={lang} hero={false} /></div>
        <div className="studio-game-card__actions">
          <button type="button" data-studio-replay="" className="studio-game-button-v2" onClick={() => { complete.current = false; activeRound.current += 1; setRound(activeRound.current); setPhase("play"); }}><RotateCcw size={20} aria-hidden="true" />{words.again}</button>
          <button type="button" className="studio-game-button-v2 studio-game-button-v2--primary" onClick={onBack}>{words.back}<ArrowRight size={22} aria-hidden="true" /></button>
        </div>
      </div>}
    </div>
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
      : <div className="studio-game-mimic" data-mimic-passed="">
        <Waves size={64} aria-hidden="true" style={{ margin: "auto" }} />
        <p className="kid-type-say">{words.mimicPassed}</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBlockStart: 24 }}>
          <button type="button" data-mimic-replay="" className="studio-game-button-v2" onClick={replay}>{words.again}</button>
          {onBack && <button type="button" className="studio-game-button-v2" onClick={onBack}>{words.back}</button>}
        </div>
      </div>
      : <div className="studio-game-mimic" data-mimic-prompt={pack.prompts[step].id}>
        <span aria-hidden="true" style={{ fontSize: 80 }}>{pack.prompts[step].emoji}</span>
        <h2 className="kid-type-title">{pack.prompts[step].title}</h2>
        <p className="kid-type-say">{pack.prompts[step].instruction}</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBlockStart: 24 }}>
          <button type="button" className="studio-game-button-v2 studio-game-button-v2--primary" onClick={() => advance(true)}>{words.tried}</button>
          <button type="button" className="studio-game-button-v2" onClick={() => advance(false)}>{words.skip}</button>
        </div>
      </div>}
  </GameShell>;
}
export default StudioGame;
