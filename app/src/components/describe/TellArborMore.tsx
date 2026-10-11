/**
 * B-SHELL-39 — the "Tell Arbor more" door (My child, What Arbor knows): the
 * same guided conversation and readback as onboarding, with the items already
 * kept loaded, so an answer can replace or remove them. Milestones the
 * parent's words match go through the ArborContext milestone write (with
 * "Not this"); context lines become approved memory. Nothing is written
 * before "Keep these".
 */
import React, { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Modal } from "../ui/Modal";
import { useArbor } from "../../context/ArborContext";
import { useProfile } from "../../context/ProfileContext";
import { useLanguage } from "../../context/LanguageContext";
import { DescribeSession } from "../../lib/describeChild";
import { describeServices, primeQuestionVoice, type QuestionVoice } from "../../lib/describeChildClient";
import { milestoneCandidateIds } from "../../lib/milestones/captureMatch";
import { comparisonMonthsOf } from "../../lib/age/forChild";
import { milestoneText } from "../../lib/milestoneData";
import { UrgentSupport } from "../safety/UrgentSupport";
import DescribeChild from "./DescribeChild";
import DescribeReadback from "./DescribeReadback";
import DescribeThread from "./DescribeThread";
import "./describe.css";

export default function TellArborMore({ onClose }: { onClose: () => void }) {
  const { childProfile, milestones, setMilestoneObservation, restoreMilestone, retryMemoryReview } = useArbor();
  const { updateChild } = useProfile();
  const { t, aiLang, uiLang } = useLanguage();
  const lang: "en" | "he" = aiLang === "he" ? "he" : "en";
  const name = (childProfile.name || "").trim().split(/\s+/)[0] || childProfile.name;
  // The session reads the child and the milestones at call time, never a stale render.
  const live = useRef({ childProfile, milestones, lang });
  live.current = { childProfile, milestones, lang };
  const session = useMemo(() => new DescribeSession(describeServices({
    profile: () => live.current.childProfile,
    language: () => live.current.lang,
    updateChild: (id, patch) => updateChild(id, patch),
    milestoneCandidateIds: () => milestoneCandidateIds(live.current.milestones, comparisonMonthsOf(live.current.childProfile)),
    milestones: {
      find: (id) => live.current.milestones.find((m) => m.id === id),
      observe: (id) => setMilestoneObservation(id, "yes"),
      restore: restoreMilestone,
    },
    onMemoryChanged: retryMemoryReview,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [childProfile.id]);
  const state = useSyncExternalStore(session.subscribe, session.snapshot, session.snapshot);
  const [text, setText] = useState("");
  const [empty, setEmpty] = useState(false);
  const [viaMic, setViaMic] = useState(false);
  const primed = useRef<QuestionVoice | null>(null);
  const drafting = state.status === "drafting";
  const conversing = state.status === "asking" || (drafting && state.thread.length > 1);
  const showInput = !conversing && (state.status === "idle" || state.status === "drafting" || state.status === "failed");
  const showReadback = state.status === "ready" || state.status === "committing" || state.status === "kept";
  const start = async () => {
    setEmpty(false);
    // Inside the tap: a mic answer primes the voice for the first question.
    primed.current?.cancel();
    primed.current = viaMic ? primeQuestionVoice() : null;
    const outcome = await session.start(text, t("elev.describe.opening", { name }));
    if (outcome === "empty") setEmpty(true);
    if (outcome !== "asking") { primed.current?.cancel(); primed.current = null; }
  };
  const milestoneTitle = (id: string) => {
    const milestone = live.current.milestones.find((m) => m.id === id);
    return milestone ? milestoneText(milestone, "title", t, { gender: childProfile.gender ?? null }) : undefined;
  };
  return <Modal open onClose={onClose} title={t("elev.describe.title", { name })} maxWidth="max-w-2xl">
    <div className="describe-modal" dir={uiLang === "he" ? "rtl" : "ltr"} data-testid="tell-arbor-more">
      {showInput && <>
        <p className="describe-sub">{t("elev.describe.sub")}</p>
        <DescribeChild name={name} lang={lang} value={text} onChange={(next) => { setText(next); setEmpty(false); }} quickFills disabled={drafting} autoFocus onVoiceText={() => setViaMic(true)} />
        {state.error === "crisis" && <UrgentSupport testId="describe-urgent-support" />}
        {state.error === "model" && <p className="describe-note" role="alert">{t("elev.describe.failed")}</p>}
        {empty && <p className="describe-note" role="status">{t("elev.describe.empty")}</p>}
        <div className="describe-footer">
          <button type="button" className="describe-link" onClick={onClose} disabled={drafting}>{t("elev.describe.skip")}</button>
          <button type="button" className="describe-keep-these" disabled={!text.trim() || drafting} onClick={() => void start()} data-testid="describe-play-back">
            {drafting ? t("elev.describe.drafting") : t("ob.step.continue")}
          </button>
        </div>
      </>}
      {conversing && <DescribeThread name={name} lang={lang} session={session} primedVoice={primed} />}
      {showReadback && <DescribeReadback name={name} session={session} profile={childProfile} milestoneTitle={milestoneTitle} />}
      {state.status === "kept" && <div className="describe-footer">
        <button type="button" className="describe-link" onClick={onClose}>{t("elev.describe.close")}</button>
      </div>}
    </div>
  </Modal>;
}
