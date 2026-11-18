import React from "react";
import { ArrowRight, BookOpen, Check, Play, Sticker } from "lucide-react";
import { useArbor } from "../../../context/ArborContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useChildLibraryBooks } from "../useChildLibraryBooks";
import { LibraryBookCover } from "../LibraryBookCover";
import { useKidSouvenirs } from "../rewards/useKidSouvenirs";
import { sneakFreezeFlagOn } from "../kidWorlds";
import { isStudioMakerId, studioMenuActivities, type StudioActivity, type StudioActivityId, type StudioWorldId } from "./studioCatalog";
import { StudioActivityArt } from "./StudioActivityArt";
import { studioCopy } from "./studioCopy";
import { StudioPortrait, StudioSky } from "./StudioHome";
import { StudioCrewHost, StudioWorldPlate } from "./StudioStage";
import { StudioSprout } from "./StudioSprout";
import "./studioV2.css";

/** The makers get their own shelf under the world's games, so a long world reads as two short rows of choices. */
const MAKER_SHELF = { en: "Make and discover", he: "יוצרים ומגלים" } as const;

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
    <div className="studio-v2__world-environment studio-stage__environment" aria-hidden="true"><StudioWorldPlate worldId={worldId} priority /></div>
    <div className="studio-v2__world-layout">
      <div className="studio-v2__world-scene"><div className="studio-v2__world-window studio-stage__window"><StudioWorldPlate worldId={worldId} className="studio-stage__window-plate" sizes="(max-width: 640px) 100vw, 60vw" /><StudioCrewHost worldId={worldId} className="studio-stage__window-host" /><div className="studio-v2__world-heading"><small>{world.title}</small><h1>{world.headline}</h1></div><StudioPortrait className="studio-v2__medallion" label={copy.hero} fallback={false} /></div><div className="studio-v2__world-guide"><StudioSprout size={90} rest={worldId === "feelings" ? "calm" : "wave"} label={copy.guide} onTap={() => world.hint} /><p>{world.hint}</p></div></div>
      <div className="studio-v2__world-list"><h2>{worldId === "stories" ? copy.books : copy.worldActivities}</h2>
        {/* S1 (surfacing) 7: a plan book wears the "My plan" ribbon; a running plan sorts first (lib/bookAssets libraryBookEntries). */}
        {worldId === "stories" ? <><p className="studio-v2__list-hint">{copy.booksHint}</p>{onOpenBook && books.map(entry => <button type="button" className="studio-v2__activity" key={`${childProfile.id}:${entry.book.id}:${entry.doc.sheetId}`} data-kid-plan-book={entry.book.kind === "plan" ? entry.book.id : undefined} onClick={() => onOpenBook(entry.book.id)}><span className="studio-v2__book-cover">{entry.book.kind === "plan" && <span className="studio-v2__book-ribbon">{copy.plan.ribbon}</span>}<LibraryBookCover childId={childProfile.id} entry={entry} /></span><strong>{entry.book.title[lang]}</strong><ArrowRight size={22} aria-hidden="true" /></button>)}{/* The two story makers stand on the shelf as more books. */}{activities.map(activity => <button type="button" className="studio-v2__activity" key={activity.id} data-studio-activity={activity.id} onClick={() => onActivity(activity.id)}><span className="studio-v2__book-cover"><StudioActivityArt id={activity.id} /></span><span className="studio-v2__activity-copy"><strong>{copy.activities[activity.id].title}</strong><small>{copy.activities[activity.id].description}</small></span><ArrowRight size={22} aria-hidden="true" /></button>)}<button type="button" className="studio-v2__activity" onClick={onBooks}><span className="studio-v2__activity-icon"><BookOpen size={32} aria-hidden="true" /></span><strong>{copy.allBooks}</strong><ArrowRight size={22} aria-hidden="true" /></button></> : <>{/* B-KID-171: a game shelf, not a settings list — each game is its picture first (the film's cover), two to four across. */}{[activities.filter(a => !isStudioMakerId(a.id)), activities.filter(a => isStudioMakerId(a.id))].map((shelf: StudioActivity[], n) => shelf.length > 0 && <React.Fragment key={n}>{n === 1 && <h3 className="studio-v2__shelf-title" data-studio-maker-shelf="">{MAKER_SHELF[lang]}</h3>}<div className="studio-v2__activity-grid" data-shelf={n === 1 ? "makers" : "games"}>{shelf.map(activity => {
          const kept = souvenirs.items.some(item => item.kind === "world" && item.refId === (activity.legacyWorldId ?? activity.id));
          return <button type="button" className="studio-v2__activity" key={activity.id} data-studio-activity={activity.id} onClick={() => onActivity(activity.id)}><span className="studio-v2__activity-art"><StudioActivityArt id={activity.id} /></span><span className="studio-v2__activity-copy"><strong>{copy.activities[activity.id].title}</strong><small>{copy.activities[activity.id].description}</small></span><span className="studio-v2__activity-state" data-kept={kept} aria-label={kept ? copy.kept : copy.play}>{kept ? <Check size={20} /> : <Play size={20} />}</span></button>;
        })}</div></React.Fragment>)}{!activities.length && <p className="studio-v2__empty">{copy.empty}</p>}</>}
        <aside className="studio-v2__keepsake-note"><Sticker size={38} aria-hidden="true" /><div><strong>{copy.keepsake}</strong><p>{copy.keepsakeHint}</p></div></aside>
      </div>
    </div>
  </section>;
}
export { StudioWorld };
