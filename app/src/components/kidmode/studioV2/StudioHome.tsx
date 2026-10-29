import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, Check, Sparkles, Sticker } from "lucide-react";
import { useArbor } from "../../../context/ArborContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useKidTheme } from "../../../hooks/useKidTheme";
import { useChildCollection } from "../../../hooks/useChildCollection";
import { kidArt, kidArtSrcSet } from "../../../lib/kidThemeManifest";
import { HERO_NAME_FALLBACK } from "../../../lib/heroNameFallback";
import { bedtimeDoorOpen } from "../../../lib/timeOfDay";
import { heGender } from "../../../lib/library/bookText";
import type { PlanBookDoc } from "../../../lib/library/plans/planBookDoc";
import { leadPlan, recordTry, tonightStepForChild, tryRecorded } from "../../../lib/plans/planWeek";
import { ArborMascot } from "../../ui/ArborMascot";
import { useStudioHero } from "./useStudioHero";
import { HoldExitButton } from "../HoldExitButton";
import { prefetchKidSurfaces } from "../kidPrefetch";
import { HeroFigure } from "../hero/HeroFigure";
import { useChildLibraryBooks } from "../useChildLibraryBooks";
import { kidSfx } from "../audio/kidAudio";
import { STUDIO_V2_WORLDS, type StudioWorldId } from "./studioCatalog";

/** B-KID-162 (round 2): the doors in reading order — the upper pair (Hero
 *  Stories, Studio) before the lower (Playbank, Feelings), start to end — so
 *  Tab meets them as the eye does. Their places come from CSS, not this order. */
export const STUDIO_DOOR_ORDER: readonly StudioWorldId[] = ["stories", "studio", "playbank", "feelings"];
import { studioCopy } from "./studioCopy";
import { QUEST_STEPS, studioQuestText, useStudioQuestProgress } from "./studioProgress";
import "./studioV2.css";
import "./studioSky.css";
import { StudioPortrait } from "./StudioPortrait";
import { StudioSprout } from "./StudioSprout";
export { StudioPortrait } from "./StudioPortrait";

/** The profile alone supplies the child; portal artwork never redraws them. */
export function StudioPortalArt({ worldId }: { worldId: StudioWorldId }) {
  const theme = useKidTheme();
  const art = kidArt(theme, `studio.portal.${worldId}`);
  return <span className="studio-v2__portal-art" aria-hidden="true">{art && !art.hasHero && <img src={art.src480} srcSet={kidArtSrcSet(art)} sizes="(max-width: 640px) 36vw, 600px" style={{ objectPosition: art.objectPosition }} alt="" draggable={false} decoding="async" />}</span>;
}
export function StudioSky() {
  // Authored atmosphere from Kids Studio Sky.dc.html, the V2 source of truth.
  return <div className="studio-v2__sky" aria-hidden="true"><span className="studio-sky__aurora studio-sky__aurora--stories" /><span className="studio-sky__aurora studio-sky__aurora--calm" /><span className="studio-sky__stars" /><span className="studio-sky__rays" /><span className="studio-sky__horizon" /><span className="studio-sky__ground" /></div>;
}
export interface StudioHomeProps {
  onWorld: (worldId: StudioWorldId) => void;
  onCollection: () => void;
  onQuest: () => void;
  onExit: () => void;
  /** S1 (surfacing): opens a library book over the shell (the plan book's deep link). */
  onOpenBook?: (bookId: string) => void;
}
export default function StudioHome({ onWorld, onCollection, onQuest, onExit, onOpenBook }: StudioHomeProps) {
  const { childProfile } = useArbor();
  useEffect(() => prefetchKidSurfaces(), []);
  const { uiLang } = useLanguage();
  const lang = uiLang === "he" ? "he" : "en";
  const copy = studioCopy(lang);
  const questCopy = studioQuestText[lang];
  const hero = useStudioHero();
  const quest = useStudioQuestProgress(childProfile.id);
  const [hint, setHint] = useState(0);
  const hintWorld = STUDIO_V2_WORLDS[hint % STUDIO_V2_WORLDS.length];
  const hasPose = !!hero.sheet;
  // ── S1 (surfacing): a running Everyday Plan takes the bottom rail (hero
  //    title · tonight's step in the child's words · Open my book · I tried!)
  //    and, once the evening door is open, Sprout's line. "I tried!" writes
  //    one LOCAL day key under the plan row's `tries` (a count, never a
  //    streak, never "missed"). No plan → the rail is the cozy corner, unchanged.
  const planRows = useChildCollection<PlanBookDoc>(childProfile.id, "books");
  const now = useMemo(() => new Date(), [planRows.items]);
  const plan = useMemo(() => leadPlan(planRows.items, now), [planRows.items, now]);
  const books = useChildLibraryBooks(childProfile.id);
  const planEntry = plan ? books.find((e) => e.book.id === plan.doc.bookId) : undefined;
  const step = plan ? tonightStepForChild(plan.doc, lang, heGender(childProfile.gender)) : null;
  const tried = !!plan && tryRecorded(plan.doc, now);
  const evening = bedtimeDoorOpen(now.getHours());
  const openPlanBook = () => { if (planEntry && onOpenBook) onOpenBook(planEntry.book.id); else onWorld("stories"); };
  const tryTonight = () => {
    if (!plan || tried) return;
    kidSfx("tap");
    void planRows.upsert(recordTry(plan.doc, new Date()));
  };
  const planLine = plan && step && evening ? copy.plan.bubble(step) : null;
  return <section className="studio-v2 studio-v2--home" dir={lang === "he" ? "rtl" : "ltr"} data-studio-home="">
    <StudioSky />
    <header className="studio-v2__header">
      <div className="studio-v2__greeting"><h1><span>{hero.name === HERO_NAME_FALLBACK ? copy.helloNoName : <>{copy.hello} <bdi>{hero.name}</bdi>!</>}</span><Sparkles size={22} aria-hidden="true" /></h1><p>{copy.invitation}</p></div>
      <div className="studio-v2__header-actions"><button className="studio-v2__glass-button" type="button" onClick={onCollection}><Sticker size={22} aria-hidden="true" /><span>{copy.collection}</span></button><HoldExitButton onExit={onExit} /></div>
    </header>
    <nav className="studio-v2__doors" aria-label={copy.invitation}>{STUDIO_DOOR_ORDER.map(worldId => <button className="studio-v2__door" data-world={worldId} key={worldId} type="button" onClick={() => onWorld(worldId)}>
      <StudioPortalArt worldId={worldId} /><span className="studio-v2__door-label"><span><strong>{copy.worlds[worldId].title}</strong><small>{copy.worlds[worldId].description}</small></span><ArrowRight size={20} aria-hidden="true" /></span>
    </button>)}</nav>
    <div className="studio-v2__hero" data-avatar-source={hasPose ? "current-character" : hero.url ? "current-portrait" : "mascot"}>
      {hasPose ? <div className="studio-v2__figure"><HeroFigure sheet={hero.sheet!} pose="idle" height={430} x={210} y={450} /></div> : hero.url ? <StudioPortrait className="studio-v2__hero-portrait" /> : <div className="studio-v2__hero-empty"><ArborMascot size={200} mood="wave" animate={false} /><p>{copy.noHero}</p></div>}
    </div>
    <div className="studio-v2__guide">
      {planLine ? (
        <div className="studio-v2__bubble studio-v2__bubble--plan" data-kid-plan-bubble={plan!.def.id}><span aria-live="polite">{planLine}</span><button type="button" onClick={openPlanBook}>{copy.plan.read}<ArrowRight size={15} aria-hidden="true" /></button></div>
      ) : (
        <div className="studio-v2__bubble"><span aria-live="polite">{copy.worlds[hintWorld].hint}</span><button type="button" onClick={() => onWorld(hintWorld)}>{copy.takeMe}<ArrowRight size={15} aria-hidden="true" /></button></div>
      )}
      <StudioSprout size={92} label={copy.guide} onTap={() => { if (planLine) return planLine; const next = hint + 1; setHint(next); return copy.worlds[STUDIO_V2_WORLDS[next % STUDIO_V2_WORLDS.length]].hint; }} />
    </div>
    {plan ? (
      <section className="studio-v2__quest studio-v2__quest--plan" aria-label={copy.plan.kicker} data-kid-plan-rail={plan.def.id}>
        <div className="studio-v2__quest-title"><small>{copy.plan.kicker}</small><h2 dir="auto">{plan.def.title[lang]}</h2>{step && <p dir="auto" data-kid-plan-step="">{copy.plan.tonight(step)}</p>}</div>
        <div className="studio-v2__plan-actions">
          <button type="button" className="studio-v2__gold-button" data-kid-plan-open="" onClick={openPlanBook}><BookOpen size={20} aria-hidden="true" />{copy.plan.open}<ArrowRight size={20} aria-hidden="true" /></button>
          <button type="button" className="studio-v2__glass-button" data-kid-plan-tried={tried ? "tonight" : ""} aria-pressed={tried} onClick={tryTonight}>{tried ? <Check size={20} aria-hidden="true" /> : <Sparkles size={20} aria-hidden="true" />}<span>{tried ? copy.plan.triedDone : copy.plan.tried}</span></button>
        </div>
      </section>
    ) : (
      <section className="studio-v2__quest" aria-label={questCopy.title}>
        <div className="studio-v2__quest-title"><small>{copy.quest}</small><h2>{quest.completed ? questCopy.done : questCopy.title}</h2>{/* T7: no count on a kid surface — the steps' own marks show the way */}{(!quest.loaded || quest.completed) && <p>{quest.loaded ? questCopy.ending : copy.questLoading}</p>}</div>
        <ol className="studio-v2__quest-steps">{QUEST_STEPS.map((step, index) => <li key={step} data-done={quest.steps.includes(step)} data-connected={quest.loaded && index < quest.steps.length - 1} aria-current={quest.loaded && !quest.completed && index === quest.steps.length ? "step" : undefined}><span>{quest.steps.includes(step) ? <Check size={22} aria-hidden="true" /> : <i className="studio-v2__quest-dot" aria-hidden="true" />}</span><small>{questCopy.steps[index]}</small></li>)}</ol>
        <button type="button" className="studio-v2__gold-button" onClick={onQuest}>{quest.completed ? copy.questOpen : copy.questContinue}<ArrowRight size={20} aria-hidden="true" /></button>
      </section>
    )}
  </section>;
}
export { StudioHome };
