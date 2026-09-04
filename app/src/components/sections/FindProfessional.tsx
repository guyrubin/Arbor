import { ageLabel } from "../../lib/childAge";
import React, { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import Icon from "../ui/Icon";
import { PageHeader, cardCls, Chip, PASTEL, InitialsTile } from "../ui/kit";
import type { PastelKey } from "../ui/kit";
import { Modal } from "../ui/Modal";
import type { Professional } from "../../services/professionals";
import { api, authHeaders } from "../../lib/api";
import { track } from "../../lib/analytics";
import { useArbor } from "../../context/ArborContext";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
// LC-09: the "track" leg — a recorded consult request becomes a tracked
// appointment, so "Track it in Appointments" stops landing on an empty list.
import { useChildCollection } from "../../hooks/useChildCollection";
import { appointmentFromConsultRequest, type Appointment } from "../../lib/careTrack";

/** Specialty chips. `query` is the CANONICAL search term the chip drops into
 *  the search box — professional records come back from /api/professionals in
 *  English, so translating the query would make every chip match nothing.
 *  Only `labelKey` is translated; see i18nElevation/careNetwork.ts. */
const SPECIALTIES: ReadonlyArray<{ query: string; labelKey: string }> = [
  { query: "Child Psychologist", labelKey: "elev.careNet.spec.psychologist" },
  { query: "Speech Therapist", labelKey: "elev.careNet.spec.speech" },
  { query: "Occupational Therapist", labelKey: "elev.careNet.spec.ot" },
  { query: "Parenting Coach", labelKey: "elev.careNet.spec.parentCoach" },
  { query: "Educational Consultant", labelKey: "elev.careNet.spec.eduConsultant" },
  { query: "Pediatrician", labelKey: "elev.careNet.spec.pediatrician" },
  { query: "Autism / ADHD Specialist", labelKey: "elev.careNet.spec.neuro" },
  { query: "Sleep Consultant", labelKey: "elev.careNet.spec.sleep" },
  { query: "Family Therapist", labelKey: "elev.careNet.spec.family" },
  { query: "School Readiness Specialist", labelKey: "elev.careNet.spec.schoolReadiness" },
];

/** LC-16: a filter's IDENTITY is this id, never the label a parent reads.
 *  The screen used to hold the selection as the English label string and
 *  switch on it — so translating "Verified by Arbor" would have left every
 *  chip visibly selected and matching nothing on a Hebrew UI. */
export type CareFilterId =
  | "verified"
  | "online"
  | "in_person"
  | "hebrew"
  | "english"
  | "ages_3_6"
  | "insurance";

export const CARE_FILTERS: ReadonlyArray<{ id: CareFilterId; labelKey: string }> = [
  { id: "verified", labelKey: "elev.careNet.filter.verified" },
  { id: "online", labelKey: "elev.careNet.filter.online" },
  { id: "in_person", labelKey: "elev.careNet.filter.inPerson" },
  { id: "hebrew", labelKey: "elev.careNet.filter.hebrew" },
  { id: "english", labelKey: "elev.careNet.filter.english" },
  { id: "ages_3_6", labelKey: "elev.careNet.filter.ages36" },
  { id: "insurance", labelKey: "elev.careNet.filter.insurance" },
];

// Fallback shown if the API is unavailable (keeps the directory functional
// offline). LC-16: this stays EMPTY. Arbor shows nobody until a real
// practitioner's identity and credentials have been reviewed — never a seed,
// a sample, or a placeholder profile.
const FALLBACK: Professional[] = [];
// True if the professional's age range overlaps [lo, hi].
function agesOverlap(ages: string, lo: number, hi: number): boolean {
  const m = ages.match(/(\d+)\s*[–-]\s*(\d+)/);
  if (!m) return true;
  const [min, max] = [Number(m[1]), Number(m[2])];
  return min <= hi && max >= lo;
}

/** Matching is language-independent: it reads the filter's id and the
 *  professional record, never any displayed copy. */
export function matchesFilter(p: Professional, f: CareFilterId): boolean {
  switch (f) {
    case "verified": return !!p.verified;
    case "online": return /online|remote/i.test(`${p.mode} ${p.city}`);
    case "in_person": return /in.?person/i.test(p.mode);
    case "hebrew": return /hebrew/i.test(p.langs);
    case "english": return /english/i.test(p.langs);
    case "ages_3_6": return agesOverlap(p.ages, 3, 6);
    case "insurance": return (p as { insurance?: boolean }).insurance !== false;
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
  const [active, setActive] = useState<CareFilterId[]>(["verified"]);
  const toggle = (f: CareFilterId) => setActive((p) => (p.includes(f) ? p.filter((x) => x !== f) : [...p, f]));
  const [pros, setPros] = useState<Professional[]>(FALLBACK);
  const [query, setQuery] = useState("");
  // MON-3 v1: real consult request flow (durable, email-based transaction).
  const [consultPro, setConsultPro] = useState<Professional | null>(null);
  const [consultNote, setConsultNote] = useState("");
  const [consultMode, setConsultMode] = useState<"either" | "video" | "in_person">("either");
  const [consultBusy, setConsultBusy] = useState(false);
  const [consultDone, setConsultDone] = useState<{ id: string; mailto: string | null } | null>(null);
  // LC-09: the same per-child sink the Appointments surface reads.
  const apptsCol = useChildCollection<Appointment>(childProfile.id, "appointments");

  const openConsult = (p: Professional) => {
    setConsultPro(p);
    // Prefill from the Consult packet when handed in; otherwise a gentle default.
    setConsultNote(
      incomingNote?.trim()
        ? incomingNote.trim()
        : childProfile.challenges[0]
        ? t("elev.careNet.consult.note.default", {
            topic: childProfile.challenges[0].toLowerCase(),
            name: first,
            age: ageLabel(childProfile, t),
          })
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
      // LC-09: find → share → TRACK. The request now exists as a "requested"
      // appointment the parent can follow, instead of vanishing into the
      // server's status model with no client surface.
      await apptsCol.upsert(
        appointmentFromConsultRequest({
          proName: consultPro.name,
          proRole: consultPro.role,
          requestId: request.id,
          // PERSISTED VALUE, not display copy: Appointments stores and renders
          // this string. It stays canonical English so a parent who switches
          // language does not end up with a half-translated record.
          mode: consultMode === "in_person" ? "In person" : "Online",
          nowMs: Date.now(),
        })
      );
      toast(t("elev.learnCare.track.created"), "success");
    } catch {
      // The API's own message is an untranslated server string; the parent
      // gets the localized failure line and can retry.
      toast(t("elev.careNet.consult.error"), "error");
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
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-[1180px]">
      {!embedded && (
        <PageHeader eyebrow={t("elev.careNet.eyebrow")} title={t("sec.findpro.title")} subtitle={t("sec.findpro.sub", { name: childProfile.name.split(" ")[0] })} />
      )}

      {/* Search + filters */}
      <div className={`${cardCls} p-5 space-y-4`}>
        <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "var(--arbor-paper-deep)" }}>
          <Icon name="search" size={18} style={{ color: "var(--arbor-muted)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("elev.careNet.search.placeholder")}
            dir="auto"
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "var(--arbor-ink)" }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {CARE_FILTERS.map((f) => {
            const on = active.includes(f.id);
            return (
              <button key={f.id} onClick={() => toggle(f.id)} className="rounded-full px-3 py-1.5 text-xs font-bold transition inline-flex items-center gap-1"
                style={on ? { background: "var(--arbor-clay)", color: "#fff" } : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>
                {f.id === "verified" && <Icon name="verified_user" size={15} fill={on ? 1 : 0} />}{t(f.labelKey)}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {SPECIALTIES.map((s, i) => (
            <button key={s.query} onClick={() => setQuery(s.query)} className="cursor-pointer">
              <Chip tone={(["mint","sky","lav","coral","yellow","pink"] as const)[i % 6]}>{t(s.labelKey)}</Chip>
            </button>
          ))}
        </div>
      </div>

      {/* Curated results */}
      {results.length === 0 ? (
        <div className={`${cardCls} p-10 text-center`}>
          <Icon name="shield_person" size={34} style={{ color: "var(--arbor-green-ink)" }} />
          <p className="mt-3 text-base font-bold" style={{ color: "var(--arbor-ink)" }}>{t("elev.careNet.empty.title")}</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("elev.careNet.empty.body")}</p>
          {!embedded && <button onClick={() => setActiveTab("consult")} className="mt-4 rounded-xl px-4 py-2.5 text-xs font-bold text-white" style={{ background: "var(--arbor-gradient-primary)" }}>{t("elev.careNet.empty.cta")}</button>}
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-5">
          {results.map((p) => (
            <div key={p.name} className={`${cardCls} p-5`}>
              <div className="flex items-start gap-4">
                <InitialsTile name={p.name} tone={(p.tone in PASTEL ? p.tone : "sky") as PastelKey} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-extrabold" dir="auto" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{p.name}</h3>
                    {p.verified && <Chip tone="mint" icon={<Icon name="verified" size={15} fill={1} />}>{t("elev.careNet.card.verified")}</Chip>}
                  </div>
                  <p className="text-sm font-semibold" dir="auto" style={{ color: "var(--arbor-green-ink)" }}>{p.role}</p>
                  <p className="text-xs mt-0.5" dir="auto" style={{ color: "var(--arbor-muted)" }}>{p.creds}</p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: "var(--arbor-yellow-ink)" }}><Icon name="star" size={15} fill={1} /> {p.rating}</span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 text-[12px]" style={{ color: "var(--arbor-muted)" }}>
                <span className="inline-flex items-center gap-1.5" dir="auto"><Icon name="translate" size={15} /> {p.langs}</span>
                <span className="inline-flex items-center gap-1.5" dir="auto"><Icon name="location_on" size={15} /> {p.city}</span>
                <span className="inline-flex items-center gap-1.5" dir="auto"><Icon name="language" size={15} /> {p.mode}</span>
                <span dir="auto">{t("elev.careNet.card.ages", { ages: p.ages, price: p.price })}</span>
              </div>
              <p className="text-xs mt-3 leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink)" }}><b>{t("elev.careNet.card.handles")}</b> {p.handles}</p>
              <p className="text-xs mt-1 leading-relaxed" dir="auto" style={{ color: "var(--arbor-muted)" }}>{p.approach}</p>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => openConsult(p)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 text-white font-bold text-xs rounded-xl py-2.5"
                  style={{ background: "var(--arbor-gradient-primary)" }}
                >
                  <Icon name="send" size={15} /> {t("elev.careNet.card.request")}
                </button>
                {!embedded && (
                  <button
                    onClick={() => { toast(t("elev.careNet.share.toast"), "info"); setActiveTab("consult"); }}
                    className="inline-flex items-center justify-center gap-1.5 font-bold text-xs rounded-xl px-3 py-2.5 bg-white"
                    style={{ color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.30)" }}
                  >
                    <Icon name="description" size={15} /> {t("elev.careNet.card.share")}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-center" style={{ color: "var(--arbor-muted)" }}>{t("elev.careNet.footer.verification")}</p>

      {/* MON-3 v1: consultation request modal */}
      <Modal open={!!consultPro} onClose={() => setConsultPro(null)} title={consultPro ? t("elev.careNet.consult.titleWith", { name: consultPro.name }) : t("elev.careNet.consult.title")}>
        {consultDone ? (
          <div className="space-y-4 text-sm">
            <div className="flex items-start gap-3 rounded-2xl p-4" style={{ background: "var(--arbor-green-soft)" }}>
              <Icon name="check_circle" size={20} fill={1} style={{ color: "var(--arbor-green-ink)" }} />
              <div>
                <p className="font-bold" style={{ color: "var(--arbor-ink)" }}>{t("elev.careNet.done.title")}</p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
                  {consultPro ? t("elev.careNet.done.body", { name: consultPro.name }) : t("elev.careNet.done.bodyGeneric")}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {consultDone.mailto && (
                <a href={consultDone.mailto} className="inline-flex items-center gap-1.5 text-xs font-bold rounded-xl px-3 py-2 text-white" style={{ background: "var(--arbor-clay)" }}>
                  <Icon name="mail" size={15} /> {t("elev.careNet.done.mail")}
                </a>
              )}
              {!embedded && (
                <button onClick={() => { setConsultPro(null); setActiveTab("consult"); }} className="inline-flex items-center gap-1.5 text-xs font-bold rounded-xl px-3 py-2 bg-white" style={{ color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.30)" }}>
                  <Icon name="description" size={15} /> {t("elev.careNet.done.summary")}
                </button>
              )}
              <button onClick={() => { setConsultPro(null); setActiveTab("appointments"); }} className="inline-flex items-center gap-1.5 text-xs font-bold rounded-xl px-3 py-2 bg-white" style={{ color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}>
                {t("elev.learnCare.track.open")}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="space-y-1.5">
              <label htmlFor="consult-note" className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("elev.careNet.note.label")}</label>
              <textarea
                id="consult-note"
                value={consultNote}
                onChange={(e) => setConsultNote(e.target.value)}
                rows={3}
                dir="auto"
                placeholder={t("elev.careNet.note.placeholder", { name: first })}
                className="w-full rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
              />
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-bold block" style={{ color: "var(--arbor-muted)" }}>{t("elev.careNet.mode.label")}</span>
              <div className="flex gap-2">
                {([["either", "elev.careNet.mode.either"], ["video", "elev.careNet.mode.video"], ["in_person", "elev.careNet.mode.inPerson"]] as const).map(([k, labelKey]) => (
                  <button key={k} type="button" onClick={() => setConsultMode(k)} className="flex-1 py-2 rounded-xl text-xs font-bold transition"
                    style={consultMode === k ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.40)" } : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}>
                    {t(labelKey)}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[11px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
              {t("elev.careNet.privacy", { name: first })}
            </p>
            <button onClick={() => void submitConsult()} disabled={consultBusy} className="w-full py-3 text-white font-extrabold text-sm rounded-2xl transition active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: "var(--arbor-gradient-primary)" }}>
              {consultBusy ? (<><Icon name="progress_activity" size={16} className="animate-spin" /> {t("elev.careNet.sending")}</>) : (<><Icon name="send" size={18} /> {t("elev.careNet.send")}</>)}
            </button>
          </div>
        )}
      </Modal>
    </motion.div>
  );
}
