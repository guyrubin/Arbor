import { ageLabel } from "../../lib/childAge";
import React from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { PageHeader, SectionCard, cardCls, PASTEL, PastelKey } from "../ui/kit";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { buildReport, openPrintableReport, isProfessionalReportType, ReportDoc, ReportType, type ParentReportType } from "../../lib/reportExport";
import type { ExportAudience, PresetPrintSection } from "../../consult/packet";
import { useHeroAvatar } from "../ui/HeroAvatar";
import { useChildCollection } from "../../hooks/useChildCollection";
import type { LangObservation } from "../../growth/vocabAgg";

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
  return (type: ParentReportType) => {
    const heroImageUrl = isGenerated && heroUrl ? heroUrl : undefined;
    const doc = buildReport(type, {
      child: childProfile,
      logs: behaviorLogs,
      plans: actionPlans,
      checkedMilestones,
      totalMilestones,
      heroImageUrl,
      langObs: langObsCol.items,
    }, uiLang);
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
  const { childProfile, setActiveTab, requestConsultPrefill } = useArbor();
  const { t } = useLanguage();
  const exportReport = useReportExport();
  // B-CAREPRO-28: the door names no audience — the parent picks the
  // profession in Consult's first step (their last choice is remembered).
  const openConsult = () => {
    requestConsultPrefill({});
    setActiveTab("consult");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-[1180px]">
      <PageHeader eyebrow={t("elev.reports.eyebrow")} title={t("sec.reports.title")} subtitle={t("sec.reports.sub", { name: childProfile.name.split(" ")[0] })} />

      {/* Item 11 (IA-02): the surface contract reaches the DOM. `data-module`
          marks a top-level sibling module (what moduleBudget counts);
          `data-primary-move` marks the ONE control that performs the move
          surfaceContract.ts declares for this route. */}
      <div data-module="reports-catalogue" data-primary-move="export-report" style={{ display: "contents" }}>
      <SectionCard title={t("elev.reports.section")} icon={<Icon name="assessment" size={20} />} tone="mint">
        <div className="grid sm:grid-cols-2 gap-3">
          {PARENT_RECORD_REPORTS.map((r) => (
            <div key={r.type} className={`${cardCls} p-4 flex items-start gap-3`}>
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0" style={{ background: PASTEL[r.tone].soft, color: PASTEL[r.tone].ink }}><Icon name="description" size={18} /></span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t(r.titleKey)}</h3>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t(r.descKey)}</p>
              </div>
              <button
                onClick={() => exportReport(r.type)}
                className="flex-shrink-0 inline-flex items-center justify-center gap-1 text-xs font-bold rounded-lg px-3 min-h-11 min-w-11 transition hover:brightness-95"
                style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-green-ink)" }}
                aria-label={t("elev.reports.exportAria", { title: t(r.titleKey) })}
              >
                <Icon name="download" size={14} /> PDF
              </button>
            </div>
          ))}
        </div>
        {/* B-CAREPRO-23: ONE door for a professional summary — Consult, where
            the parent redacts, adds the reason and ticks the reviewed gate. */}
        <button
          type="button"
          onClick={openConsult}
          data-testid="reports-consult-door"
          className={`${cardCls} w-full mt-3 p-4 flex items-center gap-3 min-h-11 text-start transition hover:brightness-95`}
        >
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0" style={{ background: PASTEL.lav.soft, color: PASTEL.lav.ink }}><Icon name="forum" size={18} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("elev.reports.proDoor.title")}</span>
            <span className="block text-xs mt-0.5 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("elev.reports.proDoor.desc")}</span>
          </span>
          <Icon name="arrow_forward" size={16} className="rtl:-scale-x-100 flex-shrink-0" style={{ color: "var(--arbor-green-ink)" }} />
        </button>
      </SectionCard>
      </div>

      <p className="text-xs text-center" style={{ color: "var(--arbor-muted)" }}>{t("elev.reports.printHint")}</p>
    </motion.div>
  );
}
