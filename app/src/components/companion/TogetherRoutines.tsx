import React, { useEffect, useMemo, useRef, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { track } from "../../lib/analytics";
import { ageMonthsFromProfile } from "../../lib/childAge";
import { localized, type Routine } from "../../lib/routines";
import {
  routineDayKey,
  routineIdOfPlan,
  routineRunToday,
  routineStepCount,
  routineTemplatesForAge,
  routineToPlan,
} from "../../lib/routineTemplates";
import type { ActionPlan } from "../../types";
import { BrandChip, BRAND_CHIP_INK, brandChipShape } from "../ui/BrandChip";
import Icon from "../ui/Icon";
import { Modal } from "../ui/Modal";
import { Sheet, useCompactSurface } from "../ui/Sheet";
import RoutineRunSheet, { type RoutineStart } from "./RoutineRunSheet";
import { routineChipTone, todaysRhythm, type RhythmSlot } from "./togetherRhythm";
import "./togetherRhythm.css";

/* ════════════════════════════════════════════════════════════════════════════
   TogetherRoutines — Together's Routines filter (v4: Today's rhythm).

   v4: once the family has started a routine, the filter reads as the day:
   "Today's rhythm" lists the started routines in the order of the day (the
   part of the day each belongs to — togetherRhythm.ts; never an invented clock
   time or person), each with the routine's chip, its part of the day and
   duration, "Next up" on the first one not finished today, a check when every
   step is ticked today, one mark per step (ticked or not, today's run) and
   the next step's words. The header counts the routines finished today.
   "Add a routine" opens the routine library (every routine offered at the
   child's age, the started ones checked); a routine opens its sheet on top.
   Before anything is started, the filter is the ready-made library itself —
   the honest empty state.

   Adopt first, then run (v3 FEAT-07, unchanged): a routine's sheet offers
   "Start as a plan", which writes ONE plan-routine-<id>-<ms> plan and waits
   for the server. "In your plan" (and a place in the rhythm) only for a stored
   plan; while the start is on its way (or failed) its optimistic row is not
   counted, and a retry rewrites the same plan id.
   Counts only — the steps ticked today and the steps there are, never a share.
   ════════════════════════════════════════════════════════════════════════════ */

const SLOT_KEYS: Readonly<Record<RhythmSlot, string>> = {
  morning: "companion.together-view.rhythm-slot-morning",
  midday: "companion.together-view.rhythm-slot-midday",
  afternoon: "companion.together-view.rhythm-slot-afternoon",
  evening: "companion.together-view.rhythm-slot-evening",
  night: "companion.together-view.rhythm-slot-night",
  anytime: "companion.together-view.rhythm-slot-anytime",
};

export default function TogetherRoutines({ headingId }: { headingId?: string }) {
  const { childProfile, actionPlans = [], startRoutinePlan } = useArbor();
  const { t, uiLang } = useLanguage();
  const lang = uiLang === "he" ? "he" : "en";
  const childName = childProfile.name?.split(" ")[0] || t("companion.together-view.your-child");
  const months = ageMonthsFromProfile(childProfile);
  const templates = useMemo(() => routineTemplatesForAge(months), [months]);
  const [openedState, setOpenedState] = useState<{ childId: string; routineId: string | null }>({ childId: childProfile.id, routineId: null });
  const openedId = openedState.childId === childProfile.id ? openedState.routineId : null;
  const [libraryState, setLibraryState] = useState<{ childId: string; open: boolean }>({ childId: childProfile.id, open: false });
  const libraryOpen = libraryState.childId === childProfile.id && libraryState.open;
  const [startState, setStartState] = useState<RoutineStart | null>(null);
  const start = startState && startState.childId === childProfile.id ? startState : null;
  const latest = useRef(0);
  // One start at a time, even for a second tap that lands before a re-render.
  const inFlight = useRef<number | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  // v3 F-TOG-3: below lg a sheet rises from the bottom; the Modal stays the wide answer.
  const LibrarySurface = useCompactSurface() ? Sheet : Modal;

  const day = routineDayKey(Date.now());
  /** The stored plan started from this routine (newest first), else null. */
  const planFor = (routineId: string): ActionPlan | null => {
    // A start still on its way, or one that failed, is not "in your plan" yet.
    const unconfirmed = start && start.status !== "saved" ? start.plan.id : null;
    const stored = actionPlans.find((p) => p.id !== unconfirmed && routineIdOfPlan(p) === routineId);
    if (stored) return stored;
    return start && start.status === "saved" && start.routineId === routineId ? start.plan : null;
  };
  const rhythm = todaysRhythm(templates, planFor, day, lang);
  const finished = rhythm.filter((card) => card.complete).length;
  const opened = openedId ? templates.find((r) => r.id === openedId) ?? null : null;
  const open = (routineId: string) => setOpenedState({ childId: childProfile.id, routineId });

  const startRoutine = (routine: Routine) => {
    if (inFlight.current !== null || start?.status === "pending" || planFor(routine.id)) return;
    // A retry rewrites the failed start's plan, so the id never changes.
    const plan = start && start.routineId === routine.id && start.status === "failed"
      ? start.plan
      : routineToPlan(routine, lang, childName, Date.now());
    const id = ++latest.current;
    inFlight.current = id;
    const childId = childProfile.id;
    setStartState({ id, childId, routineId: routine.id, plan, status: "pending" });
    let request: Promise<void>;
    try { request = Promise.resolve(startRoutinePlan(plan)); } catch (error) { request = Promise.reject(error); }
    request.then(
      () => {
        if (inFlight.current === id) inFlight.current = null;
        // Counts and an id only — never the plan text.
        try { track("plan_template_start", { surface: "together", template: routine.id }); } catch { /* noop */ }
        if (!mounted.current || latest.current !== id) return;
        setStartState((s) => (s && s.id === id ? { ...s, status: "saved" } : s));
      },
      () => {
        if (inFlight.current === id) inFlight.current = null;
        if (!mounted.current || latest.current !== id) return;
        setStartState((s) => (s && s.id === id ? { ...s, status: "failed" } : s));
      },
    );
  };

  if (templates.length === 0) return null;
  const hasRhythm = rhythm.length > 0;
  return (
    <div className="together-routines" data-testid="together-routines" data-mode={hasRhythm ? "rhythm" : "library"}>
      <div className="companion-section-heading together-routines-heading">
        <div>
          <span className="companion-eyebrow">{t("companion.together-view.routines-kicker")}</span>
          <h2 id={headingId}>{hasRhythm ? t("companion.together-view.rhythm-title") : t("companion.together-view.routines-title")}</h2>
        </div>
        {hasRhythm && (
          <div className="together-rhythm-actions">
            <p className="together-rhythm-tally" data-testid="together-rhythm-tally">
              <span className="together-rhythm-count">{t("companion.together-view.rhythm-done", { done: finished, total: rhythm.length })}</span>
              <span className="together-rhythm-count-label">{t("companion.together-view.rhythm-done-label")}</span>
            </p>
            <button type="button" className="together-rhythm-add" data-testid="together-rhythm-add" aria-haspopup="dialog"
              onClick={() => setLibraryState({ childId: childProfile.id, open: true })}>
              <Icon name="add" size={18} />{t("companion.together-view.rhythm-add")}
            </button>
          </div>
        )}
      </div>
      <p className="companion-caption">
        {hasRhythm ? t("companion.together-view.rhythm-sub", { name: childName }) : t("companion.together-view.routines-sub")}
      </p>

      {hasRhythm ? (
        <>
          <ul className="together-rhythm-grid" data-testid="together-rhythm">
            {rhythm.map((card, index) => {
              const { routine } = card;
              const tone = routineChipTone(routine);
              const nextIcon = card.complete ? "check" : card.nextIcon ?? "flag";
              return (
                <li key={routine.id}>
                  <button
                    type="button"
                    className="together-rhythm-card"
                    data-routine-tile={routine.id}
                    data-in-plan="true"
                    data-next-up={card.nextUp ? "true" : "false"}
                    data-complete={card.complete ? "true" : "false"}
                    aria-haspopup="dialog"
                    style={{ ["--rhythm-ink" as string]: BRAND_CHIP_INK[tone] } as React.CSSProperties}
                    onClick={() => open(routine.id)}
                  >
                    <span className="together-rhythm-head">
                      <BrandChip icon={routine.ms} tone={tone} shape={brandChipShape(index)} size={40} />
                      <span className="together-rhythm-title">
                        <span className="together-rhythm-name" dir="auto">{localized(routine.title, lang)}</span>
                        <span className="together-rhythm-when">
                          <span className="together-rhythm-slot">{t(SLOT_KEYS[card.slot])}</span>
                          <span aria-hidden="true">·</span>
                          <span>{localized(routine.time, lang)}</span>
                        </span>
                      </span>
                      {card.nextUp && <span className="together-rhythm-next-up" data-testid="together-rhythm-next-up">{t("companion.together-view.rhythm-next-up")}</span>}
                      {card.complete && <Icon name="check_circle" size={22} fill={1} className="together-rhythm-done" aria-label={t("companion.together-view.rhythm-done-aria")} />}
                    </span>
                    <span className="together-rhythm-marks" role="img" aria-label={t("companion.together-view.rhythm-steps-aria", { done: card.done.length, total: card.total })}>
                      {Array.from({ length: card.total }, (_, step) => (
                        <span key={step} className="together-rhythm-mark" data-ticked={card.done.includes(step) ? "true" : "false"} />
                      ))}
                    </span>
                    <span className="together-rhythm-next">
                      <Icon name={nextIcon} size={17} />
                      <span dir="auto">{card.nextStep ? t("companion.together-view.rhythm-next-step", { step: card.nextStep }) : t("companion.together-view.rhythm-all-done")}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="together-rhythm-why" data-testid="together-rhythm-why">
            <BrandChip icon="eco" tone="green" size={32} />
            <p dir="auto"><b>{t("companion.together-view.rhythm-why-label")}</b> {t("companion.together-view.rhythm-why", { name: childName })}</p>
          </div>
        </>
      ) : (
        <ul className="together-routine-grid">
          {templates.map((routine) => (
            <li key={routine.id}>
              <button
                type="button"
                className="together-routine-tile"
                data-routine-tile={routine.id}
                data-in-plan="false"
                aria-haspopup="dialog"
                onClick={() => open(routine.id)}
              >
                <span className="together-routine-icon"><Icon name={routine.ms} size={26} /></span>
                <span className="together-routine-name" dir="auto">{localized(routine.title, lang)}</span>
                <span className="together-routine-meta">{t("companion.together-view.routines-steps", { n: routine.steps.length, time: localized(routine.time, lang) })}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {libraryOpen && (
        <LibrarySurface open onClose={() => setLibraryState({ childId: childProfile.id, open: false })} title={t("companion.together-view.library-title")}>
          <div className="companion-preview together-library" data-testid="together-library" dir={lang === "he" ? "rtl" : "ltr"}>
            <p>{t("companion.together-view.library-sub", { name: childName })}</p>
            <ul className="together-library-grid">
              {templates.map((routine, index) => {
                const plan = planFor(routine.id);
                const done = plan ? routineRunToday(plan, day).length : 0;
                const left = plan ? Math.max(0, routineStepCount(plan) - done) : 0;
                return (
                  <li key={routine.id}>
                    <button type="button" className="together-library-item" data-library-routine={routine.id} data-in-plan={plan ? "true" : "false"}
                      aria-haspopup="dialog" onClick={() => open(routine.id)}>
                      <BrandChip icon={routine.ms} tone={routineChipTone(routine)} shape={brandChipShape(index)} size={34} />
                      <span className="together-library-text">
                        <span className="together-routine-name" dir="auto">{localized(routine.title, lang)}</span>
                        <span className="together-routine-meta">
                          {plan ? t("elev.plans.routineRun.today", { done, left }) : t("companion.together-view.routines-steps", { n: routine.steps.length, time: localized(routine.time, lang) })}
                        </span>
                      </span>
                      {plan && <Icon name="check_circle" size={20} fill={1} className="together-library-in-plan" aria-label={t("companion.together-view.routines-in-plan")} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </LibrarySurface>
      )}
      {opened && (
        <RoutineRunSheet
          routine={opened}
          plan={planFor(opened.id)}
          start={start && start.routineId === opened.id ? start : null}
          childName={childName}
          onStart={() => startRoutine(opened)}
          onClose={() => setOpenedState({ childId: childProfile.id, routineId: null })}
        />
      )}
    </div>
  );
}
