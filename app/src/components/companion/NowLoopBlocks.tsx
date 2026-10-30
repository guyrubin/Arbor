import React, { useId, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import PracticeCard, { practiceText } from "../loop/PracticeCard";
import { startConversationVoice } from "../../lib/companionConversation";
import NoticeCard from "../loop/NoticeCard";
import TonightFlow from "../loop/TonightFlow";
import { NowNoticeRow } from "./NowNoticeRow";
import Icon from "../ui/Icon";
import { BrandChip } from "../ui/BrandChip";
import { PendingLine } from "../ui/Receipt";
import { NOW_COPY } from "./nowViewCopy";
import type { useNowLoop } from "./useNowLoop";

type Loop = ReturnType<typeof useNowLoop>;

/**
 * The milestone loop's blocks, drawn for Now (parity, 9 Oct 2026). Now's ONE
 * primary move is #/overview's contract move; each block carries it only while
 * it is the lead, through the components' own stamp props (one stamp on screen
 * at a time — PracticeCard on its answer group, then the first Notice row once
 * the practice is answered, or Tonight's current step).
 */
const MOVE = "choose-next-step";
const stamp = { "data-primary-move": MOVE } as const;

export function NowPracticeLead({ loop, name, whyText, headerNote, onAdapt, adaptLabel, choosing = false }: {
  loop: Loop; name: string; whyText?: string | null; headerNote?: string | null;
  onAdapt: () => void; adaptLabel: string;
  /** B-STATUS-01: the AI focus is still choosing today's practice (B-LOOP-13). */
  choosing?: boolean;
}) {
  const { childProfile } = useArbor();
  const { t, uiLang } = useLanguage();
  if (!loop.pick) return null;
  const pick = loop.pick;
  const copy = NOW_COPY[uiLang === "he" ? "he" : "en"];
  return <>
    <PracticeCard
      key={loop.adaptationKey}
      practice={pick.practice}
      milestone={pick.milestone}
      shelf={pick.shelf}
      childName={name}
      gender={childProfile.gender}
      actionFirstDetailsLabel={NOW_COPY[uiLang === "he" ? "he" : "en"].practiceDetails}
      answerLabels={{ did: copy.done, notToday: copy.haventTried }}
      answered={loop.doseAnswer}
      onAnswer={loop.answerPractice}
      onUndo={loop.undoPractice}
      quotes={loop.quotes}
      whyReason={loop.whyReason}
      whyDate={loop.whyDate}
      /* B-LOOP-13: the AI's why sentence replaces the chooser's reason ONLY beside its own pick. */
      whyText={pick.via === "ai" ? whyText ?? null : null}
      headerNote={headerNote}
      stampMove={MOVE}
      mode={loop.plan.practiceMode === "tonight" ? "tonight" : "day"}
      adaptation={pick.adaptation?.key ?? null}
      onAdapt={loop.setAdaptation}
    />
    {/* B-STATUS-01: Arbor may still swap in its pick (B-LOOP-13) — ONE quiet
        line after 400 ms, gone once it answers or the dose is in. */}
    <PendingLine active={choosing && !loop.doseAnswer} testId="now-practice-pending">{t("elev.loop.pending.practice")}</PendingLine>
    {/* B-VOICE-02: "Talk it through" starts the spoken conversation on this
        tap; Arbor says the practice's words first (text-to-speech, never the
        prompt), then listens. Adapting it in writing stays beside it. */}
    <div className="now-loop-actions">
      <button type="button" className="companion-text-button" data-testid="now-practice-talk"
        onClick={() => startConversationVoice({ source: "practice", opening: practiceWords(pick.practice, uiLang === "he" ? "he" : "en", childProfile.gender) })}>
        {t("companion.input.talk")}<Icon name="graphic_eq" size={18} />
      </button>
      <button type="button" className="companion-text-button now-loop-adapt" onClick={onAdapt}>{adaptLabel}<Icon name="chat_bubble" size={18} /></button>
    </div>
  </>;
}

/** B-VOICE-02: the words a practice's "Talk it through" says first — its own
 *  "say" line, else what to do (page language, Hebrew forms by gender). */
export function practiceWords(practice: Parameters<typeof practiceText>[0], lang: "en" | "he", gender?: string | null): string {
  return practiceText(practice, "say", lang, gender) || practiceText(practice, "do", lang, gender);
}

/** No practice for the window: the thinnest shelf's Notice card leads. */
export function NowNoticeLead({ loop, name }: { loop: Loop; name: string }) {
  const { childProfile } = useArbor();
  const card = loop.slotNotice;
  if (!card) return null;
  return <NoticeCard key={card.milestone.id} milestone={card.milestone} shelf={card.shelf} gender={childProfile.gender} childName={name} variant="card" answers="segmented" answersAttrs={stamp} {...loop.noticeHandlers(card.milestone, card.shelf)} />;
}

/** v4: the head's line says what is true right now — how many things there
 *  are to notice and how many are already answered — so it never contradicts
 *  the open count beside the title. Counts only, never a score. */
export function noticeSummaryKey(rows: number, waiting: number): string {
  if (waiting <= 0) return rows > 1 ? "elev.loop.today.notice.doneTwo" : "elev.loop.today.notice.doneOne";
  if (rows <= 1) return "elev.loop.today.notice.subOne";
  return waiting < rows ? "elev.loop.today.notice.oneLeft" : "elev.loop.today.notice.sub";
}

/** Notice today — ≤ 2 rows, never the practice's shelf (B-LOOP-04).
 *  v4: one object with a head (gradient chip · title · how many are still
 *  open · the calm sub) that folds the rows away and back; the say-back
 *  question and "Arbor noticed" follow as its last rows (`extras`). */
export function NowNoticeBlock({ loop, name, practiceLeads, extras }: { loop: Loop; name: string; practiceLeads: boolean; extras?: React.ReactNode }) {
  const { childProfile, setActiveTab } = useArbor();
  const { t } = useLanguage();
  const id = useId();
  const [open, setOpen] = useState(true);
  if (!loop.blockNotices.length) return null;
  // Counts only: how many of today's rows are still unanswered (never a score).
  const waiting = loop.blockNotices.filter(c => !c.milestone.observationStatus).length;
  // v4 (Arbor v4 · NOTICE TODAY): ONE line of head — the chip, the name, the
  // open count, the sub-line, the chevron — the whole line is the fold control;
  // then compact rows (area chip · title over shelf · three inline answers) and
  // the foot: not a score, and the way to every milestone.
  return <section className="now-notice" data-testid="today-notice" aria-labelledby={`${id}-notice`}>
    <h2 className="now-notice-heading">
      <button type="button" className="now-notice-head" aria-expanded={open} aria-controls={`${id}-notice-body`} data-testid="today-notice-toggle" onClick={() => setOpen(v => !v)}>
        <BrandChip icon="visibility" tone="sky" shape="drop" />
        <span id={`${id}-notice`} className="now-notice-title">{t("elev.loop.today.notice.title")}</span>
        {waiting > 0 && <><span className="now-notice-count" data-testid="today-notice-count" aria-hidden="true">{waiting}</span><span className="sr-only">{t("elev.loop.today.notice.count", { n: waiting })}</span></>}
        <span className="now-notice-sub">{t(noticeSummaryKey(loop.blockNotices.length, waiting))}</span>
        <Icon name={open ? "expand_less" : "expand_more"} size={20} className="now-notice-chev" />
      </button>
    </h2>
    <div className="now-notice-card" id={`${id}-notice-body`} hidden={!open}>
      {loop.blockNotices.map((c, i) => (
        /* Practice answered: the move passes to the first Notice row's answers. */
        <NowNoticeRow key={c.milestone.id} index={i} milestone={c.milestone} shelf={c.shelf} gender={childProfile.gender} childName={name}
          answersAttrs={i === 0 && practiceLeads && loop.doseAnswer ? stamp : undefined} {...loop.noticeHandlers(c.milestone, c.shelf)} />
      ))}
      {extras}
      <div className="now-notice-foot">
        <span>{t("elev.loop.today.notice.foot")}</span>
        <button type="button" className="now-notice-all" data-testid="today-notice-all" onClick={() => setActiveTab("development")}>
          {t("elev.loop.today.notice.all")}<Icon name="arrow_forward" size={15} className="rtl:-scale-x-100" />
        </button>
      </div>
    </div>
  </section>;
}

/** Tonight's three questions (B-LOOP-10) and, at the week's end, the goal marks
 *  (B-PROG-07). The story is the door's line at night (critic c2 r1), never here. */
export function NowTonightLead({ loop }: { loop: Loop }) {
  return <TonightFlow {...loop.tonight} stampMove={MOVE} />;
}

/** Before the evening (or behind a chosen step): ONE pointer line, never a module. */
export function NowTonightPointer({ onOpen }: { onOpen: () => void }) {
  const { t } = useLanguage();
  return <button type="button" className="now-weekly-door now-tonight-pointer" data-testid="today-tonight-pointer" onClick={onOpen}>
    <BrandChip icon="dark_mode" tone="lav" shape="arch" />
    <span><b>{t("elev.loop.today.tonight")}</b><small>{t("elev.loop.today.tonightSub")}</small></span>
    <Icon name="arrow_forward" size={19} className="rtl:-scale-x-100" />
  </button>;
}
