import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { useProfile } from "../../context/ProfileContext";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import { useEntitlement } from "../../hooks/useEntitlement";

const LANGUAGE_OPTIONS = ["Hebrew", "English", "Arabic", "Russian", "French", "Other"];

export default function AddChildModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addChild, profiles } = useProfile();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { entitlement } = useEntitlement();
  // MON-1: multi-child is a Plus feature once entitlements are enforced.
  const atChildLimit = entitlement.enforced && profiles.length >= entitlement.limits.maxChildren;
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [age, setAge] = useState<number>(4);
  const [languages, setLanguages] = useState<string[]>([]);
  const [strengths, setStrengths] = useState("");
  const [challenges, setChallenges] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setStep(1);
    setName("");
    setAge(4);
    setLanguages([]);
    setStrengths("");
    setChallenges("");
    setSaving(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const toggleLanguage = (lang: string) =>
    setLanguages((prev) => (prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]));

  const toLines = (text: string) =>
    text.split("\n").map((s) => s.trim()).filter(Boolean);

  const finish = async () => {
    setSaving(true);
    try {
      const childName = name.trim() || "New Child";
      await addChild({
        name: childName,
        age,
        languages: languages.length ? languages : ["English"],
        schoolContext: "",
        strengths: toLines(strengths),
        challenges: toLines(challenges),
        riskLevel: "Low",
      });
      toast(t("ac.addedToast", { name: childName }), "success");
      close();
    } finally {
      setSaving(false);
    }
  };

  const canAdvance = step === 1 ? name.trim().length > 0 : true;

  if (atChildLimit) {
    return (
      <Modal open={open} onClose={close} title={t("ac.title")}>
        <div className="space-y-4 text-sm">
          <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: "linear-gradient(120deg,#eef6f1,var(--arbor-lav-soft))", border: "1px solid var(--arbor-rule)" }}>
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl flex-shrink-0" style={{ background: "#fff", color: "var(--arbor-green-ink)" }}><Sparkles className="w-4 h-4" /></span>
            <div>
              <p className="font-bold" style={{ color: "var(--arbor-ink)" }}>{t("ac.limitTitle")}</p>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
                {t("ac.limitBody", { max: entitlement.limits.maxChildren === 1 ? 6 : entitlement.limits.maxChildren })}
              </p>
              <button onClick={() => { toast(t("ac.notifyToast"), "success"); close(); }} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold rounded-xl px-3 py-2" style={{ background: "var(--arbor-clay)", color: "#fff" }}>
                {t("ac.notify")}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={close} title={t("ac.titleStep", { step })}>
      <div className="space-y-5 text-sm">
        {/* Step progress */}
        <div className="flex gap-1.5">
          {[1, 2, 3].map((s) => (
            <div key={s} className="h-1 flex-1 rounded-full" style={{ background: s <= step ? "var(--arbor-clay)" : "var(--arbor-rule-strong)" }} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("ac.name")}</label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("ac.namePh")}
                className="w-full rounded-xl px-4 py-2.5 focus:outline-none"
                style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("ac.age")} <span style={{ color: "var(--arbor-green-ink)" }}>{age}</span></label>
              <input type="range" min={0} max={18} value={age} onChange={(e) => setAge(parseInt(e.target.value))} className="w-full" style={{ accentColor: "var(--arbor-clay)" }} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <label className="text-xs font-bold block" style={{ color: "var(--arbor-muted)" }}>{t("ac.langs")}</label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGE_OPTIONS.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => toggleLanguage(lang)}
                  className="px-3 py-2 rounded-xl text-xs font-bold transition"
                  style={languages.includes(lang)
                    ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.40)" }
                    : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
                >
                  {t("ob.lang." + lang.toLowerCase())}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("ac.strengths")} <span style={{ opacity: 0.7 }}>{t("ac.optLines")}</span></label>
              <textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={3} className="w-full rounded-xl px-4 py-2.5 text-xs focus:outline-none" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("ac.challenges")} <span style={{ opacity: 0.7 }}>{t("ac.optLines")}</span></label>
              <textarea value={challenges} onChange={(e) => setChallenges(e.target.value)} rows={3} className="w-full rounded-xl px-4 py-2.5 text-xs focus:outline-none" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }} />
            </div>
          </div>
        )}

        <div className="flex justify-between gap-3 pt-2">
          <Button variant="ghost" size="sm" onClick={step === 1 ? close : () => setStep((s) => s - 1)}>
            {step === 1 ? t("ac.cancel") : t("ac.back")}
          </Button>
          {step < 3 ? (
            <Button size="sm" disabled={!canAdvance} onClick={() => setStep((s) => s + 1)}>
              {t("ac.next")}
            </Button>
          ) : (
            <Button size="sm" disabled={saving} onClick={finish}>
              {saving ? t("ac.adding") : t("ac.add")}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
