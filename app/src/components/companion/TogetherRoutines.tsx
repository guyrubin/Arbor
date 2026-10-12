import React, { useEffect, useMemo, useRef, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { track } from "../../lib/analytics";
import { ageMonthsFromProfile } from "../../lib/childAge";
import { localized, type Routine } from "../../lib/routines";
import { HASH_ALIASES, routeHash, splitHash } from "../../lib/routes";
import { PASTEL } from "../../lib/tokens";
import {
  routineDayKey,
  routineIdOfPlan,
  routineRunToday,
  routineStepCount,
  routineTemplatesForAge,
  routineToPlan,
} from "../../lib/routineTemplates";
import type { ActionPlan } from "../../types";
import Icon from "../ui/Icon";
import RoutineRunSheet, { type RoutineStart } from "./RoutineRunSheet";

/* ════════════════════════════════════════════════════════════════════════════
   TogetherRoutines — v3 FEAT-07: the ready-made routines on Together.

   v3 F-TOG-1: Together renders it inside its own module (together-routines),
   between the stories and the away-from-the-screen ideas; it holds no
   data-module and no contract move of its own. It owns the section heading
   (the kicker and an h2 the section is labelled by) in both modes.
   v3 F-TOG-2: both modes show every routine offered at the child's age
   (routineTemplatesForAge: no nap board past 4, potty only 18–48 m), each on
   its own tone; the Routines pill is the Shell's, so there is no "all" link.
   #/plans lands on this pill (F-SHELL-1) and opens the newest routine plan's
   sheet, once, when one exists.

   Adopt first, then run: a tile opens its sheet; "Make it a plan" writes ONE
   plan-routine-<id>-<ms> plan and waits for the server. A tile says "In your
   plan" only for a stored plan; while the start is on its way (or failed) its
   optimistic row is not counted, and a retry rewrites the same plan id.
   The tile's today line is counts only (ticked, still to go) — never a share.
   ════════════════════════════════════════════════════════════════════════════ */

export default function TogetherRoutines({ mode, headingId }: { mode: "all" | "routines"; headingId?: string }) {
  const { childProfile, actionPlans = [], startRoutinePlan } = useArbor();
  const { t, uiLang } = useLanguage();
  const lang = uiLang === "he" ? "he" : "en";
  const childName = childProfile.name?.split(" ")[0] || t("companion.together-view.your-child");
  const months = ageMonthsFromProfile(childProfile);
  const templates = useMemo(() => routineTemplatesForAge(months), [months]);
  const [openedState, setOpenedState] = useState<{ childId: string; routineId: string | null }>({ childId: childProfile.id, routineId: null });
  const openedId = openedState.childId === childProfile.id ? openedState.routineId : null;
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

  // v3 F-TOG-2: an arrival on #/plans (or #/routines, an alias of either, or
  // the pill address carrying sheet=routine) opens the newest routine plan's
  // sheet once, then names this pill in the address. The plans may still be
  // loading: a later snapshot opens it. Any tile the parent opens first ends
  // the arrival.
  const arrived = useRef(false);
  useEffect(() => {
    if (arrived.current || typeof window === "undefined") return;
    let key = "";
    let sheet: string | null = null;
    try { const hash = splitHash(window.location.hash); key = hash.key.toLowerCase(); sheet = hash.query.get("sheet"); } catch { return; }
    const route = HASH_ALIASES[key] ?? key;
    if (route !== "plans" && route !== "routines" && sheet !== "routine") { arrived.current = true; return; }
    const newest = actionPlans
      .map((plan) => ({ routineId: routineIdOfPlan(plan), at: Number(/-(\d{10,})$/.exec(plan.id)?.[1] ?? 0) }))
      .filter((entry) => entry.routineId !== null && templates.some((routine) => routine.id === entry.routineId))
      .sort((a, b) => b.at - a.at)[0];
    if (!newest) return;
    arrived.current = true;
    setOpenedState({ childId: childProfile.id, routineId: newest.routineId });
    try { window.history.replaceState(window.history.state, "", `#${routeHash("practice", { f: "routines" })}`); } catch { /* the sheet is open either way */ }
  }, [actionPlans, templates, childProfile.id]);

  const day = routineDayKey(Date.now());
  /** The stored plan started from this routine (newest first), else null. */
  const planFor = (routineId: string): ActionPlan | null => {
    // A start still on its way, or one that failed, is not "in your plan" yet.
    const unconfirmed = start && start.status !== "saved" ? start.plan.id : null;
    const stored = actionPlans.find((p) => p.id !== unconfirmed && routineIdOfPlan(p) === routineId);
    if (stored) return stored;
    return start && start.status === "saved" && start.routineId === routineId ? start.plan : null;
  };
  const adopted = templates.filter((r) => planFor(r.id) !== null);
  const ordered = [...adopted, ...templates.filter((r) => planFor(r.id) === null)];
  const tiles = ordered;
  const opened = openedId ? templates.find((r) => r.id === openedId) ?? null : null;

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
  return (
    <div className="together-routines" data-testid="together-routines" data-mode={mode}>
      <div className="companion-section-heading together-routines-heading">
        <div>
          <span className="companion-eyebrow">{t("companion.together-view.routines-kicker")}</span>
          <h2 id={headingId}>{t("companion.together-view.routines-title")}</h2>
        </div>
      </div>
      <p className="companion-caption">{t("companion.together-view.routines-sub")}</p>
      <ul className="together-routine-grid">
        {tiles.map((routine) => {
          const plan = planFor(routine.id);
          const done = plan ? routineRunToday(plan, day).length : 0;
          const left = plan ? Math.max(0, routineStepCount(plan) - done) : 0;
          return (
            <li key={routine.id}>
              <button
                type="button"
                className="together-routine-tile"
                data-routine-tile={routine.id}
                data-in-plan={plan ? "true" : "false"}
                aria-haspopup="dialog"
                onClick={() => { arrived.current = true; setOpenedState({ childId: childProfile.id, routineId: routine.id }); }}
              >
                <span className="together-routine-icon" style={{ background: PASTEL[routine.tone].soft, color: PASTEL[routine.tone].ink }}><Icon name={routine.ms} size={24} /></span>
                <span className="together-routine-name" dir="auto">{localized(routine.title, lang)}</span>
                <span className="together-routine-meta">{t("companion.together-view.routines-steps", { n: routine.steps.length, time: localized(routine.time, lang) })}</span>
                {plan && (
                  <span className="together-routine-in-plan" data-testid="together-routine-in-plan">
                    <Icon name="check_circle" size={16} />{t("companion.together-view.routines-in-plan")}
                  </span>
                )}
                {plan && <span className="together-routine-meta" data-testid="together-routine-today">{t("elev.plans.routineRun.today", { done, left })}</span>}
              </button>
            </li>
          );
        })}
      </ul>
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
