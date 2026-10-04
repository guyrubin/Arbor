import { ageLabel } from "../../lib/childAge";
import React from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { PageHeader, SectionCard, PASTEL, PastelKey } from "../ui/kit";
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
  // W2-CAREPRO r1: Weekly Insight leads; the other records are quiet rows.
  const lead = PARENT_RECORD_REPORTS[0];
  // B-CAREPRO-28: the door names no audience — the parent picks the
  // profession in Consult's first step (their last choice is remembered).
  const openConsult = () => {
    requestConsultPrefill({});
    setActiveTab("consult");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-[1180px]">
      <PageHeader eyebrow={t("elev.reports.eyebrow")} title={t("sec.reports.title")} subtitle={t("sec.reports.sub", { name: childProfile.name.split(" ")[0] })} />

      {/* Item 11 (IA-02): `data-module` marks the top-level sibling module
          (what moduleBudget counts). W2-CAREPRO r1: `data-primary-move` sits
          on the ONE control that performs the move — the lead record's Save
          button — never on a display:contents wrapper around the catalogue. */}
      <div data-module="reports-catalogue">
      <SectionCard title={t("elev.reports.section")} icon={<Icon name="assessment" size={20} />} tone="mint">
        {/* The lead record: Weekly Insight, with the page's one gradient. */}
        <div className="flex flex-col gap-3 pb-4" style={{ borderBlockEnd: "1px solid var(--arbor-rule)" }}>
          <div className="min-w-0">
            <h3 className="t-md font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t(lead.titleKey)}</h3>
            <p className="t-sm mt-0.5 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t(lead.descKey)}</p>
          </div>
          <button
            type="button"
            data-primary-move="export-report"
            onClick={() => exportReport(lead.type)}
            className="touch-target self-start inline-flex items-center justify-center gap-2 t-sm font-extrabold rounded-xl px-5 min-h-11 transition hover:brightness-105"
            style={{ background: "var(--gradient-cta)", color: "var(--arbor-on-accent)" }}
            aria-label={t("elev.reports.exportAria", { title: t(lead.titleKey) })}
          >
            <Icon name="download" size={16} /> {t("elev.reports.lead.cta")}
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
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0" style={{ background: PASTEL.lav.soft, color: PASTEL.lav.ink }}><Icon name="forum" size={18} /></span>
          <span className="min-w-0 flex-1">
            <span className="block t-sm font-bold" style={{ color: "var(--arbor-ink)" }}>{t("elev.reports.proDoor.title")}</span>
            <span className="block t-xs mt-0.5 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("elev.reports.proDoor.desc")}</span>
          </span>
          <Icon name="arrow_forward" size={16} className="rtl:-scale-x-100 flex-shrink-0" style={{ color: "var(--arbor-muted)" }} />
        </button>
        {/* The other parent-record documents: one layer of chrome — hairline
            rows inside the one SectionCard, never cards inside a card. */}
        <ul>
          {PARENT_RECORD_REPORTS.filter((r) => r.type !== lead.type).map((r) => (
            <li key={r.type} className="py-3 flex items-center gap-3" style={{ borderBlockEnd: "1px solid var(--arbor-rule)" }}>
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}><Icon name="description" size={18} /></span>
              <div className="min-w-0 flex-1">
                <h3 className="t-sm font-bold" style={{ color: "var(--arbor-ink)" }}>{t(r.titleKey)}</h3>
                <p className="t-xs mt-0.5 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t(r.descKey)}</p>
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
        </ul>
      </SectionCard>
      </div>

      <p className="text-xs text-center" style={{ color: "var(--arbor-muted)" }}>{t("elev.reports.printHint")}</p>
    </motion.div>
  );
}
