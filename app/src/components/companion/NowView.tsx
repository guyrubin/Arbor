import React, { useEffect, useId, useMemo, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { useTodaysFocus, type Focus } from "../../hooks/useTodaysFocus";
import { useLastVisit } from "../../hooks/useLastVisit";
import { activeProgramWeek } from "../../lib/programs/enrolment";
import { formatChildAge } from "../../lib/age/format";
import { childPicture } from "../../lib/childPicture";
import type { ActionLoopEntry } from "../../actionLoop/model";
import { nextChosenAction } from "./companionChoices";
import { NOW_COPY } from "./nowViewCopy";
import NowRecommendation from "./NowRecommendation";
import NowMoreForToday from "./NowMoreForToday";
import { NowNoticeBlock, NowNoticeLead, NowPracticeLead, NowTonightLead, NowTonightPointer } from "./NowLoopBlocks";
import { focusSignalsForNow } from "./nowRecommendationModel";
import { useNowLoop } from "./useNowLoop";
import { useLifecycleMoment } from "../overview/useLifecycleMoment";
import { useCompanionOffer } from "../overview/useCompanionOffer";
import { practiceText } from "../loop/PracticeCard";
import { trackCompanionPlaceOpen } from "../../lib/kpiEvents";
import { trackActionOffered } from "../../lib/loopEvents";
import { availableHardMomentCards } from "../../content/selectCards";
import { ageMonthsFromProfile } from "../../lib/childAge";
import Icon from "../ui/Icon";
import { Avatar } from "../ui/Avatar";
import "./companionExperience.css";
import "./nowView.css";
import { TOGETHER_ART } from "../../lib/parentArt";

export interface NowViewProps {
  topic?: { id: string; title: string; intent?: string } | null;
  onTopicCreate?: (title: string) => void;
  onTopicOpen?: () => void;
  /** Shell owns one persistent multimodal conversation above the routes. */
  onTalkOpen?: (prompt?: string) => void;
  /** Compatibility for older Shell callers; no second voice session here. */
  onVoiceOpen?: () => void;
}

/** A fresh child/language owns its own focus request, outcomes and disclosures. */
export default function NowView(props: NowViewProps) {
  const { childProfile } = useArbor();
  const { uiLang } = useLanguage();
  return <NowContent key={`${childProfile.id}:${uiLang}`} {...props} />;
}

function PrimaryMove({ primary = true, ...props }: React.ComponentProps<"button"> & { primary?: boolean }) {
  return <button {...props} data-primary-move={primary ? "choose-next-step" : undefined} />;
}

/** B-LOOP-13: the practice lead's AI pick and why — the SAME focus request
 *  NowRecommendation makes (same signals, same journal, one cached call a day),
 *  mounted only while the practice leads. A chosen step or a program never
 *  triggers a request. */
function PracticeFocus({ journal, onFocus }: { journal: ReturnType<typeof useNowLoop>["journal"]; onFocus: (focus: Focus | null) => void }) {
  const { childProfile, behaviorLogs, playLogs, milestones, actionLoop } = useArbor();
  const now = useMemo(() => new Date(), [childProfile, behaviorLogs, playLogs, milestones, actionLoop]);
  const signals = useMemo(() => focusSignalsForNow({ behaviorLogs, playLogs, milestones, actionLoop }, now), [behaviorLogs, playLogs, milestones, actionLoop, now]);
  const { focus } = useTodaysFocus(childProfile, signals, journal);
  useEffect(() => { onFocus(focus); }, [focus, onFocus]);
  return null;
}

/** A lifecycle moment is ONE short note (P5 r1 pass A5), never a card. */
const LIFECYCLE_NOTE: Partial<Record<string, string>> = {
  birthday: "elev.lifecycle.birthday.title",
  "first-week": "elev.lifecycle.week.title",
  "first-month": "elev.lifecycle.month.title",
  "first-moment": "elev.lifecycle.first.title",
};

type Lead = "step" | "tonight" | "practice" | "notice" | "program" | "recommendation";

function NowContent({ topic, onTopicOpen, onTalkOpen }: NowViewProps) {
  const { childProfile, actionLoop, seedCoach, setActiveTab, openCaptureSheet, openHardMomentNow,
    saveTodayOutcome, pendingCaptureMode, consumeCaptureRequest } = useArbor();
  const { t, uiLang } = useLanguage();
  const he = uiLang === "he";
  const lang = he ? "he" : "en";
  const copy = NOW_COPY[lang];
  const name = childProfile.name?.split(" ")[0] || t("companion.now-view.your-child");
  const programs = useChildCollection<{ id: string }>(childProfile.id, "programs");
  const program = useMemo(() => activeProgramWeek(programs.items), [programs.items]);
  const action = useMemo(() => nextChosenAction(actionLoop, topic?.id), [actionLoop, topic?.id]);
  const [receiptAction, setReceiptAction] = useState<ActionLoopEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const id = useId();
  useEffect(() => { trackCompanionPlaceOpen("now"); }, []);
  const chosen = receiptAction ?? action;
  const talk = (prompt?: string) => onTalkOpen ? onTalkOpen(prompt) : seedCoach({ prompt: prompt ?? "", source: "companion-now" });
  const saveOutcome = async (outcome: "helped" | "not_today") => {
    if (!action || saving) return;
    setSaving(true); setSaveError(false);
    try { await saveTodayOutcome(action.id, outcome); setReceiptAction(action); }
    catch { setSaveError(true); }
    finally { setSaving(false); }
  };
  useEffect(() => { setReceiptAction(null); setSaveError(false); }, [topic?.id]);
  useEffect(() => {
    if (!pendingCaptureMode) return;
    consumeCaptureRequest();
    openCaptureSheet({ mode: pendingCaptureMode });
    // The pending request is consumed once; handler identities are render-local.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCaptureMode]);
  const openProgram = () => { setActiveTab("development"); window.location.hash = "#/development?view=program"; };
  // B-TODAY-10 / B-ASKJB-31: the hard-moment door shows only while a pilot
  // guide fits this child and language — the gate every door to the sheet shares.
  const hardMomentDoor = useMemo(() => {
    const at = new Date();
    return availableHardMomentCards({ now: at, ageMonths: ageMonthsFromProfile(childProfile, at), locale: lang }).length > 0;
  }, [childProfile, lang]);

  // ── The milestone loop (parity 9 Oct): practice → Did it → Tonight → notice. ──
  const [focus, setFocus] = useState<Focus | null>(null);
  const loop = useNowLoop({
    aiPracticeId: focus?.practiceVia === "ai" ? focus.practiceId : undefined,
    openPhotoCapture: () => openCaptureSheet({ mode: "photo" }),
  });
  const [tonightOpen, setTonightOpen] = useState(false);
  // Lead order: the parent's own chosen step; Tonight (evening, or opened from
  // its pointer); today's practice; the thinnest shelf's notice; the program;
  // the AI/library recommendation. ONE lead, ONE primary move.
  const tonightLeads = tonightOpen || (!chosen && loop.plan.order[0] === "tonight");
  const lead: Lead = tonightLeads ? "tonight" : chosen ? "step" : loop.pick ? "practice" : loop.slotNotice ? "notice" : program ? "program" : "recommendation";
  const showNotice = lead !== "notice" && loop.plan.order.includes("notice") && loop.blockNotices.length > 0;
  const showPointer = lead !== "tonight" && loop.tonightHasQuestions && (loop.plan.tonightPointer || (lead === "step" && loop.evening));
  const pickId = loop.pick?.practice.id;
  useEffect(() => { if (lead === "practice" && pickId) trackActionOffered("now-practice"); }, [lead, pickId]);

  // ── Return hooks (parity 9 Oct): the visit stamp, a lifecycle note, the offer. ──
  const { previousVisitAt, isReturning } = useLastVisit(childProfile);
  const lifecycle = useLifecycleMoment({ previousVisitAt });
  const todayOffer = useCompanionOffer("today", { whatChanged: lifecycle.moment ? { id: lifecycle.moment.kind } : null });
  const lifecycleKey = lifecycle.moment && todayOffer.offer?.kind === "what-changed" ? LIFECYCLE_NOTE[lifecycle.moment.kind] : undefined;
  const lifecycleNote = lifecycleKey ? t(lifecycleKey, { name }) : null;
  const ageText = formatChildAge(childProfile, t);
  const dateLine = new Date().toLocaleDateString(he ? "he-IL" : "en-GB", { weekday: "long", day: "numeric", month: "long" });

  return <div className="companion-page now-page" dir={he ? "rtl" : "ltr"}>
    <header className="now-heading">
      <div>
        <div className="now-identity">
          <Avatar name={childProfile.name} photoURL={childPicture(childProfile).url} size={28} />
          <p className="companion-eyebrow" data-testid="today-identity">{dateLine}{ageText ? <> · {t("elev.loop.today.identity", { name, age: ageText })}</> : null}</p>
        </div>
        <h1 className="arbor-type-hero">{copy.title(name)}</h1><p>{copy.subtitle}</p>
      </div>
    </header>

    <div className="now-main-grid">
      <div className="now-main-column">
        {lead === "practice" && <PracticeFocus journal={loop.journal} onFocus={setFocus} />}
        {lead === "tonight" ? <section className="now-loop-lead" data-module="today-tonight" aria-label={t("elev.loop.today.tonight")}>
          <NowTonightLead loop={loop} />
        </section> : lead === "step" && chosen ? <section className="now-lead arbor-depth-primary" data-module="now-step" aria-labelledby={`${id}-step`}>
          <div className="now-lead-band"><span className="now-glyph" aria-hidden="true"><Icon name={receiptAction ? "check" : "bookmark"} size={24} /></span><div><p className="companion-eyebrow">{copy.chosen}</p><p className="now-provenance">{receiptAction ? copy.saved : copy.today}</p></div></div>
          <h2 id={`${id}-step`} className="now-lead-title">{receiptAction ? copy.finishedTitle : copy.chosenTitle}</h2>
          <p className="now-chosen-words" dir="auto">{chosen.recommendation}</p>
          <p className="now-lead-body" role={receiptAction ? "status" : undefined}>{receiptAction ? copy.finished : copy.chosenWhy}</p>
          {!receiptAction && <div className="now-lead-actions" role="group" aria-label={copy.outcomes}>
            <PrimaryMove type="button" className="companion-primary" disabled={saving} onClick={() => void saveOutcome("helped")}><Icon name="check" size={19} />{saving ? copy.saving : copy.helped}</PrimaryMove>
            <button type="button" className="companion-secondary" disabled={saving} onClick={() => void saveOutcome("not_today")}>{copy.notToday}</button>
          </div>}
          <PrimaryMove primary={!!receiptAction} type="button" className="companion-text-button" onClick={() => talk(copy.adaptPrompt(chosen.recommendation))}>{copy.adapt}<Icon name="chat_bubble" size={18} /></PrimaryMove>
          {saveError && <p role="alert" className="now-inline-status">{copy.saveError}</p>}
        </section> : lead === "practice" && loop.pick ? <section className="now-loop-lead" data-module="today-practice" aria-label={copy.today}>
          <NowPracticeLead loop={loop} name={name} whyText={focus?.why} headerNote={lifecycleNote} adaptLabel={copy.adapt}
            onAdapt={() => talk(copy.adaptPrompt(practiceText(loop.pick!.practice, "do", lang, childProfile.gender)))} />
        </section> : lead === "notice" ? <section className="now-loop-lead" data-module="today-practice" aria-label={t("elev.loop.today.notice.title")}>
          <NowNoticeLead loop={loop} name={name} />
        </section> : lead === "program" && program ? <section className="now-lead arbor-depth-primary" data-module="now-program" aria-labelledby={`${id}-program`}>
          <div className="now-lead-band"><span className="now-glyph" aria-hidden="true"><Icon name="menu_book" size={24} /></span><p className="companion-eyebrow">{copy.programLabel}</p></div>
          <h2 id={`${id}-program`} className="now-lead-title">{program.content.skill[lang]}</h2>
          <p className="now-lead-body">{copy.programWhy(program.week)}</p>
          <div className="now-lead-actions"><PrimaryMove type="button" className="companion-primary" onClick={openProgram}>{copy.continueProgram}<Icon name="arrow_forward" size={19} className="rtl:-scale-x-100" /></PrimaryMove></div>
          <button type="button" className="companion-text-button" onClick={() => talk(copy.adaptPrompt(program.content.skill[lang]))}>{copy.adapt}<Icon name="chat_bubble" size={18} /></button>
        </section> : <NowRecommendation name={name} onTalkOpen={talk} journal={loop.journal} />}
        {lifecycleNote && lead !== "practice" && <p className="now-lifecycle-note" role="note">{lifecycleNote}</p>}

        {showNotice && <div data-module="today-notice"><NowNoticeBlock loop={loop} name={name} practiceLeads={lead === "practice"} /></div>}
        {showPointer && <NowTonightPointer onOpen={() => { loop.setTonightEarly(true); setTonightOpen(true); }} />}

        {hardMomentDoor && <button type="button" className="now-hard-moment" onClick={() => openHardMomentNow()}><Icon name="volunteer_activism" size={24} /><span><b>{copy.hardTitle}</b><small>{copy.hardBody}</small></span><Icon name="arrow_forward" size={19} className="rtl:-scale-x-100" /></button>}
        <button type="button" className="now-weekly-door" onClick={() => setActiveTab("weekly")}><Icon name="calendar_month" size={24} /><span><b>{copy.weeklyTitle}</b><small>{copy.weeklyBody}</small></span><Icon name="arrow_forward" size={19} className="rtl:-scale-x-100" /></button>
        <NowMoreForToday now={loop.now} evening={loop.evening} storyFits={loop.storyFits} rhythmDaysNeeded={loop.rhythm.daysNeeded}
          keepsakeDocs={loop.keepsakeDocs} previousVisitAt={previousVisitAt} isReturning={isReturning} todayOffer={todayOffer} />
      </div>

      <aside className="now-side-column">
        <section className="now-conversation" data-module="now-focus" aria-labelledby={`${id}-talk`}>
          <div className="now-section-icon" aria-hidden="true"><Icon name="chat_bubble" size={25} /></div>
          {topic && <p className="companion-eyebrow">{copy.topic}</p>}
          <h2 id={`${id}-talk`} dir="auto">{topic?.title || copy.talkTitle}</h2>
          <p>{copy.talkBody}</p>
          <button type="button" className="companion-secondary" onClick={() => talk(topic?.title)}>{copy.talk}<Icon name="arrow_forward" size={18} className="rtl:-scale-x-100" /></button>
          {onTopicOpen && <button type="button" className="companion-text-button" onClick={onTopicOpen}>{copy.topics}<Icon name="bookmark" size={17} /></button>}
        </section>
        <section className="now-capture" aria-labelledby={`${id}-capture`}>
          <h2 id={`${id}-capture`}>{copy.capture}</h2><p>{copy.captureBody}</p>
          <div className="now-capture-modes" role="group" aria-label={copy.quickSave}>
            <button type="button" onClick={() => openCaptureSheet({ mode: "text" })}><Icon name="edit_note" size={21} />{copy.write}</button>
            <button type="button" onClick={() => openCaptureSheet({ mode: "voice" })}><Icon name="mic" size={21} />{copy.dictate}</button>
            <button type="button" onClick={() => openCaptureSheet({ mode: "photo" })}><Icon name="photo_camera" size={21} />{copy.photo}</button>
          </div>
        </section>
        {/* B-PROG-03: the program is Today's frame — one line beside the practice, never a second lead. */}
        {program && lead !== "program" && <button type="button" className="now-weekly-door now-program-line" data-testid="now-program-line" onClick={openProgram}>
          <Icon name="menu_book" size={24} /><span><b>{copy.programLabel}</b><small dir="auto">{program.content.skill[lang]}</small></span><Icon name="arrow_forward" size={19} className="rtl:-scale-x-100" />
        </button>}
      </aside>
    </div>

    {/* Navigation to the other two places: chrome, never a counted module. */}
    <nav className="now-open-doors" aria-label={t("companion.now-view.understand-more-with-support")}>
      <button type="button" className="now-picture-door" onClick={() => setActiveTab("development")}><span className="now-door-icon" aria-hidden="true"><Icon name="auto_stories" size={29} /></span><span><h2>{copy.pictureTitle(name)}</h2><p>{copy.pictureBody}</p></span><Icon name="arrow_forward" size={20} className="rtl:-scale-x-100" /></button>
      <button type="button" className="now-together-door" onClick={() => setActiveTab("practice")}><img src={TOGETHER_ART.src} srcSet={TOGETHER_ART.srcSet} width={TOGETHER_ART.width} height={TOGETHER_ART.height} alt="" loading="lazy" /><span><h2>{copy.togetherTitle}</h2><p>{copy.togetherBody}</p></span><Icon name="arrow_forward" size={20} className="rtl:-scale-x-100" /></button>
    </nav>
    <footer className="now-footer"><button type="button" className="companion-text-button" onClick={() => setActiveTab("learn")}><Icon name="menu_book" size={18} />{copy.learning}</button><button type="button" className="companion-text-button" onClick={() => setActiveTab("consult")}><Icon name="group" size={19} />{copy.care}</button></footer>
  </div>;
}
