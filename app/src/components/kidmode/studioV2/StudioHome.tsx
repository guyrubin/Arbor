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
import { STUDIO_V2_WORLDS, type StudioWorldId } from "./studioCatalog";
import { studioCopy } from "./studioCopy";
import { QUEST_STEPS, studioQuestText, useStudioQuestProgress } from "./studioProgress";
import "./studioV2.css";
import "./studioSky.css";
import { StudioPortrait } from "./StudioPortrait";
import WorldScene from "../../practice/WorldScene";
export { StudioPortrait } from "./StudioPortrait";

/** The V2 environments are deliberately neutral: the profile alone supplies the child. */
const WORLD_SCENES: Record<StudioWorldId, string> = {
  stories: "An original magical story world: the child opens an illuminated storybook, with a tiny violet castle and a winding golden path rising from its pages. Expressive three-quarter close-up, face clearly visible, warm wonder, rich cinematic depth",
  studio: "An original creative studio: the child paints a colorful handmade rocket on a wooden easel, brush in hand, warm amber lamps and art supplies. Expressive three-quarter close-up, face clearly visible, playful discovery, rich cinematic depth",
  playbank: "An original playful discovery garden: the child solves a chunky wooden animal puzzle at a low table among green leaves and glowing lanterns. Expressive three-quarter close-up, face clearly visible, joyful curiosity, rich cinematic depth",
  feelings: "An original feelings adventure: the child gently welcomes little friendly glowing emotion orbs on a sunny mountain path with soft clouds. Expressive three-quarter close-up, face clearly visible, reassuring warmth, rich cinematic depth",
};
export function StudioPortalArt({ worldId, personalized = false }: { worldId: StudioWorldId; personalized?: boolean }) {
  const theme = useKidTheme();
  const hero = useHeroAvatar();
  const art = kidArt(theme, `studio.portal.${worldId}`);
  const neutral = art && !art.hasHero ? art : null;
  return <span className="studio-v2__portal-art" aria-hidden="true">{neutral && (personalized
    ? <WorldScene worldId={`studio-v2-${worldId}`} theme={theme} imagePrompt={WORLD_SCENES[worldId]} heroUrl={hero.url ?? undefined} heroStyle={hero.style} sizes="(max-width: 640px) 36vw, 600px" fallbackArt={{ src: neutral.src480, srcSet: kidArtSrcSet(neutral), objectPosition: neutral.objectPosition, provenanceId: neutral.provenanceId, hasHero: false }}>{null}</WorldScene>
    : <img src={neutral.src480} srcSet={kidArtSrcSet(neutral)} sizes="100vw" style={{ objectPosition: neutral.objectPosition }} alt="" draggable={false} decoding="async" />)}</span>;
}
export function StudioSky() {
  // Authored atmosphere from Kids Studio Sky.dc.html, the V2 source of truth.
  return <div className="studio-v2__sky" aria-hidden="true"><span className="studio-sky__aurora studio-sky__aurora--stories" /><span className="studio-sky__aurora studio-sky__aurora--calm" /><span className="studio-sky__stars" /><span className="studio-sky__rays" /><span className="studio-sky__horizon" /><span className="studio-sky__ground" /></div>;
}
export interface StudioHomeProps { onWorld: (worldId: StudioWorldId) => void; onCollection: () => void; onQuest: () => void; onExit: () => void }
export default function StudioHome({ onWorld, onCollection, onQuest, onExit }: StudioHomeProps) {
  const { childProfile } = useArbor();
  useEffect(() => { prefetchKidSurfaces(); }, []);
  const { uiLang } = useLanguage();
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
      <div className="studio-v2__greeting"><h1><span>{hero.name === HERO_NAME_FALLBACK ? copy.helloNoName : <>{copy.hello} <bdi>{hero.name}</bdi>!</>}</span><Sparkles size={22} aria-hidden="true" /></h1><p>{copy.invitation}</p></div>
      <div className="studio-v2__header-actions"><button className="studio-v2__glass-button" type="button" onClick={onCollection}><Sticker size={22} aria-hidden="true" /><span>{copy.collection}</span></button><HoldExitButton onExit={onExit} /></div>
    </header>
    <nav className="studio-v2__doors" aria-label={copy.invitation}>{STUDIO_V2_WORLDS.map(worldId => <button className="studio-v2__door" data-world={worldId} key={worldId} type="button" onClick={() => onWorld(worldId)}>
      <StudioPortalArt worldId={worldId} personalized /><span className="studio-v2__door-label"><span><strong>{copy.worlds[worldId].title}</strong><small>{copy.worlds[worldId].description}</small></span><ArrowRight size={20} aria-hidden="true" /></span>
    </button>)}</nav>
    <div className="studio-v2__hero" data-avatar-source={hasPose ? "current-sheet" : hero.url ? "current-portrait" : "mascot"}>
      {hasPose ? <div className="studio-v2__figure"><HeroFigure sheet={heroState.sheet} pose="idle" height={430} x={210} y={450} /></div> : hero.url ? <StudioPortrait className="studio-v2__hero-portrait" /> : <div className="studio-v2__hero-empty"><ArborMascot size={200} mood="wave" animate={false} /><p>{copy.noHero}</p></div>}
    </div>
    <div className="studio-v2__guide"><div className="studio-v2__bubble"><span aria-live="polite">{copy.worlds[hintWorld].hint}</span><button type="button" onClick={() => onWorld(hintWorld)}>{copy.takeMe}<ArrowRight size={15} aria-hidden="true" /></button></div><button type="button" className="studio-v2__sprout" aria-label={copy.guide} onClick={() => setHint(n => n + 1)}><ArborMascot size={92} mood={hint % 2 ? "think" : "wave"} animate={false} /></button></div>
    <section className="studio-v2__quest" aria-label={questCopy.title}>
      <div className="studio-v2__quest-title"><small>{copy.quest}</small><h2>{quest.completed ? questCopy.done : questCopy.title}</h2><p>{quest.loaded ? quest.completed ? questCopy.ending : copy.progress(quest.steps.length) : copy.questLoading}</p></div>
      <ol className="studio-v2__quest-steps">{QUEST_STEPS.map((step, index) => <li key={step} data-done={quest.steps.includes(step)} data-connected={quest.loaded && index < quest.steps.length - 1} aria-current={quest.loaded && !quest.completed && index === quest.steps.length ? "step" : undefined}><span>{quest.steps.includes(step) ? <Check size={22} aria-hidden="true" /> : index + 1}</span><small>{questCopy.steps[index]}</small></li>)}</ol>
      <button type="button" className="studio-v2__gold-button" onClick={onQuest}>{quest.completed ? copy.questOpen : copy.questContinue}<ArrowRight size={20} aria-hidden="true" /></button>
    </section>
  </section>;
}
export { StudioHome };
