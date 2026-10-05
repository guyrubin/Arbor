import React from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { heldOutcome, type ActionLoopEntry, type ChildResponse, type HeldAnswer } from "../../actionLoop/model";
import type { TodayOutcomeVia } from "../../lib/loopEvents";
import { genderedKey } from "../../lib/today/fromRecord";

export const HELD_ANSWERS: readonly HeldAnswer[] = ["yes", "no"];
export const CHILD_RESPONSES: readonly ChildResponse[] = ["calmer", "same", "harder"];

/** Which question a hard-moment row is on: the adult's, the child's, or done. */
export function heldStage(row: Pick<ActionLoopEntry, "status" | "outcome" | "held" | "childResponse">): "held" | "child" | "done" {
  if (row.status !== "completed" || !row.outcome) return "held";
  if (row.held && !row.childResponse) return "child";
  return "done";
}

/**
 * B-ASKJB-33 — the outcome ask for a HARD-MOMENT step, wherever outcomes are
 * asked (Today's step card and the carry-over line): two taps instead of
 * "Did it help?".
 *   1. "Did you manage to hold the plan calmly?  Yes · Not this time" —
 *      the adult's part; ONLY this answer feeds "Last time, this helped".
 *      It writes the ledger outcome (yes → helped, not this time → not today)
 *      so plans, What changed and the focus loop read it as before.
 *   2. "And {name}?  Calmer · Same · Harder" — stored for the visit packet.
 * One neutral treatment for every answer (colour-coding would grade the day).
 * Clinical review line: the wording of both questions.
 */
export default function HeldPlanAsk({ row, via = "card" }: { row: ActionLoopEntry; via?: TodayOutcomeVia }) {
  const { recordTodayOutcome, recordChildResponse, childProfile } = useArbor();
  const { t, uiLang } = useLanguage();
  const name = (childProfile.name || "").split(" ")[0];
  const stage = heldStage(row);
  if (stage === "done") {
    return row.childResponse ? (
      <p role="status" data-testid="held-ask-saved" className="text-[13px]" style={{ color: "var(--arbor-muted)" }}>{t("hm.child.saved")}</p>
    ) : null;
  }
  const pill = "inline-flex min-h-[44px] items-center rounded-full px-4 text-[14px] font-semibold transition active:scale-[0.98]";
  const pillStyle = { color: "var(--arbor-ink)", background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule-strong)" };
  if (stage === "held") {
    return (
      <div data-testid="held-ask" data-stage="held">
        <p className="text-[15px] font-semibold" style={{ color: "var(--arbor-ink)" }}>{t("hm.held.ask")}</p>
        <div role="group" aria-label={t("hm.held.ask")} className="mt-2 flex flex-wrap gap-2">
          {HELD_ANSWERS.map((held) => (
            <button key={held} type="button" data-held={held} className={pill} style={pillStyle}
              onClick={() => recordTodayOutcome(row.id, heldOutcome(held), via, held)}>
              {t(held === "yes" ? "hm.held.yes" : "hm.held.no")}
            </button>
          ))}
        </div>
      </div>
    );
  }
  const ask = t("hm.child.ask", { name });
  return (
    <div data-testid="held-ask" data-stage="child">
      <p dir="auto" className="text-[15px] font-semibold" style={{ color: "var(--arbor-ink)" }}><bdi>{ask}</bdi></p>
      <div role="group" aria-label={ask} className="mt-2 flex flex-wrap gap-2">
        {CHILD_RESPONSES.map((r) => (
          <button key={r} type="button" data-child={r} className={pill} style={pillStyle} onClick={() => recordChildResponse(row.id, r)}>
            {/* HE: only "calmer" agrees with the child's gender (רגוע / רגועה). */}
            {t(uiLang === "he" && r === "calmer" ? genderedKey("hm.child.calmer", childProfile.gender) : `hm.child.${r}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
