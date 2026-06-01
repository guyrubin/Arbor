import React, { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { ShieldAlert, Phone, Plus, Trash2, CalendarCheck, AlertTriangle } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useChildCollection } from "../../hooks/useChildCollection";

type Contact = { id: string; name: string; role: string; phone: string; notes: string };

const WARNING_SIGNS = [
  "Sudden loss of previously mastered skills (regression)",
  "Talk of self-harm or harming others",
  "Persistent withdrawal from people and play",
  "Sleep or appetite change lasting more than two weeks",
  "Injury, fever, or a medical concern needing review",
  "Escalating aggression that endangers self or others",
];

const RISK_STYLES: Record<string, { banner: string; label: string }> = {
  Low: { banner: "bg-emerald-500/10 border-emerald-500/25 text-emerald-300", label: "Low" },
  Moderate: { banner: "bg-amber-500/10 border-amber-500/25 text-[#f4d991]", label: "Moderate" },
  High: { banner: "bg-[#e2562d]/15 border-[#e2562d]/40 text-[#ffb59c]", label: "High" },
};

export default function SafetyTab() {
  const { childProfile } = useArbor();

  const reviewedKey = useMemo(() => `arbor.safetyReviewed.${childProfile.id}`, [childProfile.id]);
  const checklistKey = useMemo(() => `arbor.safetyChecklist.${childProfile.id}`, [childProfile.id]);

  // Emergency contacts persist to Firestore (per child); checklist + last-reviewed
  // are lightweight device-local notes.
  const contactsCol = useChildCollection<Contact>(childProfile.id, "contacts");
  const contacts = contactsCol.items;
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [lastReviewed, setLastReviewed] = useState<string | null>(null);
  const [form, setForm] = useState<Contact>({ id: "", name: "", role: "", phone: "", notes: "" });

  useEffect(() => {
    try {
      setChecked(JSON.parse(localStorage.getItem(checklistKey) || "{}"));
      setLastReviewed(localStorage.getItem(reviewedKey));
    } catch {
      setChecked({});
    }
  }, [reviewedKey, checklistKey]);

  const toggleSign = (i: number) => {
    const next = { ...checked, [i]: !checked[i] };
    setChecked(next);
    try { localStorage.setItem(checklistKey, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const addContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    void contactsCol.upsert({ ...form, id: `c-${Date.now()}` });
    setForm({ id: "", name: "", role: "", phone: "", notes: "" });
  };

  const markReviewed = () => {
    const now = new Date().toISOString();
    setLastReviewed(now);
    try { localStorage.setItem(reviewedKey, now); } catch { /* ignore */ }
  };

  const risk = RISK_STYLES[childProfile.riskLevel] || RISK_STYLES.Low;
  const reviewStale = !lastReviewed || Date.now() - new Date(lastReviewed).getTime() > 30 * 86_400_000;

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight">Safety & Escalation</h2>
        <p className="text-sm text-[#a8a093] mt-1">Safety is a top-level feature: clear risk signals, contacts, and crisis language ready when you need them.</p>
      </div>

      {/* Risk banner */}
      <div className={`rounded-2xl border p-5 flex items-center gap-4 ${risk.banner}`}>
        <ShieldAlert className="w-6 h-6 flex-shrink-0" />
        <div>
          <span className="text-[10px] uppercase font-black tracking-widest opacity-80">Current risk level</span>
          <div className="text-xl font-black">{risk.label}</div>
        </div>
        <p className="text-xs opacity-80 ml-auto max-w-sm text-right hidden sm:block">
          Based on {childProfile.name}&apos;s profile. Update it from the sidebar profile editor as circumstances change.
        </p>
      </div>

      {/* Crisis script (pinned) */}
      <div className="bg-[#e2562d]/10 border border-[#e2562d]/30 rounded-2xl p-6 space-y-2">
        <span className="text-xs font-black uppercase tracking-wider text-[#ffb59c] flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4" /> Crisis script — say this
        </span>
        <p className="text-sm text-gray-100 leading-relaxed italic">
          “I am here. You are safe. I am not going anywhere. We will get through this moment together, and then we will figure out the next step — you don&apos;t have to do it alone.”
        </p>
        <p className="text-[11px] text-[#a8a093]">If there is immediate danger to your child or others, contact local emergency services first.</p>
      </div>

      {/* Escalation checklist + last reviewed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#141821] border border-white/10 rounded-2xl p-6 space-y-3">
          <span className="text-xs font-bold text-[#f4d991] uppercase tracking-wider">Escalation checklist — warning signs</span>
          <div className="space-y-2">
            {WARNING_SIGNS.map((sign, i) => (
              <label key={i} className="flex items-start gap-3 p-2.5 rounded-xl border border-white/5 bg-white/[0.01] hover:border-white/15 transition cursor-pointer text-xs">
                <input type="checkbox" checked={!!checked[i]} onChange={() => toggleSign(i)} className="mt-0.5 accent-[#e2562d]" />
                <span className={checked[i] ? "text-[#ffb59c] font-bold" : "text-gray-300"}>{sign}</span>
              </label>
            ))}
          </div>
          <p className="text-[11px] text-[#a8a093]">Any checked sign is a prompt to consult a professional promptly.</p>
        </div>

        <div className="bg-[#141821] border border-white/10 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#f4d991] uppercase tracking-wider flex items-center gap-1.5">
              <CalendarCheck className="w-3.5 h-3.5" /> Safety review
            </span>
            <button onClick={markReviewed} className="bg-[#d7aa55] hover:bg-[#c39947] text-black font-extrabold text-[11px] px-3 py-1.5 rounded-lg transition">Mark reviewed</button>
          </div>
          <p className="text-sm text-gray-200">
            Last reviewed: <strong>{lastReviewed ? new Date(lastReviewed).toLocaleDateString() : "never"}</strong>
          </p>
          {reviewStale && (
            <div className="text-xs text-[#f4d991] bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
              It&apos;s been a while — review safety info monthly to keep it current.
            </div>
          )}
        </div>
      </div>

      {/* Emergency contacts */}
      <div className="bg-[#141821] border border-white/10 rounded-2xl p-6 space-y-4">
        <span className="text-xs font-bold text-[#f4d991] uppercase tracking-wider flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5" /> Emergency contacts
        </span>

        {contacts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {contacts.map((c) => (
              <div key={c.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex items-start justify-between gap-2">
                <div className="text-xs">
                  <strong className="text-white block">{c.name}</strong>
                  <span className="text-[#a8a093]">{c.role}{c.role && c.phone ? " · " : ""}{c.phone}</span>
                  {c.notes && <p className="text-[10px] text-[#a8a093] mt-1">{c.notes}</p>}
                </div>
                <button onClick={() => void contactsCol.remove(c.id)} className="text-[#a8a093] hover:text-red-400 transition" aria-label="Remove contact">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={addContact} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" className="bg-[#08090c] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#d7aa55]/50" />
          <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Role (e.g. Pediatrician)" className="bg-[#08090c] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#d7aa55]/50" />
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="bg-[#08090c] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#d7aa55]/50" />
          <div className="flex gap-2">
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" className="flex-1 bg-[#08090c] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#d7aa55]/50" />
            <button type="submit" className="bg-[#d7aa55] hover:bg-[#c39947] text-black font-extrabold px-3 rounded-lg flex items-center"><Plus className="w-4 h-4" /></button>
          </div>
        </form>
      </div>

      {/* Static safeguards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
        <div className="bg-[#141821] border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="w-10 h-10 bg-yellow-500/15 rounded-xl flex items-center justify-center text-xl text-yellow-300">🩺</div>
          <h3 className="font-bold text-white text-sm">Medical Escalation Safeguard</h3>
          <p className="text-[#a8a093] leading-relaxed">The Parent Coach screens high-risk terms (fever, injury, self-harm, abuse, regression, severe distress) and routes parents toward professional or urgent support.</p>
        </div>
        <div className="bg-[#141821] border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="w-10 h-10 bg-blue-500/15 rounded-xl flex items-center justify-center text-xl text-blue-300">🇪🇺</div>
          <h3 className="font-bold text-white text-sm">GDPR & Minimization Controls</h3>
          <p className="text-[#a8a093] leading-relaxed">Arbor is designed for GDPR-aligned children&apos;s data minimization. No unsupervised AI interaction for children; details are stored as parent-approved observations.</p>
        </div>
        <div className="bg-[#141821] border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="w-10 h-10 bg-green-500/15 rounded-xl flex items-center justify-center text-xl text-green-300">🛡️</div>
          <h3 className="font-bold text-white text-sm">Multi-Professional Handoff</h3>
          <p className="text-[#a8a093] leading-relaxed">The printable summary bridges home observations with specialized care profiles, giving teachers and clinics non-diagnosing observational context instantly.</p>
        </div>
      </div>
    </motion.div>
  );
}
