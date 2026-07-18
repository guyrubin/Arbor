import React from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { PageHeader, SectionCard, cardCls, PASTEL, PastelKey } from "../ui/kit";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { buildReport, openPrintableReport, isProfessionalReportType, ReportDoc, ReportType } from "../../lib/reportExport";
import { buildPresetPacket, presetPacketToPrintSections } from "../../consult/packet";
import { useHeroAvatar } from "../ui/HeroAvatar";

/** The 8 clinical PDF report types. Exported so the single Consult export menu
 *  (b3) consumes the same list — there is exactly one report definition source. */
export const REPORTS: { title: string; desc: string; tone: PastelKey; type: ReportType }[] = [
  { title: "Weekly Insight", desc: "This week's summary for your records or to share.", tone: "mint", type: "weekly" },
  { title: "Teacher Handoff", desc: "Classroom-ready context, what helps and what escalates.", tone: "sky", type: "teacher" },
  { title: "Therapist Summary", desc: "Concern, timeline, patterns and tried interventions.", tone: "lav", type: "therapist" },
  { title: "Pediatrician Summary", desc: "Duration, frequency, milestones — no-diagnosis framing.", tone: "coral", type: "pediatrician" },
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
    checkedMilestones, totalMilestones,
  } = useArbor();
  // The child's hero anchors the printed handoff to *this* child. Privacy gate:
  // embed ONLY the stylized descriptor hero (isGenerated) — never a real photo —
  // into a document the parent may forward to a clinician.
  const { url: heroUrl, isGenerated } = useHeroAvatar();
  return (type: ReportType, excludedIds?: Set<string>) => {
    const heroImageUrl = isGenerated && heroUrl ? heroUrl : undefined;
    if (isProfessionalReportType(type)) {
      const packet = buildPresetPacket(type, {
        profile: {
          name: childProfile.name, age: childProfile.age, languages: childProfile.languages,
          schoolContext: childProfile.schoolContext, strengths: childProfile.strengths, challenges: childProfile.challenges,
        },
        logs: behaviorLogs.map((l) => ({ behaviorType: l.behaviorType, intensity: l.intensity, timestamp: l.timestamp, resolved: l.resolved })),
        milestones: milestones.map((m) => ({ domain: m.domain, title: m.title, checked: m.checked })),
        plans: actionPlans.map((p) => ({ title: p.title, issue: p.issue })),
        memory: approvedMemoryItems.map((m) => ({ fact: m.fact, status: m.status })),
        nowMs: Date.now(),
      });
      const doc: ReportDoc = {
        title: REPORTS.find((r) => r.type === type)!.title,
        subtitle: `${childProfile.name}, age ${childProfile.age}`,
        sections: presetPacketToPrintSections(type, packet, excludedIds),
        heroImageUrl,
      };
      openPrintableReport(doc, childProfile.name);
      return;
    }
    const doc = buildReport(type, {
      child: childProfile,
      logs: behaviorLogs,
      plans: actionPlans,
      checkedMilestones,
      totalMilestones,
      heroImageUrl,
    });
    openPrintableReport(doc, childProfile.name);
  };
}

/** Care Network › Reports — exportable artifacts generated from real child data.
 *  Still routable for deep links; the primary surface is the Consult flow (b3). */
export default function Reports() {
  const { childProfile } = useArbor();
  const { t } = useLanguage();
  const exportReport = useReportExport();

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
              <button
                onClick={() => exportReport(r.type)}
                className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-bold rounded-lg px-2.5 py-1.5 transition hover:brightness-95"
                style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-green-ink)" }}
                aria-label={`Export ${r.title} as PDF`}
              >
                <Icon name="download" size={14} /> PDF
              </button>
            </div>
          ))}
        </div>
      </SectionCard>
      <p className="text-xs text-center" style={{ color: "var(--arbor-muted)" }}>Reports open in a new tab — use your browser's “Save as PDF”. Every report carries Arbor's non-diagnostic framing.</p>
    </motion.div>
  );
}
