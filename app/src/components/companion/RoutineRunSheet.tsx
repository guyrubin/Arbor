import React from "react";
import { useLanguage } from "../../context/LanguageContext";
import { localized, type Routine } from "../../lib/routines";
import type { ActionPlan } from "../../types";
import RoutineRunBoard from "../plans/RoutineRunBoard";
import Icon from "../ui/Icon";
import { Sheet } from "../ui/Sheet";
import { PendingLine, Receipt } from "../ui/Receipt";

/* ════════════════════════════════════════════════════════════════════════════
   RoutineRunSheet — v3 FEAT-07: one ready-made routine, opened from its
   Together tile.

   v3 F-TOG-2: a sheet at every width (the shared bottom sheet on a phone; the
   stylesheet lifts it to a centred card from 768 px). Its footer names what the
   routine feeds (a plain chip, never a verdict) and holds the one action.

   Not started yet: the why-line, the steps as a read-only preview and ONE
   button, "Make it a plan". The start state lives in TogetherRoutines (the
   tile reads it too); "In your plan" shows only once the plan write resolved,
   a rejected write offers the same button again with the same plan id, so a
   retry never makes a second plan.
   Started: the run board (RoutineRunBoard) — the one place its steps tick and
   reset. No contract stamp here: Together keeps its one move on the invitation.
   Hook-free apart from the language (the start-flow suite calls it directly).
   ════════════════════════════════════════════════════════════════════════════ */

/** A routine start in flight, held by TogetherRoutines per child. */
export type RoutineStart = {
  id: number;
  childId: string;
  routineId: string;
  /** The plan this start writes (kept for a retry, so the id never changes). */
  plan: ActionPlan;
  status: "pending" | "saved" | "failed";
};

export default function RoutineRunSheet({ routine, plan, start, childName, onStart, onClose }: {
  routine: Routine;
  /** The routine's plan once it is stored, else null. */
  plan: ActionPlan | null;
  /** This routine's start, when one was made on this page. */
  start: RoutineStart | null;
  childName: string;
  onStart: () => void;
  onClose: () => void;
}) {
  const { t, uiLang } = useLanguage();
  const lang = uiLang === "he" ? "he" : "en";
  const title = localized(routine.title, lang);
  const why = localized(routine.why, lang).replace(/\{name\}/g, childName);
  const pending = start?.status === "pending";
  const failed = start?.status === "failed";
  return (
    <Sheet open onClose={onClose} title={title}>
      <div className="together-sheet companion-preview together-routine-sheet" data-testid="together-routine-sheet" data-routine={routine.id} dir={lang === "he" ? "rtl" : "ltr"}>
        <p dir="auto">{why}</p>
        {plan ? (
          <RoutineRunBoard plan={plan} />
        ) : (
          <>
            <h3 className="together-routine-sheet-label">{t("companion.together-view.routines-preview")}</h3>
            <ol className="together-routine-steps">
              {routine.steps.map((step) => (
                <li key={step.key}>
                  <Icon name={step.ms} size={20} />
                  <span dir="auto">{localized(step.label, lang)}</span>
                </li>
              ))}
            </ol>
            <PendingLine active={pending} testId="together-routine-pending" className="companion-caption">{t("companion.together-view.routines-starting")}</PendingLine>
            {failed && <p role="alert" className="companion-caption" data-testid="together-routine-failed">{t("companion.together-view.routines-start-failed")}</p>}
          </>
        )}
        <footer className="together-routine-sheet-foot">
          <span className="together-feeds-chip" data-testid="together-routine-feeds" dir="auto">
            <Icon name="eco" size={16} />
            {t("companion.together-view.routines-feeds", { areas: localized(routine.domains, lang) })}
          </span>
          <div className="together-routine-sheet-actions">
            {!plan ? (
              <button type="button" className="companion-primary" data-testid="together-routine-start" disabled={pending} onClick={onStart}>
                <Icon name="flag" size={18} />
                {failed ? t("companion.together-view.routines-retry") : t("companion.together-view.routines-make-plan")}
              </button>
            ) : start?.status === "saved" ? (
              <Receipt testId="together-routine-started" size="sm" icon="check_circle">{t("companion.together-view.routines-in-plan")}</Receipt>
            ) : (
              <span className="together-routine-in-plan" data-testid="together-routine-sheet-in-plan">
                <Icon name="check_circle" size={18} />
                {t("companion.together-view.routines-in-plan")}
              </span>
            )}
            <button type="button" className="companion-text-button" data-testid="together-routine-close" onClick={onClose}>
              <Icon name="close" size={18} />
              {t("companion.together-view.routines-close")}
            </button>
          </div>
        </footer>
      </div>
    </Sheet>
  );
}
