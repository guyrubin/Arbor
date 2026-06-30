import React, { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { PageHeader, SectionCard, cardCls, PASTEL, PastelKey } from "../ui/kit";

type Contact = { id: string; name: string; role: string; phone: string; notes: string };

const WARNING_SIGNS = [
  "Sudden loss of previously mastered skills (regression)",
  "Talk of self-harm or harming others",
  "Persistent withdrawal from people and play",
  "Sleep or appetite change lasting more than two weeks",
  "Injury, fever, or a medical concern needing review",
  "Escalating aggression that endangers self or others",
];

const RISK_TONE: Record<string, PastelKey> = { Low: "mint", Moderate: "yellow", High: "pink" };

const inputCls = "rounded-lg px-3 py-2 text-sm focus:outline-none";
const inputStyle: React.CSSProperties = { background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" };

export default function SafetyTab() {
  const { childProfile, approvedMemoryItems, handleMemoryDecision, isMemoryUpdating } = useArbor();
  const { t } = useLanguage();
  const first = childProfile.name.split(" ")[0];

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

  const riskLabel = childProfile.riskLevel || "Low";
  const riskTone = RISK_TONE[riskLabel] || "mint";
  const riskP = PASTEL[riskTone];
  const reviewStale = !lastReviewed || Date.now() - new Date(lastReviewed).getTime() > 30 * 86_400_000;

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-[1180px]">
      <PageHeader
        eyebrow="Care Network"
        title="Safety & Escalation"
        subtitle="Clear risk signals, emergency contacts, and crisis language — ready the moment you need them."
      />

      {/* Risk banner */}
      <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: riskP.soft }}>
        <Icon name="gpp_maybe" size={24} className="flex-shrink-0" style={{ color: riskP.ink }} />
        <div>
          <span className="text-[10px] uppercase font-extrabold tracking-widest" style={{ color: riskP.ink }}>Current risk level</span>
          <div className="text-xl font-extrabold" style={{ color: "var(--arbor-ink)" }}>{riskLabel}</div>
        </div>
        <p className="text-xs ms-auto max-w-sm text-end hidden sm:block" style={{ color: "var(--arbor-muted)" }}>
          Based on {first}&apos;s profile. Update it from the profile editor as circumstances change.
        </p>
      </div>

      {/* Crisis script (pinned) */}
      <div className="rounded-2xl p-6 space-y-2" style={{ background: "var(--arbor-pink-soft)" }}>
        <span className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--arbor-pink-ink)" }}>
          <Icon name="warning" size={16} /> Crisis script — say this
        </span>
        <p className="text-sm leading-relaxed italic" style={{ color: "var(--arbor-ink)" }}>
          “I am here. You are safe. I am not going anywhere. We will get through this moment together, and then we will figure out the next step — you don&apos;t have to do it alone.”
        </p>
        <p className="text-[11px]" style={{ color: "var(--arbor-muted)" }}>If there is immediate danger to your child or others, contact local emergency services first.</p>
      </div>

      {/* Escalation checklist + last reviewed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Escalation checklist — warning signs" icon={<Icon name="warning" size={20} />} tone="coral">
          <div className="space-y-2">
            {WARNING_SIGNS.map((sign, i) => (
              <label key={i} className={`${cardCls} flex items-start gap-3 p-2.5 transition cursor-pointer text-xs`}>
                <input type="checkbox" checked={!!checked[i]} onChange={() => toggleSign(i)} className="mt-0.5" style={{ accentColor: "var(--arbor-pink-ink)" }} />
                <span style={{ color: checked[i] ? "var(--arbor-pink-ink)" : "var(--arbor-ink)", fontWeight: checked[i] ? 700 : 400 }}>{sign}</span>
              </label>
            ))}
          </div>
          <p className="text-[11px] mt-3" style={{ color: "var(--arbor-muted)" }}>Any checked sign is a prompt to consult a professional promptly.</p>
        </SectionCard>

        <SectionCard title="Safety review" icon={<Icon name="event_available" size={20} />} tone="sky"
          action={
            <button onClick={markReviewed} className="font-extrabold text-[11px] px-3 py-1.5 rounded-lg transition" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>Mark reviewed</button>
          }
        >
          <p className="text-sm" style={{ color: "var(--arbor-ink)" }}>
            Last reviewed: <strong>{lastReviewed ? new Date(lastReviewed).toLocaleDateString() : "never"}</strong>
          </p>
          {reviewStale && (
            <div className="text-xs rounded-xl px-3 py-2 mt-3" style={{ background: "var(--arbor-yellow-soft)", color: "var(--arbor-yellow-ink)" }}>
              It&apos;s been a while — review safety info monthly to keep it current.
            </div>
          )}
        </SectionCard>
      </div>

      {/* Emergency contacts */}
      <SectionCard title="Emergency contacts" icon={<Icon name="call" size={20} />} tone="mint">
        {contacts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {contacts.map((c) => (
              <div key={c.id} className={`${cardCls} p-3 flex items-start justify-between gap-2`}>
                <div className="text-xs">
                  <strong className="block" style={{ color: "var(--arbor-ink)" }}>{c.name}</strong>
                  <span style={{ color: "var(--arbor-muted)" }}>{c.role}{c.role && c.phone ? " · " : ""}{c.phone}</span>
                  {c.notes && <p className="text-[10px] mt-1" style={{ color: "var(--arbor-muted)" }}>{c.notes}</p>}
                </div>
                <button onClick={() => void contactsCol.remove(c.id)} className="transition" style={{ color: "var(--arbor-muted)" }} aria-label={t("aria.removeContact")}>
                  <Icon name="delete" size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={addContact} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" className={inputCls} style={inputStyle} />
          <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Role (e.g. Pediatrician)" className={inputCls} style={inputStyle} />
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className={inputCls} style={inputStyle} />
          <div className="flex gap-2">
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" className={`flex-1 ${inputCls}`} style={inputStyle} />
            <button type="submit" aria-label={t("aria.addContact")} className="text-white font-extrabold px-3 rounded-lg flex items-center" style={{ background: "var(--arbor-clay)" }}><Icon name="add" size={16} /></button>
          </div>
        </form>
      </SectionCard>

      {/* What Arbor knows (approved memory) */}
      <SectionCard title={`What Arbor knows about ${first}`} icon={<Icon name="neurology" size={20} />} tone="lav">
        <p className="text-xs mb-3" style={{ color: "var(--arbor-muted)" }}>Only parent-approved observations become active memory. Forget any of them at any time.</p>
        {approvedMemoryItems.length === 0 ? (
          <p className={`${cardCls} text-xs p-3`} style={{ color: "var(--arbor-muted)" }}>No approved memory yet. Approve observations from the Child Memory queue.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {approvedMemoryItems.map((item) => (
              <div key={item.memoryId} className={`${cardCls} p-3 flex items-start justify-between gap-2`}>
                <p className="text-xs leading-relaxed" style={{ color: "var(--arbor-ink)" }}>{item.fact}</p>
                <button
                  onClick={() => handleMemoryDecision(item.memoryId, "deleted")}
                  disabled={isMemoryUpdating === item.memoryId}
                  className="text-[10px] font-bold flex-shrink-0 disabled:opacity-50"
                  style={{ color: "var(--arbor-pink-ink)" }}
                >
                  Forget
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Static safeguards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        {[
          { icon: <Icon name="stethoscope" size={20} />, tone: "yellow" as PastelKey, title: "Medical escalation safeguard", body: "The Parent Coach screens high-risk terms (fever, injury, self-harm, abuse, regression, severe distress) and routes parents toward professional or urgent support." },
          { icon: <Icon name="lock" size={20} />, tone: "sky" as PastelKey, title: "GDPR & data minimization", body: "Arbor is designed for GDPR-aligned children's data minimization. No unsupervised AI interaction for children; details are stored as parent-approved observations." },
          { icon: <Icon name="group" size={20} />, tone: "mint" as PastelKey, title: "Multi-professional handoff", body: "The printable summary bridges home observations with specialized care profiles, giving teachers and clinics non-diagnosing observational context instantly." },
        ].map((s) => (
          <div key={s.title} className={`${cardCls} p-5 space-y-3`}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: PASTEL[s.tone].soft, color: PASTEL[s.tone].ink }}>{s.icon}</div>
            <h3 className="font-extrabold text-sm" style={{ color: "var(--arbor-ink)" }}>{s.title}</h3>
            <p className="leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{s.body}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
