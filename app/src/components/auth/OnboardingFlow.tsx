import React, { useState } from "react";
import { motion } from "motion/react";
import { RefreshCw, Moon, HeartHandshake, MessageCircle, Utensils, Sparkles, Pencil } from "lucide-react";
import { useProfile } from "../../context/ProfileContext";
import { useToast } from "../../context/ToastContext";
import { ArborMark as ArborMarkIcon } from "../ui/ArborMark";

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

/** First-run setup for a new account: name + age + one concern. Kept short so the
 *  parent reaches a personalized Home (their first win) in under a minute. */
export default function OnboardingFlow() {
  const { addChild } = useProfile();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [age, setAge] = useState(4);
  const [concern, setConcern] = useState<string>("");
  const [otherText, setOtherText] = useState("");
  const [languages, setLanguages] = useState<string[]>(["English"]);
  const [showLangs, setShowLangs] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggleLang = (l: string) => setLanguages((p) => (p.includes(l) ? p.filter((x) => x !== l) : [...p, l]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const picked = CONCERNS.find((c) => c.id === concern);
    const challenge = concern === "other" ? otherText.trim() : (picked?.challenge || "");
    try {
      await addChild({
        name: name.trim(),
        age,
        languages: languages.length ? languages : ["English"],
        schoolContext: "",
        strengths: [],
        challenges: challenge ? [challenge] : [],
        riskLevel: "Low",
      });
      toast(`Arbor is ready for ${name.trim()}.`, "success");
    } catch {
      toast("Couldn't create the profile. Please try again.", "error");
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = { background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" };

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
            <h1 className="text-2xl font-black tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>Tell us about your child</h1>
            <p className="text-sm mt-1" style={{ color: "var(--arbor-muted)" }}>Two quick things, and Arbor starts personalizing right away.</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-start">
            <div className="space-y-1.5">
              <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>Child's name</label>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Maya" className="w-full rounded-xl px-4 py-2.5 focus:outline-none" style={inputStyle} />
            </div>
            <div className="space-y-1.5 sm:w-[150px]">
              <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>Age: <span style={{ color: "#1f8a5a" }}>{age}</span></label>
              <input type="range" min={0} max={18} value={age} onChange={(e) => setAge(parseInt(e.target.value))} className="w-full mt-3" style={{ accentColor: "#34b277" }} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold block" style={{ color: "var(--arbor-ink)" }}>What's on your mind right now?</label>
            <div className="grid grid-cols-2 gap-2">
              {CONCERNS.map((c) => {
                const on = concern === c.id;
                return (
                  <button key={c.id} type="button" onClick={() => setConcern(c.id)} className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-bold transition text-left" style={on ? { background: "#e4f4ec", color: "#1f8a5a", border: "1px solid rgba(52,178,119,0.40)" } : { background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}>
                    <span style={{ color: on ? "#1f8a5a" : "var(--arbor-muted)" }}>{c.icon}</span> {c.label}
                  </button>
                );
              })}
            </div>
            {concern === "other" && (
              <input value={otherText} onChange={(e) => setOtherText(e.target.value)} autoFocus placeholder="In a few words, what's going on?" className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none mt-1" style={inputStyle} />
            )}
          </div>

          {!showLangs ? (
            <button type="button" onClick={() => setShowLangs(true)} className="text-xs font-bold" style={{ color: "#1f8a5a" }}>+ Add languages spoken at home (optional)</button>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-bold block" style={{ color: "var(--arbor-muted)" }}>Languages at home</label>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((l) => (
                  <button key={l} type="button" onClick={() => toggleLang(l)} className="px-3 py-1.5 rounded-xl text-xs font-bold transition" style={languages.includes(l) ? { background: "#e4f4ec", color: "#1f8a5a", border: "1px solid rgba(52,178,119,0.40)" } : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button type="submit" disabled={saving || !name.trim()} className="w-full py-3 text-white font-extrabold text-sm rounded-2xl transition active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: "linear-gradient(135deg,#3cc081,#34b277 60%,#2a9c66)", boxShadow: "0 8px 20px rgba(52,178,119,0.24)" }}>
            {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
            {saving ? "Setting up…" : name.trim() ? `Start with ${name.trim()}` : "Start"}
          </button>
          <p className="text-[11px] text-center" style={{ color: "var(--arbor-muted)" }}>You can add more about your child anytime. Nothing is shared without your say-so.</p>
        </form>
      </motion.div>
    </div>
  );
}
