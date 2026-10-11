import { assertClinicianExportCeiling } from "./packet";
import { DOMAIN_COUNT, distinctDomains, domainLabelEn } from "../lib/domains/registry";
import { ageLabel } from "../lib/childAge";
import { ageMonthsOf } from "../lib/age/forChild";
import { ageWindowMilestones, comparisonAgeMonths } from "../lib/milestoneData";
import { domainMilestoneCounts, type DomainBand } from "../practice/signals";
import type { PracticeData } from "../practice/usePracticeData";
import type { WatchSignal } from "../practice/watch";
import type { ChildProfile, Milestone } from "../types";
import { en as growthTruthEn } from "../lib/i18nElevation/growthTruth";

// B-GROWTH-22: the existing clinician summary moved out of the retired leaf.
// Both outputs use the same ceiling. The parent preview never carries the
// resettable streak; the explicit clinician copy retains its existing clause.
const BAND_WORD = /\b(?:emerging|developing|on[\s-]?track|strong)\b/i;
const parentSafeEvidence = (evidence: string[]): string[] => evidence.filter(e => !BAND_WORD.test(e));
const exportEvidence = (e: string): string => e.startsWith("elev.") ? growthTruthEn[e] ?? e : e;

export interface ClinicianSummaryInput {
  childProfile: ChildProfile;
  milestones: Milestone[];
  bands: DomainBand[];
  data: Pick<PracticeData, "today" | "week" | "streak" | "stats">;
  advCount: number;
  watch: WatchSignal[];
}

/** Read-only snapshot builder. No grades, persistence, providers or egress. */
export function buildClinicianSummary({ childProfile, milestones, bands, data, advCount, watch }: ClinicianSummaryInput): {
  clinicianSummary: string | null;
  previewSummary: string | null;
} {
  const comparisonMonths = comparisonAgeMonths(ageMonthsOf(childProfile), childProfile.preterm?.gestationalWeeks);
  const windowMilestones = ageWindowMilestones(milestones, comparisonMonths);
  const domainCounts = domainMilestoneCounts(windowMilestones);
  const visibleDomains = bands.filter(b => (domainCounts.get(b.domain)?.total ?? 0) > 0);
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const homePractice = `Home practice, last 7 days: ${data.week.sessions} interactions on ${plural(data.week.activeDays, "day")} across ${distinctDomains("practice", data.week.domainsTouched).length} of ${DOMAIN_COUNT} domains.`;
  const streakClause = ` Streak: ${plural(data.streak, "day")}.`;
  const build = (withStreak: boolean): string | null => {
    const lines: string[] = [
      `ARBOR PRACTICE SUMMARY — ${childProfile.name}, age ${ageLabel(childProfile)}`,
      `Generated ${data.today} · Parent-collected observational data · NOT a diagnostic assessment`,
      ``,
      `Domain picture (milestone checklist + home practice signal):`,
      // Same rule as the rendered list: a domain with no milestone in this
      // age window has no denominator to report (item 19).
      ...visibleDomains.map((b) => {
        const c = domainCounts.get(b.domain);
        const reached = c?.reached ?? 0;
        const total = c?.total ?? 0;
        return `  • ${domainLabelEn("practice", b.domain)}: ${reached} of ${total} milestones noticed by parent (home-practice signal; basis: ${b.basis.join(", ")})`;
      }),
      ``,
      withStreak ? `${homePractice}${streakClause}` : homePractice,
    ];
    if (data.stats.length > 0) {
      lines.push(``, `Articulation practice (parent/auto-scored at home):`);
      for (const s of data.stats.slice(0, 8)) {
        // Counts, never percentages (IA W4.5): this summary is a clinician export.
        const recentWindow = Math.min(s.attempts, 10);
        const landed = Math.round((s.recentAccuracy / 100) * recentWindow);
        lines.push(`  • /${s.sound}/ — ${s.attempts} attempts, about ${landed} of the last ${recentWindow} landed (parent/auto-scored, not a normed measure), highest level: ${s.levelReached}`);
      }
    }
    if (advCount > 0) {
      lines.push(``, `Story play: ${advCount} story ${advCount === 1 ? "scene" : "scenes"} played.`);
    }
    if (watch.length > 0) {
      // Masterplan 1.7: observational register — the pattern plus its count of
      // contributing observations, never a graded level tag.
      lines.push(``, `Non-diagnostic patterns worth a conversation:`);
      watch.forEach((w) => {
        const evidence = parentSafeEvidence(w.evidence).map(exportEvidence);
        const n = Math.max(evidence.length, 1);
        lines.push(`  • ${w.area}: ${n} contributing observation${n === 1 ? "" : "s"}${evidence.length > 0 ? `; evidence: ${evidence.join("; ")}` : ""}`);
      });
    }
    const text = lines.join("\n");
    // IA W4.5: the practice summary is a clinician-facing EXPORT — bound to the
    // same clinician ceiling as the consult presets (forbidden tokens, counts-
    // never-percentages). Fail closed: a violating summary neither renders nor
    // copies — a blocked export exports NOTHING.
    try { assertClinicianExportCeiling(text); } catch { return null; }
    return text;
  };
  return { clinicianSummary: build(true), previewSummary: build(false) };
}
