import { useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { track } from "../../lib/analytics";

/**
 * v3 F-FORYOU-1 — "Try it today": one tap puts a read's (or an activity's)
 * one small thing on today's list, through the shared accept seam
 * (acceptTodayAction, "tiny"), never twice.
 *
 * The receipt follows the write, as in the course reader: "Adding…" while
 * this tap's write is in flight, "Added to today" once it resolved, and a
 * failed write says so. A row already in a server-confirmed ledger reads
 * "Added to today"; a row the ledger has not confirmed yet reads the neutral
 * "On today's list" — never "Added", and never a live-looking button.
 */
export type TryTodaySource = "learn-read";
type AddState = "idle" | "saving" | "saved" | "failed";

export function useTryToday(recommendation: string, source: TryTodaySource) {
  const { actionLoop, actionLoopConfirmed, acceptTodayAction } = useArbor();
  const text = recommendation.trim();
  const taken = (actionLoop ?? []).some((a) => a.source === source && a.recommendation === text);
  const [state, setState] = useState<AddState>("idle");
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  // A different read is a different action: its receipt starts clean.
  useEffect(() => { setState("idle"); }, [text]);
  const added = state === "saved" || (state === "idle" && taken && actionLoopConfirmed === true);
  const listed = !added && state === "idle" && taken;
  const add = () => {
    if (!text || taken || state === "saving") return;
    setState("saving");
    acceptTodayAction(text, "tiny", source).then(
      () => { if (mounted.current) setState("saved"); },
      () => { if (mounted.current) setState("failed"); },
    );
    try { track("learn_add_today", { from: "for-you" }); } catch { /* noop */ }
  };
  return { state, taken, added, listed, add };
}

/** The outlined "Try it today" control, with its receipt and its failure line. */
export function TryTodayButton({ recommendation, source = "learn-read", testId = "try-today" }: {
  recommendation: string;
  source?: TryTodaySource;
  testId?: string;
}) {
  const { t } = useLanguage();
  const { state, taken, added, listed, add } = useTryToday(recommendation, source);
  return (
    <span className="inline-flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={add}
        disabled={taken}
        aria-busy={state === "saving"}
        data-testid={testId}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 text-sm font-bold transition disabled:opacity-80 focus:outline-none focus-visible:ring-2"
        style={added
          ? { background: "var(--arbor-paper-elevated)", color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-rule)" }
          : listed
            ? { background: "var(--arbor-paper-deep)", color: "var(--arbor-ink-soft)", border: "1px solid var(--arbor-rule)" }
            : { background: "var(--arbor-paper-elevated)", color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-rule-strong)" }}
      >
        <Icon name={added ? "check_circle" : listed ? "event_available" : "flag"} size={16} fill={added ? 1 : 0} />
        {state === "saving"
          ? t("elev.learnCare.addToday.saving")
          : added
            ? t("learn.addedToday")
            : listed
              ? t("elev.learnCare.addToday.listed")
              : t("elev.learnCare.pick.tryToday")}
      </button>
      {state === "failed" && (
        <span role="alert" data-testid={`${testId}-failed`} className="t-sm" style={{ color: "var(--arbor-ink-soft)" }}>{t("elev.learnCare.addToday.failed")}</span>
      )}
    </span>
  );
}
