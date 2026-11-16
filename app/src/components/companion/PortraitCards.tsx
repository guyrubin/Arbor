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
 * v3 F-CHILD-1 — the three portrait cards under the Milestones header.
 *
 *  1. A strength: the latest strength the parent told Arbor, dated by its
 *     ledger record ("In your words · 3 Oct"); a line with no record is shown
 *     undated, never given an invented date.
 *  2. A moment you kept: the newest word, first or moment the parent kept,
 *     with its day.
 *  3. The mock's "Current focus" card, holding what GoalFocusLine read
 *     (focusGoal, the brief's seam for the saved question); a tap opens the
 *     goal picker the page owns (GoalBuilderModal). It keeps the label
 *     "What we're working on": the one-focus copy pin bans a second "focus"
 *     word on this page, so the mock's label is a recorded departure. The
 *     icon (bookmark) and the source line follow the mock. B-GROWTH-40: with
 *     a plan started for that goal, ONE line under it, "Next: {step}"
 *     (focusNextStep), the plan's next unfinished step. No new card.
 *
 * A card with nothing to show says "Not told yet" and offers "Tell Arbor"
 * (the describe conversation for a strength, the capture sheet for a
 * moment). Nothing here is generated: every line is the parent's own words.
 * v10.1: the three are object cards (glyph, label, the words, one action),
 * shown at every width; the page lays them out (a row on a desk, a stack on a
 * phone) and adds the check beside them.
 */
export interface PortraitCardsProps {
  /** The record the page already loaded (useObservationRecord), read, never refetched. */
  sources: ObservationSources;
  onEditGoal: () => void;
}

export default function PortraitCards({ sources, onEditGoal }: PortraitCardsProps) {
  const { childProfile, openCaptureSheet, actionPlans } = useArbor();
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
  const goal = focusGoal(childProfile.activeGoals ?? []);
  // B-GROWTH-40: the plan started for this goal says what to do next (one line, inside this card).
  const next = useMemo(() => focusNextStep(goal, actionPlans ?? []), [goal, actionPlans]);
  const notTold = (testId: string, onTell: () => void) => (
    <>
      <p className="ol ms-obj-empty">{t("companion.milestones.notTold")}</p>
      <button type="button" className="oa" data-testid={testId} onClick={onTell}>
        <Icon name="add_comment" size={16} />
        <span>{t("companion.milestones.tell")}</span>
      </button>
    </>
  );
  return (
    <div className="portrait-cards" data-testid="portrait-cards">
      <article className="obj" data-testid="portrait-card-strength">
        <div className="oh">
          <span className="ogi" aria-hidden="true"><Icon name="auto_awesome" size={17} /></span>
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
          <span className="ogi" aria-hidden="true"><Icon name="edit_note" size={17} /></span>
          <h3 className="ok">{t("companion.milestones.card.kept")}</h3>
        </div>
        {kept ? (
          <>
            <p className="ol" dir="auto">{kept.text}</p>
            {kept.at && <p className="ms-obj-src">{t("companion.milestones.srcParent", { date: fmtDay(kept.at, uiLang) })}</p>}
            {/* B-ASKJB-36 (critic r1): the card opens the Kept reader, where
                every kept moment sits by month. */}
            <a className="oa" data-testid="portrait-card-kept-open" href={`#${routeHash("development", { view: "kept" })}`}>
              {t("kept.view")}
              <Icon name="chevron_right" size={16} className="rtl:-scale-x-100" />
            </a>
          </>
        ) : notTold("portrait-card-kept-tell", () => openCaptureSheet())}
      </article>
      {/* The whole goal card is the goal picker's door, as production's was. */}
      <button type="button" className="obj ms-goal" data-testid="portrait-goals-edit" onClick={onEditGoal}>
        <span className="oh">
          <span className="ogi" aria-hidden="true"><Icon name="bookmark" size={17} /></span>
          <span className="ok">{t("elev.goal.profile.title")}</span>
        </span>
        <span className="ol">{goal ? <bdi>{goalLabel(goal, t)}</bdi> : t("elev.goal.profile.empty")}</span>
        {next && <span className="ms-obj-src portrait-card-next" data-testid="portrait-goal-next">{t("companion.milestones.goalNext", { step: next })}</span>}
        {goal && <span className="ms-obj-src" data-testid="portrait-goal-src">{t("companion.milestones.srcGoal")}</span>}
        {goal && <span className="oa b">{t("elev.goal.profile.edit")}</span>}
      </button>
      {telling && <TellArborMore onClose={() => setTelling(false)} />}
    </div>
  );
}
