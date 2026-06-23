import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Heart, MessageCircle, Users, Moon, BookOpen, Repeat2, Utensils,
  ShieldCheck, RefreshCw, ChevronLeft,
} from "lucide-react";
import { useProfile } from "../../context/ProfileContext";
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
        style={{ background: "linear-gradient(135deg,#3cc081,var(--arbor-clay) 60%,var(--arbor-clay-deep))", boxShadow: "0 8px 20px rgba(52,178,119,0.24)" }}
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
  onNext: () => void;
}

const LANGUAGES = ["Hebrew", "English", "Arabic", "Russian", "French", "Other"];

function StepChild({
  name, setName, ageYears, setAgeYears, ageMonthsPart, setAgeMonthsPart,
  languages, setLanguages, controllerConsent, setControllerConsent, onNext,
}: StepChildProps) {
  const { t } = useLanguage();
  const [showLangs, setShowLangs] = useState(false);

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
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("ob.namePlaceholder")}
            className="w-full rounded-xl px-4 py-2.5 focus:outline-none"
            style={inputStyle}
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
      <div className="space-y-2.5 rounded-2xl p-3.5" style={{ background: "var(--arbor-green-soft)", border: "1px solid rgba(52,178,119,0.30)" }}>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-green-ink)" }}>
          <ShieldCheck className="w-3.5 h-3.5" /> {t("ob.consent.heading")}
        </span>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" checked={controllerConsent} onChange={(e) => setControllerConsent(e.target.checked)} className="mt-0.5" style={{ accentColor: "var(--arbor-green-ink)" }} />
          <span className="text-[12px] leading-snug" style={{ color: "var(--arbor-ink)" }}>{t("ob.consent.controller")}</span>
        </label>
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={!name.trim() || !controllerConsent}
        className="w-full py-3 text-white font-extrabold text-sm rounded-2xl transition active:scale-[0.98] disabled:opacity-50"
        style={{ background: "linear-gradient(135deg,#3cc081,var(--arbor-clay) 60%,var(--arbor-clay-deep))", boxShadow: "0 8px 20px rgba(52,178,119,0.24)" }}
      >
        {t("ob.step.continue")}
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
              className="flex items-start gap-3 px-4 py-3 rounded-2xl text-left transition active:scale-[0.99]"
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

      <button
        type="button"
        onClick={onNext}
        disabled={selectedDomains.length === 0}
        className="w-full py-3 text-white font-extrabold text-sm rounded-2xl transition active:scale-[0.98] disabled:opacity-50"
        style={{ background: "linear-gradient(135deg,#3cc081,var(--arbor-clay) 60%,var(--arbor-clay-deep))", boxShadow: "0 8px 20px rgba(52,178,119,0.24)" }}
      >
        {t("ob.step.continue")}
      </button>

      <button
        type="button"
        onClick={onSkip}
        className="w-full text-xs font-bold py-2"
        style={{ color: "var(--arbor-muted)" }}
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
        style={{ background: "linear-gradient(135deg,#3cc081,var(--arbor-clay) 60%,var(--arbor-clay-deep))", boxShadow: "0 8px 20px rgba(52,178,119,0.24)" }}
      >
        {t("ob.step.continue")}
      </button>

      <button
        type="button"
        onClick={onSkip}
        className="w-full text-xs font-bold py-2"
        style={{ color: "var(--arbor-muted)" }}
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
      <span className="text-xs font-extrabold text-right" style={{ color: "var(--arbor-ink)" }}>{value}</span>
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
        style={{ background: "linear-gradient(135deg,#3cc081,var(--arbor-clay) 60%,var(--arbor-clay-deep))", boxShadow: "0 8px 20px rgba(52,178,119,0.24)" }}
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
  const { addChild, updateChild } = useProfile();
  const { toast } = useToast();
  const { t } = useLanguage();

  // Navigation
  const [step, setStep] = useState<Step>(1);

  /**
   * REPLAY / DEMO MODE (AP-049 AC-1):
   * When replaying=true the flow is a preview-only pass. No profile writes,
   * no consent calls, and no AvatarCreator modal can fire. The real first-run
   * path (replaying=false, profile created once in handleStep2Next) is unchanged.
   */
  const [replaying, setReplaying] = useState(false);

  // Step 2 state (name + age + consent) — keep months-precise picker exactly
  const [name, setName] = useState("");
  const [ageYears, setAgeYears] = useState(0);
  const [ageMonthsPart, setAgeMonthsPart] = useState(0);
  const [languages, setLanguages] = useState<string[]>(["English"]);
  const [controllerConsent, setControllerConsent] = useState(false);

  // Step 3 state (domain multi-select)
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);

  // Step 4 state (avatar)
  const [avatarResult, setAvatarResult] = useState<AvatarResult | null>(null);
  // childId is available after addChild; for Avatar step we create the profile first.
  const [createdChildId, setCreatedChildId] = useState<string | null>(null);

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
    if (!name.trim() || !controllerConsent) return;

    // DEMO-MODE GUARD: in replay mode skip all profile writes — just advance.
    if (replaying) {
      goNext();
      return;
    }

    // Create the child profile now so step 4 (AvatarCreator) has a real childId.
    const birthDate = birthDateFromAgeMonths(totalAgeMonths);
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
      });
      setCreatedChildId(child.id);
      goNext();
    } catch {
      toast(t("ob.fail"), "error");
    }
  };

  // ── Start a non-persisting replay of the flow from Step 1 ─────────────────

  const startReplay = () => {
    setReplaying(true);
    setStep(1);
  };

  // ── Final submit (step 5) ───────────────────────────────────────────────

  const submit = async () => {
    // DEMO-MODE GUARD: replay pass — no profile writes, no updateChild call.
    if (replaying) return;

    if (!createdChildId) return;
    setSaving(true);
    try {
      // Build challenges from selected domains (maps domain ids to display names).
      const challenges = selectedDomains.map((id) => {
        const d = DOMAINS.find((x) => x.id === id);
        return d ? t(d.nameKey) : id;
      });

      // Patch the existing profile with domain choices and avatar (if set).
      const patch: Record<string, unknown> = {};
      if (challenges.length) patch.challenges = challenges;
      if (avatarResult) patch.avatar = avatarResult.dataUrl;

      // Write patch via updateChild if there is anything to patch.
      if (Object.keys(patch).length > 0) {
        await updateChild(createdChildId, patch as Parameters<typeof updateChild>[1]);
      }

      // Seed the coach if domains were picked.
      if (selectedDomains.length > 0) {
        try {
          const firstDomain = DOMAINS.find((d) => d.id === selectedDomains[0]);
          const topDomain = firstDomain ? t(firstDomain.nameKey) : selectedDomains[0];
          localStorage.setItem(
            "arbor.coachSeed",
            `${topDomain} is on my mind with ${name.trim()} (${ageString(totalAgeMonths)}). Where should I start?`,
          );
        } catch { /* ignore */ }
      }

      toast(t("ob.ready", { name: name.trim() }), "success");
    } catch {
      toast(t("ob.fail"), "error");
      setSaving(false);
    }
  };

  // ── Shared card wrapper ─────────────────────────────────────────────────

  const canGoBack = step > 1;

  return (
    <div className="arbor-app min-h-screen flex items-center justify-center px-4 py-10 antialiased text-sans">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
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
              className="p-1.5 rounded-lg transition"
              style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)" }}
              aria-label={t("ob.step.back")}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-8" />
          )}
          <div className="flex-1">
            <ProgressDots step={step} total={5} />
          </div>
          <div className="w-8" />
        </div>

        {/* Step content with slide animation */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
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
        </AnimatePresence>

        <p className="text-[11px] text-center" style={{ color: "var(--arbor-muted)" }}>
          {t("ob.footer")}
        </p>
      </motion.div>
    </div>
  );
}
