import React from "react";
import { ArrowRight, BookOpen, Check, Play, Sticker } from "lucide-react";
import { useArbor } from "../../../context/ArborContext";
import { useLanguage } from "../../../context/LanguageContext";
import { ArborMascot } from "../../ui/ArborMascot";
import { useChildLibraryBooks } from "../useChildLibraryBooks";
import { LibraryBookCover } from "../LibraryBookCover";
import { useKidSouvenirs } from "../rewards/useKidSouvenirs";
import { sneakFreezeFlagOn } from "../kidWorlds";
import { studioMenuActivities, type StudioActivityId, type StudioWorldId } from "./studioCatalog";
import { StudioActivityArt } from "./StudioActivityArt";
import { studioCopy } from "./studioCopy";
import { StudioPortalArt, StudioPortrait, StudioSky } from "./StudioHome";
import "./studioV2.css";

export interface StudioWorldProps { worldId: StudioWorldId; onActivity: (id: StudioActivityId) => void; onBooks: () => void; onOpenBook?: (id: string) => void }
export default function StudioWorld({ worldId, onActivity, onBooks, onOpenBook }: StudioWorldProps) {
  const { childProfile } = useArbor();
  const { uiLang } = useLanguage();
  const lang = uiLang === "he" ? "he" : "en";
  const copy = studioCopy(lang);
  const world = copy.worlds[worldId];
  const activities = studioMenuActivities(worldId, childProfile, lang, undefined, { sneakEnabled: sneakFreezeFlagOn() });
  const books = useChildLibraryBooks(childProfile.id);
  const souvenirs = useKidSouvenirs(childProfile.id);
  return <section className="studio-v2 studio-v2--world" data-world={worldId} dir={lang === "he" ? "rtl" : "ltr"}>
    <StudioSky />
    <div className="studio-v2__world-environment" aria-hidden="true"><StudioPortalArt worldId={worldId} /></div>
    <div className="studio-v2__world-layout">
      <div className="studio-v2__world-scene"><div className="studio-v2__world-window"><StudioPortalArt worldId={worldId} personalized /><div className="studio-v2__world-heading"><small>{world.title}</small><h1>{world.headline}</h1></div><StudioPortrait className="studio-v2__medallion" label={copy.hero} /></div><div className="studio-v2__world-guide"><ArborMascot size={80} mood={worldId === "feelings" ? "calm" : "wave"} animate={false} /><p>{world.hint}</p></div></div>
      <div className="studio-v2__world-list"><h2>{worldId === "stories" ? copy.books : copy.worldActivities}</h2>
        {worldId === "stories" ? <><p className="studio-v2__list-hint">{copy.booksHint}</p>{onOpenBook && books.map(entry => <button type="button" className="studio-v2__activity" key={`${childProfile.id}:${entry.book.id}:${entry.doc.sheetId}`} onClick={() => onOpenBook(entry.book.id)}><span className="studio-v2__book-cover"><LibraryBookCover childId={childProfile.id} entry={entry} /></span><strong>{entry.book.title[lang]}</strong><ArrowRight size={22} aria-hidden="true" /></button>)}<button type="button" className="studio-v2__activity" onClick={onBooks}><span className="studio-v2__activity-icon"><BookOpen size={32} aria-hidden="true" /></span><strong>{copy.allBooks}</strong><ArrowRight size={22} aria-hidden="true" /></button></> : <>{activities.map(activity => {
          const kept = souvenirs.items.some(item => item.kind === "world" && item.refId === (activity.legacyWorldId ?? activity.id));
          return <button type="button" className="studio-v2__activity" key={activity.id} onClick={() => onActivity(activity.id)}><span className="studio-v2__activity-art"><StudioActivityArt id={activity.id} /></span><span className="studio-v2__activity-copy"><strong>{copy.activities[activity.id].title}</strong><small>{copy.activities[activity.id].description}</small></span><span className="studio-v2__activity-state" data-kept={kept} aria-label={kept ? copy.kept : copy.play}>{kept ? <Check size={22} /> : <Play size={22} />}</span></button>;
        })}{!activities.length && <p className="studio-v2__empty">{copy.empty}</p>}</>}
        <aside className="studio-v2__keepsake-note"><Sticker size={38} aria-hidden="true" /><div><strong>{copy.keepsake}</strong><p>{copy.keepsakeHint}</p></div></aside>
      </div>
    </div>
  </section>;
}
export { StudioWorld };
