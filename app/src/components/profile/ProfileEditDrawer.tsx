import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Download, Trash2 } from "lucide-react";
import { useProfile } from "../../context/ProfileContext";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { exportChildData, downloadJson } from "../../lib/childData";
import { ChildProfile } from "../../types";

const RISK_LEVELS: ChildProfile["riskLevel"][] = ["Low", "Moderate", "High"];

export default function ProfileEditDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { activeChild, updateChild, deleteChild, profiles } = useProfile();
  const { user } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(activeChild.name);
  const [age, setAge] = useState(activeChild.age);
  const [schoolContext, setSchoolContext] = useState(activeChild.schoolContext);
  const [languages, setLanguages] = useState(activeChild.languages.join(", "));
  const [strengths, setStrengths] = useState(activeChild.strengths.join("\n"));
  const [challenges, setChallenges] = useState(activeChild.challenges.join("\n"));
  const [riskLevel, setRiskLevel] = useState<ChildProfile["riskLevel"]>(activeChild.riskLevel);
  const [saving, setSaving] = useState(false);

  // Re-sync the form whenever the drawer opens or the active child changes.
  useEffect(() => {
    if (!open) return;
    setName(activeChild.name);
    setAge(activeChild.age);
    setSchoolContext(activeChild.schoolContext);
    setLanguages(activeChild.languages.join(", "));
    setStrengths(activeChild.strengths.join("\n"));
    setChallenges(activeChild.challenges.join("\n"));
    setRiskLevel(activeChild.riskLevel);
  }, [open, activeChild]);

  const handleExport = async () => {
    setBusy(true);
    try {
      const data = await exportChildData(user?.uid, activeChild);
      downloadJson(`arbor-${activeChild.name.toLowerCase().replace(/\s+/g, "-")}-export.json`, data);
      toast("Data exported", "success");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (profiles.length <= 1) {
      toast("Can't delete your only child profile", "error");
      return;
    }
    if (!window.confirm(`Permanently delete ${activeChild.name} and ALL of their data? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteChild(activeChild.id);
      toast(`${activeChild.name}'s data was deleted`, "success");
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateChild(activeChild.id, {
        name: name.trim() || activeChild.name,
        age,
        schoolContext,
        languages: languages.split(",").map((s) => s.trim()).filter(Boolean),
        strengths: strengths.split("\n").map((s) => s.trim()).filter(Boolean),
        challenges: challenges.split("\n").map((s) => s.trim()).filter(Boolean),
        riskLevel,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            className="w-full max-w-md h-full bg-[#0c0e14] border-l border-white/10 p-6 overflow-y-auto"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-extrabold text-white tracking-tight">Edit profile</h3>
              <button onClick={onClose} className="p-1.5 rounded-lg border border-white/5 hover:bg-white/5 text-[#a8a093] hover:text-white transition" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#a8a093]">Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-[#08090c] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#d7aa55]/50" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#a8a093]">Age: <span className="text-[#f4d991]">{age}</span></label>
                <input type="range" min={0} max={18} value={age} onChange={(e) => setAge(parseInt(e.target.value))} className="w-full accent-[#d7aa55]" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#a8a093]">School context</label>
                <input value={schoolContext} onChange={(e) => setSchoolContext(e.target.value)} className="w-full bg-[#08090c] border border-white/10 rounded-xl px-4 py-2.5 text-white text-xs focus:outline-none focus:border-[#d7aa55]/50" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#a8a093]">Languages <span className="text-gray-500">(comma separated)</span></label>
                <input value={languages} onChange={(e) => setLanguages(e.target.value)} className="w-full bg-[#08090c] border border-white/10 rounded-xl px-4 py-2.5 text-white text-xs focus:outline-none focus:border-[#d7aa55]/50" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#a8a093]">Strengths <span className="text-gray-500">(one per line)</span></label>
                <textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={3} className="w-full bg-[#08090c] border border-white/10 rounded-xl px-4 py-2.5 text-white text-xs focus:outline-none focus:border-[#d7aa55]/50" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#a8a093]">Challenges <span className="text-gray-500">(one per line)</span></label>
                <textarea value={challenges} onChange={(e) => setChallenges(e.target.value)} rows={3} className="w-full bg-[#08090c] border border-white/10 rounded-xl px-4 py-2.5 text-white text-xs focus:outline-none focus:border-[#d7aa55]/50" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#a8a093]">Risk level</label>
                <div className="flex gap-2">
                  {RISK_LEVELS.map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setRiskLevel(lvl)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                        riskLevel === lvl ? "bg-[#d7aa55]/15 text-[#f4d991] border-[#d7aa55]/40" : "bg-white/[0.02] text-[#a8a093] border-white/5 hover:bg-white/5"
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={save}
                disabled={saving}
                className="w-full mt-2 py-3 bg-[#d7aa55] hover:bg-[#c39947] disabled:opacity-60 text-black font-extrabold text-sm rounded-2xl transition active:scale-[0.98]"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>

              {/* Data & privacy (GDPR) */}
              <div className="pt-4 mt-2 border-t border-white/5 space-y-2">
                <span className="text-[10px] uppercase font-black tracking-wider text-[#a8a093]">Data & privacy</span>
                <button onClick={handleExport} disabled={busy} className="w-full py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-60">
                  <Download className="w-3.5 h-3.5 text-[#d7aa55]" /> Export {activeChild.name}&apos;s data (JSON)
                </button>
                <button onClick={handleDelete} disabled={busy} className="w-full py-2.5 bg-[#e2562d]/10 border border-[#e2562d]/30 hover:bg-[#e2562d]/20 text-[#ffb59c] font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-60">
                  <Trash2 className="w-3.5 h-3.5" /> Delete this child & all data
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
