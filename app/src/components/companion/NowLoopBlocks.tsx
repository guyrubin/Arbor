import React, { useId } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import PracticeCard from "../loop/PracticeCard";
import NoticeCard from "../loop/NoticeCard";
import TonightFlow from "../loop/TonightFlow";
import { SectionHead } from "../ui/SectionHead";
import Icon from "../ui/Icon";
import { PendingLine } from "../ui/Receipt";
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
  const { t } = useLanguage();
  if (!loop.pick) return null;
  const pick = loop.pick;
  return <>
    <PracticeCard
      key={loop.adaptationKey}
      practice={pick.practice}
      milestone={pick.milestone}
      shelf={pick.shelf}
      childName={name}
      gender={childProfile.gender}
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
    <button type="button" className="companion-text-button now-loop-adapt" onClick={onAdapt}>{adaptLabel}<Icon name="chat_bubble" size={18} /></button>
  </>;
}

/** No practice for the window: the thinnest shelf's Notice card leads. */
export function NowNoticeLead({ loop, name }: { loop: Loop; name: string }) {
  const { childProfile } = useArbor();
  const card = loop.slotNotice;
  if (!card) return null;
  return <NoticeCard key={card.milestone.id} milestone={card.milestone} shelf={card.shelf} gender={childProfile.gender} childName={name} variant="card" answers="segmented" answersAttrs={stamp} {...loop.noticeHandlers(card.milestone, card.shelf)} />;
}

/** Notice today — ≤ 2 rows, never the practice's shelf (B-LOOP-04). */
export function NowNoticeBlock({ loop, name, practiceLeads }: { loop: Loop; name: string; practiceLeads: boolean }) {
  const { childProfile } = useArbor();
  const { t } = useLanguage();
  const id = useId();
  if (!loop.blockNotices.length) return null;
  return <section className="now-notice" data-testid="today-notice" aria-labelledby={`${id}-notice`}>
    <SectionHead id={`${id}-notice`} icon="visibility" title={t("elev.loop.today.notice.title")} sub={t("elev.loop.today.notice.sub")} />
    <div className="now-notice-card">
      {loop.blockNotices.map((c, i) => (
        <div key={c.milestone.id} className={i > 0 ? "now-notice-row is-next" : "now-notice-row"}>
          {/* Practice answered: the move passes to the first Notice row's answers. */}
          <NoticeCard milestone={c.milestone} shelf={c.shelf} gender={childProfile.gender} childName={name} variant="row" answers="segmented"
            answersAttrs={i === 0 && practiceLeads && loop.doseAnswer ? stamp : undefined} {...loop.noticeHandlers(c.milestone, c.shelf)} />
        </div>
      ))}
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
    <Icon name="dark_mode" size={24} />
    <span><b>{t("elev.loop.today.tonight")}</b><small>{t("elev.loop.today.tonightSub")}</small></span>
    <Icon name="arrow_forward" size={19} className="rtl:-scale-x-100" />
  </button>;
}
