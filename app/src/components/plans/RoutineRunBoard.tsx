import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { PendingLine, Receipt } from "../ui/Receipt";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { celebrate } from "../../lib/celebrate";
import { savedOnPhoneKey } from "../../lib/firestoreWrite";
import { useOnline } from "../../hooks/useSyncStatus";
import { localized, ROUTINES } from "../../lib/routines";
import {
  isRoutineRunComplete,
  markRoutineCelebrated,
  resetRoutineToday,
  routineCelebrated,
  routineDayKey,
  routineDaysComplete,
  routineIdOfPlan,
  routineRunToday,
  routineStepCount,
  toggleRoutineStep,
} from "../../lib/routineTemplates";
import type { ActionPlan } from "../../types";

/* ════════════════════════════════════════════════════════════════════════════
   RoutineRunBoard — v3 FEAT-07: a routine plan runs again every day.

   The ONE place a routine plan's steps are ticked (on #/plans and in the
   Together routine sheet). Each tick writes `plan.routineRuns[today]` through
   ArborContext.setRoutineRun, which waits for the server: the "Saved" receipt,
   the done-for-today line and the celebration all follow a write that
   resolved, never the tap. `step.completed` is never written, so the plan
   starts fresh tomorrow. The celebration is once per day on any device: the
   write that finishes the day also stores `routineCelebratedOn`, and a day
   already marked never celebrates again (after a reload or on a second phone).

   Counts only: ticked today and still to go, and the days every step was run
   in the last two weeks. That record line reads the plan AS STORED, so it
   moves only after a write resolved. No share, no bar, no streak, no colour
   verdict.
   B-DATA-14: offline (or with no server answer in bounded time) a tick is
   kept on this phone: the board says "Saved on this phone. Sending when
   you're back online." (then "Still sending…" once reconnected), never an
   endless "Saving…"; the "Saved" receipt and the celebration wait for the
   server's acknowledgement, and a later rejection shows the retry.
   Parent register: tokens only, logical properties, 44 px switches.
   The host passes its contract stamp (primaryProps) for the first step still
   to do; this file never names the move itself.
   ════════════════════════════════════════════════════════════════════════════ */

/** The host's contract stamp + primary fill (the same shape PlanTrackCard takes). */
export type RunStampProps = { style?: React.CSSProperties } & { [attr: `data-${string}`]: string };

type Attempt = {
  id: number;
  planId: string;
  day: string;
  /** The plan as this attempt writes it (only its run fields are read back). */
  next: ActionPlan;
  /** True when this write finishes today's run AND marks the day celebrated. */
  celebrates: boolean;
  /** queued: kept on this phone, not yet acknowledged (B-DATA-14). */
  status: "pending" | "queued" | "saved" | "failed";
};

/** The stored plan with an attempt's run (and celebrated day) laid over it. */
function withRun(plan: ActionPlan, from: ActionPlan): ActionPlan {
  const out: ActionPlan = { ...plan, routineRuns: from.routineRuns ?? {} };
  if (from.routineCelebratedOn) out.routineCelebratedOn = from.routineCelebratedOn;
  return out;
}

/** The routine's title in the reader's language (the plan's title is frozen
 *  in the language it was started in); the plan's own title otherwise. */
function routineTitle(plan: ActionPlan, lang: "en" | "he"): string {
  const id = routineIdOfPlan(plan);
  const routine = id === null ? undefined : ROUTINES.find((r) => r.id === id);
  return routine ? localized(routine.title, lang) : plan.title;
}

export default function RoutineRunBoard({ plan, primaryProps, now }: {
  plan: ActionPlan;
  primaryProps?: RunStampProps;
  /** The clock (ms); the local day decides which run is today's. */
  now?: number;
}) {
  const { setRoutineRun } = useArbor();
  const { t, uiLang } = useLanguage();
  const online = useOnline();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const latest = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const day = routineDayKey(now ?? Date.now());
  const live = attempt && attempt.planId === plan.id && attempt.day === day ? attempt : null;
  const pending = live?.status === "pending";
  // Today's run as this board last wrote it (on its way, or accepted by the
  // server) so a second tap never builds on a snapshot that has not caught up;
  // after a failed write, the plan as stored.
  const view: ActionPlan = live && live.status !== "failed" ? withRun(plan, live.next) : plan;
  // The record as persisted: the stored plan, or this board's write once the
  // server accepted it, never a write still on its way.
  const stored: ActionPlan = live?.status === "saved" ? view : plan;
  const steps = (plan.phases ?? []).flatMap((ph) => (ph.steps ?? []).map((s) => s.text));
  const ticked = routineRunToday(view, day);
  const total = routineStepCount(plan);
  const done = ticked.length;
  const left = Math.max(0, total - done);
  const complete = isRoutineRunComplete(view, day);
  const days = routineDaysComplete(stored, day);
  const title = routineTitle(plan, uiLang === "he" ? "he" : "en");
  const firstOpen = steps.findIndex((_, i) => !ticked.includes(i));
  const { style: stampStyle, ...stampAttrs } = primaryProps ?? {};

  const write = (next: ActionPlan, celebrates: boolean) => {
    const id = ++latest.current;
    const planId = plan.id;
    setAttempt({ id, planId, day, next, celebrates, status: "pending" });
    const settle = (status: Attempt["status"]) => {
      if (!mounted.current || latest.current !== id) return false;
      setAttempt((a) => (a && a.id === id ? { ...a, status } : a));
      return true;
    };
    let queued = false;
    const saved = () => {
      // Persisted with the day marked: the one moment for this day.
      if (settle("saved") && celebrates) celebrate({ kind: "routine" });
    };
    let request: Promise<void>;
    try {
      request = Promise.resolve(setRoutineRun(next, {
        onQueued: () => { queued = true; settle("queued"); },
        onSynced: saved,
        onRejected: () => { settle("failed"); },
      }));
    } catch (error) { request = Promise.reject(error); }
    request.then(
      () => {
        // Kept on this phone: the receipt waits for onSynced.
        if (queued) return;
        saved();
      },
      () => {
        if (!mounted.current || latest.current !== id) return;
        setAttempt((a) => (a && a.id === id ? { ...a, status: "failed" } : a));
      },
    );
  };
  const toggle = (idx: number) => {
    if (routineIdOfPlan(plan) === null) return;
    const next = toggleRoutineStep(view, day, idx);
    if (next === view) return;
    // Celebrate only the write that finishes a day not yet celebrated anywhere.
    const finishes = !isRoutineRunComplete(view, day) && isRoutineRunComplete(next, day);
    const celebrates = finishes && !routineCelebrated(view, day);
    write(celebrates ? markRoutineCelebrated(next, day) : next, celebrates);
  };
  const reset = () => {
    if (routineIdOfPlan(plan) === null) return;
    write(resetRoutineToday(view, day), false);
  };
  const retry = () => {
    if (!live || live.status !== "failed") return;
    write(withRun(plan, live.next), live.celebrates && !routineCelebrated(plan, day));
  };

  return (
    <div data-testid="routine-run-board" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="t-base font-semibold" style={{ color: "var(--arbor-ink)" }}>{t("elev.plans.routineRun.title")}</h3>
        <p data-testid="routine-run-count" className="t-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.plans.routineRun.today", { done, left })}</p>
      </div>
      <ol className="space-y-2" aria-label={t("elev.plans.routineRun.title")}>
        {steps.map((text, i) => {
          const on = ticked.includes(i);
          const stamped = i === firstOpen && primaryProps !== undefined;
          return (
            <li key={i}>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                data-testid={`routine-run-step-${i}`}
                {...(stamped ? stampAttrs : {})}
                onClick={() => toggle(i)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-start t-base"
                style={{
                  minBlockSize: "var(--touch-min)",
                  background: on ? "var(--arbor-paper-deep)" : "var(--arbor-paper-elevated)",
                  border: "1px solid var(--arbor-rule)",
                  color: "var(--arbor-ink)",
                  ...(stamped ? stampStyle : {}),
                }}
              >
                {on ? (
                  <Icon name="check_circle" size={22} />
                ) : (
                  <span
                    aria-hidden="true"
                    className="inline-block flex-none rounded-full"
                    style={{ inlineSize: 22, blockSize: 22, border: "2px solid currentColor" }}
                  />
                )}
                <span dir="auto" className="min-w-0 flex-1" style={on ? { textDecoration: "line-through", color: "var(--arbor-muted)" } : undefined}>{text}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {days > 0 && (
        <p data-testid="routine-run-days" className="t-sm" style={{ color: "var(--arbor-muted)" }}>
          {days === 1 ? t("elev.plans.routineRun.days.one") : t("elev.plans.routineRun.days", { n: days })}
        </p>
      )}
      <PendingLine active={pending} testId="routine-run-pending">{t("elev.plans.routineRun.saving")}</PendingLine>
      {live?.status === "queued" && (
        <Receipt testId="routine-run-queued" size="sm">{t(savedOnPhoneKey(online))}</Receipt>
      )}
      {live?.status === "saved" && (
        <Receipt testId="routine-run-saved" size="sm">
          {complete ? t("elev.plans.routineRun.doneToday", { routine: title }) : t("elev.plans.routineRun.saved")}
        </Receipt>
      )}
      {complete && (!live || live.status === "failed" || live.status === "queued") && (
        <p data-testid="routine-run-done-today" className="t-sm" style={{ color: "var(--arbor-ink-soft)" }}>
          {t("elev.plans.routineRun.doneToday", { routine: title })}
        </p>
      )}
      {live?.status === "failed" && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p role="alert" data-testid="routine-run-failed" className="t-sm" style={{ color: "var(--arbor-ink)" }}>{t("elev.plans.routineRun.failed")}</p>
          <button
            type="button"
            data-testid="routine-run-retry"
            onClick={retry}
            className="inline-flex min-h-11 items-center rounded-full px-3 t-sm font-semibold"
            style={{ color: "var(--arbor-clay-deep)", border: "1px solid var(--arbor-rule)" }}
          >
            {t("elev.plans.routineRun.retry")}
          </button>
        </div>
      )}
      {done > 0 && (
        <button
          type="button"
          data-testid="routine-run-reset"
          onClick={reset}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 t-sm font-semibold"
          style={{ color: "var(--arbor-clay-deep)", border: "1px solid var(--arbor-rule)" }}
        >
          <Icon name="restart_alt" size={18} />
          {t("elev.plans.routineRun.reset")}
        </button>
      )}
    </div>
  );
}
