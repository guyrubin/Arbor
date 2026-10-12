import React from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import PracticeCard from "../loop/PracticeCard";
import NoticeCard from "../loop/NoticeCard";
import TonightFlow from "../loop/TonightFlow";
import Icon from "../ui/Icon";
import { PendingLine } from "../ui/Receipt";
import { NOW_COPY } from "./nowViewCopy";
import type { useNowLoop } from "./useNowLoop";

type Loop = ReturnType<typeof useNowLoop>;

/**
 * The milestone loop's blocks, drawn for Now (parity, 9 Oct 2026). Now's ONE
 * primary move is #/overview's contract move; each block carries it only while
 * it is the lead, through the components' own stamp props (one stamp on screen
 * at a time — PracticeCard on its answer group, then the practice's "Adapt"
 * once it is answered, or Tonight's current step). v3 F-NOW-2: the Notice
 * block left the body; its first notice is a line in the week card.
 */
const MOVE = "choose-next-step";
const stamp = { "data-primary-move": MOVE } as const;

export function NowPracticeLead({ loop, name, whyText, onAdapt, adaptLabel, choosing = false }: {
  loop: Loop; name: string; whyText?: string | null;
  onAdapt: () => void; adaptLabel: string;
  /** B-STATUS-01: the AI focus is still choosing today's practice (B-LOOP-13). */
  choosing?: boolean;
}) {
  const { childProfile } = useArbor();
  const { t, uiLang } = useLanguage();
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
      actionFirstDetailsLabel={NOW_COPY[uiLang === "he" ? "he" : "en"].practiceDetails}
      answered={loop.doseAnswer}
      onAnswer={loop.answerPractice}
      onUndo={loop.undoPractice}
      quotes={loop.quotes}
      whyReason={loop.whyReason}
      whyDate={loop.whyDate}
      /* B-LOOP-13: the AI's why sentence replaces the chooser's reason ONLY beside its own pick. */
      whyText={pick.via === "ai" ? whyText ?? null : null}
      stampMove={MOVE}
      mode={loop.plan.practiceMode === "tonight" ? "tonight" : "day"}
      adaptation={pick.adaptation?.key ?? null}
      onAdapt={loop.setAdaptation}
    />
    {/* B-STATUS-01: Arbor may still swap in its pick (B-LOOP-13) — ONE quiet
        line after 400 ms, gone once it answers or the dose is in. */}
    <PendingLine active={choosing && !loop.doseAnswer} testId="now-practice-pending">{t("elev.loop.pending.practice")}</PendingLine>
    {/* Practice answered: the move passes to "Adapt" (v3 F-NOW-2; the Notice rows that carried it left the body). */}
    <button type="button" className="companion-text-button now-loop-adapt" {...(loop.doseAnswer ? stamp : {})} onClick={onAdapt}>{adaptLabel}<Icon name="chat_bubble" size={18} /></button>
  </>;
}

/** No practice for the window: the thinnest shelf's Notice card leads. */
export function NowNoticeLead({ loop, name }: { loop: Loop; name: string }) {
  const { childProfile } = useArbor();
  const card = loop.slotNotice;
  if (!card) return null;
  return <NoticeCard key={card.milestone.id} milestone={card.milestone} shelf={card.shelf} gender={childProfile.gender} childName={name} variant="card" answers="segmented" answersAttrs={stamp} {...loop.noticeHandlers(card.milestone, card.shelf)} />;
}

/** Tonight's three questions (B-LOOP-10) and, at the week's end, the goal marks
 *  (B-PROG-07). The story is the glance's Tonight row at night (v3 F-NOW-2), never here. */
export function NowTonightLead({ loop }: { loop: Loop }) {
  return <TonightFlow {...loop.tonight} stampMove={MOVE} />;
}

/** Before the evening (or behind a chosen step): ONE pointer line, never a module. */
export function NowTonightPointer({ onOpen }: { onOpen: () => void }) {
  const { t } = useLanguage();
  return <button type="button" className="now-weekly-door now-tonight-pointer" data-testid="today-tonight-pointer" onClick={onOpen}>
    <Icon name="bedtime" size={24} />
    <span><b>{t("elev.loop.today.tonight")}</b><small>{t("elev.loop.today.tonightSub")}</small></span>
    <Icon name="arrow_forward" size={19} className="rtl:-scale-x-100" />
  </button>;
}
