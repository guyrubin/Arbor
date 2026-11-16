import React, { useId, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import PracticeCard, { practiceText } from "../loop/PracticeCard";
import { startConversationVoice } from "../../lib/companionConversation";
import NoticeCard from "../loop/NoticeCard";
import TonightFlow, { type TonightStep } from "../loop/TonightFlow";
import { NowNoticeRow } from "./NowNoticeRow";
import Icon from "../ui/Icon";
import { PendingLine } from "../ui/Receipt";
import { NOW_COPY } from "./nowViewCopy";
import { NowRow } from "./now10/NowComingUp";
import { NOW_V10_COPY } from "./now10/nowV10Copy";
import { RIGHT_NOW_COPY } from "./nowV41Copy";
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

/** v10.1: which Notice row is asked now — the first still unanswered — and its place among the rows ("1 of 2").
 *  With every row answered, the place is the last one and nothing is asked. Counts only, never a score. */
export function noticePosition(answered: readonly boolean[]): { current: number; position: number } {
  const current = answered.findIndex(a => !a);
  return { current, position: current === -1 ? answered.length : current + 1 };
}

/** Notice today — ≤ 2 rows, never the practice's shelf (B-LOOP-04).
 *  v10.1 (N-Now V77, Waiting for you › Now): ONE card. Its head — "Did you
 *  notice this today?" and where you are ("1 of 2") — is the fold control;
 *  the row to answer now is drawn large (the milestone in the display face,
 *  its area under it, the three worded answers in one segmented tray);
 *  answered rows stay as compact lines with their pill and Undo/Change; the
 *  next row waits until this one is answered. Then the say-back question and
 *  "Arbor noticed" (`extras`), and the way to every milestone. Counts only. */
export function NowNoticeBlock({ loop, name, practiceLeads, extras }: { loop: Loop; name: string; practiceLeads: boolean; extras?: React.ReactNode }) {
  const { childProfile, setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const id = useId();
  const [open, setOpen] = useState(true);
  if (!loop.blockNotices.length) return null;
  const rows = loop.blockNotices;
  // The row to answer now: the first still unanswered. Answered rows stay (Undo / Change); later ones wait their turn.
  const { current, position } = noticePosition(rows.map(c => !!c.milestone.observationStatus));
  const q = RIGHT_NOW_COPY[uiLang === "he" ? "he" : "en"].tonightNoticeQ;
  return <section className="nw-ask now-notice" data-testid="today-notice" aria-labelledby={`${id}-notice`}>
    <h2 className="now-notice-heading">
      <button type="button" className="now-notice-head kk" aria-expanded={open} aria-controls={`${id}-notice-body`} data-testid="today-notice-toggle" onClick={() => setOpen(v => !v)}>
        <span id={`${id}-notice`}>{q}</span>
        <span className="small nowrap" data-testid="today-notice-count">{NOW_V10_COPY[uiLang === "he" ? "he" : "en"].nOfTotal(position, rows.length)}</span>
        <Icon name={open ? "expand_less" : "expand_more"} size={18} className="now-notice-chev" />
      </button>
    </h2>
    <div className="nw-ask-body" id={`${id}-notice-body`} hidden={!open}>
      {rows.map((c, i) => (current !== -1 && i > current) ? null : (
        /* Practice answered: the move passes to the row being asked's answers. */
        <NowNoticeRow key={c.milestone.id} index={i} ask={i === current} milestone={c.milestone} shelf={c.shelf} gender={childProfile.gender} childName={name}
          answersAttrs={i === (current === -1 ? 0 : current) && practiceLeads && loop.doseAnswer ? stamp : undefined} {...loop.noticeHandlers(c.milestone, c.shelf)} />
      ))}
      {extras}
      <div className="ft">
        <button type="button" className="ds-link" data-testid="today-notice-all" onClick={() => setActiveTab("development")}>
          {t("elev.loop.today.notice.all")}<Icon name="chevron_right" size={16} className="rtl:-scale-x-100" />
        </button>
      </div>
    </div>
  </section>;
}

/** Tonight's three questions (B-LOOP-10) and, at the week's end, the goal marks
 *  (B-PROG-07). The story is the door's line at night (critic c2 r1), never here. */
export function NowTonightLead({ loop: base, initialStep }: { loop: Loop; initialStep?: TonightStep }) {
  // v4.1: Right now's "Write it down" opens the evening at its words step
  // (TonightFlow reads initialStep once, on mount).
  const loop = initialStep ? { ...base, tonight: { ...base.tonight, initialStep } } : base;
  return <TonightFlow {...loop.tonight} stampMove={MOVE} />;
}

/** Before the evening (or behind a chosen step): ONE pointer line, never a module.
 *  v10.1: a Coming up row (N-Now › stop 4). */
export function NowTonightPointer({ onOpen }: { onOpen: () => void }) {
  const { t } = useLanguage();
  return <NowRow icon="dark_mode" testId="today-tonight-pointer" className="now-tonight-pointer" title={t("elev.loop.today.tonight")} sub={t("elev.loop.today.tonightSub")} onOpen={onOpen} />;
}
