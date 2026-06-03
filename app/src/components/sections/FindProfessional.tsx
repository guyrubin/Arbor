import React, { useState } from "react";
import { motion } from "motion/react";
import { Search, ShieldCheck, Globe, MapPin, Languages as LangIcon, Star, Send, FileText } from "lucide-react";
import { PageHeader, cardCls, Chip, PASTEL } from "../ui/kit";

const SPECIALTIES = [
  "Child Psychologist", "Speech Therapist", "Occupational Therapist", "Parenting Coach",
  "Educational Consultant", "Pediatrician", "Autism / ADHD Specialist", "Sleep Consultant",
  "Family Therapist", "School Readiness Specialist",
];

const FILTERS = ["Verified by Arbor", "Online", "In-person", "Hebrew", "English", "Ages 3–6", "Insurance accepted"];

type Pro = {
  name: string; role: string; creds: string; langs: string; city: string; mode: string;
  ages: string; approach: string; handles: string; price: string; rating: number; verified: boolean; tone: any;
};

const PROS: Pro[] = [
  { name: "Dr. Maya Levi", role: "Child Psychologist", creds: "PhD, Clinical Psychology", langs: "Hebrew · English", city: "Tel Aviv · Online", mode: "Online & in-person", ages: "3–10", approach: "Warm, attachment-informed, practical", handles: "Transition anxiety, emotional regulation", price: "₪₪₪", rating: 4.9, verified: true, tone: "sky" },
  { name: "Noa Ben-David", role: "Speech & Language Therapist", creds: "MA, CCC-SLP", langs: "Hebrew · English · Arabic", city: "Remote", mode: "Online", ages: "2–8", approach: "Play-based, bilingual focus", handles: "Bilingual transition, expressive language", price: "₪₪", rating: 4.8, verified: true, tone: "mint" },
  { name: "Dr. Amir Cohen", role: "Pediatrician", creds: "MD, Developmental-Behavioral", langs: "Hebrew · English", city: "Herzliya", mode: "In-person", ages: "0–12", approach: "Evidence-first, calm, parent-partnering", handles: "Developmental screening, sleep, milestones", price: "₪₪₪", rating: 5.0, verified: true, tone: "coral" },
];

/** Care Network › Find a Professional (curated, verified directory — never "marketplace" in parent UI). */
export default function FindProfessional() {
  const [active, setActive] = useState<string[]>(["Verified by Arbor"]);
  const toggle = (f: string) => setActive((p) => (p.includes(f) ? p.filter((x) => x !== f) : [...p, f]));

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-[1180px]">
      <PageHeader eyebrow="Care Network" title="Find a professional" subtitle="A curated, Arbor-verified network of child-development specialists — coordinated around Dylan, with your context ready to share." />

      {/* Search + filters */}
      <div className={`${cardCls} p-5 space-y-4`}>
        <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "var(--arbor-paper-deep)" }}>
          <Search className="w-4 h-4" style={{ color: "var(--arbor-muted)" }} />
          <input placeholder="Search by specialty, concern, or name" className="flex-1 bg-transparent outline-none text-sm" style={{ color: "var(--arbor-ink)" }} />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const on = active.includes(f);
            return (
              <button key={f} onClick={() => toggle(f)} className="rounded-full px-3 py-1.5 text-xs font-bold transition inline-flex items-center gap-1"
                style={on ? { background: "#34b277", color: "#fff" } : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>
                {f === "Verified by Arbor" && <ShieldCheck className="w-3.5 h-3.5" />}{f}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {SPECIALTIES.map((s, i) => <Chip key={s} tone={(["mint","sky","lav","coral","yellow","pink"] as const)[i % 6]}>{s}</Chip>)}
        </div>
      </div>

      {/* Curated results */}
      <div className="grid lg:grid-cols-2 gap-5">
        {PROS.map((p) => (
          <div key={p.name} className={`${cardCls} p-5`}>
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-extrabold flex-shrink-0" style={{ background: PASTEL[p.tone as keyof typeof PASTEL].soft, color: PASTEL[p.tone as keyof typeof PASTEL].ink, fontFamily: "var(--font-display)" }}>
                {p.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-extrabold" style={{ color: "var(--arbor-ink)" }}>{p.name}</h3>
                  {p.verified && <Chip tone="mint" icon={<ShieldCheck className="w-3.5 h-3.5" />}>Verified by Arbor</Chip>}
                </div>
                <p className="text-sm font-semibold" style={{ color: "#1f8a5a" }}>{p.role}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--arbor-muted)" }}>{p.creds}</p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: "#a9780f" }}><Star className="w-3.5 h-3.5 fill-current" /> {p.rating}</span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 text-[12px]" style={{ color: "var(--arbor-muted)" }}>
              <span className="inline-flex items-center gap-1.5"><LangIcon className="w-3.5 h-3.5" /> {p.langs}</span>
              <span className="inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {p.city}</span>
              <span className="inline-flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> {p.mode}</span>
              <span>Ages {p.ages} · {p.price}</span>
            </div>
            <p className="text-xs mt-3 leading-relaxed" style={{ color: "var(--arbor-ink)" }}><b>Handles:</b> {p.handles}</p>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{p.approach}</p>

            <div className="flex gap-2 mt-4">
              <button className="flex-1 inline-flex items-center justify-center gap-1.5 text-white font-bold text-xs rounded-xl py-2.5" style={{ background: "linear-gradient(135deg,#3cc081,#2a9c66)" }}>
                <Send className="w-3.5 h-3.5" /> Request consultation
              </button>
              <button className="inline-flex items-center justify-center gap-1.5 font-bold text-xs rounded-xl px-3 py-2.5 bg-white" style={{ color: "#1f8a5a", border: "1px solid rgba(52,178,119,0.30)" }}>
                <FileText className="w-3.5 h-3.5" /> Share Arbor summary
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-center" style={{ color: "var(--arbor-muted)" }}>Every professional is reviewed and verified by Arbor. Curated, not crowdsourced.</p>
    </motion.div>
  );
}
