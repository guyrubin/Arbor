import React, { useState } from "react";
import { motion } from "motion/react";
import { RefreshCw, Moon, HeartHandshake, MessageCircle, Utensils, Sparkles, Pencil, ShieldCheck } from "lucide-react";
import { useProfile } from "../../context/ProfileContext";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import { ArborMark as ArborMarkIcon } from "../ui/ArborMark";
import { api } from "../../lib/api";
import { birthDateFromAgeMonths } from "../../lib/childAge";

const LANGUAGES = ["Hebrew", "English", "Arabic", "Russian", "French", "Other"];

// "What's on your mind" → the first thing Arbor watches for this child. Maps a
// warm, plain-language concern to a profile challenge so Home and the coach can
// personalize from the very first screen.
const CONCERNS: { id: string; label: string; challenge: string; icon: React.ReactNode }[] = [
  { id: "sleep", label: "Sleep & bedtime", challenge: "Sleep and bedtime", icon: <Moon className="w-4 h-4" /> },
  { id: "behavior", label: "Big feelings & behavior", challenge: "Big feelings and behavior", icon: <HeartHandshake className="w-4 h-4" /> },
  { id: "speech", label: "Talking & speech", challenge: "Talking and communication", icon: <MessageCircle className="w-4 h-4" /> },
  { id: "eating", label: "Eating", challenge: "Eating", icon: <Utensils className="w-4 h-4" /> },
  { id: "start", label: "Just getting started", challenge: "", icon: <Sparkles className="w-4 h-4" /> },
  { id: "other", label: "Something specific", challenge: "", icon: <Pencil className="w-4 h-4" /> },
];

function ArborMark() {
  return <ArborMarkIcon size={56} />;
}

/**
 * Derive a human-readable age string from a total months value.
 * Used for the localStorage coach-bridge seed so it reads "9 months" not "age 0".
 */
function ageString(totalMonths: number): string {
  if (totalMonths < 12) return `${totalMonths} month${totalMonths !== 1 ? "s" : ""}`;
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (months === 0) return `${years} year${years !== 1 ? "s" : ""}`;
  return `${years} year${years !== 1 ? "s" : ""} ${months} month${months !== 1 ? "s" : ""}`;
}

/** First-run setup for a new account: name + age + one concern. Kept short so the
 *  parent reaches a personalized Home (their first win) in under a minute. */
export default function OnboardingFlow() {
  const { addChild } = useProfile();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [name, setName] = useState("");

  // B0 — months-precise age state.
  // ageYears + ageMonthsPart together form the precise age for under-3s.
  // For 3+, ageYears is all that matters (ageMonthsPart stays 0).
  const [ageYears, setAgeYears] = useState(0);
  const [ageMonthsPart, setAgeMonthsPart] = useState(0);

  // Derived total months — the canonical value used to compute birthDate.
  const totalAgeMonths = ageYears * 12 + ageMonthsPart;
  // Legacy back-compat: whole-year equivalent stored alongside the precise value.
  const ageLegacyYears = Math.floor(totalAgeMonths / 12);

  // Whether we are in the "under 3 years" mode (months precision matters most).
  const isUnder3 = ageYears < 3;

  // Optional gender — a personalization cue (pronouns, story framing), never a
  // developmental signal. Defaults to unspecified so it never blocks setup.
  const [gender, setGender] = useState<"boy" | "girl" | "unspecified">("unspecified");

  const [concern, setConcern] = useState<string>("");
  const [otherText, setOtherText] = useState("");
  const [languages, setLanguages] = useState<string[]>(["English"]);
  const [showLangs, setShowLangs] = useState(false);
  const [saving, setSaving] = useState(false);
  // GDPR/COPPA consent (A3): the parent is the named data controller and must
  // affirm consent before any child data is processed. Photo/vision is a
  // separate, biometric-adjacent opt-in that gates /api/vision server-side.
  const [controllerConsent, setControllerConsent] = useState(false);
  const [photoConsent, setPhotoConsent] = useState(false);

  const toggleLang = (l: string) => setLanguages((p) => (p.includes(l) ? p.filter((x) => x !== l) : [...p, l]));

  // Reset the months part to 0 when the parent switches to 3+ years (no months picker shown).
  const handleYearsChange = (years: number) => {
    setAgeYears(years);
    if (years >= 3) setAgeMonthsPart(0);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !controllerConsent) return;
    setSaving(true);
    const picked = CONCERNS.find((c) => c.id === concern);
    const challenge = concern === "other" ? otherText.trim() : (picked?.challenge || "");

    // B0 — derive a birthDate from the entered age so downstream months-precision
    // logic (childAge.ts) always has a precise date to work from.
    const birthDate = birthDateFromAgeMonths(totalAgeMonths);

    try {
      const child = await addChild({
        name: name.trim(),
        // Keep legacy `age` (whole years) for back-compat with all existing `.age` readers.
        age: ageLegacyYears,
        // B0 — also store the precise fields so the 0–2 milestone/dev-score path gets
        // months precision immediately, without waiting for a profile edit.
        birthDate,
        ageMonths: totalAgeMonths,
        gender,
        languages: languages.length ? languages : ["English"],
        schoolContext: "",
        strengths: [],
        challenges: challenge ? [challenge] : [],
        riskLevel: "Low",
      });
      // Record the explicit photo/vision consent against the new child so the
      // server's COPPA gate (requireConsent on /api/vision + /api/generate-avatar)
      // has a real, parent-granted face_processing grant to check. The parent
      // can change this later in My Child › Privacy. Failure here must not block
      // setup — the gate simply stays closed (fail-closed) until consent exists.
      if (photoConsent && child?.id) {
        try {
          await api.grantConsent({ childId: child.id, purpose: "face_processing", granted: true });
        } catch { /* non-blocking; /vision stays gated until consent is recorded */ }
      }
      // B0 — seed the coach with a months-aware label for under-2s so the bridge
      // reads "9 months" not "age 0". The provider picks this up on its first
      // mount and pre-fills the Ask Arbor composer.
      if (challenge) {
        try {
          localStorage.setItem(
            "arbor.coachSeed",
            `${challenge} is on my mind with ${name.trim()} (${ageString(totalAgeMonths)}). Where should I start?`
          );
        } catch { /* ignore */ }
      }
      toast(t("ob.ready", { name: name.trim() }), "success");
    } catch {
      toast(t("ob.fail"), "error");
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = { background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" };

  // ── Age display label ──────────────────────────────────────────────────────
  // Used in the label badge. Calm factual copy; not a diagnostic claim.
  const ageDisplayLabel = totalAgeMonths === 0
    ? "newborn"
    : isUnder3
      ? ageYears === 0
        ? `${ageMonthsPart} month${ageMonthsPart !== 1 ? "s" : ""}`
        : ageMonthsPart === 0
          ? `${ageYears} year${ageYears !== 1 ? "s" : ""}`
          : `${ageYears}y ${ageMonthsPart}m`
      : `${ageYears} year${ageYears !== 1 ? "s" : ""}`;

  return (
    <div className="arbor-app min-h-screen flex items-center justify-center px-6 py-10 antialiased text-sans">
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        className="w-full max-w-lg bg-white rounded-3xl p-8 md:p-10 space-y-6"
        style={{ border: "1px solid var(--arbor-rule)", boxShadow: "0 24px 60px rgba(41,51,63,0.12)" }}
      >
        <div className="flex flex-col items-center text-center space-y-3">
          <ArborMark />
          <div>
            <h1 className="text-2xl font-black tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{t("ob.title")}</h1>
            <p className="text-sm mt-1" style={{ color: "var(--arbor-muted)" }}>{t("ob.subtitle")}</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-5">
          {/* Name + age picker row */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-start">
            <div className="space-y-1.5">
              <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("ob.name")}</label>
              <input dir="auto" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t("ob.namePlaceholder")} className="w-full rounded-xl px-4 py-2.5 focus:outline-none" style={inputStyle} />
            </div>

            {/* B0 — months-precise age picker for under-3, year-steps for 3+ */}
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

              {/* Months slider — 0–11, shown only when under 3 years */}
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

          {/* Optional gender toggle — a two-option personalization cue. */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("ob.gender.label")}</label>
            <div className="flex gap-2">
              {(["boy", "girl"] as const).map((g) => {
                const on = gender === g;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender((p) => (p === g ? "unspecified" : g))}
                    aria-pressed={on}
                    className="flex-1 py-2 rounded-xl text-xs font-bold transition"
                    style={on
                      ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.40)" }
                      : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
                  >
                    {t("ob.gender." + g)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold block" style={{ color: "var(--arbor-ink)" }}>{t("ob.mind")}</label>
            <div className="grid grid-cols-2 gap-2">
              {CONCERNS.map((c) => {
                const on = concern === c.id;
                return (
                  <button key={c.id} type="button" onClick={() => setConcern(c.id)} className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-bold transition text-left" style={on ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.40)" } : { background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}>
                    <span style={{ color: on ? "var(--arbor-green-ink)" : "var(--arbor-muted)" }}>{c.icon}</span> {t("ob.concern." + c.id)}
                  </button>
                );
              })}
            </div>
            {concern === "other" && (
              <input dir="auto" value={otherText} onChange={(e) => setOtherText(e.target.value)} autoFocus placeholder={t("ob.otherPlaceholder")} className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none mt-1" style={inputStyle} />
            )}
          </div>

          {!showLangs ? (
            <button type="button" onClick={() => setShowLangs(true)} className="text-xs font-bold" style={{ color: "var(--arbor-green-ink)" }}>{t("ob.addLangs")}</button>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-bold block" style={{ color: "var(--arbor-muted)" }}>{t("ob.langsAtHome")}</label>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((l) => (
                  <button key={l} type="button" onClick={() => toggleLang(l)} className="px-3 py-1.5 rounded-xl text-xs font-bold transition" style={languages.includes(l) ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.40)" } : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}>
                    {t("ob.lang." + l.toLowerCase())}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2.5 rounded-2xl p-3.5" style={{ background: "var(--arbor-green-soft)", border: "1px solid rgba(52,178,119,0.30)" }}>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-green-ink)" }}>
              <ShieldCheck className="w-3.5 h-3.5" /> {t("ob.consent.heading")}
            </span>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" checked={controllerConsent} onChange={(e) => setControllerConsent(e.target.checked)} className="mt-0.5" style={{ accentColor: "var(--arbor-green-ink)" }} />
              <span className="text-[12px] leading-snug" style={{ color: "var(--arbor-ink)" }}>{t("ob.consent.controller")}</span>
            </label>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" checked={photoConsent} onChange={(e) => setPhotoConsent(e.target.checked)} className="mt-0.5" style={{ accentColor: "var(--arbor-green-ink)" }} />
              <span className="text-[12px] leading-snug" style={{ color: "var(--arbor-ink)" }}>{t("ob.consent.photo")}</span>
            </label>
          </div>

          <button type="submit" disabled={saving || !name.trim() || !controllerConsent} className="w-full py-3 text-white font-extrabold text-sm rounded-2xl transition active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: "var(--gradient-cta)", boxShadow: "0 8px 20px rgba(52,178,119,0.24)" }}>
            {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
            {saving ? t("ob.settingUp") : name.trim() ? t("ob.startWith", { name: name.trim() }) : t("ob.start")}
          </button>
          <p className="text-[11px] text-center" style={{ color: "var(--arbor-muted)" }}>{t("ob.footer")}</p>
        </form>
      </motion.div>
    </div>
  );
}
