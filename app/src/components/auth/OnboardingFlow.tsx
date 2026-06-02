import React, { useState } from "react";
import { motion } from "motion/react";
import { RefreshCw } from "lucide-react";
import { useProfile } from "../../context/ProfileContext";
import { useToast } from "../../context/ToastContext";

const LANGUAGES = ["Hebrew", "English", "Arabic", "Russian", "French", "Other"];

function ArborMark() {
  return (
    <svg width="56" height="56" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ob-teal" x1="54" y1="6" x2="28" y2="84" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#18F0D2" /><stop offset="50%" stopColor="#38C8F0" /><stop offset="100%" stopColor="#68B4FF" />
        </linearGradient>
        <linearGradient id="ob-purple" x1="12" y1="90" x2="46" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#CCA8FF" /><stop offset="100%" stopColor="#A07AF8" />
        </linearGradient>
        <radialGradient id="ob-orange" cx="36%" cy="28%" r="62%">
          <stop offset="0%" stopColor="#FFC07A" /><stop offset="100%" stopColor="#FF5822" />
        </radialGradient>
      </defs>
      <path d="M40 88 C40 50 52 22 65 16 C78 22 90 50 90 88 L76 88 C76 56 70 32 65 32 C60 32 54 56 54 88Z" fill="#1B2898" />
      <path d="M14 88 C12 72 16 54 28 42 C34 36 42 34 46 40 C44 52 40 66 38 76 C36 82 28 88 20 88Z" fill="url(#ob-purple)" />
      <path d="M52 6 C62 14 66 32 62 50 C60 62 54 74 44 80 C36 84 28 80 22 72 C18 64 18 50 22 38 C28 24 38 8 52 6Z" fill="url(#ob-teal)" />
      <circle cx="78" cy="15" r="12" fill="url(#ob-orange)" />
    </svg>
  );
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
        className="w-full max-w-lg bg-[#141821] border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl space-y-6"
      >
        <div className="flex flex-col items-center text-center space-y-3">
          <ArborMark />
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white">Let&apos;s set up your child&apos;s profile</h1>
            <p className="text-sm text-[#a8a093] mt-1">Arbor personalizes every insight, script, and story to your child. This takes a minute.</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#a8a093]">Child&apos;s name</label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dylan" className="w-full bg-[#08090c] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#d7aa55]/50" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#a8a093]">Age: <span className="text-[#f4d991]">{age}</span></label>
            <input type="range" min={0} max={18} value={age} onChange={(e) => setAge(parseInt(e.target.value))} className="w-full accent-[#d7aa55]" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-[#a8a093] block">Languages</label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((l) => (
                <button key={l} type="button" onClick={() => toggleLang(l)} className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${languages.includes(l) ? "bg-[#d7aa55]/15 text-[#f4d991] border-[#d7aa55]/40" : "bg-white/[0.02] text-[#a8a093] border-white/5 hover:bg-white/5"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#a8a093]">Strengths <span className="text-gray-500">(optional)</span></label>
              <textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={3} placeholder="One per line" className="w-full bg-[#08090c] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#d7aa55]/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#a8a093]">Challenges <span className="text-gray-500">(optional)</span></label>
              <textarea value={challenges} onChange={(e) => setChallenges(e.target.value)} rows={3} placeholder="One per line" className="w-full bg-[#08090c] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#d7aa55]/50" />
            </div>
          </div>

          <button type="submit" disabled={saving || !name.trim()} className="w-full py-3 bg-[#d7aa55] hover:bg-[#c39947] disabled:opacity-50 text-black font-extrabold text-sm rounded-2xl transition active:scale-[0.98] flex items-center justify-center gap-2">
            {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
            {saving ? "Creating…" : "Create profile & enter Arbor"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
