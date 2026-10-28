import React, { useId, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { intakeDay } from "../../consult/packet";
import { HEARING_CHECK_ANSWERS, hearingAnswerKey, hearingCheckOf, hearingCheckPatch, type HearingCheckAnswer } from "../../lib/hearingCheck";
import { Icon } from "../ui/Icon";

/**
 * B-NEXT-01 — "When was hearing last checked?" on the Words shelf and beside
 * the speech therapist's packet (journal's professional view). One bounded
 * choice, kept on the child's profile with its day (lib/hearingCheck); once
 * answered it reads back as one dated line with "Change". "Not sure" adds the
 * one routing line (a nurse or the paediatrician can check). Parent register,
 * neutral ink, 44 px answers, no colour, no verdict. Mounted only while the
 * pilot flag is on (hearingQuestionOn) — the callers own that gate.
 */
export default function HearingCheckQuestion({ testId = "hearing-check" }: { testId?: string }) {
  const { childProfile, updateChild } = useArbor();
  const { t, uiLang } = useLanguage();
  const lang = uiLang === "he" ? "he" : "en";
  const stored = hearingCheckOf(childProfile);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const id = useId();
  const answer = async (choice: HearingCheckAnswer) => {
    setSaving(true);
    setFailed(false);
    const ok = await updateChild(childProfile.id, hearingCheckPatch(choice));
    setSaving(false);
    if (ok) setEditing(false);
    else setFailed(true);
  };
  const asking = !stored || editing;
  return (
    <section data-testid={testId} aria-labelledby={`${id}-q`} className="arbor-depth-card min-w-0 p-4" style={{ background: "var(--arbor-paper-elevated)", borderRadius: "var(--r-lg)" }}>
      <h3 id={`${id}-q`} className="flex items-center gap-2 t-base font-semibold" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-sans)" }}>
        <Icon name="hearing" size={20} style={{ color: "var(--arbor-ink-soft)" }} />{t("elev.hearing.question")}
      </h3>
      {asking ? (
        <>
          <p className="mt-1.5 t-sm leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }}>{t("elev.hearing.why")}</p>
          <div role="group" aria-labelledby={`${id}-q`} data-testid={`${testId}-answers`} className="mt-3 flex flex-wrap gap-2">
            {HEARING_CHECK_ANSWERS.map((choice) => (
              <button key={choice} type="button" data-answer={choice} disabled={saving} aria-pressed={stored?.answer === choice}
                onClick={() => void answer(choice)}
                className="inline-flex min-h-[44px] items-center rounded-full px-4 text-[14px] font-semibold transition active:scale-[0.98] disabled:opacity-60"
                style={{ color: "var(--arbor-ink)", background: "var(--arbor-paper-deep)", border: `1px solid var(${stored?.answer === choice ? "--arbor-ink" : "--arbor-rule-strong"})` }}>
                {t(hearingAnswerKey(choice))}
              </button>
            ))}
          </div>
          {failed && <p role="alert" className="mt-2 t-sm" style={{ color: "var(--arbor-ink)" }}>{t("elev.hearing.saveError")}</p>}
        </>
      ) : (
        <>
          <p role="status" data-testid={`${testId}-kept`} className="mt-1.5 t-sm leading-relaxed" style={{ color: "var(--arbor-ink)" }}>
            {t("elev.hearing.kept", { date: intakeDay(stored.answeredAt, lang), answer: t(hearingAnswerKey(stored.answer)) })}
          </p>
          {stored.answer === "notSure" && <p data-testid={`${testId}-route`} className="mt-1 t-sm leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }}>{t("elev.hearing.notSure")}</p>}
          <button type="button" data-testid={`${testId}-change`} onClick={() => setEditing(true)} className="mt-1 inline-flex min-h-11 items-center t-sm font-semibold" style={{ color: "var(--arbor-green-ink)" }}>
            {t("elev.hearing.change")}
          </button>
        </>
      )}
    </section>
  );
}
