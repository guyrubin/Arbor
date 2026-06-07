import React, { useState } from "react";
import { motion } from "motion/react";
import { RefreshCw } from "lucide-react";
import { useProfile } from "../../context/ProfileContext";
import { useToast } from "../../context/ToastContext";
import { ArborMark as ArborMarkIcon } from "../ui/ArborMark";

const LANGUAGES = ["Hebrew", "English", "Arabic", "Russian", "French", "Other"];

function ArborMark() {
  return <ArborMarkIcon size={56} />;
}

/** Shown to a new authenticated account with no children — creates the first child. */
export default function OnboardingFlow() {
  const { addChild } = useProfile();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [age, setAge] = useState(4);
  const [languages, setLanguages] = useState<string[]>(["English"]);
  const [strengths, setStrengths] = useState("");
  const [challenges, setChallenges] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleLang = (l: string) =>
    setLanguages((p) => (p.includes(l) ? p.filter((x) => x !== l) : [...p, l]));

  const toLines = (t: string) => t.split("\n").map((s) => s.trim()).filter(Boolean);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await addChild({
        name: name.trim(),
        age,
        languages: languages.length ? languages : ["English"],
        schoolContext: "",
        strengths: toLines(strengths),
        challenges: toLines(challenges),
        riskLevel: "Low",
      });
      toast(`Welcome to Arbor — ${name.trim()}'s profile is ready`, "success");
    } catch {
      toast("Couldn't create the profile — please try again", "error");
      setSaving(false);
    }
  };

  return (
    <div className="arbor-app min-h-screen flex items-center justify-center px-6 py-10 antialiased text-sans">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg bg-white rounded-3xl p-8 md:p-10 space-y-6"
        style={{ border: "1px solid var(--arbor-rule)", boxShadow: "0 24px 60px rgba(41,51,63,0.12)" }}
      >
        <div className="flex flex-col items-center text-center space-y-3">
          <ArborMark />
          <div>
            <h1 className="text-2xl font-black tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>Let&apos;s set up your child&apos;s profile</h1>
            <p className="text-sm mt-1" style={{ color: "var(--arbor-muted)" }}>Arbor personalizes every insight, script, and story to your child. This takes a minute.</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>Child&apos;s name</label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Maya" className="w-full rounded-xl px-4 py-2.5 focus:outline-none" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>Age: <span style={{ color: "#1f8a5a" }}>{age}</span></label>
            <input type="range" min={0} max={18} value={age} onChange={(e) => setAge(parseInt(e.target.value))} className="w-full" style={{ accentColor: "#34b277" }} />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold block" style={{ color: "var(--arbor-muted)" }}>Languages</label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((l) => (
                <button key={l} type="button" onClick={() => toggleLang(l)} className="px-3 py-1.5 rounded-xl text-xs font-bold transition" style={languages.includes(l) ? { background: "#e4f4ec", color: "#1f8a5a", border: "1px solid rgba(52,178,119,0.40)" } : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>Strengths <span style={{ opacity: 0.7 }}>(optional)</span></label>
              <textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={3} placeholder="One per line" className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>Challenges <span style={{ opacity: 0.7 }}>(optional)</span></label>
              <textarea value={challenges} onChange={(e) => setChallenges(e.target.value)} rows={3} placeholder="One per line" className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }} />
            </div>
          </div>

          <button type="submit" disabled={saving || !name.trim()} className="w-full py-3 text-white font-extrabold text-sm rounded-2xl transition active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: "linear-gradient(135deg,#3cc081,#34b277 60%,#2a9c66)" }}>
            {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
            {saving ? "Creating…" : "Create profile & enter Arbor"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
