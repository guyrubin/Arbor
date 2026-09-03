import React from "react";
import { useLanguage } from "../../context/LanguageContext";
import { ageLabelForMonths } from "../../lib/childAge";
import { ageMonthsOfInput, dobBounds, isValidBirthDate, type ChildAgeInput } from "../../lib/childProfileInput";

/**
 * MOB-11 / GP-03 — the ONE child-age control.
 *
 * DOB first: a native `<input type="date">` (the OS wheel on iOS/Android;
 * max = today, min = today − 18y) — the gold source lib/childAge prefers.
 * Secondary "not sure — enter the age" mode: years + months steppers with
 * 44 px targets (never a slider: ~9 px per year on a phone). Both modes
 * emit ONE ChildAgeInput that lib/childProfileInput.buildChildAgeFields turns
 * into { birthDate, ageMonths, age } — no surface writes an age field alone.
 * Mounted by OnboardingFlow step 2, AddChildModal and ProfileEditDrawer
 * (childAgeField.test.ts pins the three mounts).
 *
 * Firewall: the live label is a factual age (ageLabelForMonths) — never a
 * band, verdict or comparison. Tokens only; logical props for RTL.
 */
export function ChildAgeField({
  value,
  onChange,
  childName,
  invalid = false,
  autoFocus = false,
  now,
  idPrefix = "child-age",
}: {
  value: ChildAgeInput;
  onChange: (next: ChildAgeInput) => void;
  /** For the hint copy ("…in step with {name}'s age"). */
  childName?: string;
  /** Anti-trap marking from the parent form (missing / out-of-range DOB). */
  invalid?: boolean;
  autoFocus?: boolean;
  /** Deterministic "today" for tests. */
  now?: Date;
  idPrefix?: string;
}) {
  const { t } = useLanguage();
  const bounds = dobBounds(now);
  const months = ageMonthsOfInput(value, now);
  const name = childName?.trim() || t("elev.settingsWave.age.childFallback");

  const inputStyle: React.CSSProperties = {
    background: "var(--arbor-paper-deep)",
    border: invalid ? "1.5px solid var(--arbor-clay)" : "1px solid var(--arbor-rule-strong)",
    boxShadow: invalid ? "0 0 0 3px var(--arbor-clay-dim)" : "none",
    color: "var(--arbor-ink)",
    minHeight: 44,
  };

  const liveLabel = months === 0 && value.mode === "age"
    ? t("elev.settingsWave.age.newborn")
    : value.mode === "dob" && !isValidBirthDate(value.birthDate, now)
      ? ""
      : ageLabelForMonths(months, t);

  const switchToAge = () => onChange({ mode: "age", ageMonths: months });
  const switchToDob = () => onChange({ mode: "dob", birthDate: "" });

  if (value.mode === "dob") {
    return (
      <div className="space-y-1.5" data-testid={`${idPrefix}-field`} data-mode="dob">
        <label htmlFor={`${idPrefix}-dob`} className="text-xs font-bold flex items-center gap-1 flex-wrap" style={{ color: "var(--arbor-muted)" }}>
          {t("elev.settingsWave.age.dob")}
          {liveLabel && (
            <span className="font-extrabold" data-testid={`${idPrefix}-label`} style={{ color: "var(--arbor-green-ink)" }}>
              · {liveLabel}
            </span>
          )}
        </label>
        <input
          id={`${idPrefix}-dob`}
          type="date"
          autoFocus={autoFocus}
          value={value.birthDate}
          min={bounds.min}
          max={bounds.max}
          onChange={(e) => onChange({ mode: "dob", birthDate: e.target.value })}
          aria-invalid={invalid}
          aria-describedby={`${idPrefix}-hint`}
          className="w-full rounded-xl px-4 py-2.5 focus:outline-none"
          style={inputStyle}
          data-testid={`${idPrefix}-dob`}
        />
        <p id={`${idPrefix}-hint`} className="text-[11px]" style={{ color: invalid ? "var(--arbor-clay-deep)" : "var(--arbor-faint)" }}>
          {invalid ? t("elev.settingsWave.age.dob.missing") : t("elev.settingsWave.age.dob.hint", { name })}
        </p>
        <button
          type="button"
          onClick={switchToAge}
          className="text-xs font-bold inline-flex items-center min-h-[44px]"
          style={{ color: "var(--arbor-green-ink)" }}
          data-testid={`${idPrefix}-not-sure`}
        >
          {t("elev.settingsWave.age.notSure")}
        </button>
      </div>
    );
  }

  const years = Math.floor(months / 12);
  const monthsPart = months % 12;
  const set = (y: number, m: number) => {
    const total = Math.max(0, Math.min(216, y * 12 + m));
    onChange({ mode: "age", ageMonths: total });
  };

  return (
    <div className="space-y-1.5" data-testid={`${idPrefix}-field`} data-mode="age">
      <p className="text-xs font-bold flex items-center gap-1 flex-wrap" style={{ color: "var(--arbor-muted)" }}>
        {t("ob.ageMonths.label")}
        <span className="font-extrabold" data-testid={`${idPrefix}-label`} style={{ color: "var(--arbor-green-ink)" }}>
          · {liveLabel}
        </span>
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Stepper
          label={t("ob.ageMonths.years")}
          value={years}
          decLabel={t("elev.settingsWave.age.years.less")}
          incLabel={t("elev.settingsWave.age.years.more")}
          onDec={() => set(Math.max(0, years - 1), monthsPart)}
          onInc={() => set(Math.min(18, years + 1), years >= 17 ? 0 : monthsPart)}
          testId={`${idPrefix}-years`}
        />
        <Stepper
          label={t("ob.ageMonths.months")}
          value={monthsPart}
          decLabel={t("elev.settingsWave.age.months.less")}
          incLabel={t("elev.settingsWave.age.months.more")}
          onDec={() => set(years, Math.max(0, monthsPart - 1))}
          onInc={() => set(years, Math.min(11, monthsPart + 1))}
          testId={`${idPrefix}-months`}
        />
      </div>
      <button
        type="button"
        onClick={switchToDob}
        className="text-xs font-bold inline-flex items-center min-h-[44px]"
        style={{ color: "var(--arbor-green-ink)" }}
        data-testid={`${idPrefix}-use-dob`}
      >
        {t("elev.settingsWave.age.useDob")}
      </button>
    </div>
  );
}

/** − value + with 44 px targets (the slider it replaces was ~9 px per year). */
function Stepper({
  label, value, decLabel, incLabel, onDec, onInc, testId,
}: {
  label: string; value: number; decLabel: string; incLabel: string; onDec: () => void; onInc: () => void; testId: string;
}) {
  const btn: React.CSSProperties = {
    minWidth: 44,
    minHeight: 44,
    background: "var(--arbor-paper-elevated)",
    color: "var(--arbor-green-ink)",
    border: "1px solid var(--arbor-rule-strong)",
  };
  return (
    <div className="space-y-1" data-testid={testId}>
      <span className="text-[11px] font-bold block" style={{ color: "var(--arbor-muted)" }}>{label}</span>
      <div className="flex items-stretch rounded-xl overflow-hidden" style={{ border: "1px solid var(--arbor-rule-strong)", background: "var(--arbor-paper-deep)" }}>
        <button type="button" onClick={onDec} aria-label={decLabel} className="font-extrabold text-lg" style={btn}>−</button>
        <output className="flex-1 inline-flex items-center justify-center font-extrabold text-sm" style={{ color: "var(--arbor-ink)", minHeight: 44 }} aria-label={label}>
          {value}
        </output>
        <button type="button" onClick={onInc} aria-label={incLabel} className="font-extrabold text-lg" style={btn}>+</button>
      </div>
    </div>
  );
}

export default ChildAgeField;
