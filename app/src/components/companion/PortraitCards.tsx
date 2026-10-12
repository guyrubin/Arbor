import React, { useMemo, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import type { KeepsakeDoc } from "../../lib/firstsKeepsake";
import { fmtDay } from "../../lib/formatDate";
import { keptThings } from "../../lib/kept/keptThings";
import { milestoneText } from "../../lib/milestoneData";
import type { ObservationSources } from "../../lib/observations";
import { focusGoal, goalLabel } from "../../practice/goalBuilder";
import TellArborMore from "../describe/TellArborMore";
import { Icon } from "../ui/Icon";
import { latestKeptMoment, latestStrength } from "./milestonesModel";
import "./developmentMap.css";

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
 *     icon (bookmark) and the source line follow the mock.
 *
 * A card with nothing to show says "Not told yet" and offers "Tell Arbor"
 * (the describe conversation for a strength, the capture sheet for a
 * moment). Nothing here is generated: every line is the parent's own words.
 * The first two cards are wide-screen only (CSS); the goal card stays on a
 * phone, because the goal picker has no other door there.
 */
export interface PortraitCardsProps {
  /** The record the page already loaded (useObservationRecord), read, never refetched. */
  sources: ObservationSources;
  onEditGoal: () => void;
}

export default function PortraitCards({ sources, onEditGoal }: PortraitCardsProps) {
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
  const goal = focusGoal(childProfile.activeGoals ?? []);
  const notTold = (testId: string, onTell: () => void) => (
    <>
      <p className="portrait-card-empty">{t("companion.milestones.notTold")}</p>
      <button type="button" className="portrait-card-tell" data-testid={testId} onClick={onTell}>
        <Icon name="add_comment" size={16} />
        <span>{t("companion.milestones.tell")}</span>
      </button>
    </>
  );
  return (
    <div className="portrait-cards" data-testid="portrait-cards">
      <article className="portrait-card portrait-card-wide" data-testid="portrait-card-strength">
        <p className="portrait-card-label">
          <Icon name="auto_awesome" size={18} />
          <span>{t("companion.milestones.card.strength")}</span>
        </p>
        {strength ? (
          <>
            <p className="portrait-card-words" dir="auto">{strength.text}</p>
            <p className="portrait-card-src">
              {strength.at ? t("companion.milestones.srcWords", { date: fmtDay(strength.at, uiLang) }) : t("companion.milestones.srcWordsUndated")}
            </p>
          </>
        ) : notTold("portrait-card-strength-tell", () => setTelling(true))}
      </article>
      <article className="portrait-card portrait-card-wide" data-testid="portrait-card-kept">
        <p className="portrait-card-label">
          <Icon name="edit_note" size={18} />
          <span>{t("companion.milestones.card.kept")}</span>
        </p>
        {kept ? (
          <>
            <p className="portrait-card-words" dir="auto">{kept.text}</p>
            {kept.at && <p className="portrait-card-src">{t("companion.milestones.srcParent", { date: fmtDay(kept.at, uiLang) })}</p>}
          </>
        ) : notTold("portrait-card-kept-tell", () => openCaptureSheet())}
      </article>
      <button type="button" className="portrait-card portrait-card-goal" data-testid="portrait-goals-edit" onClick={onEditGoal}>
        <span className="portrait-card-label">
          <Icon name="bookmark" size={18} />
          <span>{t("elev.goal.profile.title")}</span>
        </span>
        <span className="portrait-card-words">{goal ? <bdi>{goalLabel(goal, t)}</bdi> : t("elev.goal.profile.empty")}</span>
        {goal && (
          <span className="portrait-card-src" data-testid="portrait-goal-src">
            {t("companion.milestones.srcGoal")} · <span className="portrait-card-change">{t("elev.goal.profile.edit")}</span>
          </span>
        )}
      </button>
      {telling && <TellArborMore onClose={() => setTelling(false)} />}
    </div>
  );
}
