import React, { useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { todayActionId, type ActionOutcome } from "../../actionLoop/model";
import {
  readSkippedCarryOvers,
  rememberSkippedCarryOver,
  selectCarryOverAction,
} from "./carryOverAction";

/**
 * ENG-12 — the step that outlived its day.
 *
 * TodayActionLoop can only ever show the action whose id carries TODAY's date,
 * so a step accepted in the evening and not reported on disappeared at
 * midnight and was never asked about again. This is a SLIM strip (never a
 * card, never a second gradient CTA): it sits under the day's anchor and asks
 * the one question that closes the loop.
 *
 * Recording the outcome goes through the SAME `recordTodayOutcome` seam the
 * live card uses — no second write path — which also updates the step's row
 * in the journal thread (TJB-05).
 *
 * Skipping is LOCAL and non-destructive: the record and its thread row stay;
 * only the question stops. Deleting the entry would erase a real thing the
 * parent did.
 *
 * CLINICAL FIREWALL: counts and plain facts about the parent's own step. No
 * score, no verdict, and the three outcome buttons carry one shared neutral
 * treatment — colour-coding "helped" against "not today" would grade the day.
 */
export default function CarryOverActionAsk() {
  const { actionLoop, recordTodayOutcome, childProfile } = useArbor();
  const { t, uiLang } = useLanguage();
  const [skipped, setSkipped] = useState<string[]>(() => readSkippedCarryOvers());

  const todayId = todayActionId(childProfile.id);
  const entry = useMemo(
    () => selectCarryOverAction(actionLoop, todayId, Date.now(), skipped),
    [actionLoop, todayId, skipped],
  );

  if (!entry) return null;

  const when = new Date(entry.acceptedAt).toLocaleDateString(uiLang === "he" ? "he-IL" : undefined, {
    month: "short",
    day: "numeric",
  });

  const outcomes: { value: ActionOutcome; label: string }[] = [
    { value: "helped", label: t("today.action.helped") },
    { value: "somewhat", label: t("today.action.somewhat") },
    { value: "not_today", label: t("today.action.notToday") },
  ];

  return (
    <section
      data-testid="carry-over-action"
      className="mt-3 rounded-[16px] p-4"
      style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}
      aria-labelledby="carry-over-action-title"
    >
      <div className="flex items-start gap-2.5">
        <Icon name="history" size={17} className="mt-0.5 flex-none" style={{ color: "var(--arbor-clay)" }} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--arbor-clay)" }}>
            {t("elev.closeloop.carry.eyebrow")}
          </p>
          <p
            id="carry-over-action-title"
            dir="auto"
            className="mt-1 text-[13.5px] font-bold leading-snug"
            style={{ color: "var(--arbor-ink)" }}
          >
            {entry.recommendation}
          </p>
          <p className="mt-1 text-[11.5px] leading-snug" style={{ color: "var(--arbor-muted)" }}>
            {t("elev.closeloop.carry.ask", { date: when })}
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {outcomes.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => recordTodayOutcome(entry.id, value)}
            className="min-h-11 rounded-xl px-2 text-xs font-bold transition active:scale-[0.98]"
            style={{
              border: "1px solid var(--arbor-rule-strong)",
              color: "var(--arbor-green-ink)",
              background: "var(--arbor-paper-elevated)",
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setSkipped(rememberSkippedCarryOver(entry.id))}
        className="mt-2 min-h-11 px-1 text-[11.5px] font-bold"
        style={{ color: "var(--arbor-muted)" }}
      >
        {t("elev.closeloop.carry.dismiss")}
      </button>
    </section>
  );
}
