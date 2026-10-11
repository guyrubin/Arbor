import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { PendingLine, Receipt } from "../ui/Receipt";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { celebrate } from "../../lib/celebrate";
import {
  isRoutineRunComplete,
  resetRoutineToday,
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
   starts fresh tomorrow.

   Counts only: ticked today and still to go, and the days every step was run
   in the last two weeks. No share, no bar, no streak, no colour verdict.
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
  /** The plan as this attempt writes it (only its routineRuns are read back). */
  next: ActionPlan;
  /** True when this write moves today's run from unfinished to finished. */
  completes: boolean;
  status: "pending" | "saved" | "failed";
};

/** One celebration per plan per day, for the whole session. */
const celebrated = new Set<string>();

export default function RoutineRunBoard({ plan, primaryProps, now }: {
  plan: ActionPlan;
  primaryProps?: RunStampProps;
  /** The clock (ms); the local day decides which run is today's. */
  now?: number;
}) {
  const { setRoutineRun } = useArbor();
  const { t } = useLanguage();
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
  const view: ActionPlan = live && live.status !== "failed" ? { ...plan, routineRuns: live.next.routineRuns } : plan;
  const steps = (plan.phases ?? []).flatMap((ph) => (ph.steps ?? []).map((s) => s.text));
  const ticked = routineRunToday(view, day);
  const total = routineStepCount(plan);
  const done = ticked.length;
  const left = Math.max(0, total - done);
  const complete = isRoutineRunComplete(view, day);
  const days = routineDaysComplete(view);
  const firstOpen = steps.findIndex((_, i) => !ticked.includes(i));
  const { style: stampStyle, ...stampAttrs } = primaryProps ?? {};

  const write = (next: ActionPlan, completes: boolean) => {
    const id = ++latest.current;
    const planId = plan.id;
    setAttempt({ id, planId, day, next, completes, status: "pending" });
    let request: Promise<void>;
    try { request = Promise.resolve(setRoutineRun(next)); } catch (error) { request = Promise.reject(error); }
    request.then(
      () => {
        if (!mounted.current || latest.current !== id) return;
        setAttempt((a) => (a && a.id === id ? { ...a, status: "saved" } : a));
        const key = `${planId}@${day}`;
        if (completes && !celebrated.has(key)) {
          celebrated.add(key);
          celebrate({ kind: "routine" });
        }
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
    write(next, !isRoutineRunComplete(view, day) && isRoutineRunComplete(next, day));
  };
  const reset = () => {
    if (routineIdOfPlan(plan) === null) return;
    write(resetRoutineToday(view, day), false);
  };
  const retry = () => {
    if (!live || live.status !== "failed") return;
    write({ ...plan, routineRuns: live.next.routineRuns }, live.completes && !isRoutineRunComplete(plan, day));
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
      {live?.status === "saved" && (
        <Receipt testId="routine-run-saved" size="sm">
          {complete ? t("elev.plans.routineRun.doneToday", { routine: plan.title }) : t("elev.plans.routineRun.saved")}
        </Receipt>
      )}
      {complete && (!live || live.status === "failed") && (
        <p data-testid="routine-run-done-today" className="t-sm" style={{ color: "var(--arbor-ink-soft)" }}>
          {t("elev.plans.routineRun.doneToday", { routine: plan.title })}
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
