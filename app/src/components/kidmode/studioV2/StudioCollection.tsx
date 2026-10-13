import React from "react";
import { BookOpen } from "lucide-react";
import { StudioSky, StudioPortalArt } from "./StudioHome";
import "./studioV2.css";
import "./studioKeepsakes.css";
import { useArbor } from "../../../context/ArborContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useKidSouvenirs } from "../rewards/useKidSouvenirs";
import { souvenirStrip, QUEST_SOUVENIR_REF } from "../rewards/kidSouvenirs";
import { KidSouvenirSticker } from "../rewards/KidSouvenir";
import { sneakFreezeFlagOn } from "../kidWorlds";
import { studioActivityFromLegacy, studioActivityFits, type StudioActivityId } from "./studioCatalog";
import { studioCopy } from "./studioCopy";
import { studioCollectionText, studioQuestText } from "./studioProgress";

export function StudioCollection({ onActivity, onBooks, onQuest }: { onActivity: (id: StudioActivityId) => void; onBooks: () => void; onHome: () => void; onQuest?: () => void }) {
  const { childProfile } = useArbor(); const { uiLang } = useLanguage();
  const ledger = useKidSouvenirs(childProfile.id); const copy = studioCollectionText[uiLang];
  const items = souvenirStrip(ledger.items);
  return <section className="studio-v2 studio-keepsakes" data-studio-collection="" dir={uiLang === "he" ? "rtl" : "ltr"}>
    <StudioSky />
    <div className="studio-keepsakes__layout">
      <div className="studio-keepsakes__scene"><StudioPortalArt worldId="stories" /><header className="studio-keepsakes__heading"><h1>{copy.title}</h1><p>{copy.empty}</p></header></div>
      <div className="studio-keepsakes__panel">
    {!ledger.loaded ? <p role="status">{copy.loading}</p> : !items.length ? null : <ul className="studio-keepsakes__collection">{items.map(item => {
      const isQuest = item.kind === "world" && item.refId === QUEST_SOUVENIR_REF;
      const activity = item.kind === "world" ? studioActivityFromLegacy(item.refId) : undefined;
      const available = isQuest ? !!onQuest : item.kind === "book" || !!activity && studioActivityFits(activity.id, childProfile, uiLang, undefined, { sneakEnabled: sneakFreezeFlagOn() });
      const title = isQuest ? studioQuestText[uiLang].title : item.kind === "book" ? copy.book : activity ? studioCopy(uiLang).activities[activity.id].title : copy.unknown;
      const content = <><KidSouvenirSticker kind={item.kind} refId={item.refId} /><span>{title}</span></>;
      return <li key={item.id}>{available ? <button type="button" className="studio-v2__glass-button studio-keepsakes__item" onClick={() => { if (!ledger.isCurrent()) return; if (isQuest) onQuest?.(); else if (item.kind === "book") onBooks(); else if (activity) onActivity(activity.id); }}>{content}</button> : <div className="studio-keepsakes__item">{content}</div>}</li>;
    })}</ul>}
    <button type="button" onClick={onBooks} className="studio-v2__glass-button studio-keepsakes__books"><BookOpen size={24} aria-hidden="true" />{copy.books}</button>
      </div>
    </div>
  </section>;
}
export default StudioCollection;
