import React, { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { Search, ShieldCheck, Globe, MapPin, Languages as LangIcon, Star, Send, FileText, RefreshCw, CheckCircle2, Mail } from "lucide-react";
import { PageHeader, cardCls, Chip, PASTEL } from "../ui/kit";
import { Modal } from "../ui/Modal";
import type { Professional } from "../../services/professionals";
import { api, authHeaders } from "../../lib/api";
import { track } from "../../lib/analytics";
import { useArbor } from "../../context/ArborContext";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";

const SPECIALTIES = [
  "Child Psychologist", "Speech Therapist", "Occupational Therapist", "Parenting Coach",
  "Educational Consultant", "Pediatrician", "Autism / ADHD Specialist", "Sleep Consultant",
  "Family Therapist", "School Readiness Specialist",
];

const FILTERS = ["Verified by Arbor", "Online", "In-person", "Hebrew", "English", "Ages 3–6", "Insurance accepted"];

// Fallback shown if the API is unavailable (keeps the directory functional offline).
const FALLBACK: Professional[] = [
  { id: "p1", name: "Dr. Maya Levi", role: "Child Psychologist", creds: "PhD, Clinical Psychology", langs: "Hebrew · English", city: "Tel Aviv · Online", mode: "Online & in-person", ages: "3–10", approach: "Warm, attachment-informed, practical", handles: "Transition anxiety, emotional regulation", price: "₪₪₪", rating: 4.9, verified: true, tone: "sky" },
  { id: "p2", name: "Noa Ben-David", role: "Speech & Language Therapist", creds: "MA, CCC-SLP", langs: "Hebrew · English · Arabic", city: "Remote", mode: "Online", ages: "2–8", approach: "Play-based, bilingual focus", handles: "Bilingual transition, expressive language", price: "₪₪", rating: 4.8, verified: true, tone: "mint" },
  { id: "p3", name: "Dr. Amir Cohen", role: "Pediatrician", creds: "MD, Developmental-Behavioral", langs: "Hebrew · English", city: "Herzliya", mode: "In-person", ages: "0–12", approach: "Evidence-first, calm, parent-partnering", handles: "Developmental screening, sleep, milestones", price: "₪₪₪", rating: 5.0, verified: true, tone: "coral" },
];

/** True if the professional's "min–max" age string overlaps [lo, hi]. */
function agesOverlap(ages: string, lo: number, hi: number): boolean {
  const m = ages.match(/(\d+)\s*[–-]\s*(\d+)/);
  if (!m) return true;
  const [min, max] = [Number(m[1]), Number(m[2])];
  return min <= hi && max >= lo;
}

function matchesFilter(p: Professional, f: string): boolean {
  switch (f) {
    case "Verified by Arbor": return !!p.verified;
    case "Online": return /online|remote/i.test(`${p.mode} ${p.city}`);
    case "In-person": return /in.?person/i.test(p.mode);
    case "Hebrew": return /hebrew/i.test(p.langs);
    case "English": return /english/i.test(p.langs);
    case "Ages 3–6": return agesOverlap(p.ages, 3, 6);
    case "Insurance accepted": return (p as { insurance?: boolean }).insurance !== false;
    default: return true;
  }
}

/** Care Network › Find a Professional (curated, verified directory — fetched from
 *  the Arbor professionals API, never "marketplace" in parent UI). */
/** Optional incoming context handed in from the Consult flow's "Send to a
 *  professional" action: the parent-selected packet text prefills the consult
 *  note so the request starts from the redacted summary, not a hardcoded line. */
export interface FindProfessionalProps {
  /** Prefill text for the consult-request note (e.g. the selected packet). */
  incomingNote?: string;
  /** When true, FindProfessional is rendered inside a host modal (Consult send
   *  flow) — used to avoid steering parents back to a route that no longer exists. */
  embedded?: boolean;
}

export default function FindProfessional({ incomingNote, embedded }: FindProfessionalProps = {}) {
  const { childProfile, setActiveTab } = useArbor();
  const { toast } = useToast();
  const { t } = useLanguage();
  const first = childProfile.name.split(" ")[0];
  const [active, setActive] = useState<string[]>(["Verified by Arbor"]);
  const toggle = (f: string) => setActive((p) => (p.includes(f) ? p.filter((x) => x !== f) : [...p, f]));
  const [pros, setPros] = useState<Professional[]>(FALLBACK);
  const [query, setQuery] = useState("");
  // MON-3 v1: real consult request flow (durable, email-based transaction).
  const [consultPro, setConsultPro] = useState<Professional | null>(null);
  const [consultNote, setConsultNote] = useState("");
  const [consultMode, setConsultMode] = useState<"either" | "video" | "in_person">("either");
  const [consultBusy, setConsultBusy] = useState(false);
  const [consultDone, setConsultDone] = useState<{ id: string; mailto: string | null } | null>(null);

  const openConsult = (p: Professional) => {
    setConsultPro(p);
    // Prefill from the Consult packet when handed in; otherwise a gentle default.
    setConsultNote(
      incomingNote?.trim()
        ? incomingNote.trim()
        : childProfile.challenges[0]
        ? `We're working on ${childProfile.challenges[0].toLowerCase()} with ${first} (age ${childProfile.age}).`
        : ""
    );
    setConsultMode("either");
    setConsultDone(null);
  };

  const submitConsult = async () => {
    if (!consultPro) return;
    setConsultBusy(true);
    // Loop conversion (c3): highest-intent action in Care. Raw track() strings,
    // not the LoopEvent enum (that contract is owned by mk-p0-4).
    track("consult_send_initiated", { proRole: consultPro.role, mode: consultMode, fromPacket: !!incomingNote?.trim() });
    try {
      const { request, mailto } = await api.requestConsult({
        professionalId: consultPro.id,
        childId: childProfile.id,
        note: consultNote,
        preferredMode: consultMode,
      });
      setConsultDone({ id: request.id, mailto });
      track("consult_send_completed", { proRole: consultPro.role, mode: consultMode });
      toast(`Consultation request sent for ${consultPro.name}.`, "success");
    } catch (err: any) {
      toast(err.message || "Couldn't record the request — please try again.", "error");
    } finally {
      setConsultBusy(false);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/professionals", { headers: await authHeaders() });
        if (res.ok) {
          const data = await res.json();
          if (alive && Array.isArray(data.professionals) && data.professionals.length) setPros(data.professionals);
        }
      } catch { /* keep fallback */ }
    })();
    return () => { alive = false; };
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pros.filter((p) => {
      if (!active.every((f) => matchesFilter(p, f))) return false;
      if (!q) return true;
      return `${p.name} ${p.role} ${p.handles} ${p.approach}`.toLowerCase().includes(q);
    });
  }, [pros, active, query]);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-[1180px]">
      {!embedded && (
        <PageHeader eyebrow="Care Network" title={t("sec.findpro.title")} subtitle={t("sec.findpro.sub", { name: childProfile.name.split(" ")[0] })} />
      )}

      {/* Search + filters */}
      <div className={`${cardCls} p-5 space-y-4`}>
        <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "var(--arbor-paper-deep)" }}>
          <Search className="w-4 h-4" style={{ color: "var(--arbor-muted)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by specialty, concern, or name"
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "var(--arbor-ink)" }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const on = active.includes(f);
            return (
              <button key={f} onClick={() => toggle(f)} className="rounded-full px-3 py-1.5 text-xs font-bold transition inline-flex items-center gap-1"
                style={on ? { background: "var(--arbor-clay)", color: "#fff" } : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>
                {f === "Verified by Arbor" && <ShieldCheck className="w-3.5 h-3.5" />}{f}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {SPECIALTIES.map((s, i) => (
            <button key={s} onClick={() => setQuery(s)} className="cursor-pointer">
              <Chip tone={(["mint","sky","lav","coral","yellow","pink"] as const)[i % 6]}>{s}</Chip>
            </button>
          ))}
        </div>
      </div>

      {/* Curated results */}
      {results.length === 0 ? (
        <div className={`${cardCls} p-10 text-center`}>
          <p className="text-sm font-bold" style={{ color: "var(--arbor-ink)" }}>No professionals match those filters.</p>
          <button onClick={() => { setActive([]); setQuery(""); }} className="text-xs font-bold mt-2" style={{ color: "var(--arbor-green-ink)" }}>Clear filters</button>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-5">
          {results.map((p) => (
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
                  <p className="text-sm font-semibold" style={{ color: "var(--arbor-green-ink)" }}>{p.role}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--arbor-muted)" }}>{p.creds}</p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: "var(--arbor-yellow-ink)" }}><Star className="w-3.5 h-3.5 fill-current" /> {p.rating}</span>
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
                <button
                  onClick={() => openConsult(p)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 text-white font-bold text-xs rounded-xl py-2.5"
                  style={{ background: "var(--arbor-gradient-primary)" }}
                >
                  <Send className="w-3.5 h-3.5" /> Request consultation
                </button>
                <button
                  onClick={() => { toast("Build a shareable summary in Consult.", "info"); setActiveTab("consult"); }}
                  className="inline-flex items-center justify-center gap-1.5 font-bold text-xs rounded-xl px-3 py-2.5 bg-white"
                  style={{ color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.30)" }}
                >
                  <FileText className="w-3.5 h-3.5" /> Share Arbor summary
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-center" style={{ color: "var(--arbor-muted)" }}>Every professional is reviewed and verified by Arbor. Curated, not crowdsourced.</p>

      {/* MON-3 v1: consultation request modal */}
      <Modal open={!!consultPro} onClose={() => setConsultPro(null)} title={consultPro ? `Request a consultation — ${consultPro.name}` : "Request a consultation"}>
        {consultDone ? (
          <div className="space-y-4 text-sm">
            <div className="flex items-start gap-3 rounded-2xl p-4" style={{ background: "var(--arbor-green-soft)" }}>
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: "var(--arbor-green-ink)" }} />
              <div>
                <p className="font-bold" style={{ color: "var(--arbor-ink)" }}>Request recorded</p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
                  Arbor saved your consultation request{consultPro ? ` for ${consultPro.name}` : ""}. We'll coordinate the introduction — you can prepare context to share meanwhile.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {consultDone.mailto && (
                <a href={consultDone.mailto} className="inline-flex items-center gap-1.5 text-xs font-bold rounded-xl px-3 py-2 text-white" style={{ background: "var(--arbor-clay)" }}>
                  <Mail className="w-3.5 h-3.5" /> Send the intro email
                </a>
              )}
              <button onClick={() => { setConsultPro(null); setActiveTab("consult"); }} className="inline-flex items-center gap-1.5 text-xs font-bold rounded-xl px-3 py-2 bg-white" style={{ color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.30)" }}>
                <FileText className="w-3.5 h-3.5" /> Prepare a shareable summary
              </button>
              <button onClick={() => { setConsultPro(null); setActiveTab("appointments"); }} className="inline-flex items-center gap-1.5 text-xs font-bold rounded-xl px-3 py-2 bg-white" style={{ color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}>
                Track it in Appointments
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="space-y-1.5">
              <label htmlFor="consult-note" className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>What's going on? (shared with the professional)</label>
              <textarea
                id="consult-note"
                value={consultNote}
                onChange={(e) => setConsultNote(e.target.value)}
                rows={3}
                placeholder={`A sentence or two about what you'd like help with for ${first}.`}
                className="w-full rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
              />
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-bold block" style={{ color: "var(--arbor-muted)" }}>Preferred format</span>
              <div className="flex gap-2">
                {([["either", "Either"], ["video", "Video call"], ["in_person", "In person"]] as const).map(([k, label]) => (
                  <button key={k} type="button" onClick={() => setConsultMode(k)} className="flex-1 py-2 rounded-xl text-xs font-bold transition"
                    style={consultMode === k ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.40)" } : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[11px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
              Nothing from {first}'s profile is shared automatically — only the note above. You stay in control of any reports you choose to share.
            </p>
            <button onClick={() => void submitConsult()} disabled={consultBusy} className="w-full py-3 text-white font-extrabold text-sm rounded-2xl transition active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: "var(--arbor-gradient-primary)" }}>
              {consultBusy ? (<><RefreshCw className="w-4 h-4 animate-spin" /> Sending…</>) : (<><Send className="w-4 h-4" /> Send the request</>)}
            </button>
          </div>
        )}
      </Modal>
    </motion.div>
  );
}
