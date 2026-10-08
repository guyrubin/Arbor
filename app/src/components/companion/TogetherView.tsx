import React, { useEffect, useId, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { kidModeOpenFor, TOGETHER_CARDS } from "../../lib/age/playGate";
import { useKidModeEntry } from "../kidmode/useKidModeEntry";
import { readParentPin } from "../kidmode/parentGate";
import { requestOpenSettings } from "../layout/settingsBus";
import { opensInKidMode, studioWorldsForChild, worksInLanguage, type StudioWorld } from "../practice/studioWorlds";
import Icon from "../ui/Icon";
import { Modal } from "../ui/Modal";
import { OFFSCREEN_IDEAS, STORY_DOORS, WORLD_ART, type TogetherCategory } from "./companionChoices";
import "./companionExperience.css";

type Preview = { kind: "world"; world: StudioWorld } | { kind: "offscreen"; id: string };

/** Parent previews lead to the existing child-mode entry seam. Nothing on this
 * page starts a camera/microphone or writes an activity just because it is seen. */
export default function TogetherView() {
  const { childProfile, setActiveTab, addMoment, activeFamilyTopic } = useArbor();
  const { t, uiLang } = useLanguage();
  const he = uiLang === "he";
  const lang = he ? "he" : "en";
  const name = childProfile.name?.split(" ")[0] || (he ? "הילד שלכם" : "your child");
  const [category, setCategory] = useState<TogetherCategory>("all");
  const [previewState, setPreviewState] = useState<{ childId: string; value: Preview | null }>({ childId: childProfile.id, value: null });
  const preview = previewState.childId === childProfile.id ? previewState.value : null;
  const setPreview = (value: Preview | null) => setPreviewState({ childId: childProfile.id, value });
  const [keptState, setKeptState] = useState<{ childId: string; ids: string[] }>({ childId: childProfile.id, ids: [] });
  const kept = keptState.childId === childProfile.id ? keptState.ids : [];
  const { request: requestKidMode, step: heroStep } = useKidModeEntry();
  const { worlds } = studioWorldsForChild(lang, childProfile);
  const kidAvailable = kidModeOpenFor(childProfile);
  const filterId = useId();
  useEffect(() => { setPreview(null); setKeptState({ childId: childProfile.id, ids: [] }); setCategory("all"); }, [childProfile.id]);
  const filters: { id: TogetherCategory; label: string; icon: string }[] = [
    { id: "all", label: he ? "הכול" : "All together", icon: "interests" },
    { id: "stories", label: he ? "סיפורים" : "Stories", icon: "auto_stories" },
    ...(kidAvailable && worlds.length ? [{ id: "games" as const, label: he ? "משחקים" : "Games", icon: "sports_esports" }] : []),
    { id: "offscreen", label: he ? "בלי מסך" : "Away from the screen", icon: "wb_sunny" },
  ];
  const show = (id: TogetherCategory) => category === "all" || category === id;
  const openWorld = (world: StudioWorld) => {
    setPreview(null);
    if ((!opensInKidMode(world) || !worksInLanguage(world, lang)) && world.tab) setActiveTab(world.tab);
    else requestKidMode({ view: "arcade", worldId: world.id });
  };
  const offlineIds: readonly string[] = kidAvailable ? OFFSCREEN_IDEAS.map((idea) => idea.id) : TOGETHER_CARDS;
  const offline = (id: string) => {
    const idea = OFFSCREEN_IDEAS.find((item) => item.id === id);
    return idea ? { title: idea.title[lang], detail: idea.detail[lang], say: idea.say[lang], icon: idea.icon }
      : { title: t(`elev.ages.together.${id}.title`), detail: t(`elev.ages.together.${id}.do`), say: t(`elev.ages.together.${id}.say`), icon: "favorite" };
  };
  const previewTitle = preview?.kind === "world" ? t(preview.world.kidNameKey) : preview ? offline(preview.id).title : "";
  const keepOffline = (id: string) => {
    if (kept.includes(id)) return;
    const idea = offline(id);
    const moment = kidAvailable ? (he ? `עשינו ביחד: ${idea.title}` : `We tried together: ${idea.title}`) : t(`elev.ages.together.${id}.moment`);
    if (addMoment(moment)) setKeptState({ childId: childProfile.id, ids: [...kept, id] });
  };

  return (
    <div className="companion-page companion-together" dir={he ? "rtl" : "ltr"}>
      <section className="companion-together-hero" data-module="together-invitation" aria-labelledby={`${filterId}-title`}>
        <div>
          <span className="companion-eyebrow">{he ? "ביחד · מקום לסקרנות ולקשר" : "TOGETHER · ROOM FOR CURIOSITY AND CONNECTION"}</span>
          <h1 id={`${filterId}-title`} className="arbor-type-hero">{he ? `העולם גדול יותר כשמגלים אותו עם ${name}.` : `A little world to discover with ${name}.`}</h1>
          <p>{he ? "סיפור להיכנס אליו. משחק להיסחף בו. רגע טוב שלא צריך סיבה." : "A story to get lost in. A game to wonder at. A good moment needs no other reason."}</p>
          <button type="button" className="companion-primary" data-primary-move="choose-together" onClick={() => setPreview({ kind: "offscreen", id: offlineIds[0] })}><Icon name="favorite" size={19} />{he ? "רעיון קטן לזמן ביחד" : "One small idea for time together"}<Icon name="arrow_forward" size={18} className="companion-arrow" /></button>
        </div>
        <figure className="companion-together-art"><img src="/visuals/companion/together-table.webp" width="960" height="640" alt={he ? "איור של ספר פתוח, קוביות, ספלי משחק וצבעים" : "Illustration of an open book, building blocks, pretend-play cups and crayons"} fetchPriority="high" /></figure>
      </section>

      {activeFamilyTopic && <div className="companion-topic-context"><Icon name="bookmark" size={18} /><span>{he ? "השאלה שלכם נשארת איתכם: " : "Your question stays with you: "}<b dir="auto">{activeFamilyTopic.title}</b></span><span className="companion-caption">{he ? "כאן אפשר גם פשוט ליהנות." : "Here, it is also enough just to enjoy."}</span></div>}

      <div className="companion-filter-row" role="group" aria-label={he ? "מה מתאים לכם עכשיו?" : "What feels right now?"}>
        {filters.map((filter) => <button key={filter.id} type="button" className="companion-filter" aria-pressed={category === filter.id} onClick={() => setCategory(filter.id)}><Icon name={filter.icon} size={19} />{filter.label}</button>)}
      </div>

      {show("stories") && <section className="companion-collection" data-module="together-stories" aria-labelledby={`${filterId}-stories`}>
        <div className="companion-section-heading"><div><span className="companion-eyebrow">{he ? "לקרוא, לדמיין, לדבר" : "READ, IMAGINE, TALK"}</span><h2 id={`${filterId}-stories`}>{he ? "לאיזה סיפור ניכנס?" : "Which story shall we step into?"}</h2></div>{category === "all" && <button type="button" className="companion-text-button" onClick={() => setCategory("stories")}>{he ? "כל הסיפורים" : "All stories"}<Icon name="arrow_forward" size={18} className="companion-arrow" /></button>}</div>
        <div className="companion-story-grid">{STORY_DOORS.slice(0, category === "all" ? 2 : undefined).map((story) => <button key={story.id} type="button" className="companion-story-card" onClick={() => setActiveTab(story.tab)}><div className="companion-card-art"><img src={story.art} alt="" loading="lazy" width="480" height="320" /><span className="companion-art-label"><Icon name={story.icon} size={16} />{he ? "לבחירה ולתצוגה מקדימה" : "CHOOSE AND PREVIEW"}</span></div><div className="companion-card-copy"><h3>{story.title[lang]}</h3><p>{story.detail[lang]}</p><span className="companion-door-link">{he ? "לגלות" : "Explore"}<Icon name="arrow_forward" size={18} className="companion-arrow" /></span></div></button>)}</div>
      </section>}

      {kidAvailable && show("games") && <section className="companion-collection" data-module="together-games" aria-labelledby={`${filterId}-games`}>
        <div className="companion-section-heading"><div><span className="companion-eyebrow">{he ? "קודם בוחרים. אחר כך משחקים." : "FIRST CHOOSE. THEN PLAY."}</span><h2 id={`${filterId}-games`}>{he ? "משחקים שמזמינים לנסות" : "Little invitations to play"}</h2></div>{category === "all" && worlds.length > 3 && <button type="button" className="companion-text-button" onClick={() => setCategory("games")}>{he ? "כל המשחקים" : "All games"}<Icon name="arrow_forward" size={18} className="companion-arrow" /></button>}</div>
        {worlds.length ? <div className="companion-world-grid">{worlds.slice(0, category === "all" ? 3 : undefined).map((world) => <button key={world.id} type="button" className="companion-world-card" onClick={() => setPreview({ kind: "world", world })}><img src={`/visuals/cards/game-${WORLD_ART[world.id]}.png`} alt="" width="480" height="320" loading="lazy" /><div><h3>{t(world.kidNameKey)}</h3><p>{t(`practice.world.${world.key}.skill`)}</p><span className="companion-door-link">{he ? "לראות לפני שמתחילים" : "Preview before playing"}<Icon name="arrow_forward" size={17} className="companion-arrow" /></span></div></button>)}</div> : <p className="companion-caption">{he ? "אין כרגע משחקי מסך ברשימה שמתאימים לגיל הזה. אפשר לבחור סיפור או רעיון בלי מסך." : "There are no listed screen games for this age yet. Explore a story or an idea away from the screen."}</p>}
      </section>}

      {show("offscreen") && <section className="companion-collection" data-module="together-offscreen" aria-labelledby={`${filterId}-offscreen`}>
        <div className="companion-section-heading"><div><span className="companion-eyebrow">{he ? "בחיים עצמם" : "IN EVERYDAY LIFE"}</span><h2 id={`${filterId}-offscreen`}>{he ? "משהו קטן לעשות ביחד" : "Something small to do together"}</h2></div><button type="button" className="companion-text-button" onClick={() => setActiveTab("daily-play")}>{he ? "עוד רעיונות" : "More ideas"}<Icon name="arrow_forward" size={18} className="companion-arrow" /></button></div>
        <div className="companion-offscreen-grid">{offlineIds.map((id) => { const idea = offline(id); return <button key={id} type="button" className="companion-offscreen-card" onClick={() => setPreview({ kind: "offscreen", id })}><Icon name={idea.icon} size={26} /><h3>{idea.title}</h3><p className="companion-say" dir="auto">“{idea.say}”</p><span className="companion-door-link">{he ? "איך מתחילים" : "How to begin"}<Icon name="arrow_forward" size={17} className="companion-arrow" /></span></button>; })}</div>
      </section>}

      <footer className="companion-together-footer">
        {kidAvailable ? <><Icon name="verified_user" size={21} /><p>{readParentPin() ? (he ? "המעבר למשחק הוא בחירה שלכם. החזרה לאזור ההורים מוגנת בקוד שהגדרתם." : "You choose when to enter play. Your PIN protects the return to the parent area.") : (he ? "במשחק נשארים באזור הילדים. אפשר להגדיר קוד לחזרה לאזור ההורים." : "Play opens in the child area. Set a PIN to protect the return to the parent area.")}</p><button type="button" className="companion-text-button" onClick={() => requestOpenSettings({ focus: "pin" })}>{he ? "הגדרות הורים" : "Parent settings"}</button></> : <p>{he ? "בגיל הזה הזמן ביחד מובל על ידכם. אזור המשחק העצמאי נפתח מגיל שלוש." : "At this age, shared time is led by you. The independent play area opens from age three."}</p>}
      </footer>
      {heroStep}
      <Modal open={preview !== null} onClose={() => setPreview(null)} title={previewTitle}>
        {preview?.kind === "world" && <div className="companion-preview" dir={he ? "rtl" : "ltr"}>
          <img src={`/visuals/cards/game-${WORLD_ART[preview.world.id]}.png`} width="480" height="320" alt="" />
          <p>{t(`practice.world.${preview.world.key}.skill`)}</p>
          <p className="companion-caption">{!worksInLanguage(preview.world, lang) ? (he ? "המשחק הקולי זמין כרגע באנגלית. נפתח קודם את הסבר ההורים." : "This voice game is currently in English. Open the parent guide first.") : opensInKidMode(preview.world) ? (he ? "כשתהיו מוכנים, נעבור לאזור הילדים. אפשר לשחק יחד." : "When you are ready, enter the child area. You can play together.") : (he ? "נפתח את כלי השפה באזור ההורים." : "Open the language tools in the parent area.")}</p>
          <button type="button" className="companion-primary" onClick={() => openWorld(preview.world)}><Icon name="play_arrow" size={20} />{worksInLanguage(preview.world, lang) && opensInKidMode(preview.world) ? (he ? "מתחילים לשחק" : "Start playing") : (he ? "לפתוח" : "Open")}</button>
        </div>}
        {preview?.kind === "offscreen" && <div className="companion-preview" dir={he ? "rtl" : "ltr"}>
          <img src="/visuals/companion/together-table.webp" width="960" height="640" alt="" />
          <p>{offline(preview.id).detail}</p><blockquote className="companion-say" dir="auto">“{offline(preview.id).say}”</blockquote>
          <p className="companion-caption">{he ? "אפשר להניח את המסך ולנסות. אין צורך לתעד." : "You can put the screen down and try it. There is no need to record anything."}</p>
          <button type="button" className="companion-primary" onClick={() => setPreview(null)}>{he ? "נלך לנסות" : "Let’s give it a try"}<Icon name="arrow_forward" size={18} className="companion-arrow" /></button>
          <button type="button" className="companion-text-button" disabled={kept.includes(preview.id)} onClick={() => keepOffline(preview.id)}><Icon name={kept.includes(preview.id) ? "check" : "bookmark_add"} size={18} />{kept.includes(preview.id) ? (he ? "נשמר רגע מהזמן שלנו ביחד" : "A moment from your time together is saved") : (he ? "כבר ניסינו — לשמור רגע" : "We already tried it — keep the moment")}</button>
        </div>}
      </Modal>
    </div>
  );
}
