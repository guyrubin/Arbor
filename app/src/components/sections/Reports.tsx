import { ageLabel } from "../../lib/childAge";
import React from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { PageHeader, SectionCard, cardCls, PASTEL, PastelKey } from "../ui/kit";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useToast } from "../../context/ToastContext";
import { buildReport, openPrintableReport, isProfessionalReportType, ReportDoc, ReportType } from "../../lib/reportExport";
import { buildPacketInput, buildPresetPacket, presetPacketToPrintSections } from "../../consult/packet";
import { getLastExportedAt, recordExport } from "../../consult/exportHistory";
import { useHeroAvatar } from "../ui/HeroAvatar";
import { useChildCollection } from "../../hooks/useChildCollection";
import type { LangObservation } from "../../growth/vocabAgg";
import type { GrowthEntry } from "../../growth/growthEntries";

/** The 8 clinical PDF report types. Exported so the single Consult export menu
 *  (b3) consumes the same list — there is exactly one report definition source. */
export const REPORTS: { title: string; desc: string; tone: PastelKey; type: ReportType }[] = [
  { title: "Weekly Insight", desc: "This week's summary for your records or to share.", tone: "mint", type: "weekly" },
  { title: "Teacher Handoff", desc: "Classroom-ready context, what helps and what escalates.", tone: "sky", type: "teacher" },
  { title: "Therapist Summary", desc: "Concern, timeline, patterns and tried interventions.", tone: "lav", type: "therapist" },
  { title: "Pediatrician Summary", desc: "Duration, frequency, milestones — no-diagnosis framing.", tone: "coral", type: "pediatrician" },
  { title: "SLP Summary", desc: "Speech-language context: communication patterns and what's been tried.", tone: "lav", type: "slp" },
  { title: "Behavioral Health Summary", desc: "Behavior patterns, supports and context — no-diagnosis framing.", tone: "sky", type: "behavioral_health" },
  { title: "Development Snapshot", desc: "A point-in-time picture of your child's development.", tone: "yellow", type: "snapshot" },
  { title: "Behavior Pattern Report", desc: "Triggers, intensity and recovery over time.", tone: "pink", type: "behavior" },
  { title: "Language Transition Note", desc: "Home/school languages, comfort and useful phrases.", tone: "sky", type: "language" },
  { title: "Growth Plan Progress", desc: "Plan steps completed and what's next.", tone: "mint", type: "growth" },
];

/** Single clinical-PDF export seam: build a report doc from real child state and
 *  open it as a printable tab. b3's Consult menu and this page share this hook —
 *  no second export engine is introduced.
 *
 *  IA W4.2: professional audiences (teacher/therapist/pediatrician) build ONLY
 *  through the consult preset serializer — audience data ceilings + the
 *  fail-closed clinical scan run on every build AND at the print egress. Parent
 *  redaction choices (excludedIds, from the Consult include-toggles) survive
 *  into the PDF. Parent-record types stay on `buildReport`. */
export function useReportExport() {
  const {
    childProfile, behaviorLogs, milestones, actionPlans, approvedMemoryItems,
    checkedMilestones, totalMilestones, setActiveTab,
  } = useArbor();
  // The child's hero anchors the printed handoff to *this* child. Privacy gate:
  // embed ONLY the stylized descriptor hero (isGenerated) — never a real photo —
  // into a document the parent may forward to a clinician.
  const { url: heroUrl, isGenerated } = useHeroAvatar();
  // LC-19: the parent's logged phrases feed the Language Transition Note —
  // the same registered `langObs` sink Language Lab writes (export/erase-swept).
  const langObsCol = useChildCollection<LangObservation>(childProfile.id, "langObs", {
    orderByField: "timestamp",
    orderDir: "desc",
    max: 500,
  });
  // LC-20: the pediatrician preset's own evidence — the measurements the parent
  // logged, as entered. Same registered sink the growth card writes.
  const growthCol = useChildCollection<GrowthEntry>(childProfile.id, "growthEntries", {
    orderByField: "date",
    orderDir: "desc",
    max: 200,
  });
  /** LC-20/LC-12: `extras` carries the parent's own voice — the reason for the
   *  visit and the questions they prepared in Appointments — from whichever
   *  surface triggered the export. Absent → the packet is unchanged. */
  return (
    type: ReportType,
    excludedIds?: Set<string>,
    extras?: { reason?: string; questions?: string[] }
  ) => {
    const heroImageUrl = isGenerated && heroUrl ? heroUrl : undefined;
    // LC-11b — ONE teacher door, closed at the SEAM. This hook is the only
    // path to a preset PDF, so the redirect lives here rather than in each
    // caller: the Reports card and the Consult menu both reach it, and any
    // future caller inherits it. The School Brief is the one teacher document
    // (per-export parent approval, CURATED_FIELDS allowlist, the escalation
    // note held back, fail-closed scan) — none of which this path has.
    if (type === "teacher") {
      setActiveTab("school-brief");
      return;
    }
    if (isProfessionalReportType(type)) {
      const packet = buildPresetPacket(type, {
        // LC-17b: the SHARED input assembler — the one mapping the consult
        // surface and both share sides use. Hand-rolling it here is what
        // dropped every log `trigger`, leaving the behavioural-health preset
        // with no triggers section and making it byte-identical to the
        // therapist summary for every real user.
        ...buildPacketInput(
          { profile: childProfile, logs: behaviorLogs, milestones, plans: actionPlans, memory: approvedMemoryItems },
          Date.now()
        ),
        // CARE-7: the delta section renders only when THIS audience has a
        // prior export on record.
        lastExportedAt: getLastExportedAt(childProfile.id, type) ?? undefined,
        // LC-20: the four "professional" reports were byte-identical documents.
        // Each clinician preset now carries the ONE evidence section its own
        // discipline reads — SLP the phrases, pediatrician the measurements —
        // and every packet opens with the parent's reason for coming.
        reason: extras?.reason,
        questions: extras?.questions,
        langObs: langObsCol.items
          .map((o) => ({ phrase: o.phrase ?? "", language: o.language, at: o.timestamp }))
          .filter((o) => o.phrase.trim().length > 0),
        growthEntries: growthCol.items.map((g) => ({ date: g.date, heightCm: g.heightCm, weightKg: g.weightKg })),
      });
      const doc: ReportDoc = {
        title: REPORTS.find((r) => r.type === type)!.title,
        subtitle: `${childProfile.name}, ${ageLabel(childProfile)}`,
        sections: presetPacketToPrintSections(type, packet, excludedIds),
        heroImageUrl,
      };
      openPrintableReport(doc, childProfile.name);
      // Only a build that survived the fail-closed guards reaches this line —
      // a blocked packet throws above and records nothing.
      recordExport(childProfile.id, type);
      return;
    }
    const doc = buildReport(type, {
      child: childProfile,
      logs: behaviorLogs,
      plans: actionPlans,
      checkedMilestones,
      totalMilestones,
      heroImageUrl,
      langObs: langObsCol.items,
    });
    openPrintableReport(doc, childProfile.name);
  };
}

/** Care Network › Reports — exportable artifacts generated from real child data.
 *  Still routable for deep links; the primary surface is the Consult flow (b3). */
export default function Reports() {
  const { childProfile, setActiveTab } = useArbor();
  const { t } = useLanguage();
  const { toast } = useToast();
  const exportReport = useReportExport();
  // LC-11b — the second teacher door. This card used to call exportReport
  // ("teacher") straight into the preset PDF: no per-export approval, no
  // CURATED_FIELDS allowlist, no escalation-note assertion, no parent review
  // of AI-edited fields — everything the School Brief exists to enforce. The
  // route is live (#/reports), so "one teacher document, one door" was false
  // and the open door was the UNGATED one. It now opens the School Brief, the
  // same redirect the Consult menu makes (and the export seam itself now
  // refuses the type, so neither door can be reopened by accident).
  const openTeacherDoor = () => {
    toast(t("elev.learnCare.brief.oneDoor.hint"), "info");
    setActiveTab("school-brief");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-[1180px]">
      <PageHeader eyebrow="Care Network" title={t("sec.reports.title")} subtitle={t("sec.reports.sub", { name: childProfile.name.split(" ")[0] })} />

      <SectionCard title="Exportable reports" icon={<Icon name="assessment" size={20} />} tone="mint">
        <div className="grid sm:grid-cols-2 gap-3">
          {REPORTS.map((r) => (
            <div key={r.title} className={`${cardCls} p-4 flex items-start gap-3`}>
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0" style={{ background: PASTEL[r.tone].soft, color: PASTEL[r.tone].ink }}><Icon name="description" size={18} /></span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{r.title}</h3>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{r.desc}</p>
              </div>
              {r.type === "teacher" ? (
                <button
                  onClick={openTeacherDoor}
                  data-testid="reports-teacher-one-door"
                  className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-bold rounded-lg px-2.5 py-1.5 transition hover:brightness-95"
                  style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-green-ink)" }}
                  aria-label={t("elev.learnCare.brief.oneDoor")}
                >
                  {t("elev.learnCare.brief.oneDoor")} <Icon name="arrow_forward" size={14} className="rtl:-scale-x-100" />
                </button>
              ) : (
                <button
                  onClick={() => exportReport(r.type)}
                  className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-bold rounded-lg px-2.5 py-1.5 transition hover:brightness-95"
                  style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-green-ink)" }}
                  aria-label={`Export ${r.title} as PDF`}
                >
                  <Icon name="download" size={14} /> PDF
                </button>
              )}
            </div>
          ))}
        </div>
      </SectionCard>
      <p className="text-xs text-center" style={{ color: "var(--arbor-muted)" }}>Reports open in a new tab — use your browser's “Save as PDF”. Every report carries Arbor's non-diagnostic framing.</p>
    </motion.div>
  );
}
