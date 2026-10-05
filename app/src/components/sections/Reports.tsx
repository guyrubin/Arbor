import { ageLabel } from "../../lib/childAge";
import React from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { PageHeader, PastelKey } from "../ui/kit";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { buildFullRecord, buildReport, openPrintableReport, isProfessionalReportType, ReportDoc, ReportType, type ParentReportType } from "../../lib/reportExport";
import type { ExportAudience, PresetPrintSection } from "../../consult/packet";
import { useHeroAvatar } from "../ui/HeroAvatar";
import { useChildCollection } from "../../hooks/useChildCollection";
import type { LangObservation } from "../../growth/vocabAgg";
import type { BehaviorLog } from "../../types";
import { getLastExportedAt, recordExport } from "../../consult/exportHistory";
import { fmtDay } from "../../lib/formatDate";
import { requestOpenSettings } from "../layout/settingsBus";
import { parentWords, recordStartIso, reportsLeadCounts } from "../../lib/recordCounts";
export { reportsLeadCounts };

/** W2-CAREPRO r2 / B-CAREPRO-NEW-2e — the device-local export-history slot the
 *  lead "Save this week's record" writes (same store Consult's "since" reads). */
export const REPORTS_WEEKLY_EXPORT_KEY = "reports-weekly";
const WEEK_MS = 7 * 86_400_000;

/** B-CAREPRO-NEW-2f / W2-CAREPRO c2 r1 — the parent's own words, quoted:
 *  the newest kept moment (this week's when there is one, else the newest in
 *  the whole record, with its date), else null. Reads the words where capture
 *  stores them (lib/recordCounts.parentWords: notes, else a Moment's trigger)
 *  — the capture sheet never writes `notes`, so a notes-only filter never filled. */
export function keptThisWeek(logs: readonly { timestamp: string; notes?: string; trigger?: string; behaviorType?: string }[], nowMs: number): { quote: string; at: string; thisWeek: boolean } | null {
  const newest = logs
    .filter((l) => parentWords(l) && new Date(l.timestamp).getTime() <= nowMs)
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))[0];
  if (!newest) return null;
  return { quote: parentWords(newest), at: newest.timestamp, thisWeek: nowMs - new Date(newest.timestamp).getTime() <= WEEK_MS };
}

export { recordStartIso };

/** The 10 report definitions (5 parent-record documents, 5 professional
 *  presets) — the one source of their titles. #/reports renders the parent
 *  records; Consult titles its PDF from the preset rows (B-CAREPRO-28). */
export const REPORTS: { title: string; desc: string; titleKey: string; descKey: string; tone: PastelKey; type: ReportType }[] = [
  { title: "Weekly Insight", desc: "This week's summary for your records or to share.", titleKey: "elev.reports.weekly.title", descKey: "elev.reports.weekly.desc", tone: "mint", type: "weekly" },
  { title: "Teacher Handoff", desc: "Classroom-ready context, what helps and what escalates.", titleKey: "elev.reports.teacher.title", descKey: "elev.reports.teacher.desc", tone: "sky", type: "teacher" },
  { title: "Therapist Summary", desc: "Concern, timeline, patterns and tried interventions.", titleKey: "elev.reports.therapist.title", descKey: "elev.reports.therapist.desc", tone: "lav", type: "therapist" },
  { title: "Pediatrician Summary", desc: "Duration, frequency, milestones — no-diagnosis framing.", titleKey: "elev.reports.pediatrician.title", descKey: "elev.reports.pediatrician.desc", tone: "coral", type: "pediatrician" },
  { title: "SLP Summary", desc: "Speech-language context: communication patterns and what's been tried.", titleKey: "elev.reports.slp.title", descKey: "elev.reports.slp.desc", tone: "lav", type: "slp" },
  { title: "Behavioral Health Summary", desc: "Behavior patterns, supports and context — no-diagnosis framing.", titleKey: "elev.reports.behavioral_health.title", descKey: "elev.reports.behavioral_health.desc", tone: "sky", type: "behavioral_health" },
  { title: "Development Snapshot", desc: "A point-in-time picture of your child's development.", titleKey: "elev.reports.snapshot.title", descKey: "elev.reports.snapshot.desc", tone: "yellow", type: "snapshot" },
  { title: "Behavior Pattern Report", desc: "Triggers, intensity and recovery over time.", titleKey: "elev.reports.behavior.title", descKey: "elev.reports.behavior.desc", tone: "pink", type: "behavior" },
  { title: "Language Transition Note", desc: "Home/school languages, comfort and useful phrases.", titleKey: "elev.reports.language.title", descKey: "elev.reports.language.desc", tone: "sky", type: "language" },
  { title: "Growth Plan Progress", desc: "Plan steps completed and what's next.", titleKey: "elev.reports.growth.title", descKey: "elev.reports.growth.desc", tone: "mint", type: "growth" },
];

/** B-CAREPRO-23: #/reports is "Your full record" — ONLY the parent-record
 *  documents (weekly, snapshot, behaviour pattern, language note, growth plan).
 *  No professional preset is exportable from this page: those documents need
 *  the Consult review gate (redaction, reason, questions, reviewed checkbox),
 *  so the page carries one door to Consult instead.
 *
 *  B-CAREPRO-28: the Consult PDF menu (its professional subset of REPORTS) is
 *  gone — Consult prints ONE PDF for the chosen audience through
 *  `useConsultPdf`, from the same capped sections its Copy text is built from. */
export const PARENT_RECORD_REPORTS = REPORTS.filter(
  (r): r is (typeof REPORTS)[number] & { type: ParentReportType } => !isProfessionalReportType(r.type)
);

/** The parent-record PDF seam (#/reports): build a report doc from real child
 *  state and open it as a printable tab. Professional summaries never come
 *  through here (B-CAREPRO-28): they are printed by Consult, behind its gate. */
export function useReportExport() {
  const {
    childProfile, behaviorLogs, actionPlans,
    checkedMilestones, totalMilestones,
  } = useArbor();
  // LC-13 / item 8: the PDF carries the family's language.
  const { uiLang } = useLanguage();
  // The child's hero anchors the printed record to *this* child. Privacy gate:
  // embed ONLY the stylized descriptor hero (isGenerated) — never a real photo.
  const { url: heroUrl, isGenerated } = useHeroAvatar();
  // LC-19: the parent's logged phrases feed the Language Transition Note —
  // the same registered `langObs` sink Language Lab writes (export/erase-swept).
  const langObsCol = useChildCollection<LangObservation>(childProfile.id, "langObs", {
    orderByField: "timestamp",
    orderDir: "desc",
    max: 500,
  });
  // W2-CAREPRO c2 r1: "record" builds the ONE combined parent-record document.
  return (type: ParentReportType | "record") => {
    const heroImageUrl = isGenerated && heroUrl ? heroUrl : undefined;
    const ctx = {
      child: childProfile,
      logs: behaviorLogs,
      plans: actionPlans,
      checkedMilestones,
      totalMilestones,
      heroImageUrl,
      langObs: langObsCol.items,
    };
    const doc = type === "record" ? buildFullRecord(ctx, uiLang) : buildReport(type, ctx, uiLang);
    openPrintableReport(doc, childProfile.name, uiLang);
  };
}

/** B-CAREPRO-28 — Consult's ONE PDF per audience. The caller hands the
 *  sections it built with `exportPrintSections` (the same audience, redaction
 *  and note as its Copy text); this opens them in the shared print shell with
 *  the audience's own title and the stylized hero (never a real photo). */
export function useConsultPdf() {
  const { childProfile } = useArbor();
  const { t, uiLang } = useLanguage();
  const { url: heroUrl, isGenerated } = useHeroAvatar();
  return (audience: ExportAudience, sections: PresetPrintSection[]) => {
    const report = REPORTS.find((r) => r.type === audience);
    const doc: ReportDoc = {
      title: report ? t(report.titleKey) : t("elev.carehonesty.consult.pdf.selfTitle"),
      subtitle: `${childProfile.name}, ${ageLabel(childProfile)}`,
      sections,
      heroImageUrl: isGenerated && heroUrl ? heroUrl : undefined,
    };
    openPrintableReport(doc, childProfile.name, uiLang);
  };
}

/** Care Network › Reports — "Your full record": the parent's own documents,
 *  generated from real child data. Still routable for deep links (deep-export
 *  must-hold); professional summaries are prepared in the Consult flow (b3).
 *
 *  B-CAREPRO-23: the five professional cards (therapist, pediatrician, SLP,
 *  behavioural health — and the Teacher card, a redirect to a redirect) are
 *  gone from this page. They exported with no redaction, reason, questions or
 *  reviewed gate; the same documents are built in Consult behind that gate,
 *  so the page has ONE door there (through the B-CAREPRO-13 prefill seam). */
export default function Reports() {
  const { childProfile, setActiveTab, requestConsultPrefill, behaviorLogs, milestones } = useArbor();
  const { t, uiLang } = useLanguage();
  const exportReport = useReportExport();
  const first = (childProfile.name || "").split(" ")[0];
  // B-CAREPRO-NEW-2e: the record leads — counts since the last save on this
  // device (else this week), from the same ctx buildReport reads.
  const [lastSaved, setLastSaved] = React.useState<string | null>(() => getLastExportedAt(childProfile.id, REPORTS_WEEKLY_EXPORT_KEY));
  const nowMs = Date.now();
  const counts = reportsLeadCounts({ logs: behaviorLogs ?? [], milestones: milestones ?? [], sinceIso: lastSaved, nowMs });
  const countText = (n: number, one: string, other: string) => t(n === 1 ? one : other, { n });
  const kept = keptThisWeek(behaviorLogs ?? [], nowMs);
  // W2-CAREPRO c2 r1: before the first save the lead names the record, not
  // its absence — counts over the whole record since it began.
  const startIso = recordStartIso(behaviorLogs ?? [], milestones ?? []);
  const recordMoments = (behaviorLogs ?? []).length;
  const recordNoticed = (milestones ?? []).filter((m) => m.checked).length;
  const saveLead = () => {
    exportReport("record");
    const when = new Date().toISOString();
    recordExport(childProfile.id, REPORTS_WEEKLY_EXPORT_KEY, when);
    setLastSaved(when);
  };
  // One count clause per parent-record row, from the same record (law 1: counts only).
  const allMoments = (behaviorLogs ?? []).length;
  const noticed = (milestones ?? []).filter((m) => m.checked).length;
  const rowCount: Partial<Record<ParentReportType, string>> = {
    snapshot: t(noticed === 1 ? "elev.reports.line.milestonesNoticed.one" : "elev.reports.line.milestonesNoticed", { n: noticed }),
    behavior: t(allMoments === 1 ? "elev.reports.line.momentsLogged.one" : "elev.reports.line.momentsLogged.other", { n: allMoments }),
  };
  // W2-CAREPRO c2 r1: the lead is the ONE "{name}'s record" document (the
  // page's H1 and contract job); every single document is a quiet row.
  // B-CAREPRO-28: the door names no audience — the parent picks the
  // profession in Consult's first step (their last choice is remembered).
  const openConsult = () => {
    requestConsultPrefill({});
    setActiveTab("consult");
  };

  return (
    // W2-CAREPRO r2: a ~720 px reading measure at every width (it was a
    // stretched 935 px phone column at 1280 with ~800 px of eye travel per row).
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-[720px]">
      <PageHeader eyebrow={t("elev.reports.eyebrow")} title={t("sec.reports.title")} subtitle={t("sec.reports.sub", { name: childProfile.name.split(" ")[0] })} />

      {/* Item 11 (IA-02): `data-module` marks the top-level sibling module
          (what moduleBudget counts). W2-CAREPRO r1: `data-primary-move` sits
          on the ONE control that performs the move — the lead record's Save
          button — never on a display:contents wrapper around the catalogue. */}
      {/* W2-CAREPRO r2: no "Exportable reports" card header — the H1 frames the
          list; one plain surface (one layer of chrome). */}
      <div data-module="reports-catalogue" className="rounded-[22px] p-5 md:p-6" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)", boxShadow: "var(--shadow-sm)" }}>
        {/* The lead record: Weekly Insight, with the page's one gradient. */}
        <div className="flex flex-col gap-3 pb-4" style={{ borderBlockEnd: "1px solid var(--arbor-rule)" }}>
          <div className="min-w-0">
            <h2 data-testid="reports-lead-title" className="t-md font-extrabold" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-sans)" }}>{t("elev.reports.record.title", { name: first })}</h2>
            {/* B-CAREPRO-NEW-2e: one counts-only line from the record.
                W2-CAREPRO c2 r2: the lead is PERMANENT — always the whole
                record since it began (the H2 above names the child), never
                replaced after a save. A second fact appears ONLY when new
                moments exist since the parent last opened the PDF; it never
                prints a zero. "Opened", not "saved": the print tab can be
                cancelled and nothing listens for afterprint across windows. */}
            {startIso ? (
              <p data-testid="reports-lead-counts" className="t-sm mt-0.5 leading-relaxed" style={{ color: "var(--arbor-ink)" }}>
                {t("elev.reports.lead.first", {
                  date: fmtDay(startIso, uiLang),
                  moments: countText(recordMoments, "elev.reports.line.moments.one", "elev.reports.line.moments.other"),
                  milestones: countText(recordNoticed, "elev.reports.lead.milestones.one", "elev.reports.lead.milestones.other"),
                })}
              </p>
            ) : null}
            {lastSaved && counts.moments > 0 ? (
              <p data-testid="reports-lead-new" className="t-xs mt-0.5 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
                {t(counts.moments === 1 ? "elev.reports.lead.new.one" : "elev.reports.lead.new.other", { n: counts.moments, date: fmtDay(lastSaved, uiLang) })}
              </p>
            ) : null}
          </div>
          {/* B-CAREPRO-NEW-2f: the parent's own words, quoted — this week's
              newest, else the newest in the record. W2-CAREPRO c2 r2: a FLAT
              --arbor-peach-wash (the CTA is the page's only gradient); the
              blockquote keeps the UI direction and only the quote is isolated
              (<bdi>), so a Latin quote never flips a Hebrew card; the date
              lives in the caption as a no-wrap <bdi>. */}
          {kept ? (
            <figure data-testid="reports-kept" className="p-3" style={{ background: "var(--arbor-peach-wash)", borderRadius: "var(--r)" }}>
              <figcaption className="t-xs" style={{ color: "var(--arbor-muted)" }}>
                {t("elev.reports.kept.label")} · <bdi data-testid="reports-kept-date" className="whitespace-nowrap">{fmtDay(kept.at, uiLang)}</bdi>
              </figcaption>
              <blockquote className="t-base mt-0.5" style={{ color: "var(--arbor-peach-ink)", fontFamily: uiLang === "he" ? "var(--font-display)" : "var(--font-editorial)" }}>
                <bdi>“{kept.quote}”</bdi>
              </blockquote>
              {lastSaved && kept.at <= lastSaved ? (
                <p data-testid="reports-kept-saved" className="t-xs mt-1" style={{ color: "var(--arbor-muted)" }}>{t("elev.reports.kept.saved", { name: first })}</p>
              ) : null}
            </figure>
          ) : recordMoments === 0 ? (
            <p data-testid="reports-kept-empty" className="t-xs" style={{ color: "var(--arbor-muted)" }}>{t("elev.reports.kept.empty")}</p>
          ) : null}
          <button
            type="button"
            data-primary-move="export-report"
            onClick={saveLead}
            className="touch-target self-start inline-flex items-center justify-center gap-2 t-sm font-extrabold rounded-xl px-5 min-h-11 transition hover:brightness-105"
            style={{ background: "var(--gradient-cta)", color: "var(--arbor-on-accent)" }}
            aria-label={t("elev.reports.exportAria", { title: t("elev.reports.record.title", { name: first }) })}
          >
            <Icon name="download" size={16} /> {t("elev.reports.lead.cta", { name: first })}
          </button>
        </div>
        {/* B-CAREPRO-23: ONE door for a professional summary — Consult, where
            the parent redacts, adds the reason and ticks the reviewed gate.
            W2-CAREPRO r1: a quiet text row directly under the lead (above the
            fold at 375), outside the stamped move, no card chrome. */}
        <button
          type="button"
          onClick={openConsult}
          data-testid="reports-consult-door"
          className="w-full py-3 flex items-center gap-3 min-h-11 text-start transition hover:brightness-95"
          style={{ borderBlockEnd: "1px solid var(--arbor-rule)" }}
        >
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}><Icon name="forum" size={18} /></span>
          <span className="min-w-0 flex-1">
            <span className="block t-sm font-bold" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-sans)" }}>{t("elev.reports.proDoor.title")}</span>
            <span className="block t-xs mt-0.5 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("elev.reports.proDoor.desc")}</span>
          </span>
          <Icon name="arrow_forward" size={16} className="rtl:-scale-x-100 flex-shrink-0" style={{ color: "var(--arbor-muted)" }} />
        </button>
        {/* The other parent-record documents: one layer of chrome — hairline
            rows inside the one SectionCard, never cards inside a card. */}
        <ul>
          {PARENT_RECORD_REPORTS.map((r) => (
            <li key={r.type} className="py-3 flex items-center gap-3" style={{ borderBlockEnd: "1px solid var(--arbor-rule)" }}>
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}><Icon name="description" size={18} /></span>
              <div className="min-w-0 flex-1">
                {/* W2-CAREPRO r2: every row title in ONE family (the body face,
                    t-sm bold) — an h3 picked up the display face, and in HE
                    Frank Ruhl's small x-height read smaller than its own desc. */}
                <p data-testid="reports-row-title" className="t-sm font-bold" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-sans)" }}>{t(r.titleKey)}</p>
                <p className="t-xs mt-0.5 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t(r.descKey, { name: first })}{rowCount[r.type] ? <> · <span data-testid="reports-row-count">{rowCount[r.type]}</span></> : null}</p>
              </div>
              <button
                type="button"
                onClick={() => exportReport(r.type)}
                className="touch-target flex-shrink-0 inline-flex items-center justify-center gap-1 t-xs font-bold rounded-lg px-3 min-h-11 min-w-11 transition hover:brightness-95"
                style={{ background: "transparent", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}
                aria-label={t("elev.reports.exportAria", { title: t(r.titleKey) })}
              >
                <Icon name="download" size={14} /> PDF
              </button>
            </li>
          ))}
          {/* W2-CAREPRO r2: the complete record keeps its ONE home (Settings >
              Your data, B-CAREPRO-35); this page carries the door to it. */}
          <li>
            <button
              type="button"
              data-testid="reports-your-data"
              onClick={() => requestOpenSettings({ focus: "data" })}
              className="w-full py-3 flex items-center gap-3 min-h-11 text-start transition hover:brightness-95"
            >
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}><Icon name="folder_open" size={18} /></span>
              <span className="min-w-0 flex-1 t-sm font-bold" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-sans)" }}>{t("elev.reports.yourData", { name: first })}</span>
              <span className="t-xs font-bold flex-shrink-0" style={{ color: "var(--arbor-clay)" }}>{t("elev.reports.yourData.cta")}</span>
              <Icon name="arrow_forward" size={16} className="rtl:-scale-x-100 flex-shrink-0" style={{ color: "var(--arbor-muted)" }} />
            </button>
          </li>
        </ul>
      </div>

      <p className="text-xs text-center" style={{ color: "var(--arbor-muted)" }}>{t("elev.reports.printHint")}</p>
    </motion.div>
  );
}
