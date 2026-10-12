import React from "react";
import { useLanguage } from "../../context/LanguageContext";
import { localized, type Routine } from "../../lib/routines";
import type { ActionPlan } from "../../types";
import RoutineRunBoard from "../plans/RoutineRunBoard";
import Icon from "../ui/Icon";
import { Modal } from "../ui/Modal";
import { PendingLine, Receipt } from "../ui/Receipt";

/* ════════════════════════════════════════════════════════════════════════════
   RoutineRunSheet — v3 FEAT-07: one ready-made routine, opened from its
   Together tile.

   Not started yet: the why-line, the steps as a read-only preview and ONE
   button, "Start as a plan". The start state lives in TogetherRoutines (the
   tile reads it too); "In your plan" shows only once the plan write resolved,
   a rejected write offers the same button again with the same plan id, so a
   retry never makes a second plan.
   Started: the run board (RoutineRunBoard) — the one place its steps tick.
   The footer names the routine's areas as a plain label and closes the sheet.
   No contract stamp here: Together keeps its one move on the invitation.
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
    <Modal open onClose={onClose} title={title}>
      <div className="companion-preview together-routine-sheet" data-testid="together-routine-sheet" data-routine={routine.id} dir={lang === "he" ? "rtl" : "ltr"}>
        <p dir="auto">{why}</p>
        {plan && start?.status === "saved" && (
          <Receipt testId="together-routine-started" size="sm">{t("companion.together-view.routines-in-plan")}</Receipt>
        )}
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
            <button type="button" className="companion-primary" data-testid="together-routine-start" disabled={pending} onClick={onStart}>
              <Icon name="flag" size={18} />
              {failed ? t("companion.together-view.routines-retry") : t("companion.together-view.routines-start")}
            </button>
            <PendingLine active={pending} testId="together-routine-pending" className="companion-caption">{t("companion.together-view.routines-starting")}</PendingLine>
            {failed && <p role="alert" className="companion-caption" data-testid="together-routine-failed">{t("companion.together-view.routines-start-failed")}</p>}
          </>
        )}
        <footer className="together-routine-sheet-foot">
          <span className="companion-caption">{t("companion.together-view.routines-areas", { areas: localized(routine.domains, lang) })}</span>
          <button type="button" className="companion-text-button" data-testid="together-routine-close" onClick={onClose}>
            <Icon name="close" size={18} />
            {t("companion.together-view.routines-close")}
          </button>
        </footer>
      </div>
    </Modal>
  );
}
