import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Activity, AlertTriangle, Check, ClipboardCopy, Compass, FileBarChart, Gauge, History, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { PageHeader, SectionCard, TrustSafetyBar, cardCls, Chip } from "../ui/kit";
import ProgressRing from "../ui/ProgressRing";
import DomainRadar from "./DomainRadar";
import { DOMAIN_META } from "../../practice/content";
import { usePracticeData, useCopilot } from "../../practice/usePracticeData";
import { watchSignals } from "../../practice/watch";
import type { ScreeningResult } from "../../lib/screening";
import type { BandLevel } from "../../practice/signals";
import { track } from "../../lib/analytics";

type SavedScreening = ScreeningResult & { id: string };

const BAND_COPY: Record<BandLevel, { label: string; note: string }> = {
  emerging:   { label: "Emerging",   note: "early signal — more observation and play will sharpen the picture" },
  developing: { label: "Developing", note: "growing steadily — keep the daily reps going" },
  "on-track": { label: "On track",   note: "solid signal across what we can observe" },
  strong:     { label: "Strong",     note: "a clear strength — use it to pull the other domains along" },
};

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
  const { bands, recommendation, confidence, trend, snapshots } = useCopilot(milestones, data, childProfile.id);
  const screeningsCol = useChildCollection<SavedScreening>(childProfile.id, "screenings");
  const first = childProfile.name.split(" ")[0];
  const [copied, setCopied] = useState(false);

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
      ...bands.map((b) => `  • ${DOMAIN_META[b.domain].label}: ${BAND_COPY[b.band].label}; confidence ${confidence[b.domain]}; trend ${trend[b.domain] >= 0 ? "+" : ""}${Math.round(trend[b.domain])} (basis: ${b.basis.join(", ")})`),
      ``,
      `Home practice, last 7 days: ${data.week.sessions} interactions on ${data.week.activeDays} day(s) across ${data.week.domainsTouched.length} domain(s). Streak: ${data.streak} day(s).`,
    ];
    if (data.stats.length > 0) {
      lines.push(``, `Articulation practice (parent/auto-scored at home):`);
      for (const s of data.stats.slice(0, 8)) {
        lines.push(`  • /${s.sound}/ — ${s.attempts} attempts, recent accuracy ${s.recentAccuracy}%, trend ${s.trend}, highest level: ${s.levelReached}`);
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
  }, [bands, confidence, trend, childProfile, data.today, data.week, data.streak, data.stats, advCount, advCorrect, watch, recommendation]);

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

      {/* Feature 9: domain bands vs chronological age context */}
      <SectionCard title={`Domain picture — chronological age ${childProfile.age}`} icon={<Gauge className="w-5 h-5" />} tone="mint">
        <div className="flex flex-col lg:flex-row gap-6 items-center mb-5">
          <div className="flex-shrink-0">
            <DomainRadar bands={bands} />
            <p className="text-[10px] text-center mt-1" style={{ color: "var(--arbor-muted)" }}>Each axis is one domain&apos;s current signal (0–100).</p>
          </div>
          <div className="flex-1 w-full space-y-4">
          {bands.map((b) => {
            const meta = DOMAIN_META[b.domain];
            const copy = BAND_COPY[b.band];
            const delta = trend[b.domain] ?? 0;
            const TrendIcon = delta > 1 ? TrendingUp : delta < -1 ? TrendingDown : Minus;
            return (
              <div key={b.domain} className="flex items-center gap-4">
                <span className="w-40 flex-shrink-0 text-xs font-extrabold" style={{ color: "var(--arbor-ink)" }}>{meta.label}</span>
                <div className="flex-1 h-5 rounded-full relative overflow-hidden" style={{ background: "rgba(41,51,63,0.06)" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${b.signal}%` }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ background: meta.color, opacity: 0.85 }}
                  />
                  {/* band threshold ticks */}
                  {[35, 55, 75].map((t) => (
                    <span key={t} className="absolute top-0 bottom-0 w-px" style={{ left: `${t}%`, background: "rgba(255,255,255,0.9)" }} />
                  ))}
                </div>
                <span className="w-28 flex-shrink-0 text-right">
                  <Chip tone={b.band === "strong" ? "mint" : b.band === "on-track" ? "sky" : b.band === "developing" ? "yellow" : "pink"}>{copy.label}</Chip>
                </span>
                <span className="w-28 flex-shrink-0 inline-flex items-center justify-end gap-1 text-[11px] font-bold" style={{ color: delta > 1 ? "var(--arbor-green-ink)" : delta < -1 ? "var(--arbor-pink-ink)" : "var(--arbor-muted)" }}>
                  <TrendIcon className="w-3.5 h-3.5" /> {delta > 0 ? "+" : ""}{Math.round(delta)}
                </span>
                <span className="w-24 flex-shrink-0 text-right">
                  <Chip tone={confidence[b.domain] === "high" ? "mint" : confidence[b.domain] === "medium" ? "sky" : "yellow"}>{confidence[b.domain]}</Chip>
                </span>
              </div>
            );
          })}
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]" style={{ color: "var(--arbor-muted)" }}>
          {bands.map((b) => (
            <p key={b.domain}>
              <b style={{ color: DOMAIN_META[b.domain].color }}>{DOMAIN_META[b.domain].label}:</b> {BAND_COPY[b.band].note}. Confidence: {confidence[b.domain]}; trend: {trend[b.domain] > 0 ? "+" : ""}{Math.round(trend[b.domain] ?? 0)}. <i>Based on: {b.basis.join(" + ")}.</i>
            </p>
          ))}
        </div>
        <p className="text-[11px] mt-4 rounded-xl p-3" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>
          Why bands and not ages? &ldquo;Language age 3.7&rdquo; sounds precise but home observation can&apos;t honestly support it. Bands show where attention helps — a professional assessment is what turns this into clinical conclusions.
        </p>
      </SectionCard>

      {/* Feature 10a: the weekly recommendation */}
      <SectionCard title="This week's focus" icon={<Compass className="w-5 h-5" />} tone="coral"
        action={
          <button onClick={() => setActiveTab("missions")} className="inline-flex items-center gap-2 font-bold text-xs px-4 py-2.5 rounded-xl text-white transition" style={{ background: "var(--arbor-peach-ink)" }}>
            Open this week's mission →
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
        <div className={`${cardCls} p-5 flex items-center gap-4`}>
          <ProgressRing value={data.score} size={64} stroke={6} color="var(--arbor-clay)">
            <span className="text-base font-extrabold" style={{ color: "var(--arbor-ink)" }}>{data.score}</span>
          </ProgressRing>
          <div>
            <p className="text-xs font-extrabold" style={{ color: "var(--arbor-ink)" }}>Development Score</p>
            <p className="text-[10.5px] mt-0.5" style={{ color: "var(--arbor-muted)" }}>Practice consistency this week — not ability.</p>
          </div>
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
