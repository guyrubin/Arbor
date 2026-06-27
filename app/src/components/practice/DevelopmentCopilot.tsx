import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Activity, AlertTriangle, Check, ClipboardCopy, Compass, FileBarChart, Gauge, History } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { PageHeader, SectionCard, TrustSafetyBar, cardCls, Chip } from "../ui/kit";
import { DOMAIN_META } from "../../practice/content";
import { usePracticeData, useCopilot } from "../../practice/usePracticeData";
import { watchSignals } from "../../practice/watch";
import type { ScreeningResult } from "../../lib/screening";
import { track } from "../../lib/analytics";

type SavedScreening = ScreeningResult & { id: string };

// Wave-3 (2026-06-27): verdict bands demoted. No "emerging / developing / on
// track / strong" label is rendered against a child anymore (mirrors DevScoreCard).
// The band is still computed by signals.ts (drives the route-to-pro escalation
// internally) but is never surfaced as a verdict. One mechanism-only message.
const MECHANISM_NOTE = "More play and observation will add to the picture.";

/**
 * Child Development Copilot — the connective layer the single-skill apps don't
 * have. Blends milestones + live practice signal into per-domain bands, one
 * weekly recommendation, and a clinician-ready summary.
 *
 * Deliberately shows BANDS, not "developmental age = X.X years": point
 * estimates without normed instruments would be clinically indefensible.
 */
export default function DevelopmentCopilot() {
  const { childProfile, milestones, behaviorLogs, setActiveTab } = useArbor();
  const { t } = useLanguage();
  const data = usePracticeData(childProfile.id);
  const { bands, recommendation, snapshots } = useCopilot(milestones, data, childProfile.id);
  const screeningsCol = useChildCollection<SavedScreening>(childProfile.id, "screenings");
  const first = childProfile.name.split(" ")[0];
  const [copied, setCopied] = useState(false);

  // Wave-3 (2026-06-27): the domain picture is now a flat COUNT of parent-
  // noticed milestones per domain (a parent-owned log), never the 0–100 band
  // signal. Mirrors DevScoreCard's parent-observed / count / mechanism register.
  const domainCounts = useMemo(() => {
    const map = new Map<string, { reached: number; total: number }>();
    for (const m of milestones) {
      const e = map.get(m.domain) ?? { reached: 0, total: 0 };
      e.total += 1;
      if (m.checked) e.reached += 1;
      map.set(m.domain, e);
    }
    return map;
  }, [milestones]);

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
  const dashboardRisk: "Low" | "Moderate" | "High" =
    childProfile.riskLevel === "High" ? "High" :
    watch.some((w) => w.level === "discuss") || childProfile.riskLevel === "Moderate" ? "Moderate" :
    "Low";

  const clinicianSummary = useMemo(() => {
    const lines: string[] = [
      `ARBOR PRACTICE SUMMARY — ${childProfile.name}, age ${childProfile.age}`,
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
      `Home practice, last 7 days: ${data.week.sessions} interactions on ${data.week.activeDays} day(s) across ${data.week.domainsTouched.length} domain(s). Streak: ${data.streak} day(s).`,
    ];
    if (data.stats.length > 0) {
      lines.push(``, `Articulation practice (parent/auto-scored at home):`);
      for (const s of data.stats.slice(0, 8)) {
        lines.push(`  • /${s.sound}/ — ${s.attempts} attempts, recent home-practice accuracy ${s.recentAccuracy}% (parent/auto-scored, not a normed measure), highest level: ${s.levelReached}`);
      }
    }
    if (advCount > 0) {
      lines.push(``, `Comprehension play: ${advCorrect}/${advCount} first-try correct across logic, sequencing, vocabulary and instruction scenes.`);
    }
    if (watch.length > 0) {
      lines.push(``, `Non-diagnostic watch signals:`);
      watch.forEach((w) => lines.push(`  • ${w.area}: ${w.level}; evidence: ${w.evidence.join("; ")}`));
    }
    lines.push(``, `Current focus suggested to the family: ${recommendation.headline}.`);
    return lines.join("\n");
  }, [bands, domainCounts, childProfile, data.today, data.week, data.streak, data.stats, advCount, advCorrect, watch, recommendation]);

  const copySummary = async () => {
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
        eyebrow="My Child"
        title={t("prac.copilot.title")}
        subtitle={t("prac.copilot.sub", { name: first })}
      />

      <TrustSafetyBar
        risk={dashboardRisk}
        note="Bands reflect parent-observed data only. They are a conversation starter for professionals — never a diagnosis."
        onEscalate={() => setActiveTab("find-pro")}
      />

      {/* Feature 9: domain picture — flat parent-noticed milestone COUNT per
          domain (Wave-3, 2026-06-27). Replaces the prior 0–100 radar polygon,
          the animated fill bars, the band-label chips, the threshold ticks, and
          the per-domain trend glyphs — all verdicts on a child. Now mirrors
          DevScoreCard: count / mechanism / route-to-pro. Emits nothing about
          the child as a verdict. */}
      <SectionCard title={`Domain picture — age ${childProfile.age}`} icon={<Gauge className="w-5 h-5" />} tone="mint">
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
        {/* sr-only count summary for assistive tech — count-only, no verdict. */}
        <div className="sr-only">
          {bands.map((b) => {
            const c = domainCounts.get(b.domain) ?? { reached: 0, total: 0 };
            return <span key={b.domain}>{DOMAIN_META[b.domain].label}: {c.reached} of {c.total} milestones noticed by you. </span>;
          })}
        </div>
        <p className="text-[11px] mt-4 rounded-xl p-3 leading-relaxed" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>
          We show counts of what you&apos;ve noticed — not a score or a &ldquo;developmental age.&rdquo; Home observation can&apos;t honestly support either. A professional assessment is what turns this into conclusions.
        </p>
      </SectionCard>

      {/* Feature 10a: the weekly recommendation */}
      <SectionCard title="This week's focus" icon={<Compass className="w-5 h-5" />} tone="coral"
        action={
          <button onClick={() => setActiveTab("overview")} className="inline-flex items-center gap-2 font-bold text-xs px-4 py-2.5 rounded-xl text-white transition" style={{ background: "var(--arbor-peach-ink)" }}>
            Today&apos;s mission →
          </button>
        }>
        <div className="flex items-start gap-4">
          <span className="inline-flex items-center justify-center rounded-2xl flex-shrink-0" style={{ background: DOMAIN_META[recommendation.domain].soft, width: 52, height: 52 }}>
            <Activity className="w-6 h-6" style={{ color: DOMAIN_META[recommendation.domain].color }} />
          </span>
          <div>
            <p className="text-base font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{recommendation.headline}</p>
            <p className="text-xs mt-1.5 leading-relaxed max-w-2xl" style={{ color: "var(--arbor-muted)" }}>{recommendation.why}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Watch signals" icon={<AlertTriangle className="w-5 h-5" />} tone={watch.some((w) => w.level === "discuss") ? "yellow" : "mint"}>
        {watch.length === 0 ? (
          <div className="rounded-2xl p-4" style={{ background: "var(--arbor-green-soft)" }}>
            <p className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>No watch signals yet.</p>
            <p className="text-xs mt-1" style={{ color: "var(--arbor-muted)" }}>
              Arbor needs enough recent practice, logged moments, or a Development Check before it raises a pattern. Silence here means "not enough concerning signal", not a clinical clearance.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {watch.map((w) => {
              const tone = w.level === "discuss" ? "yellow" : "sky";
              return (
                <div key={w.id} className={`${cardCls} p-4`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{w.area}</p>
                    <Chip tone={tone}>{w.level === "discuss" ? "Discuss" : "Monitor"}</Chip>
                  </div>
                  <p className="text-[11px] font-bold mb-1" style={{ color: DOMAIN_META[w.domain].color }}>{DOMAIN_META[w.domain].label}</p>
                  <div className="space-y-1.5">
                    {w.evidence.map((e, i) => (
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

      <SectionCard title="Weekly history" icon={<History className="w-5 h-5" />} tone="sky">
        {/* Wave-3 (2026-06-27): the longitudinal trend/sparkline block was removed —
            it rendered a per-child "signal over time" trajectory, a verdict surface
            the clinical firewall does not allow. The weekly snapshots below remain
            for now; converting their 0–100 signal bars to the count register is a
            larger data-shape change tracked in PRODUCT-BACKLOG (AP-CF-snapshots). */}
        {snapshots.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>
            The first weekly band snapshot will appear here once the dashboard has loaded practice data.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[...snapshots].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3).map((snap) => (
              <div key={snap.id} className={`${cardCls} p-4`}>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <p className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{snap.id}</p>
                  <span className="text-[11px]" style={{ color: "var(--arbor-muted)" }}>{snap.date}</span>
                </div>
                <div className="space-y-2">
                  {snap.bands.map((b) => {
                    const meta = DOMAIN_META[b.domain];
                    return (
                      <div key={b.domain}>
                        <div className="flex justify-between text-[10px] font-bold mb-1">
                          <span style={{ color: meta.color }}>{meta.label}</span>
                          <span style={{ color: "var(--arbor-muted)" }}>{Math.round(b.signal)}</span>
                        </div>
                        <div className="h-2 rounded-full" style={{ background: "rgba(41,51,63,0.08)" }}>
                          <div className="h-2 rounded-full" style={{ width: `${b.signal}%`, background: meta.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Practice pulse */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`${cardCls} p-5`}>
          <p className="text-2xl font-extrabold" style={{ color: "var(--arbor-ink)" }}>{data.score}</p>
          <p className="text-[10.5px] mt-0.5" style={{ color: "var(--arbor-muted)" }}>Practice consistency this week — engagement, not ability or development.</p>
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
      <SectionCard title="Share with a professional" icon={<FileBarChart className="w-5 h-5" />} tone="sky"
        action={
          <div className="flex gap-2">
            <button onClick={() => void copySummary()} className="inline-flex items-center gap-2 font-bold text-xs px-4 py-2.5 rounded-xl transition" style={{ background: "var(--arbor-sky-soft)", color: "var(--arbor-sky-ink)" }}>
              {copied ? <Check className="w-3.5 h-3.5" /> : <ClipboardCopy className="w-3.5 h-3.5" />} {copied ? "Copied" : "Copy summary"}
            </button>
            <button onClick={() => setActiveTab("reports")} className="inline-flex items-center gap-2 font-bold text-xs px-4 py-2.5 rounded-xl transition" style={{ background: "#fff", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}>
              Full reports →
            </button>
          </div>
        }>
        <p className="text-[11px] mb-3" style={{ color: "var(--arbor-muted)" }}>
          A speech-language professional, psychologist or pediatrician gets months of between-session data in one paragraph — the thing the single-skill practice apps never close the loop on.
        </p>
        <pre className="text-[11px] leading-relaxed whitespace-pre-wrap rounded-xl p-4 select-text" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)", fontFamily: "ui-monospace, monospace" }}>
          {clinicianSummary}
        </pre>
      </SectionCard>
    </motion.div>
  );
}
