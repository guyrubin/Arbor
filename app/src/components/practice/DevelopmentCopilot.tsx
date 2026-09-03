import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { PageHeader, SectionCard, TrustSafetyBar, cardCls, Chip } from "../ui/kit";
import { DOMAIN_META } from "../../practice/content";
import { usePracticeData, useCopilot } from "../../practice/usePracticeData";
import { domainMilestoneCounts } from "../../practice/signals";
import { watchSignals } from "../../practice/watch";
import type { ScreeningResult } from "../../lib/screening";
import type { PracticeDomain } from "../../types";
import { assertClinicianExportCeiling } from "../../consult/packet";
import { track } from "../../lib/analytics";
import { en as fullPictureEn, he as fullPictureHe } from "../../lib/i18nElevation/fullpicture";
// GP-01 / GP-08: months-precise age label + the shared age window.
import { ageLabel, ageMonthsFromProfile } from "../../lib/childAge";
import { ageWindowMilestones, comparisonAgeMonths } from "../../lib/milestoneData";

type SavedScreening = ScreeningResult & { id: string };

/** Masterplan 1.7 — module-local string resolution for the Full Picture
 *  reframe. i18nElevation/index.ts registration is that file's own recipe (one
 *  line per module, owned separately); resolving directly here keeps this
 *  workstream inside the files it owns while mirroring i18n.ts {var}
 *  interpolation (same recipe as Screening.tsx × screeningcalm). */
function tFP(uiLang: string, key: string, vars?: Record<string, string | number>): string {
  let s = (uiLang === "he" ? fullPictureHe[key] : undefined) ?? fullPictureEn[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

// Wave-3 (2026-06-27): verdict bands demoted. No "emerging / developing / on
// track / strong" label is rendered against a child anymore (mirrors DevScoreCard).
// The band is still computed by signals.ts (drives the route-to-pro escalation
// internally) but is never surfaced as a verdict. One mechanism-only message.
const MECHANISM_NOTE = "More play and observation will add to the picture.";

/** Masterplan 1.7 / GD-10 — presentation guard on evidence lines: a couple of
 *  watch-signal evidence strings interpolate the internal band VALUE
 *  ("…currently emerging"). Band values never render on a parent surface, so
 *  any evidence line carrying one is dropped from display (the underlying
 *  computation is untouched — the signal still fires and still counts). */
const BAND_WORD = /\b(?:emerging|developing|on[\s-]?track|strong)\b/i;
const parentSafeEvidence = (evidence: string[]): string[] => evidence.filter((e) => !BAND_WORD.test(e));

/**
 * The Full Picture (route id: "copilot") — the connective layer the
 * single-skill apps don't have. Blends milestones + live practice signal +
 * screening + logged moments into one calm observational surface, one weekly
 * recommendation, and a clinician-ready summary.
 *
 * CLINICAL FIREWALL (constraints-lens ruling, masterplan 1.7): everything here
 * is counts and observational language. No Discuss/Monitor level tags, no
 * Low/Moderate/High risk render, no band value or trend — one neutral tone for
 * every area. Escalation stays available, keyed on the internal signal without
 * ever displaying a grade.
 */
export default function DevelopmentCopilot() {
  const { childProfile, milestones, behaviorLogs, setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const data = usePracticeData(childProfile.id);
  const { bands, recommendation, snapshots } = useCopilot(milestones, data, childProfile.id);
  const screeningsCol = useChildCollection<SavedScreening>(childProfile.id, "screenings");
  const first = childProfile.name.split(" ")[0];
  const [copied, setCopied] = useState(false);

  // Wave-3 (2026-06-27): the domain picture is now a flat COUNT of parent-
  // noticed milestones per domain (a parent-owned log), never the 0–100 band
  // signal. Mirrors DevScoreCard's parent-observed / count / mechanism register.
  // Keyed by PRACTICE domain (via MILESTONE_DOMAIN_MAP) so it lines up with the
  // `bands` / DOMAIN_META keys the rows iterate; the same helper feeds the
  // weekly-history count register so the live and historical views agree.
  // GP-08: counted over the child's AGE WINDOW (current corrected band + one
  // earlier — the shared lib/milestoneData.milestoneAgeWindow), never the whole
  // 0–6y catalogue, so "x of y noticed" is an age-appropriate denominator.
  const comparisonMonths = useMemo(() => {
    const chronoMonths = ageMonthsFromProfile(childProfile) ?? Math.round((childProfile.age || 0) * 12);
    return comparisonAgeMonths(chronoMonths, childProfile.preterm?.gestationalWeeks);
  }, [childProfile]);
  const windowMilestones = useMemo(() => ageWindowMilestones(milestones, comparisonMonths), [milestones, comparisonMonths]);
  const domainCounts = useMemo(() => domainMilestoneCounts(windowMilestones), [windowMilestones]);

  const advCount = data.adventures.items.length;
  const advCorrect = data.adventures.items.filter((a) => a.correct).length;
  const lastScreening = useMemo(
    () => [...screeningsCol.items].sort((a, b) => (a.answeredAt < b.answeredAt ? 1 : -1))[0],
    [screeningsCol.items]
  );
  const screeningWatchLabels = useMemo(
    () => lastScreening?.watchAreas.map((w) => w.label) ?? [],
    [lastScreening]
  );
  const watch = useMemo(
    () => watchSignals({
      age: childProfile.age,
      screeningWatchLabels,
      logs: behaviorLogs,
      stats: data.stats,
      bands,
      missions: data.missions.items,
      adventureScenes: advCount,
      adventureCorrect: advCorrect,
    }),
    [childProfile.age, screeningWatchLabels, behaviorLogs, data.stats, bands, data.missions.items, advCount, advCorrect]
  );

  // Masterplan 1.7: the old graded dashboard-risk value is gone. What remains
  // is a single internal boolean that gates the PRESENCE of the escalate CTA (Screening.firewall.test.ts precedent: outcome-gated CTA
  // presence is allowed; a graded tone/label is not). Nothing about this
  // boolean is ever displayed.
  const escalationSignal =
    childProfile.riskLevel !== "Low" || watch.some((w) => w.level === "discuss");

  // GD-10: cumulative practice register — a running tally of activity, never a
  // score. Replaces the old developmentScore VALUE in the pulse tiles.
  const { practiceMoments, skillAreas } = useMemo(() => {
    const completedMissions = data.missions.items.filter((m) => m.completed);
    const domains = new Set<PracticeDomain>([
      ...((data.speech.items.length + data.mimic.items.length > 0 ? ["speech"] : []) as PracticeDomain[]),
      ...((data.adventures.items.length > 0 ? ["cognition"] : []) as PracticeDomain[]),
      ...completedMissions.map((m) => m.domain),
      ...data.events.items.map((e) => e.domain),
    ]);
    const moments =
      data.speech.items.length +
      data.mimic.items.length +
      data.adventures.items.length +
      data.events.items.length +
      completedMissions.length;
    return { practiceMoments: moments, skillAreas: domains.size };
  }, [data.speech.items, data.mimic.items, data.adventures.items, data.events.items, data.missions.items]);

  /* Masterplan 2.3 — a RESETTABLE continuity counter is banned from PARENT
     surfaces (computeStreak().current zeroes on any lapse, so it renders as
     guilt, not information). The summary is therefore built TWICE from one
     builder:
       • clinicianSummary — the EXPORT (copy-to-clipboard). Keeps the streak
         clause: adherence over the last week is what a clinician reading the
         sheet asked for, and the export never renders on a parent surface.
       • previewSummary  — what the <pre> below actually SHOWS the parent.
         Identical text minus the streak clause.
     Both go through assertClinicianExportCeiling independently and both fail
     closed. Every other line is shared, so preview and export can never drift. */
  const { clinicianSummary, previewSummary } = useMemo(() => {
    const homePractice = `Home practice, last 7 days: ${data.week.sessions} interactions on ${data.week.activeDays} day(s) across ${data.week.domainsTouched.length} domain(s).`;
    const streakClause = ` Streak: ${data.streak} day(s).`;
    const build = (withStreak: boolean): string | null => {
      const lines: string[] = [
        `ARBOR PRACTICE SUMMARY — ${childProfile.name}, age ${ageLabel(childProfile)}`,
        `Generated ${data.today} · Parent-collected observational data · NOT a diagnostic assessment`,
        ``,
        `Domain picture (milestone checklist + home practice signal):`,
        ...bands.map((b) => {
          const c = domainCounts.get(b.domain);
          const reached = c?.reached ?? 0;
          const total = c?.total ?? 0;
          return `  • ${DOMAIN_META[b.domain].label}: ${reached} of ${total} milestones noticed by parent (home-practice signal; basis: ${b.basis.join(", ")})`;
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
        lines.push(``, `Comprehension play: ${advCorrect}/${advCount} first-try correct across logic, sequencing, vocabulary and instruction scenes.`);
      }
      if (watch.length > 0) {
        // Masterplan 1.7: observational register — the pattern plus its count of
        // contributing observations, never a graded level tag.
        lines.push(``, `Non-diagnostic patterns worth a conversation:`);
        watch.forEach((w) => {
          const evidence = parentSafeEvidence(w.evidence);
          const n = Math.max(evidence.length, 1);
          lines.push(`  • ${w.area}: ${n} contributing observation${n === 1 ? "" : "s"}${evidence.length > 0 ? `; evidence: ${evidence.join("; ")}` : ""}`);
        });
      }
      lines.push(``, `Current focus suggested to the family: ${recommendation.headline}.`);
      const text = lines.join("\n");
      // IA W4.5: the practice summary is a clinician-facing EXPORT — bound to the
      // same clinician ceiling as the consult presets (forbidden tokens, counts-
      // never-percentages). Fail closed: a violating summary neither renders nor
      // copies — a blocked export exports NOTHING.
      try { assertClinicianExportCeiling(text); } catch { return null; }
      return text;
    };
    return { clinicianSummary: build(true), previewSummary: build(false) };
  }, [bands, domainCounts, childProfile, data.today, data.week, data.streak, data.stats, advCount, advCorrect, watch, recommendation]);

  const copySummary = async () => {
    if (!clinicianSummary) return;
    try {
      await navigator.clipboard.writeText(clinicianSummary);
      setCopied(true);
      track("copilot_summary_copied", {});
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — the text is selectable below */
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-[1180px]">
      <PageHeader
        eyebrow="Growth"
        title={tFP(uiLang, "elev.fullpicture.title")}
        subtitle={tFP(uiLang, "elev.fullpicture.sub", { name: first })}
      />

      {/* Masterplan 1.7: constant posture — the bar's tone and text never grade
          the child (no risk prop → one calm register for everyone). Escalation
          stays available below, gated on the internal signal only. */}
      <TrustSafetyBar
        note="Counts reflect parent-observed data only. They are a conversation starter for professionals — never a diagnosis."
      />
      {escalationSignal && (
        <button
          type="button"
          onClick={() => setActiveTab("find-pro")}
          data-testid="copilot-escalate-cta"
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-start transition active:scale-[0.99]"
          style={{ minHeight: 44, background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}
        >
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--arbor-paper-deep)" }}>
            <Icon name="support_agent" size={18} style={{ color: "var(--arbor-green-ink)" }} />
          </span>
          <span className="min-w-0 flex-1 text-[13px] font-bold leading-snug" style={{ color: "var(--arbor-ink)" }}>
            {t("kit.trust.talkPro")}
          </span>
          <Icon name="chevron_right" size={18} className="rtl:rotate-180 flex-shrink-0" style={{ color: "var(--arbor-green-ink)" }} />
        </button>
      )}

      {/* Feature 9: domain picture — flat parent-noticed milestone COUNT per
          domain (Wave-3, 2026-06-27). Replaces the prior 0–100 radar polygon,
          the animated fill bars, the band-label chips, the threshold ticks, and
          the per-domain trend glyphs — all verdicts on a child. Now mirrors
          DevScoreCard: count / mechanism / route-to-pro. Emits nothing about
          the child as a verdict. */}
      <SectionCard title={`Domain picture — age ${ageLabel(childProfile, t)}`} icon={<Icon name="monitoring" size={20} />} tone="mint">
        <ul className="space-y-2.5">
          {bands.map((b) => {
            const meta = DOMAIN_META[b.domain];
            const c = domainCounts.get(b.domain) ?? { reached: 0, total: 0 };
            return (
              <li key={b.domain} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-xs font-extrabold" style={{ color: "var(--arbor-ink)" }}>{meta.label}</span>
                <span className="text-[11.5px]" style={{ color: "var(--arbor-muted)" }}>
                  {c.reached} of {c.total} milestones noticed · {MECHANISM_NOTE}
                </span>
              </li>
            );
          })}
        </ul>
        {/* The sr-only mirror of this same list was removed (2026-08-12): the
            visible <ul> above is already plain text in the accessibility tree,
            so the duplicate made every domain row announce twice and made
            "Speech sounds — 0 of 0 milestones noticed" appear three times on
            one screen. One rendered row per domain; the clinician export below
            is a separate artifact, not a third copy of this list. */}
        <p className="text-[11px] mt-4 rounded-xl p-3 leading-relaxed" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>
          We show counts of what you&apos;ve noticed — not a score or a &ldquo;developmental age.&rdquo; Home observation can&apos;t honestly support either. A professional assessment is what turns this into conclusions.
        </p>
      </SectionCard>

      {/* Feature 10a: the weekly recommendation */}
      <SectionCard title="This week's focus" icon={<Icon name="explore" size={20} />} tone="coral"
        action={
          <button onClick={() => setActiveTab("overview")} className="inline-flex items-center gap-2 font-bold text-xs px-4 py-2.5 rounded-xl text-white transition" style={{ background: "var(--arbor-peach-ink)" }}>
            Today&apos;s mission →
          </button>
        }>
        <div className="flex items-start gap-4">
          <span className="inline-flex items-center justify-center rounded-2xl flex-shrink-0" style={{ background: DOMAIN_META[recommendation.domain].soft, width: 52, height: 52 }}>
            <Icon name="monitor_heart" size={24} style={{ color: DOMAIN_META[recommendation.domain].color }} />
          </span>
          <div>
            <p className="text-base font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{recommendation.headline}</p>
            <p className="text-xs mt-1.5 leading-relaxed max-w-2xl" style={{ color: "var(--arbor-muted)" }}>{recommendation.why}</p>
          </div>
        </div>
      </SectionCard>

      {/* Masterplan 1.7: "Worth a conversation" — the former Watch signals
          section in the observational register. ONE neutral tone for every
          area and for the section itself (no discuss-vs-monitor flip); each
          row reports the COUNT of contributing observations, mirroring the
          Screening result screen's calm reframe. */}
      <SectionCard title={tFP(uiLang, "elev.fullpicture.watch.title")} icon={<Icon name="forum" size={20} />} tone="lav">
        {watch.length === 0 ? (
          <div className="rounded-2xl p-4" style={{ background: "var(--arbor-paper-deep)" }}>
            <p className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{tFP(uiLang, "elev.fullpicture.watch.empty.title")}</p>
            <p className="text-xs mt-1" style={{ color: "var(--arbor-muted)" }}>
              {tFP(uiLang, "elev.fullpicture.watch.empty.body")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {watch.map((w) => {
              const evidence = parentSafeEvidence(w.evidence);
              const n = Math.max(evidence.length, 1);
              return (
                <div key={w.id} className={`${cardCls} p-4`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{w.area}</p>
                    <Chip tone="lav">
                      {tFP(uiLang, n === 1 ? "elev.fullpicture.watch.row.one" : "elev.fullpicture.watch.row.many", { n })}
                    </Chip>
                  </div>
                  <p className="text-[11px] font-bold mb-1" style={{ color: DOMAIN_META[w.domain].color }}>{DOMAIN_META[w.domain].label}</p>
                  <div className="space-y-1.5">
                    {evidence.map((e, i) => (
                      <p key={i} className="text-[11px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>Evidence: {e}</p>
                    ))}
                  </div>
                  <button onClick={() => setActiveTab("reports")} className="mt-3 text-[11px] font-extrabold" style={{ color: "var(--arbor-green-ink)" }}>
                    Prepare a professional summary →
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Weekly history" icon={<Icon name="history" size={20} />} tone="sky">
        {/* AP-CF-snapshots (Wave-3, 2026-06-27): the weekly snapshots now render in
            the COUNT register — parent-noticed milestones per domain over time —
            never the 0–100 `signal` fill bars they used to. (The longitudinal
            trend/sparkline block was already removed; the per-child "signal over
            time" trajectory is a verdict surface the clinical firewall disallows.)
            Snapshots persist `reached`/`total` (see signals.pendingSnapshot); older
            snapshots without them fall back to the current milestone tally so the
            view never reverts to a score. This is a conversation starter about what
            you've noticed — never a diagnosis. */}
        {snapshots.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>
            The first weekly snapshot will appear here once the dashboard has loaded practice data. It records how many milestones you&apos;ve noticed in each domain — a log, not a score.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[...snapshots].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3).map((snap) => (
              <div key={snap.id} className={`${cardCls} p-4`}>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <p className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{snap.id}</p>
                  <span className="text-[11px]" style={{ color: "var(--arbor-muted)" }}>{snap.date}</span>
                </div>
                <ul className="space-y-1.5">
                  {snap.bands.map((b) => {
                    const meta = DOMAIN_META[b.domain];
                    // Count register: prefer the snapshot's persisted parent-noticed
                    // counts; fall back to the current tally for legacy snapshots.
                    const fallback = domainCounts.get(b.domain);
                    const reached = b.reached ?? fallback?.reached ?? 0;
                    const total = b.total ?? fallback?.total ?? 0;
                    return (
                      <li key={b.domain} className="flex items-baseline justify-between gap-2 text-[11px]">
                        <span className="font-bold" style={{ color: meta.color }}>{meta.label}</span>
                        <span style={{ color: "var(--arbor-muted)" }}>{reached} of {total} noticed</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Practice pulse — GD-10: the first tile is a CUMULATIVE COUNT of
          practice moments (a running activity tally), never the 0–100
          developmentScore value or any band/trend. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`${cardCls} p-5`}>
          <p className="text-2xl font-extrabold" style={{ color: "var(--arbor-ink)" }}>{practiceMoments}</p>
          <p className="text-[10.5px] mt-0.5" style={{ color: "var(--arbor-muted)" }}>
            {tFP(uiLang, "elev.fullpicture.pulse.moments", { k: skillAreas, kPlural: skillAreas === 1 ? "" : "s" })}
          </p>
        </div>
        <div className={`${cardCls} p-5`}>
          <p className="text-2xl font-extrabold" style={{ color: "var(--arbor-ink)" }}>{data.week.sessions}</p>
          <p className="text-[10.5px] mt-0.5" style={{ color: "var(--arbor-muted)" }}>Practice interactions in 7 days, across {data.week.domainsTouched.length} domain{data.week.domainsTouched.length === 1 ? "" : "s"}</p>
        </div>
        <div className={`${cardCls} p-5`}>
          <p className="text-2xl font-extrabold" style={{ color: "var(--arbor-ink)" }}>{advCount > 0 ? `${advCorrect}/${advCount}` : "—"}</p>
          <p className="text-[10.5px] mt-0.5" style={{ color: "var(--arbor-muted)" }}>Adventure scenes solved on the first try</p>
        </div>
      </div>

      {/* Feature 10b: clinician summary */}
      <SectionCard title="Share with a professional" icon={<Icon name="description" size={20} />} tone="sky"
        action={
          <div className="flex gap-2">
            <button onClick={() => void copySummary()} className="inline-flex items-center gap-2 font-bold text-xs px-4 py-2.5 rounded-xl transition" style={{ background: "var(--arbor-sky-soft)", color: "var(--arbor-sky-ink)" }}>
              {copied ? <Icon name="check" size={14} /> : <Icon name="content_copy" size={14} />} {copied ? "Copied" : "Copy summary"}
            </button>
            <button onClick={() => setActiveTab("reports")} className="inline-flex items-center gap-2 font-bold text-xs px-4 py-2.5 rounded-xl transition" style={{ background: "#fff", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}>
              Full reports →
            </button>
          </div>
        }>
        <p className="text-[11px] mb-3" style={{ color: "var(--arbor-muted)" }}>
          A speech-language professional, psychologist or pediatrician gets months of between-session data in one paragraph — the thing the single-skill practice apps never close the loop on.
        </p>
        {/* Masterplan 2.3: the PARENT-facing preview renders previewSummary —
            the streak clause is stripped here and lives only in the copied
            export. Never swap this back to clinicianSummary. */}
        <pre className="text-[11px] leading-relaxed whitespace-pre-wrap rounded-xl p-4 select-text" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)", fontFamily: "ui-monospace, monospace" }}>
          {previewSummary ?? "This summary did not pass Arbor's export safety check, so nothing was exported. Please try again after your next practice session."}
        </pre>
      </SectionCard>
    </motion.div>
  );
}
