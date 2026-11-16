import React, { useMemo, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import type { KeepsakeDoc } from "../../lib/firstsKeepsake";
import { fmtDay } from "../../lib/formatDate";
import { routeHash } from "../../lib/routes";
import { keptThings } from "../../lib/kept/keptThings";
import { milestoneText } from "../../lib/milestoneData";
import type { ObservationSources } from "../../lib/observations";
import { focusGoal, focusNextStep, goalLabel } from "../../practice/goalBuilder";
import TellArborMore from "../describe/TellArborMore";
import { Icon } from "../ui/Icon";
import { latestKeptMoment, latestStrength } from "./milestonesModel";

/**
 * v3 F-CHILD-1 — the portrait cards of the Milestones pill (In your words).
 *
 *  1. A strength: the latest strength the parent told Arbor, dated by its
 *     ledger record ("In your words · 3 Oct"); a line with no record is shown
 *     undated, never given an invented date.
 *  2. A moment you kept: the newest word, first or moment the parent kept,
 *     with its day.
 *  3. v10.1: what the family is working on moved to the rail's focus row
 *     (GoalFocus, below), beside the Development check.
 *
 * A card with nothing to show says "Not told yet" and offers "Tell Arbor"
 * (the describe conversation for a strength, the capture sheet for a
 * moment). Nothing here is generated: every line is the parent's own words.
 * v10.1: the two are object cards (glyph, label, the words, one action),
 * shown at every width; the page lays them out.
 */
export interface PortraitCardsProps {
  /** The record the page already loaded (useObservationRecord), read, never refetched. */
  sources: ObservationSources;
}

export default function PortraitCards({ sources }: PortraitCardsProps) {
  const { childProfile, openCaptureSheet } = useArbor();
  const { t, uiLang } = useLanguage();
  const [telling, setTelling] = useState(false);
  const gender = childProfile.gender ?? null;
  const strength = useMemo(() => latestStrength(childProfile), [childProfile]);
  const kept = useMemo(() => latestKeptMoment(keptThings({
    behaviorLogs: sources.behaviorLogs,
    milestones: sources.milestones?.map((item) => ({ ...item, title: milestoneText(item, "title", t, { gender }) })),
    langObs: sources.langObs,
    keepsakes: sources.keepsakes?.filter((item): item is KeepsakeDoc => typeof (item as Partial<KeepsakeDoc>).id === "string"),
  }, childProfile), sources.behaviorLogs, Date.now()), [sources.behaviorLogs, sources.milestones, sources.langObs, sources.keepsakes, childProfile, t, gender]);
  const notTold = (testId: string, onTell: () => void) => (
    <>
      <p className="ol ms-obj-empty">{t("companion.milestones.notTold")}</p>
      <button type="button" className="oa" data-testid={testId} onClick={onTell}>
        <Icon name="add_comment" size={18} />
        <span>{t("companion.milestones.tell")}</span>
      </button>
    </>
  );
  return (
    <div className="portrait-cards" data-testid="portrait-cards">
      <article className="obj" data-testid="portrait-card-strength">
        <div className="oh">
          <span className="ogi" aria-hidden="true"><Icon name="auto_awesome" size={18} /></span>
          <h3 className="ok">{t("companion.milestones.card.strength")}</h3>
        </div>
        {strength ? (
          <>
            <p className="ol" dir="auto">{strength.text}</p>
            <p className="ms-obj-src">
              {strength.at ? t("companion.milestones.srcWords", { date: fmtDay(strength.at, uiLang) }) : t("companion.milestones.srcWordsUndated")}
            </p>
          </>
        ) : notTold("portrait-card-strength-tell", () => setTelling(true))}
      </article>
      <article className="obj" data-testid="portrait-card-kept">
        <div className="oh">
          <span className="ogi" aria-hidden="true"><Icon name="edit_note" size={18} /></span>
          <h3 className="ok">{t("companion.milestones.card.kept")}</h3>
        </div>
        {kept ? (
          <>
            <p className="ol" dir="auto">{kept.text}</p>
            {kept.at && <p className="ms-obj-src">{t("companion.milestones.srcParent", { date: fmtDay(kept.at, uiLang) })}</p>}
            {/* B-ASKJB-36 (critic r1): the card opens the Kept reader, where
                every kept moment sits by month. */}
            <a className="oa" data-testid="portrait-card-kept-open" href={`#${routeHash("timeline", { kind: "kept", reader: "book" })}`}>
              {t("kept.view")}
              <Icon name="chevron_right" size={18} className="rtl:-scale-x-100" />
            </a>
          </>
        ) : notTold("portrait-card-kept-tell", () => openCaptureSheet())}
      </article>
      {telling && <TellArborMore onClose={() => setTelling(false)} />}
    </div>
  );
}

/**
 * v10.1 — what the family is working on, as the focus row of the rail's
 * focus-and-check object (it was the third portrait card). The whole row is
 * the goal picker's door, as production's card was: the goal (focusGoal),
 * B-GROWTH-40's one "Next: {step}" line from the plan started for it, the
 * source line and Change; with no goal, the invitation to choose one.
 */
export function GoalFocus({ onEditGoal }: { onEditGoal: () => void }) {
  const { childProfile, actionPlans } = useArbor();
  const { t } = useLanguage();
  const goal = focusGoal(childProfile.activeGoals ?? []);
  const next = useMemo(() => focusNextStep(goal, actionPlans ?? []), [goal, actionPlans]);
  return (
    <button type="button" className="mcrow-btn ms-goal" data-testid="portrait-goals-edit" onClick={onEditGoal}>
      <span className="tg" aria-hidden="true"><Icon name="flag" size={18} /></span>
      <span className="mcrow-text">
        <span className="ok">{t("elev.goal.profile.title")}</span>
        <span className="ol">{goal ? <bdi>{goalLabel(goal, t)}</bdi> : t("elev.goal.profile.empty")}</span>
        {next && <span className="ms-obj-src portrait-card-next" data-testid="portrait-goal-next">{t("companion.milestones.goalNext", { step: next })}</span>}
        {goal && <span className="ms-obj-src" data-testid="portrait-goal-src">{t("companion.milestones.srcGoal")}</span>}
      </span>
      {goal && <span className="oa b">{t("elev.goal.profile.edit")}</span>}
    </button>
  );
}
