/** B-GROWTH-40: one explicit parent choice, earlier records retained.
 * Goal selection never changes P5's practice/program ownership or AI context.
 * Flat observation counts only; no deletion, area colour or progress verdict.
 */

import React, { useState, useMemo, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { useDialog } from "../../hooks/useDialog";
import { createPortal } from "react-dom";
import { AnimatePresence } from "motion/react";
import {
  GOAL_TILES,
  focusGoal,
  goalLabel,
  prefillGoalIdsForConcern,
  type ActiveGoal,
} from "../../practice/goalBuilder";
import type { BehaviorLog } from "../../types";
import { domainForBehaviorType } from "../../playbank/select";
import { useLanguage } from "../../context/LanguageContext";
import { useProfile, type GoalAttempt } from "../../context/ProfileContext";
import { goalGlyph } from "./GoalFocusLine";

// ── Token shorthands ─────────────────────────────────────────────────────────

const INK = "var(--arbor-ink)";
const MUTED = "var(--arbor-muted)";
const RULE = "var(--arbor-rule)";
const RULE_STRONG = "var(--arbor-rule-strong)";
const PAPER = "var(--arbor-paper-elevated)";
const PAPER_DEEP = "var(--arbor-paper-deep)";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Count how many BehaviorLogs have a PlayDomain that matches the goal's domainId.
 * Gate §B: returns a flat integer only — never a percentage, score, or trend.
 */
function countLinkedObservations(goal: ActiveGoal, logs: BehaviorLog[]): number {
  return logs.filter((l) => {
    const d = domainForBehaviorType(l.behaviorType);
    return d === goal.domainId;
  }).length;
}

/**
 * ISO timestamp of the most recent linked observation, or null.
 * Used for the "Last linked: X days ago" display (gate §B: timestamp only, no score).
 */
function lastLinkedObservation(goal: ActiveGoal, logs: BehaviorLog[]): string | null {
  const matched = logs
    .filter((l) => domainForBehaviorType(l.behaviorType) === goal.domainId)
    .map((l) => l.timestamp)
    .sort()
    .reverse();
  return matched[0] ?? null;
}

function daysAgoLabel(isoTs: string | null, t: (key: string, vars?: Record<string, string | number>) => string): string {
  if (!isoTs) return "";
  const diffMs = Date.now() - new Date(isoTs).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days === 0) return t("elev.goal.modal.today");
  if (days === 1) return t("elev.goal.modal.yesterday");
  return t("elev.goal.modal.daysAgo", { n: days });
}

// ── Component ────────────────────────────────────────────────────────────────

export interface GoalBuilderModalProps {
  open: boolean;
  onClose: () => void;
  childId: string;
  childName: string;
  concernId?: string;
  behaviorLogs?: BehaviorLog[];
}

type PickerScope = { owner: object; childId: string; open: boolean; closed: boolean; flight: boolean };
type Choice = { goal: Omit<ActiveGoal, "addedAt">; basis: string; scope: PickerScope; restored?: GoalAttempt };

export default function GoalBuilderModal({ open, onClose, childId, childName, concernId, behaviorLogs = [] }: GoalBuilderModalProps) {
  const { t, uiLang } = useLanguage();
  const { goalSession: owner, getGoalSelection, saveChildGoal, cancelGoalAttempt } = useProfile();
  const selection = getGoalSelection(childId);
  const activeGoals = selection?.goals ?? [];
  const attempt = selection?.attempt;
  const firstName = (childName || t("elev.goal.modal.yourChild")).split(" ")[0];
  const current = focusGoal(activeGoals);
  const version = JSON.stringify(activeGoals);
  const [choiceState, setChoice] = useState<Choice | null>(null);
  const saving = attempt?.status === "pending";
  const error = attempt?.status === "failed";
  const confirmationRef = useRef<HTMLDivElement | null>(null);
  const scopeRef = useRef<PickerScope>({ owner, childId, open, closed: false, flight: false });
  if (scopeRef.current.owner !== owner || scopeRef.current.childId !== childId || scopeRef.current.open !== open) {
    scopeRef.current = { owner, childId, open, closed: false, flight: false };
  }
  const scope = scopeRef.current;
  const choice = choiceState?.scope === scope ? choiceState : null;
  const live = useRef(false);
  const latest = useRef({ choice, version });
  latest.current = { choice, version };
  const valid = () => live.current && scopeRef.current === scope && scope.open && !scope.closed;
  const close = () => { if (!valid()) return; scope.closed = true; onClose(); };
  const { ref: dialogRef, requestClose, onBackdropClick } = useDialog({ open, onClose: close });
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  useEffect(() => { setChoice(null); }, [scope]);
  useEffect(() => {
    if (attempt) setChoice(previous => previous?.scope === scope && !previous.restored
      ? previous : { goal: attempt.goal, basis: attempt.basis, scope, restored: attempt });
    else setChoice(previous => previous?.restored ? null : previous);
  }, [scope, attempt]);
  const prefillIds = useMemo(() => concernId ? prefillGoalIdsForConcern(concernId) : [], [concernId]);
  const earlier = activeGoals.filter(goal => goal.goalId !== current?.goalId);
  // The clicked tile leaves the DOM. Keep keyboard focus in the replacement
  // question, and return to the dialog when Cancel restores the choices.
  useEffect(() => { if (choice) confirmationRef.current?.focus(); }, [choice]);
  const choose = (goal: Omit<ActiveGoal, "addedAt">) => {
    if (!valid() || scope.flight || saving || !selection) return;
    const next = { goal, basis: version, scope };
    latest.current.choice = next; setChoice(next);
  };
  const save = async () => {
    if (!choice || !valid() || scope.flight || saving || latest.current.choice !== choice) return;
    if (latest.current.version !== choice.basis) {
      const next = { goal: choice.goal, basis: latest.current.version, scope };
      latest.current.choice = next; setChoice(next); return;
    }
    scope.flight = true;
    try {
      const result = await saveChildGoal(childId, choice.goal, choice.basis);
      if (!valid()) return;
      if (result === "saved") close();
      else if (result === "changed") {
        const source = getGoalSelection(childId);
        if (source) { const next = { goal: choice.goal, basis: JSON.stringify(source.goals), scope }; latest.current.choice = next; setChoice(next); }
      }
    } finally {
      scope.flight = false;
    }
  };
  const cancel = () => { if (valid() && !scope.flight && !saving) { cancelGoalAttempt(childId); latest.current.choice = null; setChoice(null); dialogRef.current?.focus(); } };
  const obsCount = current ? countLinkedObservations(current, behaviorLogs) : 0;
  const lastTs = current ? lastLinkedObservation(current, behaviorLogs) : null;

  return createPortal(<AnimatePresence>{open && <motion.div
    className="arbor-app fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm"
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    onClick={onBackdropClick} data-arbor-dialog-layer
  >
    <motion.div ref={dialogRef} role="dialog" aria-modal="true" aria-label={t("elev.goal.profile.title")} tabIndex={-1}
      dir={uiLang === "he" ? "rtl" : "ltr"}
      className="w-full sm:max-w-lg rounded-t-[22px] sm:rounded-3xl overflow-y-auto"
      style={{ background: PAPER, border: `1px solid ${RULE}`, boxShadow: "var(--shadow-lg)", maxHeight: "90vh" }}
      initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }}
      transition={{ type: "spring", damping: 28, stiffness: 300 }} onClick={event => event.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-3 p-5" style={{ borderBottom: `1px solid ${RULE}` }}>
        <h3 className="text-lg leading-tight" style={{ fontFamily: "var(--font-display)", color: INK }}>{t("elev.goal.profile.title")}</h3>
        <button type="button" onClick={requestClose} aria-label={t("aria.close")} className="shrink-0 min-w-11 min-h-11 rounded-lg" style={{ border: `1px solid ${RULE}`, color: MUTED }}><Icon name="close" size={18} /></button>
      </div>
      <div className="p-5 space-y-5">
        {current && <div data-testid="goal-current" className="space-y-2">
          <p className="flex items-start gap-2 text-base" style={{ color: INK }}><Icon name={goalGlyph(current)} size={20} /><bdi>{goalLabel(current, t)}</bdi></p>
          <p className="text-xs" style={{ color: MUTED }}>{obsCount === 0 ? t("elev.goal.modal.obs.none") : obsCount === 1 ? t("elev.goal.modal.obs.one") : t("elev.goal.modal.obs.many", { n: obsCount })}{lastTs && ` · ${t("elev.goal.modal.lastLinked", { when: daysAgoLabel(lastTs, t) })}`}</p>
        </div>}
        {choice ? <div ref={confirmationRef} tabIndex={-1} data-testid="goal-confirm" className="space-y-3" aria-live="polite">
          <p className="text-sm" style={{ color: INK }}>{current && current.goalId !== choice.goal.goalId ? t("elev.goal.modal.replace", { goal: goalLabel(current, t) }) : t("elev.goal.modal.keepNotes")}</p>
          <p className="text-base font-semibold" style={{ color: INK }}><bdi>{goalLabel(choice.goal, t)}</bdi></p>
          {error && <p role="alert" className="text-sm" style={{ color: INK }}>{t("elev.goal.modal.saveError")}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" data-testid="goal-save" disabled={saving} onClick={() => void save()} className="min-h-11 rounded-xl px-4 py-2 text-sm font-semibold" style={{ background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" }}>{saving ? t("elev.goal.modal.saving") : error ? t("elev.goal.modal.retry") : t("elev.goal.modal.makeCurrent")}</button>
            <button type="button" data-testid="goal-cancel" disabled={saving} onClick={cancel} className="min-h-11 rounded-xl px-4 py-2 text-sm" style={{ color: MUTED, border: `1px solid ${RULE}` }}>{t("elev.goal.modal.cancel")}</button>
          </div>
        </div> : <>
          <div>
            <p className="mb-3 text-sm" style={{ color: MUTED }}>{t("elev.goal.modal.pick", { name: firstName })}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {GOAL_TILES.filter(tile => !activeGoals.some(goal => goal.goalId === tile.id)).map(tile => <button type="button" key={tile.id} data-testid={`goal-choice-${tile.id}`}
                disabled={saving || !selection} onClick={() => choose({ goalId: tile.id, label: tile.label, domainId: tile.domainId })}
                className="min-h-11 flex items-start gap-3 rounded-xl p-3 text-start text-sm"
                style={{ background: PAPER_DEEP, border: `1px solid ${prefillIds.includes(tile.id) ? RULE_STRONG : RULE}`, color: INK }}
              ><Icon name={goalGlyph(tile)} size={20} /><span>{goalLabel({ goalId: tile.id, label: tile.label }, t)}</span></button>)}
            </div>
          </div>
          {earlier.length > 0 && <details data-testid="goal-earlier">
            <summary className="min-h-11 py-3 text-sm font-semibold cursor-pointer" style={{ color: INK }}>{t("elev.goal.modal.earlier")}</summary>
            <div className="space-y-3">{earlier.map((goal, index) => <div key={`${goal.goalId}:${index}`} className="border-t pt-3" style={{ borderColor: RULE }}>
              <p className="text-sm" style={{ color: INK }}><bdi>{goalLabel(goal, t)}</bdi></p>
              <button type="button" data-testid={`goal-earlier-${goal.goalId}`} disabled={saving || !selection} onClick={() => choose(goal)} className="min-h-11 py-2 text-start text-sm font-semibold" style={{ color: "var(--arbor-clay)" }}>{t("elev.goal.modal.makeCurrent")}</button>
            </div>)}</div>
          </details>}
          <p className="text-xs leading-relaxed" style={{ color: MUTED }}>{t("elev.goal.modal.keepNotes")}</p>
        </>}
      </div>
    </motion.div>
  </motion.div>}</AnimatePresence>, document.body);
}
