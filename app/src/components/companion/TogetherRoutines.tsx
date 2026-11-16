import React, { useEffect, useMemo, useRef, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { track } from "../../lib/analytics";
import { useHashQuery } from "../../hooks/useHashQuery";
import { routeHash } from "../../lib/routes";
import { ageMonthsFromProfile } from "../../lib/childAge";
import { localized, type Routine } from "../../lib/routines";
import { routineDayKey, routineIdOfPlan, routineTemplatesForAge, routineToPlan } from "../../lib/routineTemplates";
import type { ActionPlan } from "../../types";
import Icon from "../ui/Icon";
import { LivingForm } from "../../design/primitives";
import type { Composition } from "../../design/useComposition";
import RoutineRunSheet, { type RoutineStart } from "./RoutineRunSheet";
import { routineSlot, todaysRhythm, type RhythmCard, type RhythmSlot } from "./togetherRhythm";
import { FITS_COPY } from "./nowV41Copy";
import { clockOf, dayPart, routineForPart } from "./rightNowModel";
import { routineFace } from "../together/routineArt";
import { TOGETHER_COPY } from "../together/togetherCopy";
import "../together/together.css";

/* ════════════════════════════════════════════════════════════════════════════
   TogetherRoutines — Together › Routines, v10.1: the day map.

   Every ready-made routine offered at the child's age is drawn ONCE, as a card
   in the band of the day it belongs to (Morning · Afternoon · Evening · When
   it comes up — the production part of the day, togetherRhythm.ROUTINE_SLOT).
   A card shows the routine's steps as a small path of marks; once the routine
   is a plan, the marks ticked today fill in (the run board's own ticks).

   v4.1 Fits right now stays: the started routine of this part of the day with
   a step still open (rightNowModel.routineForPart, the same rule as Now) is
   that same card, opened in place, with its steps numbered and the one move.

   Adopt first, then run (v3 FEAT-07, unchanged): a card opens the routine's
   sheet; "Start as a plan" writes ONE plan-routine-<id>-<ms> plan and waits for
   the server; a retry rewrites the same plan id; the plan appears under
   Now › Plans. Counts only — never a share or a score.
   ════════════════════════════════════════════════════════════════════════════ */

type Band = "morning" | "afternoon" | "evening" | "anytime";
const BANDS: readonly Band[] = ["morning", "afternoon", "evening", "anytime"];
const BAND_OF: Readonly<Record<RhythmSlot, Band>> = {
  morning: "morning",
  midday: "afternoon",
  afternoon: "afternoon",
  evening: "evening",
  night: "evening",
  anytime: "anytime",
};
const BAND_ICON: Readonly<Record<Band, string>> = { morning: "wb_sunny", afternoon: "light_mode", evening: "dark_mode", anytime: "bolt" };

export default function TogetherRoutines({ composition, headingId, primaryMoveProps }: {
  composition: Composition;
  headingId?: string;
  /** The route's one move (#/practice "start-routine"), stamped on each routine card by the screen. */
  primaryMoveProps?: Record<string, string>;
}) {
  const { childProfile, actionPlans = [], startRoutinePlan } = useArbor();
  const { t, uiLang } = useLanguage();
  const lang = uiLang === "he" ? "he" : "en";
  const copy = TOGETHER_COPY[lang];
  const phone = composition === "phone";
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

  // Read per render (as the day key always was); the map is not a long-lived clock face.
  const clockNow = new Date();
  const day = routineDayKey(clockNow.getTime());
  /** The stored plan started from this routine (newest first), else null. */
  const planFor = (routineId: string): ActionPlan | null => {
    // A start still on its way, or one that failed, is not "in your plan" yet.
    const unconfirmed = start && start.status !== "saved" ? start.plan.id : null;
    const stored = actionPlans.find((p) => p.id !== unconfirmed && routineIdOfPlan(p) === routineId);
    if (stored) return stored;
    return start && start.status === "saved" && start.routineId === routineId ? start.plan : null;
  };
  const rhythm = todaysRhythm(templates, planFor, day, lang);
  const fits = routineForPart(rhythm, dayPart(clockNow.getHours()));
  const opened = openedId ? templates.find((r) => r.id === openedId) ?? null : null;
  const open = (routineId: string) => setOpenedState({ childId: childProfile.id, routineId });
  // v4.1: Now's Right now opens a routine by address (#/practice?routine=<id>),
  // once per child and routine; closing the sheet drops the routine from the
  // address, so Back never reopens it.
  const requestedRoutine = useHashQuery().get("routine");
  const handledRoutine = useRef<string | null>(null);
  useEffect(() => {
    if (!requestedRoutine || !templates.some((r) => r.id === requestedRoutine)) return;
    const key = `${childProfile.id}:${requestedRoutine}`;
    if (handledRoutine.current === key) return;
    handledRoutine.current = key;
    setOpenedState({ childId: childProfile.id, routineId: requestedRoutine });
  }, [requestedRoutine, templates, childProfile.id]);
  const closeRoutine = () => {
    setOpenedState({ childId: childProfile.id, routineId: null });
    if (requestedRoutine && typeof window !== "undefined" && window.location.hash.includes("routine=")) {
      window.history.replaceState(window.history.state, "", `#${routeHash("practice")}`);
    }
  };

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
  const cardOf = new Map<string, RhythmCard>(rhythm.map((card) => [card.routine.id, card]));
  const bandName: Record<Band, string> = { morning: copy.bandMorning, afternoon: copy.bandAfternoon, evening: copy.bandEvening, anytime: copy.bandAnytime };

  const steps = (routine: Routine, card: RhythmCard | undefined) => {
    const total = card ? card.total : routine.steps.length;
    return (
      <span className="tg-steps" role="img" aria-label={card
        ? t("companion.together-view.rhythm-steps-aria", { done: card.done.length, total: card.total })
        : copy.routineStepsAria(total)}>
        {Array.from({ length: total }, (_, i) => <i key={i} className={card?.done.includes(i) ? "d" : undefined} />)}
      </span>
    );
  };

  const routineCard = (routine: Routine) => {
    const card = cardOf.get(routine.id);
    const face = routineFace(routine.id, phone ? 36 : 40);
    const title = localized(routine.title, lang);
    return (
      <button
        type="button"
        className="dm-c"
        data-routine-tile={routine.id}
        data-in-plan={card ? "true" : "false"}
        data-complete={card?.complete ? "true" : "false"}
        {...primaryMoveProps}
        aria-haspopup="dialog"
        onClick={() => open(routine.id)}
      >
        <span className="face"><LivingForm src={face.src} width={face.width} height={face.height} crop={face.crop} /></span>
        <span className="nm" dir="auto">{title}</span>
        <span className="meta">
          {localized(routine.time, lang)}
          {!phone && card && <span className="ct" dir="auto"> · {card.nextStep ? t("companion.together-view.rhythm-next-step", { step: card.nextStep }) : t("companion.together-view.rhythm-all-done")}</span>}
        </span>
        {steps(routine, card)}
        <span className="go">
          {card ? <><Icon name="check_circle" size={14} fill={1} className="ic-in" />{t("companion.together-view.routines-in-plan")}</>
            : <><Icon name="add" size={14} />{t("companion.together-view.routines-start")}</>}
        </span>
      </button>
    );
  };

  const fitsCard = (card: RhythmCard) => {
    const { routine } = card;
    const face = routineFace(routine.id, phone ? 56 : 92);
    const why = localized(routine.why, lang).replace(/\{name\}/g, childName);
    const label = <span className="tg-pen"><Icon name="schedule" size={14} />{FITS_COPY[lang].label(clockOf(clockNow.getHours() * 60 + clockNow.getMinutes()))}</span>;
    const head = <>
      <span className="face"><LivingForm src={face.src} width={face.width} height={face.height} crop={face.crop} /></span>
      <div className="mid">
        {label}
        <h3 dir="auto">{localized(routine.title, lang)}</h3>
        {!phone && <p className="why" dir="auto">{why}</p>}
        <span className="meta">{localized(routine.time, lang)}</span>
      </div>
    </>;
    return (
      <article className="dm-x" data-testid="together-fits" data-routine={routine.id}>
        {phone ? <div className="top">{head}</div> : head}
        {phone && <p className="why" dir="auto">{why}</p>}
        <ol className="stn" aria-label={t("companion.together-view.routines-preview")}>
          {routine.steps.map((step, i) => (
            <li key={step.key} data-ticked={card.done.includes(i) ? "true" : "false"}>
              <span className={card.done.includes(i) ? "tg-stn sm done" : "tg-stn sm"} aria-hidden="true">{card.done.includes(i) ? <Icon name="check" size={16} /> : i + 1}</span>
              <span dir="auto">{localized(step.label, lang)}</span>
            </li>
          ))}
        </ol>
        <div className="act">
          <button type="button" className="btn primary nowrap" data-testid="together-fits-start" aria-haspopup="dialog" onClick={() => open(routine.id)}>
            <Icon name="play_arrow" size={18} />{card.done.length > 0 ? FITS_COPY[lang].continue : FITS_COPY[lang].start}
          </button>
        </div>
      </article>
    );
  };

  return (
    <div className={phone ? "dm dm-pm" : "dm"} data-testid="together-routines" data-mode={rhythm.length > 0 ? "rhythm" : "library"}>
      {BANDS.map((band) => {
        // The routine that fits right now opens first in its band; the rest keep the library's order.
        const inBand = templates.filter((routine) => BAND_OF[routineSlot(routine.id)] === band)
          .sort((a, b) => Number(b.id === fits?.routine.id) - Number(a.id === fits?.routine.id));
        if (inBand.length === 0) return null;
        const titleId = `${headingId ?? "routines"}-band-${band}`;
        return (
          <section key={band} className={`dm-b band-${band}`} id={`band-${band}`} aria-labelledby={titleId} data-band={band}>
            <div className="dm-h">
              <span className="dm-i" aria-hidden="true"><Icon name={BAND_ICON[band]} size={20} /></span>
              <b id={titleId} role="heading" aria-level={3}>{bandName[band]}</b>
              <span className="n">{copy.bandCount(inBand.length)}</span>
            </div>
            <ul className="dm-g">
              {inBand.map((routine) => (
                fits && fits.routine.id === routine.id
                  ? <li key={routine.id} className="wide">{fitsCard(fits)}</li>
                  : <li key={routine.id}>{routineCard(routine)}</li>
              ))}
            </ul>
          </section>
        );
      })}
      {opened && (
        <RoutineRunSheet
          routine={opened}
          plan={planFor(opened.id)}
          start={start && start.routineId === opened.id ? start : null}
          childName={childName}
          onStart={() => startRoutine(opened)}
          onClose={closeRoutine}
        />
      )}
    </div>
  );
}

