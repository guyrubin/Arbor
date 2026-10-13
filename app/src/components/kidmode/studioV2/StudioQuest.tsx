import React, { useEffect, useRef, useState } from "react";
import { AlignLeft, AlignCenter, AlignRight, Armchair, RectangleHorizontal, LampFloor, Sun, Moon, Eye, Check } from "lucide-react";
import { useArbor } from "../../../context/ArborContext";
import { useAuth } from "../../../context/AuthContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useKidTheme } from "../../../hooks/useKidTheme";
import { kidArt, worldTileKey } from "../../../lib/kidThemeManifest";
import { QUEST_SOUVENIR_REF } from "../rewards/kidSouvenirs";
import { KidFinishMoment } from "../rewards/KidSouvenir";
import { QUEST_CHOICES, QUEST_STEPS, questChoiceText, studioQuestText, useStudioQuestProgress, type QuestChoice } from "./studioProgress";
import { StudioSky } from "./StudioHome";
import "./studioV2.css";
import "./studioKeepsakes.css";
const icons = { left: AlignLeft, middle: AlignCenter, right: AlignRight, pillow: Armchair, blanket: RectangleHorizontal, lamp: LampFloor, daylight: Sun, quiet: Moon, look: Eye };
export function StudioQuest({ onHome }: { onHome: () => void }) {
  const { childProfile } = useArbor(); const { user } = useAuth();
  return <Quest key={`${user?.uid ?? "local"}:${childProfile.id}`} childId={childProfile.id} onHome={onHome} />;
}
function Quest({ childId }: { childId: string; onHome: () => void }) {
  const { uiLang } = useLanguage(); const copy = studioQuestText[uiLang];
  const art = kidArt(useKidTheme(), worldTileKey("kid-quest"));
  const progress = useStudioQuestProgress(childId);
  const [saving, setSaving] = useState(false), [error, setError] = useState(false);
  const alive = useRef(true), busy = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const advance = async (choice: QuestChoice) => {
    if (busy.current || !progress.loaded || progress.completed) return;
    busy.current = true; setSaving(true); setError(false);
    try { await progress.advance(choice); } catch { if (alive.current) setError(true); }
    finally { busy.current = false; if (alive.current) setSaving(false); }
  };
  const count = progress.steps.length;
  return <section className="studio-v2 studio-keepsakes" dir={uiLang === "he" ? "rtl" : "ltr"} data-studio-quest="">
    <StudioSky />
    <div className="studio-keepsakes__layout">
      <div className="studio-keepsakes__scene">
        {art && !art.hasHero && <img className="studio-keepsakes__environment" src={art.src} alt="" />}
        <header className="studio-keepsakes__heading"><h1>{progress.completed ? copy.done : copy.title}</h1><p>{progress.completed ? copy.ending : copy.intro}</p></header>
      </div>
      <div className="studio-keepsakes__panel">
        <ol className="studio-keepsakes__steps">{QUEST_STEPS.map((step, index) => <li key={step} data-done={index < count} aria-current={progress.loaded && index === count ? "step" : undefined}><span>{index < count ? <Check size={20} aria-hidden="true" /> : index + 1}</span>{copy.steps[index]}</li>)}</ol>
        <ul className="studio-keepsakes__choices-kept">
          {QUEST_STEPS.filter(step => progress.choices[step]).map(step => { const choice = progress.choices[step]!; const Glyph = icons[choice]; return <li key={step}><Glyph size={24} aria-hidden="true" />{questChoiceText[uiLang][choice]}</li>; })}
        </ul>
        {!progress.loaded ? <p role="status">{copy.loading}</p> : progress.completed ? <KidFinishMoment childId={childId} kind="world" refId={QUEST_SOUVENIR_REF} lang={uiLang} hero={false} /> : <div className="studio-keepsakes__choices" role="group" aria-label={copy.steps[count]}>{QUEST_CHOICES[QUEST_STEPS[count]].map(choice => { const Glyph = icons[choice]; return <button className="studio-v2__glass-button" key={choice} type="button" disabled={saving} onClick={() => void advance(choice)}><Glyph size={28} aria-hidden="true" />{questChoiceText[uiLang][choice]}</button>; })}</div>}
        {saving && <p role="status">{copy.saving}</p>}{error && <p role="alert">{copy.error}</p>}
      </div>
    </div>
  </section>;
}
export default StudioQuest;
