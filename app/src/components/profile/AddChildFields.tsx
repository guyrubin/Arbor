/** Existing Add-child sheet fields. First-run onboarding is B-SHELL-36; this
 * older add-child contract remains unchanged until its own migration. */
import React, { useRef, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { Icon } from "../ui/Icon";
import { LegalLinks } from "../billing/LegalLinks";
import { isUnderThree } from "../../lib/age/forChild";
export const DOMAINS: { id: string; nameKey: string; subKey: string; icon: React.ReactNode }[] = [
  { id: "feelings", nameKey: "ob.step.domains.feelings", subKey: "ob.step.domains.feelings.sub", icon: <Icon name="favorite" size={20} /> },
  { id: "language", nameKey: "ob.step.domains.language", subKey: "ob.step.domains.language.sub", icon: <Icon name="chat_bubble" size={20} /> },
  { id: "social", nameKey: "ob.step.domains.social", subKey: "ob.step.domains.social.sub", icon: <Icon name="group" size={20} /> },
  { id: "sleep", nameKey: "ob.step.domains.sleep", subKey: "ob.step.domains.sleep.sub", icon: <Icon name="bedtime" size={20} /> },
  { id: "focus", nameKey: "ob.step.domains.focus", subKey: "ob.step.domains.focus.sub", icon: <Icon name="menu_book" size={20} /> },
  { id: "behavior", nameKey: "ob.step.domains.behavior", subKey: "ob.step.domains.behavior.sub", icon: <Icon name="repeat" size={20} /> },
  { id: "eating", nameKey: "ob.step.domains.eating", subKey: "ob.step.domains.eating.sub", icon: <Icon name="restaurant" size={20} /> },
];

function clampInt(raw: string, lo: number, hi: number): number {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

interface StepChildProps {
  name: string;
  setName: (v: string) => void;
  ageYears: number;
  setAgeYears: (v: number) => void;
  ageMonthsPart: number;
  setAgeMonthsPart: (v: number) => void;
  /** MOB-11: "" until the parent chooses to give one. Never derived. */
  birthDate: string;
  setBirthDate: (v: string) => void;
  languages: string[];
  setLanguages: (v: string[]) => void;
  controllerConsent: boolean;
  setControllerConsent: (v: boolean) => void;
  creating: boolean;
  onNext: () => void;
}

const LANGUAGES = ["Hebrew", "English", "Arabic", "Russian", "French", "Other"];

/** Exported for the guard test, as StepReady is (MOB-12 precedent). */
export function StepChild({
  name, setName, ageYears, setAgeYears, ageMonthsPart, setAgeMonthsPart,
  birthDate, setBirthDate,
  languages, setLanguages, controllerConsent, setControllerConsent, creating, onNext,
}: StepChildProps) {
  const { t } = useLanguage();
  const [showLangs, setShowLangs] = useState(false);
  const [showBirthday, setShowBirthday] = useState(false);

  // Anti-trap: the continue button stays enabled; a tap with a missing field
  // moves focus to that field and marks it, instead of silently doing nothing.
  const nameRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);
  const [missing, setMissing] = useState<"name" | "consent" | null>(null);

  const handleContinue = () => {
    if (creating) return;
    if (!name.trim()) {
      setMissing("name");
      nameRef.current?.focus();
      return;
    }
    if (!controllerConsent) {
      setMissing("consent");
      consentRef.current?.focus();
      return;
    }
    setMissing(null);
    onNext();
  };

  const isUnder3 = isUnderThree({ age: ageYears });

  const handleYearsChange = (years: number) => {
    setAgeYears(years);
    if (years >= 3) setAgeMonthsPart(0);
  };

  const toggleLang = (l: string) =>
    setLanguages(languages.includes(l) ? languages.filter((x) => x !== l) : [...languages, l]);

  const totalAgeMonths = ageYears * 12 + ageMonthsPart;
  const ageDisplayLabel =
    totalAgeMonths === 0
      ? "newborn"
      : isUnder3
        ? ageYears === 0
          ? `${ageMonthsPart} month${ageMonthsPart !== 1 ? "s" : ""}`
          : ageMonthsPart === 0
            ? `${ageYears} year${ageYears !== 1 ? "s" : ""}`
            : `${ageYears}y ${ageMonthsPart}m`
        : `${ageYears} year${ageYears !== 1 ? "s" : ""}`;

  const inputStyle: React.CSSProperties = {
    background: "var(--arbor-paper-deep)",
    border: "1px solid var(--arbor-rule-strong)",
    color: "var(--arbor-ink)",
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-black tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
          {t("ob.step.child.title")}
        </h2>
        <p className="text-sm mt-1" style={{ color: "var(--arbor-muted)" }}>{t("ob.step.child.subtitle")}</p>
      </div>

      {/* Name + age picker row */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-start">
        <div className="space-y-1.5">
          <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("ob.name")}</label>
          <input
            autoFocus
            ref={nameRef}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (missing === "name" && e.target.value.trim()) setMissing(null);
            }}
            placeholder={t("ob.namePlaceholder")}
            aria-invalid={missing === "name"}
            className="w-full rounded-xl px-4 py-2.5 focus:outline-none"
            style={
              missing === "name"
                ? { ...inputStyle, border: "1.5px solid var(--arbor-clay)", boxShadow: "0 0 0 3px rgba(224,122,95,0.18)" }
                : inputStyle
            }
          />
        </div>

        {/* MOB-11 · one ChildAgeField, the drawer's shape.
            Two range sliders used to stand here, and what they wrote was a
            BIRTHDAY: "3 years" became birthDate "2023-09-01", a day nobody
            entered, which then drove bands, screening windows and monitoring.
            The profile drawer (GP-03) already asks Years + Months as two number
            inputs; this is that field, so the two places a parent states an age
            now agree, and an exact birthday is an OPTIONAL disclosure rather
            than something inferred from a slider. */}
        <div className="space-y-1.5 sm:w-[190px]" data-testid="child-age-field">
          <label className="text-xs font-bold flex items-center gap-1" style={{ color: "var(--arbor-muted)" }}>
            {t("ob.ageMonths.label")}
            <span className="font-extrabold" style={{ color: "var(--arbor-green-ink)" }}>{ageDisplayLabel}</span>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-[11px] font-bold" style={{ color: "var(--arbor-muted)" }}>
              {t("ob.ageMonths.years")}
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={18}
                value={ageYears}
                onChange={(e) => handleYearsChange(clampInt(e.target.value, 0, 18))}
                className="w-full rounded-xl px-3 py-2.5 min-h-[44px] focus:outline-none"
                style={inputStyle}
                aria-label={t("ob.ageMonths.years")}
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-bold" style={{ color: isUnder3 ? "var(--arbor-muted)" : "var(--arbor-faint)" }}>
              {t("ob.ageMonths.months")}
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={11}
                disabled={!isUnder3}
                value={ageMonthsPart}
                onChange={(e) => setAgeMonthsPart(clampInt(e.target.value, 0, 11))}
                className="w-full rounded-xl px-3 py-2.5 min-h-[44px] focus:outline-none disabled:opacity-50"
                style={inputStyle}
                aria-label={t("ob.ageMonths.months")}
              />
            </label>
          </div>

          {/* Optional, never required: a parent who wants the exact date can
              give it, and nobody is asked for a child's birthday to proceed. */}
          {!showBirthday ? (
            <button type="button" onClick={() => setShowBirthday(true)} className="text-[11px] font-bold" style={{ color: "var(--arbor-green-ink)", minHeight: 44 }}>
              {t("elev.ob.birthday.add")}
            </button>
          ) : (
            <label className="flex flex-col gap-1 text-[11px] font-bold" style={{ color: "var(--arbor-muted)" }}>
              {t("elev.ob.birthday.label")}
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                data-testid="ob-birthdate"
                className="w-full rounded-xl px-3 py-2.5 min-h-[44px] focus:outline-none"
                style={inputStyle}
              />
            </label>
          )}
        </div>
      </div>

      {/* Languages (optional) */}
      {!showLangs ? (
        <button type="button" onClick={() => setShowLangs(true)} className="inline-flex min-h-11 w-full items-center text-start text-xs font-bold" style={{ color: "var(--arbor-green-ink)" }}>
          {t("ob.addLangs")}
        </button>
      ) : (
        <div className="space-y-2">
          <label className="text-xs font-bold block" style={{ color: "var(--arbor-muted)" }}>{t("ob.langsAtHome")}</label>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => toggleLang(l)}
                className="min-h-11 px-3 py-1.5 rounded-xl text-xs font-bold transition"
                style={
                  languages.includes(l)
                    ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid color-mix(in srgb, var(--arbor-green-ink) 40%, transparent)" }
                    : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }
                }
              >
                {t("ob.lang." + l.toLowerCase())}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Consent block */}
      <div
        className="space-y-2.5 rounded-2xl p-3.5 transition-shadow"
        style={{
          background: "var(--arbor-green-soft)",
          border: missing === "consent" ? "1px solid var(--arbor-clay)" : "1px solid color-mix(in srgb, var(--arbor-green-ink) 30%, transparent)",
          boxShadow: missing === "consent" ? "0 0 0 3px rgba(224,122,95,0.18)" : "none",
        }}
      >
        <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-green-ink)" }}>
          <Icon name="verified_user" size={14} /> {t("ob.consent.heading")}
        </span>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            ref={consentRef}
            checked={controllerConsent}
            onChange={(e) => {
              setControllerConsent(e.target.checked);
              if (missing === "consent" && e.target.checked) setMissing(null);
            }}
            aria-invalid={missing === "consent"}
            className="mt-0.5 flex-shrink-0"
            /* MOB-11: the control that records controller consent for a child's
               data measured 13x18 on a phone. 24px is the floor for a control
               this consequential, and the label reads at 14px beside it. */
            style={{ accentColor: "var(--arbor-green-ink)", width: 24, height: 24, minWidth: 24, minHeight: 24 }}
          />
          <span className="text-[14px] leading-snug" style={{ color: "var(--arbor-ink)" }}>{t("ob.consent.controller")}</span>
        </label>
        {/* MOB-01: a parent giving controller consent for child data can read
            what they are consenting to — Privacy · Terms · Support, in-app. */}
        <LegalLinks />
      </div>

      <button
        type="button"
        onClick={handleContinue}
        disabled={creating}
        aria-busy={creating}
        className="w-full py-3 text-white font-extrabold text-sm rounded-2xl transition active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
        style={{ background: "var(--arbor-gradient-primary)", boxShadow: "var(--arbor-clay-glow)" }}
      >
        {creating && <Icon name="refresh" size={16} className="animate-spin" />}
        {creating ? t("ob.settingUp") : t("ob.step.continue")}
      </button>
    </div>
  );
}

// ── Step 3 — Focus domain picker ───────────────────────────────────────────

/** Exported for the guard test, as StepReady is (MOB-12 precedent). */
export function StepDomains({
  selectedDomains,
  setSelectedDomains,
  onNext,
  onSkip,
}: {
  selectedDomains: string[];
  setSelectedDomains: (v: string[]) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const { t } = useLanguage();

  const toggle = (id: string) =>
    setSelectedDomains(
      selectedDomains.includes(id)
        ? selectedDomains.filter((d) => d !== id)
        : [...selectedDomains, id],
    );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-black tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
          {t("ob.step.domains.title")}
        </h2>
        <p className="text-sm mt-1 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
          {t("ob.step.domains.subtitle")}
        </p>
        <p className="text-xs mt-2 font-bold" style={{ color: "var(--arbor-green-ink)" }}>
          {t("ob.step.domains.multiHint")}
        </p>
      </div>

      {/* 7 domain tiles — multi-select; no score/status/warning/red styling */}
      <div className="grid grid-cols-1 gap-2">
        {DOMAINS.map((d) => {
          const on = selectedDomains.includes(d.id);
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => toggle(d.id)}
              className="flex items-start gap-3 px-4 py-3 rounded-2xl text-start transition active:scale-[0.99]"
              style={
                on
                  ? { background: "var(--arbor-green-soft)", border: "1px solid color-mix(in srgb, var(--arbor-green-ink) 40%, transparent)" }
                  : { background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }
              }
              aria-pressed={on}
            >
              <span
                className="mt-0.5 flex-shrink-0"
                style={{ color: on ? "var(--arbor-green-ink)" : "var(--arbor-muted)" }}
              >
                {d.icon}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-extrabold" style={{ color: on ? "var(--arbor-green-ink)" : "var(--arbor-ink)" }}>
                  {t(d.nameKey)}
                </span>
                <span className="block text-xs leading-snug mt-0.5" style={{ color: "var(--arbor-muted)" }}>
                  {t(d.subKey)}
                </span>
              </span>
              {on && (
                <span className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center self-center" style={{ background: "var(--arbor-green-ink)" }}>
                  <svg viewBox="0 0 10 8" width="10" height="8" fill="none">
                    <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer reassurance — VERBATIM copy from clearance */}
      <p className="text-[11px] text-center" style={{ color: "var(--arbor-muted)" }}>
        {t("ob.step.domains.footer")}
      </p>

      {/* OBJ-ONB-01 · sticky footer.
          Seven tiles push Continue to y960 and Skip to y1020 at 390 × 844: both
          ways out of the step sat below the fold, on the last screen before a
          parent reaches the product. The pair now rides the bottom of the step
          container, so scrolling the tiles never hides the exit. The reassurance
          line above scrolls with the tiles — it is content, not an exit.

          Anti-trap (kept): continue is never disabled. With zero picks it takes
          the skip path (all areas stay in view), matching the "choose as many as
          you like" copy instead of contradicting it with a dead button. */}
      <div
        className="sticky bottom-0 -mx-1 px-1 pt-3 pb-2 space-y-2"
        data-testid="onboarding-domains-footer"
        style={{ background: "var(--arbor-paper-elevated)", borderTop: "1px solid var(--arbor-rule)" }}
      >
        <button
          type="button"
          onClick={selectedDomains.length === 0 ? onSkip : onNext}
          className="w-full py-3 text-white font-extrabold text-sm rounded-2xl transition active:scale-[0.98]"
          style={{ background: "var(--arbor-gradient-primary)", boxShadow: "var(--arbor-clay-glow)", minHeight: 44 }}
        >
          {t("ob.step.continue")}
        </button>

        <button
          type="button"
          onClick={onSkip}
          className="w-full text-xs font-bold py-2"
          style={{ color: "var(--arbor-muted)", minHeight: 44 }}
        >
          {t("ob.step.domains.skip")}
        </button>
      </div>
    </div>
  );
}
