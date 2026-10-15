import { NEXT_GAME_COPY } from "../../../lib/i18nGameNext";
import React, { useEffect, useState } from "react";
import { ArrowRight, Check, Sparkles, Sticker } from "lucide-react";
import { useArbor } from "../../../context/ArborContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useKidTheme } from "../../../hooks/useKidTheme";
import { kidArt, kidArtSrcSet } from "../../../lib/kidThemeManifest";
import { HERO_NAME_FALLBACK } from "../../../lib/heroNameFallback";
import { ArborMascot } from "../../ui/ArborMascot";
import { useHeroAvatar } from "../../ui/HeroAvatar";
import { HoldExitButton } from "../HoldExitButton";
import { prefetchKidSurfaces } from "../kidPrefetch";
import { HeroFigure } from "../hero/HeroFigure";
import { useHeroSheetState } from "../hero/useHeroSheet";
import { STUDIO_V2_WORLDS, studioActivityFits, type StudioWorldId, type StudioActivityId } from "./studioCatalog";
import { studioCopy } from "./studioCopy";
import { QUEST_STEPS, studioQuestText, useStudioQuestProgress } from "./studioProgress";
import "./studioV2.css";
import { StudioActivityArt } from "./StudioActivityArt";
import "./studioGame.css";

/** The V2 environments are deliberately neutral: the profile alone supplies the child. */
export function StudioPortalArt({ worldId }: { worldId: StudioWorldId }) {
  const theme = useKidTheme();
  const art = kidArt(theme, `studio.portal.${worldId}`);
  return <span className="studio-v2__portal-art" aria-hidden="true">{art && !art.hasHero ? <img src={art.src480} srcSet={kidArtSrcSet(art)} sizes="(max-width: 640px) 45vw, 600px" style={{ objectPosition: art.objectPosition }} alt="" draggable={false} decoding="async" /> : null}</span>;
}
export function StudioSky() {
  const theme = useKidTheme();
  const art = kidArt(theme, "studio.sky");
  return <div className="studio-v2__sky" aria-hidden="true">{art && !art.hasHero ? <img src={art.src} srcSet={kidArtSrcSet(art)} sizes="100vw" alt="" decoding="async" /> : null}</div>;
}
/** Always the current approved image; never a raw upload or a generic child. */
export function StudioPortrait({ className = "", label = "" }: { className?: string; label?: string }) {
  const hero = useHeroAvatar();
  const [failed, setFailed] = useState<string | null>(null);
  return <span className={className}>{hero.url && failed !== hero.url ? <img key={hero.url} src={hero.url} alt={label} onError={() => setFailed(hero.url)} draggable={false} referrerPolicy="no-referrer" /> : <ArborMascot size={90} mood="wave" animate={false} />}</span>;
}
export interface StudioHomeProps { onActivity?: (id: StudioActivityId) => void; onWorld: (worldId: StudioWorldId) => void; onCollection: () => void; onQuest: () => void; onExit: () => void }
export default function StudioHome({ onWorld, onCollection, onQuest, onExit, onActivity }: StudioHomeProps) {
  const { childProfile } = useArbor();
  useEffect(() => { prefetchKidSurfaces(); }, []);
  const { uiLang } = useLanguage();
  const nextWords = NEXT_GAME_COPY[uiLang === "he" ? "he" : "en"];
  const lang = uiLang === "he" ? "he" : "en";
  const copy = studioCopy(lang);
  const questCopy = studioQuestText[lang];
  const hero = useHeroAvatar();
  const heroState = useHeroSheetState(childProfile);
  const quest = useStudioQuestProgress(childProfile.id);
  const [hint, setHint] = useState(0);
  const hintWorld = STUDIO_V2_WORLDS[hint % STUDIO_V2_WORLDS.length];
  const hasPose = !!hero.url && heroState.from === "child";
  return <section className="studio-v2 studio-v2--home" dir={lang === "he" ? "rtl" : "ltr"} data-studio-home="">
    <StudioSky />
    <header className="studio-v2__header">
      <div className="studio-v2__greeting"><h1>{hero.name === HERO_NAME_FALLBACK ? copy.helloNoName : <>{copy.hello} <bdi>{hero.name}</bdi>! <Sparkles size={22} aria-hidden="true" /></>}</h1><p>{copy.invitation}</p></div>
      <div className="studio-v2__header-actions"><button className="studio-v2__glass-button" type="button" onClick={onCollection}><Sticker size={22} aria-hidden="true" /><span>{copy.collection}</span></button><HoldExitButton onExit={onExit} /></div>
    </header>
    <nav className="studio-v2__doors" aria-label={copy.invitation}>{STUDIO_V2_WORLDS.map(worldId => <button className="studio-v2__door" data-world={worldId} key={worldId} type="button" onClick={() => onWorld(worldId)}>
      <StudioPortalArt worldId={worldId} /><span className="studio-v2__door-label"><span><strong>{copy.worlds[worldId].title}</strong><small>{copy.worlds[worldId].description}</small></span><ArrowRight size={20} aria-hidden="true" /></span>
    </button>)}</nav>
    <div className="studio-v2__hero" data-avatar-source={hasPose ? "current-sheet" : hero.url ? "current-portrait" : "mascot"}>
      {hasPose ? <div className="studio-v2__figure"><HeroFigure sheet={heroState.sheet} pose="idle" height={430} x={210} y={450} /></div> : hero.url ? <StudioPortrait className="studio-v2__hero-portrait" /> : <div className="studio-v2__hero-empty"><ArborMascot size={200} mood="wave" animate={false} /><p>{copy.noHero}</p></div>}
    </div>
    <div className="studio-v2__guide"><div className="studio-v2__bubble"><span aria-live="polite">{copy.worlds[hintWorld].hint}</span><button type="button" onClick={() => onWorld(hintWorld)}>{copy.takeMe}<ArrowRight size={15} aria-hidden="true" /></button></div><button type="button" className="studio-v2__sprout" aria-label={copy.guide} onClick={() => setHint(n => n + 1)}><ArborMascot size={92} mood={hint % 2 ? "think" : "wave"} animate={false} /></button></div>
    {onActivity ? <section className="studio-v2__quest studio-v2__featured" aria-label={nextWords.featured}>
      {(['river-rescue','feelings-forest','rhythm-garden'] as const).filter(id => studioActivityFits(id, childProfile, lang)).map(id => <button type="button" key={id} onClick={() => onActivity(id)}><span className="studio-v2__featured-art"><StudioActivityArt id={id} /></span><span><strong>{copy.activities[id].title}</strong><small>{copy.activities[id].description}</small></span><ArrowRight size={20} aria-hidden="true" /></button>)}
    </section> : <section className="studio-v2__quest" aria-label={questCopy.title}>
      <div className="studio-v2__quest-title"><small>{copy.quest}</small><h2>{quest.completed ? questCopy.done : questCopy.title}</h2><p>{quest.loaded ? quest.completed ? questCopy.ending : copy.progress(quest.steps.length) : copy.questLoading}</p></div>
      <ol className="studio-v2__quest-steps">{QUEST_STEPS.map((step, index) => <li key={step} data-done={quest.steps.includes(step)} aria-current={quest.loaded && !quest.completed && index === quest.steps.length ? "step" : undefined}><span>{quest.steps.includes(step) ? <Check size={22} aria-hidden="true" /> : index + 1}</span><small>{questCopy.steps[index]}</small></li>)}</ol>
      <button type="button" className="studio-v2__gold-button" onClick={onQuest}>{quest.completed ? copy.questOpen : copy.questContinue}<ArrowRight size={20} aria-hidden="true" /></button>
    </section>}
  </section>;
}
export { StudioHome };
