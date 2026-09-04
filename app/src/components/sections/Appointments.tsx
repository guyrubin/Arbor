import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import Icon from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useToast } from "../../context/ToastContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { PageHeader, SectionCard, cardCls, Chip } from "../ui/kit";
import { fmtDay } from "../../lib/formatDate";
import {
  appointmentStartMs,
  appointmentStatus,
  appointmentToIcs,
  defaultIcsEgressDeps,
  dueReminders,
  followUpsFor,
  isFollowUpDue,
  makeFollowUp,
  saveIcsFile,
  sortAppointments,
  type Appointment,
  type AppointmentFollowUp,
  type AppointmentStatus,
} from "../../lib/careTrack";

type PrepQuestion = { id: string; text: string };

/** Care Network › Appointments — persisted per child (Firestore when authed,
 *  localStorage in sandbox) so nothing is lost on refresh.
 *
 *  LC-12: the surface used to keep a name and a free-text string. It now keeps
 *  a real date (`datetime-local` → ISO), orders by that date, offers a calendar
 *  file, and captures what the professional said afterwards into the registered
 *  `apptFollowUps` sink (export + erase swept).
 *
 *  BOOKING STATUS IS LOCAL, AND ONLY LOCAL. This header used to claim the row
 *  "carries the booking status the consult request set". It does not, and no
 *  code ever made it so. `status` is stamped ONCE, client-side: "requested" at
 *  creation from a consult request (FindProfessional → careTrack
 *  .appointmentFromConsultRequest), "confirmed" for a booking the parent adds
 *  by hand, and "done" when they save a follow-up note here. It is never
 *  reconciled against the server, and `careTrack.statusFromConsultRequest` —
 *  which exists for exactly that reconciliation — has no production caller.
 *
 *  That is not an oversight to wire up on sight: `ConsultStore`
 *  (server/consultRequests.ts) exposes only `create` and `listByOwner`, and
 *  `buildConsultRequest` hard-codes `status: "requested"`, so no code path in
 *  this repo can ever move a consult request off "requested". Reconciling today
 *  would map "requested" → "requested" while overwriting the one status the
 *  parent's own action DID earn ("done" after a follow-up). See the note on
 *  `statusFromConsultRequest` for what has to land server-side first.
 *
 *  REMINDERS ARE IN-APP ONLY. This app has no notification infrastructure —
 *  no VAPID key, and @capacitor/local-notifications is not a dependency. The
 *  "Coming up" strip renders on the parent's next open and the copy says
 *  plainly that Arbor does not send phone notifications. Never soften that
 *  line into an implied alert.
 *
 *  CLINICAL FIREWALL: chips describe the BOOKING (requested / confirmed /
 *  done), never the child. Nothing here scores, rates or colour-codes a child.
 */
export default function Appointments() {
  const { setActiveTab, childProfile } = useArbor();
  const { t, uiLang } = useLanguage();
  const { toast } = useToast();
  const apptsCol = useChildCollection<Appointment>(childProfile.id, "appointments");
  const questionsCol = useChildCollection<PrepQuestion>(childProfile.id, "apptQuestions");
  const followUpsCol = useChildCollection<AppointmentFollowUp>(childProfile.id, "apptFollowUps");

  const nowMs = Date.now();
  const { upcoming, past } = useMemo(
    () => sortAppointments(apptsCol.items, nowMs),
    // nowMs re-reads each render on purpose: ordering must not go stale mid-session.
    [apptsCol.items, nowMs]
  );
  const reminders = useMemo(() => dueReminders(apptsCol.items, nowMs), [apptsCol.items, nowMs]);
  const questions = useMemo(
    () => [...questionsCol.items].sort((a, b) => (a.id < b.id ? -1 : 1)),
    [questionsCol.items]
  );

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ who: "", role: "", when: "" });
  const [q, setQ] = useState("");

  const addAppt = () => {
    if (!form.who.trim()) return;
    void apptsCol.upsert({
      id: `a${Date.now()}`,
      who: form.who,
      role: form.role || "Professional",
      // `datetime-local` yields "YYYY-MM-DDTHH:mm" (device-local). Stored as
      // given; parsing stays in careTrack so ordering has ONE definition.
      whenIso: form.when ? new Date(form.when).toISOString() : undefined,
      when: "",
      mode: "Online",
      status: "confirmed",
    });
    setForm({ who: "", role: "", when: "" });
    setAdding(false);
  };
  const addQ = () => {
    if (q.trim()) {
      void questionsCol.upsert({ id: `q${Date.now()}`, text: q.trim() });
      setQ("");
    }
  };

  const whenLabel = (a: Appointment): string => {
    const start = appointmentStartMs(a);
    if (start == null) return a.when.trim() || t("elev.learnCare.appt.when.missing");
    const day = fmtDay(new Date(start).toISOString(), uiLang);
    let time = "";
    try {
      time = new Date(start).toLocaleTimeString(uiLang === "he" ? "he-IL" : "en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      /* exotic runtime — the day alone is still an honest label */
    }
    return time ? `${day} · ${time}` : day;
  };

  /** "Add to calendar" — the transport ladder lives in careTrack.saveIcsFile
   *  (native share sheet → browser download), because a blob `<a download>` is
   *  not reliable egress inside a Capacitor WKWebView. This surface used to do
   *  exactly that and toast "saved" regardless; on iOS nothing was written and
   *  nothing failed loudly. The toast now follows what actually happened: the
   *  OS share sheet is its own confirmation, so only the browser path speaks. */
  const saveIcs = async (a: Appointment) => {
    const file = appointmentToIcs(a, Date.now());
    if (!file) return;
    const channel = await saveIcsFile(file, defaultIcsEgressDeps());
    if (channel === "download") toast(t("elev.learnCare.appt.ics.done"), "success");
    else if (channel === "unavailable") toast(t("elev.learnCare.appt.ics.failed"), "error");
  };

  const saveFollowUp = (a: Appointment, note: string) => {
    const record = makeFollowUp(a.id, note, Date.now());
    if (!record) return false;
    void followUpsCol.upsert(record);
    // The visit demonstrably happened — the booking moves to "done". This is a
    // fact about the BOOKING; nothing about the child is inferred.
    if (appointmentStatus(a) !== "done") void apptsCol.upsert({ ...a, status: "done" });
    toast(t("elev.learnCare.appt.followUp.saved"), "success");
    return true;
  };

  const row = (a: Appointment) => (
    <ApptRow
      key={a.id}
      appt={a}
      whenLabel={whenLabel(a)}
      followUps={followUpsFor(followUpsCol.items, a.id)}
      followUpDue={isFollowUpDue(a, nowMs)}
      onRemove={() => void apptsCol.remove(a.id)}
      onCalendar={() => void saveIcs(a)}
      onFollowUp={(note) => saveFollowUp(a, note)}
      t={t}
    />
  );

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-[980px]">
      <PageHeader
        eyebrow="Care Network"
        title={t("sec.appt.title")}
        subtitle={t("sec.appt.sub")}
        action={
          <button onClick={() => setAdding((a) => !a)} className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-2xl px-5 py-3 min-h-[44px]" style={{ background: "var(--arbor-gradient-primary)" }}>
            <Icon name="add" size={18} /> Add appointment
          </button>
        }
      />

      {/* LC-12 — the in-app "Coming up" strip. It renders when the parent opens
          Arbor; it is not a scheduled alert, and the honesty line says so. */}
      {reminders.length > 0 && (
        <div data-testid="appt-reminder-strip" className={`${cardCls} p-4 space-y-1.5`} style={{ background: "var(--arbor-sky-soft)" }}>
          <p className="text-[12px] font-extrabold inline-flex items-center gap-1.5" style={{ color: "var(--arbor-sky-ink)" }}>
            <Icon name="schedule" size={16} /> {t("elev.learnCare.appt.reminder.title")}
          </p>
          {reminders.map((a) => (
            <p key={a.id} className="text-[13px] font-bold" dir="auto" style={{ color: "var(--arbor-ink)" }}>
              {t("elev.learnCare.appt.reminder.line", { who: a.who, date: whenLabel(a) })}
            </p>
          ))}
          <p className="text-[11px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
            {t("elev.learnCare.appt.reminder.honesty")}
          </p>
        </div>
      )}

      {adding && (
        <div className={`${cardCls} p-5`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>New appointment</h3>
            <button onClick={() => setAdding(false)} aria-label={t("aria.cancel")}><Icon name="close" size={17} style={{ color: "var(--arbor-muted)" }} /></button>
          </div>
          <div className="grid sm:grid-cols-3 gap-2">
            <input value={form.who} onChange={(e) => setForm({ ...form, who: e.target.value })} placeholder="Professional name" className="rounded-xl px-3 py-2.5 text-sm min-h-[44px]" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }} />
            <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Role (e.g. Speech Therapist)" className="rounded-xl px-3 py-2.5 text-sm min-h-[44px]" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }} />
            {/* LC-12: a real date, not prose — this is what makes ordering,
                reminders and the calendar file possible at all. */}
            <label className="flex flex-col gap-1 text-[11px] font-bold" style={{ color: "var(--arbor-muted)" }}>
              {t("elev.learnCare.appt.when.label")}
              <input
                type="datetime-local"
                data-testid="appt-when-input"
                value={form.when}
                onChange={(e) => setForm({ ...form, when: e.target.value })}
                className="rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
                style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
              />
            </label>
          </div>
          <button onClick={addAppt} className="mt-3 inline-flex items-center gap-2 text-white font-bold text-sm rounded-xl px-4 py-2.5 min-h-[44px]" style={{ background: "var(--arbor-clay)" }}>Save</button>
        </div>
      )}

      <SectionCard title={t("elev.learnCare.appt.section.upcoming")} icon={<Icon name="calendar_month" size={20} />} tone="sky">
        {upcoming.length ? (
          <div className="space-y-3">{upcoming.map(row)}</div>
        ) : (
          <p className="text-sm" style={{ color: "var(--arbor-muted)" }}>No appointments scheduled.</p>
        )}
      </SectionCard>

      {past.length > 0 && (
        <SectionCard title={t("elev.learnCare.appt.section.past")} icon={<Icon name="history" size={20} />} tone="lav">
          <div className="space-y-3">{past.map(row)}</div>
        </SectionCard>
      )}

      <SectionCard title="Prepare your questions" icon={<Icon name="help" size={20} />} tone="mint">
        <ul className="space-y-2 mb-3">
          {questions.length === 0 && <li className="text-sm" style={{ color: "var(--arbor-muted)" }}>Add a question you want to ask at the next session.</li>}
          {questions.map((qq) => (
            <li key={qq.id} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--arbor-ink)" }}>
              <Icon name="check_circle" size={16} fill={1} className="mt-0.5" style={{ color: "var(--arbor-green-ink)" }} /> <span className="flex-1">{qq.text}</span>
              <button onClick={() => void questionsCol.remove(qq.id)} aria-label={t("aria.removeQuestion")}><Icon name="close" size={16} style={{ color: "var(--arbor-muted)" }} /></button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addQ()} placeholder="Add a question to ask…" className="flex-1 rounded-xl px-3 py-2.5 text-sm min-h-[44px]" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }} />
          <button onClick={addQ} className="inline-flex items-center gap-1 font-bold text-sm rounded-xl px-4 min-h-[44px]" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-green-ink)" }}><Icon name="add" size={18} /> Add</button>
        </div>
        {/* LC-12 + LC-20: the prepared questions ride into the consult summary. */}
        <p className="text-[11.5px] mt-2.5 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
          {t("elev.learnCare.appt.questions.toPacket")}
        </p>
        {/* LC-09: "prepare a summary" is ONE door — the Consult flow. This used
            to route to `reports`, the deep link, contradicting Reports.tsx's own
            comment that Consult is the primary surface. */}
        <button onClick={() => setActiveTab("consult")} className="mt-3 inline-flex items-center gap-2 text-sm font-bold rounded-xl px-4 py-2.5 min-h-[44px]" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
          <Icon name="description" size={18} /> Share an Arbor summary
        </button>
      </SectionCard>
    </motion.div>
  );
}

const STATUS_TONE: Record<AppointmentStatus, "yellow" | "sky" | "mint"> = {
  requested: "yellow",
  confirmed: "sky",
  done: "mint",
};

function ApptRow({
  appt,
  whenLabel,
  followUps,
  followUpDue,
  onRemove,
  onCalendar,
  onFollowUp,
  t,
}: {
  appt: Appointment;
  whenLabel: string;
  followUps: AppointmentFollowUp[];
  followUpDue: boolean;
  onRemove: () => void;
  onCalendar: () => void;
  onFollowUp: (note: string) => boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const [note, setNote] = useState("");
  const status = appointmentStatus(appt);
  const dated = appointmentStartMs(appt) != null;

  return (
    <div className={`${cardCls} p-4 space-y-3`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold" dir="auto" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{appt.who}</h3>
          <p className="text-xs" dir="auto" style={{ color: "var(--arbor-muted)" }}>{appt.role} · {appt.mode}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* The chip describes the BOOKING, never the child. */}
          <Chip tone={STATUS_TONE[status]}>{t(`elev.learnCare.appt.status.${status}`)}</Chip>
          <Chip tone="sky">{whenLabel}</Chip>
          {dated && (
            <button
              onClick={onCalendar}
              className="inline-flex items-center gap-1.5 text-[12px] font-bold rounded-xl px-3 min-h-[44px]"
              style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-green-ink)" }}
            >
              <Icon name="event" size={16} /> {t("elev.learnCare.appt.ics")}
            </button>
          )}
          <button onClick={onRemove} aria-label={t("aria.removeAppointment")} className="inline-flex items-center justify-center min-w-[44px] min-h-[44px]">
            <Icon name="delete" size={16} style={{ color: "var(--arbor-muted)" }} />
          </button>
        </div>
      </div>

      {followUps.length > 0 && (
        <ul className="space-y-1.5 ps-1">
          {followUps.map((f) => (
            <li key={f.id} className="text-[13px] leading-relaxed flex items-start gap-2" dir="auto" style={{ color: "var(--arbor-ink)" }}>
              <Icon name="chat_bubble" size={14} className="mt-1" style={{ color: "var(--arbor-lav-ink)" }} />
              <span className="flex-1">{f.note}</span>
            </li>
          ))}
        </ul>
      )}

      {/* LC-12 — the visit has happened; capture what was said, in the parent's
          own words. Written to the registered `apptFollowUps` sink. */}
      {followUpDue && (
        <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--arbor-paper-deep)" }}>
          <p className="text-[12.5px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("elev.learnCare.appt.followUp.title")}</p>
          <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("elev.learnCare.appt.followUp.hint")}</p>
          <textarea
            value={note}
            data-testid="appt-followup-input"
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={t("elev.learnCare.appt.followUp.placeholder")}
            className="w-full rounded-xl px-3 py-2.5 text-sm resize-y min-h-[56px]"
            dir="auto"
            style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
          />
          <button
            onClick={() => { if (onFollowUp(note)) setNote(""); }}
            disabled={!note.trim()}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-bold rounded-xl px-4 min-h-[44px] disabled:opacity-40"
            style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
          >
            <Icon name="save" size={16} /> {t("elev.learnCare.appt.followUp.save")}
          </button>
        </div>
      )}
    </div>
  );
}
