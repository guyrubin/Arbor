/**
 * RitualTurnCard — ENG-25. The Family Rituals cadence, surfaced.
 *
 * A ritual's cadence used to be a grey prose chip in Arbor Academy that nothing
 * ever acted on. This card is the acting: on any open where a ritual's turn has
 * come round (lib/familyRitualsCadence), that ONE ritual appears with its steps
 * one tap away and a "we did this" that restarts its clock. No notification is
 * sent — the cadence is real in-app, which is the only place Arbor can be
 * honest about today (see lib/pushPriming).
 *
 * Register: parent. Tokens only, logical CSS, 44px targets, EN + HE.
 * CLINICAL FIREWALL: this is a family practice, not a measure. Nothing here
 * counts what the family skipped, scores anything, or reports on the child.
 */
import React, { useCallback, useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import { useArbor } from "../../context/ArborContext";
import {
  cadenceLabel,
  markRitualPractised,
  readRitualRecord,
  ritualOfTheMoment,
  type RitualRecord,
} from "../../lib/familyRitualsCadence";

/** Each ritual's glyph — kept in step with the Family Formation surface. */
const RITUAL_GLYPH: Record<string, string> = {
  "truth-practice-weekly": "verified_user",
  "responsibility-ladder": "checklist",
  "family-story-canon": "menu_book",
  "weekly-reflection-sunday-reset": "event",
};

export interface RitualTurnCardProps {
  /** Injected in tests; the live surface reads the clock. */
  nowMs?: number;
}

export default function RitualTurnCard({ nowMs }: RitualTurnCardProps) {
  const { t, uiLang } = useLanguage();
  const { setActiveTab } = useArbor();
  const he = uiLang === "he";
  const now = nowMs ?? Date.now();

  const [record, setRecord] = useState<RitualRecord>(() => readRitualRecord());
  const [stepsOpen, setStepsOpen] = useState(false);

  const turn = useMemo(() => ritualOfTheMoment(now, record), [now, record]);

  const markPractised = useCallback(() => {
    if (!turn) return;
    setRecord(markRitualPractised(turn.ritual.id, now));
    setStepsOpen(false);
  }, [turn, now]);

  // Nothing waiting is a real, calm answer — say it once rather than render an
  // empty slot the parent has to interpret.
  if (!turn) {
    return (
      <p
        data-testid="ritual-turn-settled"
        className="px-1 text-[12px]"
        dir="auto"
        style={{ color: "var(--arbor-muted)" }}
      >
        {t("elev.rh.ritual.settled")}
      </p>
    );
  }

  const { ritual, firstTime } = turn;
  const cadence = cadenceLabel(ritual);
  const steps = he ? ritual.stepsHe : ritual.steps;

  return (
    <section
      data-testid="ritual-turn-card"
      data-ritual-id={ritual.id}
      aria-labelledby="ritual-turn-title"
      className="rounded-[24px] p-4 sm:p-5"
      style={{
        background: "var(--arbor-paper-elevated)",
        border: "1px solid var(--arbor-rule)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ background: "var(--arbor-green-soft)" }}
        >
          <Icon name={RITUAL_GLYPH[ritual.id] ?? "history_edu"} size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <span
            className="text-[11px] font-extrabold uppercase tracking-[0.16em]"
            style={{ color: "var(--arbor-green-ink)" }}
          >
            {t("elev.rh.ritual.eyebrow")}
          </span>
          <h2
            id="ritual-turn-title"
            className="mt-1 break-words text-[17px] font-extrabold leading-tight"
            dir="auto"
            style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}
          >
            {he ? ritual.titleHe : ritual.title}
          </h2>
          <p className="mt-1 text-[12.5px]" dir="auto" style={{ color: "var(--arbor-muted)" }}>
            <span data-testid="ritual-turn-cadence">{t(cadence.key, cadence.vars)}</span>
            {" · "}
            <span data-testid="ritual-turn-reason">
              {firstTime ? t("elev.rh.ritual.first") : t("elev.rh.ritual.turn")}
            </span>
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setStepsOpen((v) => !v)}
        aria-expanded={stepsOpen}
        className="mt-3 flex w-full items-center justify-between gap-2 rounded-2xl px-4 text-start"
        style={{ minHeight: 44, background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}
      >
        <span className="text-[13px] font-bold" dir="auto" style={{ color: "var(--arbor-ink)" }}>
          {t("elev.rh.ritual.steps")}
        </span>
        <Icon name="expand_more" size={18} className={stepsOpen ? "rotate-180" : ""} />
      </button>

      {stepsOpen && (
        <ol className="mt-3 space-y-2" data-testid="ritual-turn-steps">
          {steps.map((s, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-[13px] leading-relaxed"
              dir="auto"
              style={{ color: "var(--arbor-ink-soft)" }}
            >
              <span
                className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold"
                style={{ background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" }}
              >
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="ritual-turn-practised"
          onClick={markPractised}
          className="inline-flex items-center gap-2 rounded-2xl px-5 text-[13px] font-extrabold transition active:scale-[0.97]"
          style={{ minHeight: 44, background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" }}
        >
          <Icon name="task_alt" size={16} />
          {t("elev.rh.ritual.did")}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("family")}
          className="inline-flex items-center gap-1.5 rounded-2xl px-4 text-[13px] font-bold"
          style={{
            minHeight: 44,
            background: "var(--arbor-paper-elevated)",
            border: "1px solid var(--arbor-rule)",
            color: "var(--arbor-muted)",
          }}
        >
          {t("elev.rh.ritual.open")}
          <Icon name="chevron_right" size={16} className="rtl:rotate-180" />
        </button>
      </div>
    </section>
  );
}
