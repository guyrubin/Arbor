import React, { useMemo, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useObservations } from "../../hooks/useObservations";
import { DOMAIN_IDS, domainName, type DomainId } from "../../lib/domains/registry";
import type { Observation, ObservationOrigin } from "../../lib/observations";
import { milestoneText } from "../../lib/milestoneData";
import { behaviorTypeLabel } from "../../content/behaviorTaxonomy";
import { Icon } from "../ui/Icon";
import { Avatar } from "../ui/Avatar";
import { Modal } from "../ui/Modal";
import { buildPortraitChapters, buildPortraitEnvironments, buildPortraitThreads, portraitDiscussionPrompt } from "./portraitModel";
import "./childPortrait.css";

const icons: Record<DomainId, string> = { talking: "chat_bubble", moving: "directions_run", hands: "pan_tool", thinking: "psychology", playing: "group", feelings: "favorite", body: "spa", family: "home" };


export interface ChildPortraitProps { onDiscuss?: (prompt: string, observationIds: string[]) => void }

export default function ChildPortrait({ onDiscuss }: ChildPortraitProps) {
  const { childProfile, behaviorLogs, milestones, setActiveTab, seedCoach, openCaptureSheet } = useArbor();
  const { t, uiLang } = useLanguage();
  const c = {
    kicker: t("companion.portrait.kicker"),
    title: t("companion.portrait.title"),
    subtitle: t("companion.portrait.subtitle"),
    time: t("companion.portrait.time"),
    context: t("companion.portrait.context"),
    domain: t("companion.portrait.domain"),
    three: t("companion.portrait.three"),
    year: t("companion.portrait.year"),
    entire: t("companion.portrait.entire"),
    periodEmpty: t("companion.portrait.periodEmpty"),
    periodEmptySub: t("companion.portrait.periodEmptySub"),
    range: t("companion.portrait.range"),
    capture: t("companion.portrait.capture"),
    profile: t("companion.portrait.profile"),
    interests: t("companion.portrait.interests"),
    edit: t("companion.portrait.edit"),
    parentWords: t("companion.portrait.parentWords"),
    record: t("companion.portrait.record"),
    view: t("companion.portrait.view"),
    emptyChapter: t("companion.portrait.emptyChapter"),
    emptySub: t("companion.portrait.emptySub"),
    threadTitle: t("companion.portrait.threadTitle"),
    threadSub: t("companion.portrait.threadSub"),
    timelineNote: t("companion.portrait.timelineNote"),
    noRecord: t("companion.portrait.noRecord"),
    moments: t("companion.portrait.moments"),
    oneMoment: t("companion.portrait.oneMoment"),
    all: t("companion.portrait.all"),
    sourceTitle: t("companion.portrait.sourceTitle"),
    original: t("companion.portrait.original"),
    source: t("companion.portrait.source"),
    date: t("companion.portrait.date"),
    contextLabel: t("companion.portrait.contextLabel"),
    unspecified: t("companion.portrait.unspecified"),
    Home: t("companion.portrait.Home"),
    School: t("companion.portrait.School"),
    Transit: t("companion.portrait.Transit"),
    Public: t("companion.portrait.Public"),
    contextIntro: t("companion.portrait.contextIntro"),
    contextSub: t("companion.portrait.contextSub"),
    domainIntro: t("companion.portrait.domainIntro"),
    domainSub: t("companion.portrait.domainSub"),
    noDomain: t("companion.portrait.noDomain"),
    parentTyped: t("companion.portrait.parentTyped"),
    parentVoice: t("companion.portrait.parentVoice"),
    confirmed: t("companion.portrait.confirmed"),
    childPractice: t("companion.portrait.childPractice"),
    professional: t("companion.portrait.professional"),
    document: t("companion.portrait.document"),
    ask: t("companion.portrait.ask"),
    askNote: t("companion.portrait.askNote"),
    sourceOpen: t("companion.portrait.sourceOpen"),
    interpretation: t("companion.portrait.interpretation"),
    interpretationText: t("companion.portrait.interpretationText"),
    care: t("companion.portrait.care"),
    careSub: t("companion.portrait.careSub"),
    careAction: t("companion.portrait.careAction"),
    memory: t("companion.portrait.memory"),
    memorySub: t("companion.portrait.memorySub"),
    journal: t("companion.portrait.journal"),
    milestones: t("companion.portrait.milestones"),
    language: t("companion.portrait.language"),
    more: t("companion.portrait.more"),
    check: t("companion.portrait.check"),
    practice: t("companion.portrait.practice"),
    measurement: t("companion.portrait.measurement"),
    photo: t("companion.portrait.photo"),
    emptyAll: t("companion.portrait.emptyAll"),
    emptyAllSub: t("companion.portrait.emptyAllSub"),
    closeHint: t("companion.portrait.closeHint"),
    countLabel: t("companion.portrait.countLabel"),
    noPlace: t("companion.portrait.noPlace")
  };
  const allObservations = useObservations();
  const [view, setView] = useState<"time" | "context" | "domain">("time");
  const [range, setRange] = useState(3);
  const [selection, setSelection] = useState<{ childId: string; title: string; ids: string[]; domain?: DomainId } | null>(null);
  const [visible, setVisible] = useState(20);
  const observations = useMemo(() => allObservations.filter(o => o.childId === childProfile.id), [allObservations, childProfile.id]);
  const chapters = useMemo(() => buildPortraitChapters(observations, childProfile.id, new Date(), range), [observations, childProfile.id, range]);
  const threads = useMemo(() => buildPortraitThreads(chapters), [chapters]);
  const inView = useMemo(() => chapters.flatMap(chapter => chapter.observations).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)), [chapters]);
  const environments = useMemo(() => buildPortraitEnvironments(inView), [inView]);
  const logMap = useMemo(() => new Map(behaviorLogs.map(log => [`behaviorLogs:${log.id}`, log])), [behaviorLogs]);
  const selected = selection?.childId === childProfile.id ? selection : null;
  const selectedObservations = selected ? observations.filter(o => selected.ids.includes(o.id)).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)) : [];
  const name = childProfile.name.split(/\s+/)[0] || childProfile.name;
  const date = (at: string | Date, year = false) => new Intl.DateTimeFormat(uiLang === "he" ? "he-IL" : "en-GB", { day: "numeric", month: "short", ...(year ? { year: "numeric" as const } : {}) }).format(at instanceof Date ? at : new Date(at));
  const chapterLabel = (chapter: typeof chapters[number]) => {
    const formatter = new Intl.DateTimeFormat(uiLang === "he" ? "he-IL" : "en-GB", { month: "short", year: "numeric" });
    const from = formatter.format(chapter.from);
    const until = formatter.format(new Date(chapter.until.getTime() - 1));
    return from === until ? from : `${from} – ${until}`;
  };
  const contextLabel = (context: string) => ({ Home: c.Home, School: c.School, Transit: c.Transit, Public: c.Public, unspecified: c.unspecified }[context] ?? context);
  const sourceLabel = (o: Observation) => ({ parent_typed: c.parentTyped, parent_voice: c.parentVoice, ai_proposed_parent_confirmed: c.confirmed, kid_practice: c.childPractice, professional_entered: c.professional, document_extracted: c.document }[o.source]);
  const title = (o: Observation): string => {
    const v = o.value;
    switch (v.type) {
      case "moment": { const log = logMap.get(o.id); return log?.trigger?.trim() || log?.notes?.trim() || behaviorTypeLabel(v.behaviorType, t); }
      case "milestone": { const milestone = milestones.find(item => item.id === v.milestoneId); return milestone ? milestoneText(milestone, "title", t, { gender: childProfile.gender ?? null }) : v.title; }
      case "keepsake": return v.note;
      case "word": return v.phrase;
      case "goal_note": return v.text;
      case "fact": return v.fact;
      case "play": return v.title;
      case "practice": return c.practice;
      case "measurement": return c.measurement;
      case "check": return c.check;
    }
  };
  const select = (items: Observation[], heading: string, domain?: DomainId) => { setVisible(20); setSelection({ childId: childProfile.id, title: heading, ids: items.map(o => o.id), domain }); };
  const discuss = () => {
    if (!selected) return;
    const domains = selected.domain ? [selected.domain] : [...new Set(selectedObservations.flatMap(o => o.domains))];
    const prompt = portraitDiscussionPrompt(domains, domain => domainName(domain, t), uiLang === "he");
    setSelection(null);
    if (onDiscuss) onDiscuss(prompt, selected.ids);
    else seedCoach({ prompt, source: "child-portrait" });
  };
  const openOriginal = (o: Observation) => {
    setSelection(null);
    if (o.origin === "behaviorLogs") { openCaptureSheet({ editLogId: o.id.slice("behaviorLogs:".length) }); return; }
    const routes: Partial<Record<ObservationOrigin, Parameters<typeof setActiveTab>[0]>> = { milestones: "milestones", keepsakes: "milestones", growthEntries: "profile", langObs: "language", screenings: "screening", memory: "memory", goalObservations: "practice", actionLoops: "journal", playLogs: "journal", practiceEvents: "journal", speechAttempts: "speech", mimicSessions: "mimic", adventureResults: "adventures", missionRecords: "journal" };
    setActiveTab(routes[o.origin] ?? "journal");
  };

  return <section className="child-portrait" dir={uiLang === "he" ? "rtl" : "ltr"} data-testid="child-portrait">
    <div data-module="child-portrait-overview">
    <header className="portrait-intro">
      <div><p className="portrait-kicker">{c.kicker}</p><h1>{c.title}</h1><p className="portrait-subtitle">{c.subtitle}</p></div>
      <button type="button" className="portrait-identity" onClick={() => setActiveTab("profile")} aria-label={`${c.edit} · ${name}`}><Avatar name={childProfile.name} photoURL={childProfile.photoUrl} size={52} /><span><strong dir="auto">{name}</strong><span>{c.edit}<Icon name="chevron_right" size={16} className="portrait-arrow rtl:-scale-x-100" /></span></span></button>
    </header>
    {!!childProfile.interests?.length && <div className="portrait-interests"><span>{c.interests}</span><p dir="auto">{childProfile.interests.join(" · ")}</p></div>}
    <div className="portrait-toolbar">
      <div className="portrait-views" role="group" aria-label={c.title}>{(["time", "context", "domain"] as const).map(key => <button type="button" key={key} aria-pressed={view === key} onClick={() => setView(key)}><Icon name={key === "time" ? "history" : key === "context" ? "home" : "grid_view"} size={18} />{c[key]}</button>)}</div>
      <label className="portrait-period"><span className="sr-only">{c.range}</span><Icon name="calendar_today" size={18} /><select aria-label={c.range} value={range} onChange={event => setRange(Number(event.target.value))}><option value={3}>{c.three}</option><option value={12}>{c.year}</option><option value={0}>{c.entire}</option></select></label>
      <button type="button" className="portrait-text-button" onClick={() => select(inView, c.all)} data-primary-move="explore-child-record">{c.view}<Icon name="arrow_forward" size={18} className="portrait-arrow rtl:-scale-x-100" /></button>
    </div>

    {inView.length === 0 && <div className="portrait-empty"><div className="portrait-empty-mark" aria-hidden="true"><Icon name="auto_stories" size={52} /></div><div><h2>{observations.length ? c.periodEmpty : c.emptyAll}</h2><p>{observations.length ? c.periodEmptySub : c.emptyAllSub}</p><button type="button" className="portrait-primary" onClick={() => openCaptureSheet()}><Icon name="add" size={20} />{c.capture}</button></div></div>}
    </div>

    <div data-module="child-portrait-evidence">
    {view === "time" && <>
      <div className="portrait-chapters">{chapters.map(chapter => {
        const featured = chapter.observations.find(o => !!logMap.get(o.id)?.photoAttachment) ?? chapter.observations.find(o => ["moment", "keepsake", "word", "goal_note"].includes(o.value.type)) ?? chapter.observations[0];
        const photo = featured ? logMap.get(featured.id)?.photoAttachment : undefined;
        return <article className="portrait-chapter" key={chapter.id}>
          <div className="portrait-chapter-date"><span>{chapterLabel(chapter)}</span><span className="portrait-date-line" /></div>
          {featured ? <button type="button" className={`portrait-memory ${photo ? "portrait-memory-photo" : ""}`} onClick={() => select(chapter.observations, chapterLabel(chapter))}>
            {photo ? <img src={photo} alt={c.photo} loading="lazy" /> : <div className="portrait-memory-art" aria-hidden="true"><Icon name={icons[featured.domains[0]]} size={52} /></div>}
            <div className="portrait-memory-copy"><span className="portrait-meta">{sourceLabel(featured)} · {date(featured.at)}</span><p dir="auto">{title(featured)}</p><span className="portrait-memory-link">{c.view}<Icon name="arrow_forward" size={18} className="portrait-arrow rtl:-scale-x-100" /></span></div>
          </button> : <button type="button" className="portrait-memory portrait-memory-empty" onClick={() => openCaptureSheet()}><Icon name="add_a_photo" size={28} /><strong>{c.emptyChapter}</strong><span>{c.emptySub}</span></button>}
        </article>;
      })}</div>
      <div className="portrait-section-head"><div><h2>{c.threadTitle}</h2><p>{c.threadSub}</p></div><button type="button" className="portrait-text-button" onClick={() => setActiveTab("journal")}>{c.all}<Icon name="arrow_forward" size={18} className="portrait-arrow rtl:-scale-x-100" /></button></div>
      <div className="portrait-thread-map" role="table" aria-label={c.threadTitle}>
        <div className="portrait-thread-head" role="row"><div role="columnheader" className="sr-only">{c.domain}</div>{chapters.map(chapter => <span role="columnheader" key={chapter.id}>{chapterLabel(chapter)}</span>)}</div>
        {threads.map(thread => <div className="portrait-thread" role="row" key={thread.domain}>
          <div role="rowheader" className="portrait-domain-label"><button type="button" onClick={() => select(inView.filter(o => o.domains.includes(thread.domain)), domainName(thread.domain, t), thread.domain)}><Icon name={icons[thread.domain]} size={22} /><span>{domainName(thread.domain, t)}</span></button></div>
          {thread.cells.map((cell, i) => <div role="cell" className="portrait-thread-cell" key={chapters[i].id}>{cell.length ? <button type="button" className="portrait-mark-button" onClick={() => select(cell, `${domainName(thread.domain, t)} · ${chapterLabel(chapters[i])}`, thread.domain)} aria-label={`${domainName(thread.domain, t)}, ${chapterLabel(chapters[i])}, ${cell.length} ${cell.length === 1 ? c.oneMoment : c.moments}`}><span className="portrait-mark" aria-hidden="true" /><span className="portrait-cell-label" dir="auto">{title(cell[0])}</span><span className="portrait-cell-count">{cell.length} {cell.length === 1 ? c.oneMoment : c.moments}</span></button> : <span className="portrait-no-mark"><span aria-hidden="true">—</span><span className="sr-only">{c.noRecord}</span></span>}</div>)}
        </div>)}
      </div>
      <p className="portrait-map-note"><Icon name="info" size={18} />{c.timelineNote}</p>
    </>}

    {view === "context" && <section className="portrait-context-view"><div className="portrait-section-head"><div><h2>{c.contextIntro}</h2><p>{c.contextSub}</p></div></div><div className="portrait-environments">{environments.map(environment => <article className="portrait-environment" key={environment.context}><div className="portrait-environment-heading"><Icon name={environment.context === "Home" ? "home" : environment.context === "School" ? "school" : environment.context === "Transit" ? "directions_walk" : environment.context === "Public" ? "park" : "edit_note"} size={36} /><h3>{contextLabel(environment.context)}</h3><span>{environment.observations.length} {c.moments}</span></div><div className="portrait-context-domains">{environment.domains.map(domain => <button key={domain} type="button" onClick={() => select(environment.observations.filter(o => o.domains.includes(domain)), `${contextLabel(environment.context)} · ${domainName(domain, t)}`, domain)}><Icon name={icons[domain]} size={20} /><span>{domainName(domain, t)}</span><Icon name="chevron_right" size={18} className="portrait-arrow rtl:-scale-x-100" /></button>)}</div><button type="button" className="portrait-context-quote" onClick={() => select(environment.observations, contextLabel(environment.context))}><span>{date(environment.observations[0].at)}</span><p dir="auto">{title(environment.observations[0])}</p><Icon name="arrow_forward" size={18} className="portrait-arrow rtl:-scale-x-100" /></button></article>)}</div></section>}

    {view === "domain" && <section><div className="portrait-section-head"><div><h2>{c.domainIntro}</h2><p>{c.domainSub}</p></div></div><div className="portrait-domain-view">{DOMAIN_IDS.map((domain, i) => {
      const items = inView.filter(o => o.domains.includes(domain));
      return <button type="button" className="portrait-domain-detail" key={domain} onClick={() => select(items, domainName(domain, t), domain)}><span className="portrait-domain-index" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span><Icon name={icons[domain]} size={32} /><div><h3>{domainName(domain, t)}</h3><p dir="auto">{items[0] ? title(items[0]) : c.noDomain}</p>{items[0] && <span className="portrait-meta">{date(items[0].at)} · {sourceLabel(items[0])}</span>}</div><Icon name="arrow_forward" size={20} className="portrait-arrow rtl:-scale-x-100" /></button>;
    })}</div></section>}

    </div>
    <div className="portrait-next" data-module="child-portrait-support"><section className="portrait-care"><Icon name="diversity_1" size={38} /><div><h2>{c.care}</h2><p>{c.careSub}</p><button type="button" className="portrait-text-button" onClick={() => setActiveTab("care-team")}>{c.careAction}<Icon name="arrow_forward" size={18} className="portrait-arrow rtl:-scale-x-100" /></button></div></section><section className="portrait-record-tools"><button type="button" onClick={() => setActiveTab("memory")}><Icon name="psychology" size={22} /><span><strong>{c.memory}</strong><span>{c.memorySub}</span></span><Icon name="chevron_right" size={20} className="portrait-arrow rtl:-scale-x-100" /></button><div><button type="button" onClick={() => setActiveTab("milestones")}>{c.milestones}<Icon name="arrow_forward" size={18} className="portrait-arrow rtl:-scale-x-100" /></button><button type="button" onClick={() => setActiveTab("language")}>{c.language}<Icon name="arrow_forward" size={18} className="portrait-arrow rtl:-scale-x-100" /></button><button type="button" onClick={() => { setActiveTab("development"); window.location.hash = "#/development?view=program"; }}>{t("companion.portrait.programs")}<Icon name="arrow_forward" size={18} className="portrait-arrow rtl:-scale-x-100" /></button><button type="button" onClick={() => setActiveTab("screening")}>{t("nav.tab.screening")}<Icon name="arrow_forward" size={18} className="portrait-arrow rtl:-scale-x-100" /></button><button type="button" onClick={() => setActiveTab("journal")}>{c.journal}<Icon name="arrow_forward" size={18} className="portrait-arrow rtl:-scale-x-100" /></button></div></section></div>

    <Modal open={!!selected} onClose={() => setSelection(null)} title={selected?.title ?? c.sourceTitle} maxWidth="max-w-2xl"><div className="portrait-evidence" dir={uiLang === "he" ? "rtl" : "ltr"}>
      {selectedObservations.length === 0 && <p>{c.noDomain}</p>}
      {selectedObservations.slice(0, visible).map(o => <article key={o.id}><div className="portrait-evidence-meta"><time dateTime={o.at}>{date(o.at, true)}</time><span>{sourceLabel(o)}</span></div>{logMap.get(o.id)?.photoAttachment && <img className="portrait-evidence-photo" src={logMap.get(o.id)?.photoAttachment} alt={c.photo} loading="lazy" />}<h4>{c.original}</h4><p className="portrait-evidence-words" dir="auto">{title(o)}</p>{o.value.type === "measurement" && <p>{[o.value.heightCm != null ? `${o.value.heightCm} cm` : "", o.value.weightKg != null ? `${o.value.weightKg} kg` : "", o.value.headCircumferenceCm != null ? `${o.value.headCircumferenceCm} cm` : ""].filter(Boolean).join(" · ")}</p>}{o.value.type === "moment" && o.value.context && <p className="portrait-meta">{c.contextLabel}: {contextLabel(o.value.context)}</p>}<p className="portrait-meta">{o.domains.map(domain => domainName(domain, t)).join(" · ")}</p><button type="button" className="portrait-text-button" onClick={() => openOriginal(o)}>{c.sourceOpen}<Icon name="arrow_forward" size={18} className="portrait-arrow rtl:-scale-x-100" /></button></article>)}
      {selectedObservations.length > visible && <button type="button" className="portrait-text-button" onClick={() => setVisible(n => n + 20)}>{c.more}</button>}
      <aside className="portrait-interpretation"><h4>{c.interpretation}</h4><p>{c.interpretationText}</p></aside><button type="button" className="portrait-primary" onClick={discuss}><Icon name="chat_bubble" size={20} />{c.ask}</button><p className="portrait-map-note">{c.askNote}</p>
    </div></Modal>
  </section>;
}
