import React, { useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Heart, MessageCircle, Users, Moon, BookOpen, Repeat2, Utensils,
  ShieldCheck, RefreshCw, ChevronLeft,
} from "lucide-react";
import { useProfile } from "../../context/ProfileContext";
import { findIncompleteOnboardingChild } from "../../lib/onboardingGate";
import { markWowPending, setCoachSeed } from "../../lib/onboardingJourney";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import { ArborMark as ArborMarkIcon } from "../ui/ArborMark";
import { api } from "../../lib/api";
import { birthDateFromAgeMonths } from "../../lib/childAge";
import AvatarCreator from "../profile/AvatarCreator";

// ── Types ──────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5;

type AvatarResult = {
  dataUrl: string;
  style: string;
  source: "descriptor" | "photo";
};

// ── Step 3 domain tiles (AP-049; copy VERBATIM from GATED-CLEARANCES-CLINICAL §2) ─

const DOMAINS: { id: string; nameKey: string; subKey: string; icon: React.ReactNode }[] = [
  { id: "feelings", nameKey: "ob.step.domains.feelings", subKey: "ob.step.domains.feelings.sub", icon: <Heart className="w-5 h-5" /> },
  { id: "language", nameKey: "ob.step.domains.language", subKey: "ob.step.domains.language.sub", icon: <MessageCircle className="w-5 h-5" /> },
  { id: "social", nameKey: "ob.step.domains.social", subKey: "ob.step.domains.social.sub", icon: <Users className="w-5 h-5" /> },
  { id: "sleep", nameKey: "ob.step.domains.sleep", subKey: "ob.step.domains.sleep.sub", icon: <Moon className="w-5 h-5" /> },
  { id: "focus", nameKey: "ob.step.domains.focus", subKey: "ob.step.domains.focus.sub", icon: <BookOpen className="w-5 h-5" /> },
  { id: "behavior", nameKey: "ob.step.domains.behavior", subKey: "ob.step.domains.behavior.sub", icon: <Repeat2 className="w-5 h-5" /> },
  { id: "eating", nameKey: "ob.step.domains.eating", subKey: "ob.step.domains.eating.sub", icon: <Utensils className="w-5 h-5" /> },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function ArborMark() {
  return <ArborMarkIcon size={56} />;
}

function ageString(totalMonths: number): string {
  if (totalMonths < 12) return `${totalMonths} month${totalMonths !== 1 ? "s" : ""}`;
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (months === 0) return `${years} year${years !== 1 ? "s" : ""}`;
  return `${years} year${years !== 1 ? "s" : ""} ${months} month${months !== 1 ? "s" : ""}`;
}

// ── Step error boundary ────────────────────────────────────────────────────
// Onboarding is the one surface where a render crash is a permanent lockout:
// the in-flight profile makes the gate re-open the flow on every reload, so a
// crashing step would strand the account forever (this happened in prod when
// the avatar step threw outside ArborProvider). The boundary keeps the card
// shell — and the Back button — alive and offers a local retry.

class StepErrorBoundary extends React.Component<
  { retryLabel: string; message: string; children: React.ReactNode },
  { crashed: boolean }
> {
  state = { crashed: false };
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  render() {
    if (!this.state.crashed) return this.props.children;
    return (
      <div className="flex flex-col items-center text-center space-y-4 py-6">
        <ArborMark />
        <p className="text-sm" style={{ color: "var(--arbor-muted)" }}>{this.props.message}</p>
        <button
          type="button"
          onClick={() => this.setState({ crashed: false })}
          className="px-6 py-2.5 text-white font-extrabold text-sm rounded-2xl transition active:scale-[0.98]"
          style={{ background: "var(--arbor-gradient-primary)", boxShadow: "var(--arbor-clay-glow)" }}
        >
          {this.props.retryLabel}
        </button>
      </div>
    );
  }
}

// ── Progress dots ──────────────────────────────────────────────────────────

function ProgressDots({ step, total }: { step: Step; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={total} aria-label={`Step ${step} of ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        const s = (i + 1) as Step;
        const active = s === step;
        const done = s < step;
        return (
          <span
            key={i}
            className="rounded-full transition-all duration-300"
            style={{
              width: active ? 20 : 8,
              height: 8,
              background: active
                ? "var(--arbor-green-ink)"
                : done
                  ? "rgba(52,178,119,0.45)"
                  : "var(--arbor-rule-strong)",
            }}
          />
        );
      })}
    </div>
  );
}

// ── Step 1 — Welcome ───────────────────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center text-center space-y-6">
      <ArborMark />
      <div className="space-y-2">
        <h1 className="text-2xl font-black tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
          {t("ob.step.welcome.title")}
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
          {t("ob.step.welcome.subtitle")}
        </p>
      </div>
      <button
        onClick={onNext}
        className="w-full py-3 text-white font-extrabold text-sm rounded-2xl transition active:scale-[0.98]"
        style={{ background: "var(--arbor-gradient-primary)", boxShadow: "var(--arbor-clay-glow)" }}
      >
        {t("ob.step.welcome.cta")}
      </button>
    </div>
  );
}

// ── Step 2 — Child name + age ──────────────────────────────────────────────

interface StepChildProps {
  name: string;
  setName: (v: string) => void;
  ageYears: number;
  setAgeYears: (v: number) => void;
  ageMonthsPart: number;
  setAgeMonthsPart: (v: number) => void;
  languages: string[];
  setLanguages: (v: string[]) => void;
  controllerConsent: boolean;
  setControllerConsent: (v: boolean) => void;
  creating: boolean;
  onNext: () => void;
}

const LANGUAGES = ["Hebrew", "English", "Arabic", "Russian", "French", "Other"];

function StepChild({
  name, setName, ageYears, setAgeYears, ageMonthsPart, setAgeMonthsPart,
  languages, setLanguages, controllerConsent, setControllerConsent, creating, onNext,
}: StepChildProps) {
  const { t } = useLanguage();
  const [showLangs, setShowLangs] = useState(false);

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

  const isUnder3 = ageYears < 3;

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

        {/* B0 — months-precise age picker (preserved exactly from original stub) */}
        <div className="space-y-1.5 sm:w-[170px]">
          <label className="text-xs font-bold flex items-center gap-1" style={{ color: "var(--arbor-muted)" }}>
            {t("ob.ageMonths.label")}
            <span className="font-extrabold" style={{ color: "var(--arbor-green-ink)" }}>{ageDisplayLabel}</span>
          </label>

          {/* Years slider — 0–18, always visible */}
          <div className="space-y-0.5">
            <span className="text-[11px]" style={{ color: "var(--arbor-muted)" }}>{t("ob.ageMonths.years")}</span>
            <input
              type="range"
              min={0}
              max={18}
              value={ageYears}
              onChange={(e) => handleYearsChange(parseInt(e.target.value))}
              className="w-full"
              style={{ accentColor: "var(--arbor-clay)", minHeight: 44 }}
              aria-label={t("ob.ageMonths.years")}
            />
          </div>

          {/* Months slider — 0–11, under-3 only */}
          {isUnder3 && (
            <div className="space-y-0.5 mt-1">
              <span className="text-[11px]" style={{ color: "var(--arbor-muted)" }}>{t("ob.ageMonths.months")}</span>
              <input
                type="range"
                min={0}
                max={11}
                value={ageMonthsPart}
                onChange={(e) => setAgeMonthsPart(parseInt(e.target.value))}
                className="w-full"
                style={{ accentColor: "var(--arbor-clay)", minHeight: 44 }}
                aria-label={t("ob.ageMonths.months")}
              />
            </div>
          )}
        </div>
      </div>

      {/* Languages (optional) */}
      {!showLangs ? (
        <button type="button" onClick={() => setShowLangs(true)} className="text-xs font-bold" style={{ color: "var(--arbor-green-ink)" }}>
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
                className="px-3 py-1.5 rounded-xl text-xs font-bold transition"
                style={
                  languages.includes(l)
                    ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.40)" }
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
          border: missing === "consent" ? "1px solid var(--arbor-clay)" : "1px solid rgba(52,178,119,0.30)",
          boxShadow: missing === "consent" ? "0 0 0 3px rgba(224,122,95,0.18)" : "none",
        }}
      >
        <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-green-ink)" }}>
          <ShieldCheck className="w-3.5 h-3.5" /> {t("ob.consent.heading")}
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
            className="mt-0.5"
            style={{ accentColor: "var(--arbor-green-ink)", width: 18, height: 18 }}
          />
          <span className="text-[12px] leading-snug" style={{ color: "var(--arbor-ink)" }}>{t("ob.consent.controller")}</span>
        </label>
      </div>

      <button
        type="button"
        onClick={handleContinue}
        disabled={creating}
        aria-busy={creating}
        className="w-full py-3 text-white font-extrabold text-sm rounded-2xl transition active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
        style={{ background: "var(--arbor-gradient-primary)", boxShadow: "var(--arbor-clay-glow)" }}
      >
        {creating && <RefreshCw className="w-4 h-4 animate-spin" aria-hidden />}
        {creating ? t("ob.settingUp") : t("ob.step.continue")}
      </button>
    </div>
  );
}

// ── Step 3 — Focus domain picker ───────────────────────────────────────────

function StepDomains({
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
                  ? { background: "var(--arbor-green-soft)", border: "1px solid rgba(52,178,119,0.40)" }
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

      {/* Anti-trap: continue is never disabled. With zero picks it takes the skip
          path (all areas stay in view), matching the "choose as many as you like"
          copy instead of contradicting it with a dead button. */}
      <button
        type="button"
        onClick={selectedDomains.length === 0 ? onSkip : onNext}
        className="w-full py-3 text-white font-extrabold text-sm rounded-2xl transition active:scale-[0.98]"
        style={{ background: "var(--arbor-gradient-primary)", boxShadow: "var(--arbor-clay-glow)" }}
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
  );
}

// ── Step 4 — Avatar creation ───────────────────────────────────────────────

function StepAvatar({
  childId,
  childName,
  onAvatarCreated,
  onSkip,
  replayMode,
}: {
  childId: string;
  childName: string;
  onAvatarCreated: (result: AvatarResult) => void;
  onSkip: () => void;
  /** When true this is a no-persist replay — AvatarCreator must NOT open. */
  replayMode?: boolean;
}) {
  const { t } = useLanguage();
  const [avatarOpen, setAvatarOpen] = useState(false);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-black tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
          {t("ob.step.avatar.title", { name: childName })}
        </h2>
        <p className="text-sm mt-1 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
          {t("ob.step.avatar.subtitle")}
        </p>
      </div>

      {/*
       * DEMO-MODE GUARD (AP-049 AC-1 replay):
       * In replayMode the "Continue" button advances to the next step without
       * opening AvatarCreator, so zero face_processing/consent/generate calls
       * can fire during a replay. The real first-run path (replayMode=false) is
       * unchanged — clicking "Continue" opens AvatarCreator as before.
       */}
      <button
        type="button"
        onClick={replayMode ? onSkip : () => setAvatarOpen(true)}
        className="w-full py-3 text-white font-extrabold text-sm rounded-2xl transition active:scale-[0.98]"
        style={{ background: "var(--arbor-gradient-primary)", boxShadow: "var(--arbor-clay-glow)" }}
      >
        {t("ob.step.continue")}
      </button>

      <button
        type="button"
        onClick={onSkip}
        className="w-full text-xs font-bold py-2"
        style={{ color: "var(--arbor-muted)", minHeight: 44 }}
      >
        {t("ob.step.avatar.skip")}
      </button>

      {/*
       * BINDING SAFETY CONDITION AP-049 / F-NEW:
       * AvatarCreator's existing gated path calls api.grantConsent({ childId, purpose: "face_processing" })
       * BEFORE api.generateAvatar on the photo path (enforced via runAvatarGeneration in avatarGate.ts).
       * We do NOT add any new photo-upload path here. The consent is handled entirely inside AvatarCreator.
       * The reference photo is local-only: it is passed as a transient dataUrl and never written to
       * Firestore or Storage — only the stylized avatar result is retained by the caller.
       *
       * replayMode suppresses the modal entirely (avatarOpen stays false and the
       * button above calls onSkip directly), so this component never renders
       * with open=true during a replay.
       */}
      {!replayMode && (
        <AvatarCreator
          open={avatarOpen}
          childId={childId}
          childName={childName}
          onClose={() => setAvatarOpen(false)}
          onCreated={(result) => {
            setAvatarOpen(false);
            onAvatarCreated(result);
          }}
        />
      )}
    </div>
  );
}

// ── Step 5 — Ready ─────────────────────────────────────────────────────────

function StepReady({
  name,
  ageYears,
  ageMonthsPart,
  selectedDomains,
  avatarResult,
  saving,
  onSubmit,
  onReplay,
}: {
  name: string;
  ageYears: number;
  ageMonthsPart: number;
  selectedDomains: string[];
  avatarResult: AvatarResult | null;
  saving: boolean;
  onSubmit: () => void;
  /** Triggers a non-persisting replay of the full flow from Step 1. */
  onReplay: () => void;
}) {
  const { t } = useLanguage();
  const totalAgeMonths = ageYears * 12 + ageMonthsPart;

  const ageLabel =
    totalAgeMonths === 0
      ? "newborn"
      : ageString(totalAgeMonths);

  const domainLabels = selectedDomains
    .map((id) => {
      const d = DOMAINS.find((x) => x.id === id);
      return d ? t(d.nameKey) : id;
    })
    .join(", ");

  const row = (label: string, value: string) => (
    <div key={label} className="flex items-start justify-between gap-4 py-2" style={{ borderBottom: "1px solid var(--arbor-rule)" }}>
      <span className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{label}</span>
      <span className="text-xs font-extrabold text-end" style={{ color: "var(--arbor-ink)" }}>{value}</span>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center text-center space-y-2">
        <ArborMark />
        <h2 className="text-xl font-black tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
          {t("ob.step.ready.title", { name })}
        </h2>
        <p className="text-sm" style={{ color: "var(--arbor-muted)" }}>{t("ob.step.ready.subtitle")}</p>
      </div>

      <div className="rounded-2xl p-4 space-y-0" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
        {row(t("ob.step.ready.labelName"), name)}
        {row(t("ob.step.ready.labelAge"), ageLabel)}
        {row(
          t("ob.step.ready.labelDomains"),
          selectedDomains.length > 0 ? domainLabels : t("ob.step.ready.noDomains"),
        )}
        {row(
          t("ob.step.ready.labelAvatar"),
          avatarResult ? t("ob.step.ready.avatarSet") : t("ob.step.ready.avatarSkipped"),
        )}
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={saving}
        className="w-full py-3 text-white font-extrabold text-sm rounded-2xl transition active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ background: "var(--arbor-gradient-primary)", boxShadow: "var(--arbor-clay-glow)" }}
      >
        {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
        {t("ob.step.ready.cta")}
      </button>

      {/* AP-049 AC-1: re-launchable demo entry point */}
      <button
        type="button"
        onClick={onReplay}
        className="w-full text-xs font-bold py-2 flex items-center justify-center gap-1.5"
        style={{ color: "var(--arbor-muted)", minHeight: 44 }}
        aria-label={t("ob.demo.relaunch")}
      >
        <RefreshCw className="w-3.5 h-3.5" aria-hidden />
        {t("ob.demo.relaunch")}
      </button>
    </div>
  );
}

// ── Root component ─────────────────────────────────────────────────────────

/** AP-049 — 5-step structured onboarding. Reskins the original single-screen stub
 *  into a stepped flow with progress dots, back/continue/skip, and a demo mode.
 *  All child data writes go through ProfileContext.addChild (no schema change).
 *  Step 4 (Avatar) enforces face_processing consent via AvatarCreator's gated path. */
export default function OnboardingFlow() {
  const { addChild, updateChild, profiles } = useProfile();
  const { toast } = useToast();
  const { t } = useLanguage();

  // P0.4 — resume: if a profile was created but onboarding never finished
  // (onboardingComplete === false), pick up where the parent left off instead of
  // creating a duplicate child. Computed once at mount (the gate only renders this
  // flow when profiles is loaded).
  const resumeChild = findIncompleteOnboardingChild(profiles);
  const resumeMonths = resumeChild ? (resumeChild.ageMonths ?? resumeChild.age * 12) : 0;

  // Navigation — resume past the create step (Step 3) when continuing an in-flight setup.
  const [step, setStep] = useState<Step>(resumeChild ? 3 : 1);

  /**
   * REPLAY / DEMO MODE (AP-049 AC-1):
   * When replaying=true the flow is a preview-only pass. No profile writes,
   * no consent calls, and no AvatarCreator modal can fire. The real first-run
   * path (replaying=false, profile created once in handleStep2Next) is unchanged.
   */
  const [replaying, setReplaying] = useState(false);

  // Step 2 state (name + age + consent) — keep months-precise picker exactly.
  // On resume, hydrate from the in-flight profile: the parent already entered these
  // (and gave consent — the profile exists), so stepping back to Step 2 must show
  // their data, not blank fields behind a blocked continue.
  const [name, setName] = useState(resumeChild?.name ?? "");
  const [ageYears, setAgeYears] = useState(resumeChild ? Math.floor(resumeMonths / 12) : 0);
  const [ageMonthsPart, setAgeMonthsPart] = useState(resumeChild ? resumeMonths % 12 : 0);
  const [languages, setLanguages] = useState<string[]>(
    resumeChild?.languages?.length ? resumeChild.languages : ["English"],
  );
  const [controllerConsent, setControllerConsent] = useState(resumeChild !== null);
  const [creating, setCreating] = useState(false);

  // Step 3 state (domain multi-select)
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);

  // Step 4 state (avatar)
  const [avatarResult, setAvatarResult] = useState<AvatarResult | null>(null);
  // childId is available after addChild; for Avatar step we create the profile first.
  // On resume, preset it to the in-flight child so we never create a duplicate.
  const [createdChildId, setCreatedChildId] = useState<string | null>(resumeChild?.id ?? null);

  // Step 5 state
  const [saving, setSaving] = useState(false);

  // Derived
  const totalAgeMonths = ageYears * 12 + ageMonthsPart;
  const ageLegacyYears = Math.floor(totalAgeMonths / 12);

  // ── Step transitions ────────────────────────────────────────────────────

  const goNext = () => setStep((s) => Math.min(s + 1, 5) as Step);
  const goBack = () => setStep((s) => Math.max(s - 1, 1) as Step);

  // After step 2 confirmed: create the profile so we have a childId for AvatarCreator.
  const handleStep2Next = async () => {
    if (!name.trim() || !controllerConsent || creating) return;

    // DEMO-MODE GUARD: in replay mode skip all profile writes — just advance.
    if (replaying) {
      goNext();
      return;
    }

    // RESUME / RE-ENTRY GUARD (P0.4): the profile already exists (resumed in-flight
    // setup, or we stepped back to Step 2). Never create a second child — just advance.
    if (createdChildId) {
      goNext();
      return;
    }

    // Create the child profile now so step 4 (AvatarCreator) has a real childId.
    // `creating` holds the button in a visible busy state for the duration of the
    // write and blocks the re-tap that would otherwise create a duplicate child.
    const birthDate = birthDateFromAgeMonths(totalAgeMonths);
    setCreating(true);
    try {
      const child = await addChild({
        name: name.trim(),
        age: ageLegacyYears,
        birthDate,
        ageMonths: totalAgeMonths,
        languages: languages.length ? languages : ["English"],
        schoolContext: "",
        strengths: [],
        challenges: [],
        riskLevel: "Low",
        // P0.4: mark setup as in-flight so the gate keeps the flow mounted through
        // every step and resumes (not restarts) if interrupted. Flipped true at submit.
        onboardingComplete: false,
      });
      setCreatedChildId(child.id);
      goNext();
    } catch {
      toast(t("ob.fail"), "error");
    } finally {
      setCreating(false);
    }
  };

  // ── Start a non-persisting replay of the flow from Step 1 ─────────────────

  const startReplay = () => {
    setReplaying(true);
    setStep(1);
  };

  // ── Final submit (step 5) ───────────────────────────────────────────────

  const submit = async () => {
    // DEMO-MODE GUARD (AP-049 AC-1): the replay pass itself (steps 1–4) makes no
    // writes. The final CTA is the demo's exit — it ends replay mode and falls
    // through to the REAL submit for the already-created profile. (Previously this
    // early-returned with replaying never reset, leaving the parent permanently
    // stuck on step 5 with a dead button.)
    if (replaying) setReplaying(false);

    if (!createdChildId || saving) return;
    setSaving(true);
    try {
      // Build challenges from selected domains (maps domain ids to display names).
      const challenges = selectedDomains.map((id) => {
        const d = DOMAINS.find((x) => x.id === id);
        return d ? t(d.nameKey) : id;
      });

      // Patch the existing profile with domain choices and avatar (if set), and
      // P0.4: stamp explicit completion. This patch always has the two completion
      // keys, so the write always runs — flipping the gate from "in-flight" to done.
      const patch: Record<string, unknown> = {
        onboardingComplete: true,
        onboardingCompletedAt: new Date().toISOString(),
      };
      if (challenges.length) patch.challenges = challenges;
      // W6.1 / ONB-1: persist the avatar in the canonical shape (photoUrl data
      // URL + typed metadata — same patch as AvatarCreator's other callers).
      // The old write stuffed the raw dataUrl string into the metadata-typed
      // `avatar` field and never set photoUrl, so the first-run hero was
      // invisible (useHeroAvatar reads comicAvatarUrl||photoUrl).
      if (avatarResult) {
        patch.photoUrl = avatarResult.dataUrl;
        patch.avatar = {
          style: avatarResult.style,
          source: avatarResult.source,
          createdAt: new Date().toISOString(),
        };
      }

      await updateChild(createdChildId, patch as Parameters<typeof updateChild>[1]);

      // W6.1: a REAL first-run just completed → queue the wow (E0 hero-comic
      // overlay) to fire exactly once when Shell mounts. Submit is inherently
      // the real path — the demo replay's exit CTA falls through to this same
      // real completion, so no replay guard belongs here.
      markWowPending();

      // Seed the coach if domains were picked.
      if (selectedDomains.length > 0) {
        const firstDomain = DOMAINS.find((d) => d.id === selectedDomains[0]);
        const topDomain = firstDomain ? t(firstDomain.nameKey) : selectedDomains[0];
        setCoachSeed(
          `${topDomain} is on my mind with ${name.trim()} (${ageString(totalAgeMonths)}). Where should I start?`,
        );
      }

      toast(t("ob.ready", { name: name.trim() }), "success");
    } catch {
      toast(t("ob.fail"), "error");
      setSaving(false);
    }
  };

  // ── Shared card wrapper ─────────────────────────────────────────────────

  const canGoBack = step > 1;
  const reduceMotion = useReducedMotion();

  return (
    <div className="arbor-app min-h-screen flex items-center justify-center px-4 py-10 antialiased text-sans">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-lg bg-white rounded-3xl p-6 md:p-8 space-y-5"
        style={{ border: "1px solid var(--arbor-rule)", boxShadow: "0 24px 60px rgba(41,51,63,0.12)" }}
      >
        {/* Top bar: back chevron + progress dots */}
        <div className="flex items-center gap-3">
          {canGoBack ? (
            <button
              type="button"
              onClick={goBack}
              className="rounded-lg transition flex items-center justify-center"
              style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)", width: 36, height: 36 }}
              aria-label={t("ob.step.back")}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          ) : (
            <div style={{ width: 36 }} />
          )}
          <div className="flex-1">
            <ProgressDots step={step} total={5} />
          </div>
          <div style={{ width: 36 }} />
        </div>

        {/* Step content with an entrance-only slide. Deliberately NO AnimatePresence
            exit animation: mode="wait" gates the next step's mount on an exit
            callback that never fires when rAF is throttled (backgrounded tab,
            webview, low-power modes) — the dots advance but the screen freezes on
            the old step. Entrance-only keeps the motion without the stuck-vector.
            The boundary is keyed by step so navigating (Back) out of a crashed
            step resets it. */}
        <StepErrorBoundary key={step} retryLabel={t("err.retry")} message={t("ob.fail")}>
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.22 }}
          >
            {step === 1 && <StepWelcome onNext={goNext} />}

            {step === 2 && (
              <StepChild
                name={name} setName={setName}
                ageYears={ageYears} setAgeYears={setAgeYears}
                ageMonthsPart={ageMonthsPart} setAgeMonthsPart={setAgeMonthsPart}
                languages={languages} setLanguages={setLanguages}
                controllerConsent={controllerConsent} setControllerConsent={setControllerConsent}
                creating={creating}
                onNext={handleStep2Next}
              />
            )}

            {step === 3 && (
              <StepDomains
                selectedDomains={selectedDomains}
                setSelectedDomains={setSelectedDomains}
                onNext={goNext}
                onSkip={goNext}
              />
            )}

            {step === 4 && (createdChildId || replaying) && (
              <StepAvatar
                childId={createdChildId ?? ""}
                childName={name.trim()}
                onAvatarCreated={(result) => {
                  setAvatarResult(result);
                  goNext();
                }}
                onSkip={goNext}
                replayMode={replaying}
              />
            )}

            {step === 5 && (
              <StepReady
                name={name.trim()}
                ageYears={ageYears}
                ageMonthsPart={ageMonthsPart}
                selectedDomains={selectedDomains}
                avatarResult={avatarResult}
                saving={saving}
                onSubmit={submit}
                onReplay={startReplay}
              />
            )}
          </motion.div>
        </StepErrorBoundary>

        <p className="text-[11px] text-center" style={{ color: "var(--arbor-muted)" }}>
          {t("ob.footer")}
        </p>
      </motion.div>
    </div>
  );
}
