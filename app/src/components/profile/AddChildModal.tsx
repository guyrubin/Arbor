import React, { useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { useProfile } from "../../context/ProfileContext";
import { useToast } from "../../context/ToastContext";

const LANGUAGE_OPTIONS = ["Hebrew", "English", "Arabic", "Russian", "French", "Other"];

export default function AddChildModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addChild } = useProfile();
  const { toast } = useToast();
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
      toast(`${childName}'s profile added`, "success");
      close();
    } finally {
      setSaving(false);
    }
  };

  const canAdvance = step === 1 ? name.trim().length > 0 : true;

  return (
    <Modal open={open} onClose={close} title={`Add a child · Step ${step} of 3`}>
      <div className="space-y-5 text-sm">
        {/* Step progress */}
        <div className="flex gap-1.5">
          {[1, 2, 3].map((s) => (
            <div key={s} className="h-1 flex-1 rounded-full" style={{ background: s <= step ? "#34b277" : "var(--arbor-rule-strong)" }} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>Child&apos;s name</label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Maya"
                className="w-full rounded-xl px-4 py-2.5 focus:outline-none"
                style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>Age: <span style={{ color: "#1f8a5a" }}>{age}</span></label>
              <input type="range" min={0} max={18} value={age} onChange={(e) => setAge(parseInt(e.target.value))} className="w-full" style={{ accentColor: "#34b277" }} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <label className="text-xs font-bold block" style={{ color: "var(--arbor-muted)" }}>Languages (select all that apply)</label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGE_OPTIONS.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => toggleLanguage(lang)}
                  className="px-3 py-2 rounded-xl text-xs font-bold transition"
                  style={languages.includes(lang)
                    ? { background: "#e4f4ec", color: "#1f8a5a", border: "1px solid rgba(52,178,119,0.40)" }
                    : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>Key strengths <span style={{ opacity: 0.7 }}>(optional, one per line)</span></label>
              <textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={3} className="w-full rounded-xl px-4 py-2.5 text-xs focus:outline-none" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>Current challenges <span style={{ opacity: 0.7 }}>(optional, one per line)</span></label>
              <textarea value={challenges} onChange={(e) => setChallenges(e.target.value)} rows={3} className="w-full rounded-xl px-4 py-2.5 text-xs focus:outline-none" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }} />
            </div>
          </div>
        )}

        <div className="flex justify-between gap-3 pt-2">
          <Button variant="ghost" size="sm" onClick={step === 1 ? close : () => setStep((s) => s - 1)}>
            {step === 1 ? "Cancel" : "Back"}
          </Button>
          {step < 3 ? (
            <Button size="sm" disabled={!canAdvance} onClick={() => setStep((s) => s + 1)}>
              Next
            </Button>
          ) : (
            <Button size="sm" disabled={saving} onClick={finish}>
              {saving ? "Adding…" : "Add child"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
