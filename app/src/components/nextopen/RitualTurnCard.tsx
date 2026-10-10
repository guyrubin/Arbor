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
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import {
  cadenceLabel,
  daysUntilNextTurn,
  markRitualPractised,
  readRitualRecord,
  ritualOfTheMoment,
  type RitualRecord,
} from "../../lib/familyRitualsCadence";
import { FAMILY_RITUALS, type FamilyRitual } from "../../lib/familyRituals";
import { translate } from "../../lib/i18n";

/** W2-SHELLPLAY critic r2 (B-SHELL-NEW-2l): the charter value each ritual
 *  practises. A ritual not listed keeps the plain cadence reason. */
export const RITUAL_VALUE_KEY: Readonly<Record<string, string>> = {
  "truth-practice-weekly": "elev.charter.default.honesty",
  "responsibility-ladder": "elev.charter.default.responsibility",
};

/** The family's own word for a ritual's value when it is on their charter
 *  (matched against the keyed default in either language, case-insensitive),
 *  else null. Pure; exported for the guard. */
export function charterValueFor(ritualId: string, charter: readonly string[]): string | null {
  const key = RITUAL_VALUE_KEY[ritualId];
  if (!key) return null;
  const words = new Set([translate("en", key), translate("he", key)].map((w) => w.trim().toLowerCase()));
  return charter.find((v) => words.has(v.trim().toLowerCase())) ?? null;
}

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
  /** W2-SHELLPLAY critic r1: the host's ONE "start" move for the ritual whose
   *  turn it is (Family Formation: acceptTodayAction of its first step). When
   *  given, "Start it this week" is the card's primary control. */
  onStart?: (ritual: FamilyRitual) => void;
  /** Whether that ritual's first step is already on today's list. */
  started?: (ritual: FamilyRitual) => boolean;
  /** An unacknowledged start is disabled without claiming it is already saved. */
  startDisabled?: boolean;
  /** The host owns write feedback; the card only places it beside its Start. */
  startFeedback?: (ritual: FamilyRitual) => React.ReactNode;
  /** The host's primary-move stamp (spread onto the start control), so the
   *  route's leaf file keeps the one stamp check:framework counts. */
  primaryMoveProps?: Record<string, string>;
  /** W2-SHELLPLAY critic r2: tells the host which ritual the card shows (or
   *  null when none is due), so the ritual library never renders it twice. */
  onTurnChange?: (ritualId: string | null) => void;
  /** W2-SHELLPLAY critic r2: the family's charter values and the child, so a
   *  first-time turn names the value and the child instead of a deficit line. */
  charterValues?: readonly string[];
  childName?: string;
  childAge?: number;
}

export default function RitualTurnCard({ nowMs, onStart, started, startDisabled, startFeedback, primaryMoveProps, onTurnChange, charterValues, childName, childAge }: RitualTurnCardProps) {
  const { t, uiLang } = useLanguage();
  const he = uiLang === "he";
  const now = nowMs ?? Date.now();

  const [record, setRecord] = useState<RitualRecord>(() => readRitualRecord());
  const [stepsOpen, setStepsOpen] = useState(false);

  const turn = useMemo(() => ritualOfTheMoment(now, record), [now, record]);
  const turnId = turn?.ritual.id ?? null;
  useEffect(() => { onTurnChange?.(turnId); }, [turnId, onTurnChange]);
  // W2-SHELLPLAY critic r2 (law 7): when nothing is due the page still has ONE
  // move — plan the ritual whose turn comes round next.
  const nextUp = useMemo(() => {
    if (turn) return null;
    let best: FamilyRitual | null = null;
    let bestLeft = Infinity;
    for (const r of FAMILY_RITUALS) {
      const left = daysUntilNextTurn(r, now, record) ?? 0;
      if (left < bestLeft) { best = r; bestLeft = left; }
    }
    return best;
  }, [turn, now, record]);

  const markPractised = useCallback(() => {
    if (!turn) return;
    setRecord(markRitualPractised(turn.ritual.id, now));
    setStepsOpen(false);
  }, [turn, now]);

  // Nothing waiting is a real, calm answer — say it once rather than render an
  // empty slot the parent has to interpret.
  if (!turn) {
    const nextStarted = nextUp ? Boolean(started?.(nextUp)) : false;
    return (
      <div data-testid="ritual-turn-settled" className="space-y-2">
        <p className="px-1 t-sm" dir="auto" style={{ color: "var(--arbor-muted)" }}>
          {t("elev.rh.ritual.settled")}
        </p>
        {onStart && nextUp && (
          <button
            type="button"
            {...primaryMoveProps}
            data-testid="ritual-plan-next"
            onClick={() => onStart(nextUp)}
            disabled={startDisabled || nextStarted}
            className="inline-flex items-center gap-2 rounded-2xl px-5 t-sm font-extrabold transition active:scale-[0.97] disabled:cursor-default"
            style={
              nextStarted
                ? { minHeight: 44, background: "var(--arbor-paper-deep)", color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-rule)" }
                : { minHeight: 44, background: "var(--gradient-cta)", color: "var(--arbor-on-accent)" }
            }
          >
            <Icon name={nextStarted ? "check_circle" : "event_upcoming"} size={16} fill={nextStarted ? 1 : 0} />
            {nextStarted ? t("elev.learnCare.ritual.started") : t("elev.rh.ritual.planNext", { title: he ? nextUp.titleHe : nextUp.title })}
          </button>
        )}
        {onStart && nextUp && startFeedback?.(nextUp)}
      </div>
    );
  }

  const { ritual, firstTime } = turn;
  const charterValue = charterValueFor(ritual.id, charterValues ?? []);
  const valueSentence =
    firstTime && RITUAL_VALUE_KEY[ritual.id] && childName && typeof childAge === "number" && childAge > 0
      ? t(`elev.rh.ritual.value.${ritual.id}`, { name: childName, age: childAge })
      : "";
  const closingKey = ritual.id === "truth-practice-weekly" ? "elev.rh.ritual.closing.truth-practice-weekly" : "";
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
            className="t-xs font-extrabold uppercase tracking-[0.16em]"
            style={{ color: "var(--arbor-green-ink)" }}
          >
            {t("elev.rh.ritual.eyebrow")}
          </span>
          {/* W2-SHELLPLAY critic r2: the heading ladder — the card title is an
              h3 at t-md under the module's t-lg h2 (grid titles: t-base h3). */}
          <h3
            id="ritual-turn-title"
            className="mt-1 break-words t-md font-extrabold leading-tight"
            dir="auto"
            style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}
          >
            {he ? ritual.titleHe : ritual.title}
          </h3>
          <p className="mt-1 t-sm" dir="auto" style={{ color: "var(--arbor-muted)" }}>
            <span data-testid="ritual-turn-cadence">{t(cadence.key, cadence.vars)}</span>
            {!valueSentence && (
              <>
                {" · "}
                <span data-testid="ritual-turn-reason">
                  {firstTime ? t("elev.rh.ritual.first") : t("elev.rh.ritual.turn")}
                </span>
              </>
            )}
          </p>
          {/* W2-SHELLPLAY critic r2 (B-SHELL-NEW-2l): first time, the reason is
              the family's own value (their charter word, in the charter's chip
              pair) and the child by name and age — never "not run yet". With
              no matching value the sentence drops its first clause. */}
          {valueSentence && (
            <p data-testid="ritual-turn-value" className="mt-2 t-sm" dir="auto" style={{ color: "var(--arbor-ink-soft)" }}>
              {charterValue && (
                <>
                  <span className="inline-flex items-center rounded-full px-2.5 font-bold" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
                    <bdi>{charterValue}</bdi>
                  </span>{" "}
                  {t("elev.rh.ritual.value.onCharter")}{" "}
                </>
              )}
              {valueSentence}
            </p>
          )}
          {valueSentence && closingKey && (
            <p data-testid="ritual-turn-closing" className="mt-1.5 t-base leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-sans)", fontStyle: "normal" }}>
              “{t(closingKey)}”
            </p>
          )}
        </div>
      </div>

      {/* W2-SHELLPLAY critic r1: ONE primary control — "Start it this week"
          puts the ritual's first step on Today (the host's move, stamped by
          the host) on the page's single --gradient-cta. "We did this" is the
          quiet secondary that restarts the clock. The "Open Family Formation"
          door is gone: this card lives ON #/family, where it did nothing. */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {onStart && (
          <button
            type="button"
            {...primaryMoveProps}
            data-testid="ritual-turn-start"
            onClick={() => onStart(ritual)}
            disabled={startDisabled || started?.(ritual)}
            className="inline-flex items-center gap-2 rounded-2xl px-5 text-[13px] font-extrabold transition active:scale-[0.97] disabled:cursor-default"
            style={
              started?.(ritual)
                ? { minHeight: 44, background: "var(--arbor-paper-deep)", color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-rule)" }
                : { minHeight: 44, background: "var(--gradient-cta)", color: "var(--arbor-on-accent)" }
            }
          >
            <Icon name={started?.(ritual) ? "check_circle" : "add_task"} size={16} fill={started?.(ritual) ? 1 : 0} />
            {started?.(ritual) ? t("elev.learnCare.ritual.started") : t("elev.rh.ritual.startWeek")}
          </button>
        )}
        <button
          type="button"
          data-testid="ritual-turn-practised"
          onClick={markPractised}
          className="inline-flex items-center gap-2 rounded-2xl px-5 text-[13px] font-extrabold transition active:scale-[0.97]"
          style={{ minHeight: 44, background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}
        >
          <Icon name="task_alt" size={16} />
          {t("elev.rh.ritual.did")}
        </button>
      </div>
      {onStart && startFeedback?.(ritual)}
      {/* SHIP-FIX (W2-SHELLPLAY r3 P1): reason -> action -> detail. "How it
          goes" follows the CTA row as a quiet 44 px disclosure (no deep well),
          so the stamped start clears the fixed bottom nav at 375. */}
      <button
        type="button"
        data-testid="ritual-turn-how"
        onClick={() => setStepsOpen((v) => !v)}
        aria-expanded={stepsOpen}
        className="mt-1 inline-flex items-center gap-1 px-1 t-sm font-bold text-start"
        style={{ minHeight: 44, color: "var(--arbor-muted)" }}
      >
        <span dir="auto">{t("elev.rh.ritual.steps")}</span>
        <Icon name="expand_more" size={18} className={stepsOpen ? "rotate-180" : ""} />
      </button>

      {stepsOpen && (
        <ol className="mt-1 space-y-2" data-testid="ritual-turn-steps">
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

    </section>
  );
}
