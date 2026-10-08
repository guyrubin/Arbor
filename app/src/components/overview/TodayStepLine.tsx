import React from "react";
import { Icon } from "../ui/Icon";
import { FreeText } from "../ui/FreeText";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";

/**
 * P5 r1 pass A5 (option b, ratified 6 Oct) — an ACCEPTED step that is still
 * open today (the actionLoops row TodayActionLoop used to own) is a
 * capability, not an offer: it keeps ONE line inside Today's door. The line
 * names the step in the parent's accepted words and carries two chips that
 * write the SAME outcomes through the SAME path the card used
 * (`recordTodayOutcome(id, "helped" | "not_today")`). After an answer the
 * line keeps its receipt. Never a card, never a count.
 */
export default function TodayStepLine() {
  const { activeTodayAction, recordTodayOutcome } = useArbor();
  const { t } = useLanguage();
  if (!activeTodayAction) return null;
  const open = activeTodayAction.status === "accepted";
  return (
    <div data-testid="today-door-step" className="flex min-h-11 flex-wrap items-center gap-2 rounded-xl px-3 py-1.5">
      <Icon name="task_alt" size={18} style={{ color: "var(--arbor-muted)" }} />
      <span className="line-clamp-2 min-w-0 flex-1 font-semibold leading-snug" style={{ color: "var(--arbor-ink)", fontSize: "var(--t-base)" }}>
        {t("elev.loop.door.step")} <FreeText text={t("elev.loop.ms.quoted", { text: activeTodayAction.recommendation })} />
      </span>
      {open ? (
        <span className="flex gap-2" role="group" aria-label={t("elev.loop.door.step")}>
          {(["helped", "not_today"] as const).map((value) => (
            <button
              key={value}
              type="button"
              data-outcome={value}
              onClick={() => recordTodayOutcome(activeTodayAction.id, value)}
              className="inline-flex min-h-11 items-center rounded-full px-3 font-semibold"
              style={{ border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)", background: "var(--arbor-paper-elevated)", fontSize: "var(--t-sm)" }}
            >
              {t(value === "helped" ? "today.action.helped" : "today.action.notToday")}
            </button>
          ))}
        </span>
      ) : (
        <span role="status" data-testid="today-door-step-receipt" style={{ color: "var(--arbor-muted)", fontSize: "var(--t-sm)" }}>
          {t("today.action.receipt")}
        </span>
      )}
    </div>
  );
}
