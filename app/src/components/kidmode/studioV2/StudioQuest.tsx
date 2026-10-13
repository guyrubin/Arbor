import React, { useEffect, useRef, useState } from "react";
import { AlignLeft, AlignCenter, AlignRight, Armchair, RectangleHorizontal, LampFloor, Sun, Moon, Eye } from "lucide-react";
import { useArbor } from "../../../context/ArborContext";
import { useAuth } from "../../../context/AuthContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useKidTheme } from "../../../hooks/useKidTheme";
import { kidArt, worldTileKey } from "../../../lib/kidThemeManifest";
import { KidFinishMoment } from "../rewards/KidSouvenir";
import { QUEST_CHOICES, QUEST_STEPS, questChoiceText, studioQuestText, useStudioQuestProgress, type QuestChoice } from "./studioProgress";
const button: React.CSSProperties = { minHeight: 56, padding: "12px 20px", borderRadius: 20, border: "2px solid var(--arbor-ink)", background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)", font: "inherit", fontWeight: 800, cursor: "pointer" };
const icons = { left: AlignLeft, middle: AlignCenter, right: AlignRight, pillow: Armchair, blanket: RectangleHorizontal, lamp: LampFloor, daylight: Sun, quiet: Moon, look: Eye };
export function StudioQuest({ onHome }: { onHome: () => void }) {
  const { childProfile } = useArbor(); const { user } = useAuth();
  return <Quest key={`${user?.uid ?? "local"}:${childProfile.id}`} childId={childProfile.id} onHome={onHome} />;
}
function Quest({ childId, onHome }: { childId: string; onHome: () => void }) {
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
  return <section dir={uiLang === "he" ? "rtl" : "ltr"} data-studio-quest="" style={{ maxWidth: 760, margin: "auto", padding: 20, color: "var(--arbor-ink)", background: "var(--arbor-paper)", borderRadius: 28 }}>
    <button type="button" onClick={onHome} style={button}>{copy.home}</button>
    <h1 className="kid-type-title">{progress.completed ? copy.done : copy.title}</h1>
    <p className="kid-type-label">{progress.completed ? copy.ending : copy.intro}</p>
    {art && !art.hasHero && <img src={art.src480} alt="" style={{ width: "100%", maxHeight: 280, objectFit: "cover", borderRadius: 24 }} />}
    <ul style={{ display: "flex", flexWrap: "wrap", gap: 12, listStyle: "none", padding: 0 }}>
      {QUEST_STEPS.filter(step => progress.choices[step]).map(step => { const choice = progress.choices[step]!; const Glyph = icons[choice]; return <li key={step} style={{ display: "flex", alignItems: "center", gap: 8 }}><Glyph size={28} aria-hidden="true" />{questChoiceText[uiLang][choice]}</li>; })}
    </ul>
    {!progress.loaded ? <p role="status">{copy.loading}</p> : progress.completed ? <KidFinishMoment childId={childId} kind="world" refId="calm-builder" lang={uiLang} hero={false} /> : <>
      <ol style={{ display: "flex", flexWrap: "wrap", gap: 12, paddingInlineStart: 24 }}>{QUEST_STEPS.map((step, index) => <li key={step} aria-current={index === count ? "step" : undefined} style={{ fontWeight: index === count ? 800 : 500 }}>{index < count ? "✓ " : ""}{copy.steps[index]}</li>)}</ol>
      <div role="group" aria-label={copy.steps[count]} style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>{QUEST_CHOICES[QUEST_STEPS[count]].map(choice => { const Glyph = icons[choice]; return <button key={choice} type="button" disabled={saving} onClick={() => void advance(choice)} style={{ ...button, display: "flex", alignItems: "center", gap: 10 }}><Glyph size={28} aria-hidden="true" />{questChoiceText[uiLang][choice]}</button>; })}</div>
    </>}
    {saving && <p role="status">{copy.saving}</p>}{error && <p role="alert">{copy.error}</p>}
  </section>;
}
export default StudioQuest;
