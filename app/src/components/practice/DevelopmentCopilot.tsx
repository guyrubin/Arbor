import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Activity, ClipboardCopy, Compass, FileBarChart, Gauge, Check } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { PageHeader, SectionCard, TrustSafetyBar, cardCls, Chip } from "../ui/kit";
import ProgressRing from "../ui/ProgressRing";
import { DOMAIN_META } from "../../practice/content";
import { usePracticeData, useCopilot } from "../../practice/usePracticeData";
import type { BandLevel } from "../../practice/signals";
import { track } from "../../lib/analytics";

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
  const { childProfile, milestones, setActiveTab } = useArbor();
  const data = usePracticeData(childProfile.id);
  const { bands, recommendation } = useCopilot(milestones, data);
  const first = childProfile.name.split(" ")[0];
  const [copied, setCopied] = useState(false);

  const advCount = data.adventures.items.length;
  const advCorrect = data.adventures.items.filter((a) => a.correct).length;

  const clinicianSummary = useMemo(() => {
    const lines: string[] = [
      `ARBOR PRACTICE SUMMARY — ${childProfile.name}, age ${childProfile.age}`,
      `Generated ${data.today} · Parent-collected observational data · NOT a diagnostic assessment`,
      ``,
      `Domain picture (milestone checklist + home practice signal):`,
      ...bands.map((b) => `  • ${DOMAIN_META[b.domain].label}: ${BAND_COPY[b.band].label} (basis: ${b.basis.join(", ")})`),
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
    lines.push(``, `Current focus suggested to the family: ${recommendation.headline}.`);
    return lines.join("\n");
  }, [bands, childProfile, data.today, data.week, data.streak, data.stats, advCount, advCorrect, recommendation]);

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
        title="Development Dashboard"
        subtitle={`${first}'s whole picture in one place — language, speech, thinking, social and emotional signals from milestones and daily practice, with one clear focus for the week.`}
      />

      <TrustSafetyBar
        risk={childProfile.riskLevel === "High" ? "High" : childProfile.riskLevel === "Moderate" ? "Moderate" : "Low"}
        note="Bands reflect parent-observed data only. They are a conversation starter for professionals — never a diagnosis."
        onEscalate={() => setActiveTab("find-pro")}
      />

      {/* Feature 9: domain bands vs chronological age context */}
      <SectionCard title={`Domain picture — chronological age ${childProfile.age}`} icon={<Gauge className="w-5 h-5" />} tone="mint">
        <div className="space-y-4">
          {bands.map((b) => {
            const meta = DOMAIN_META[b.domain];
            const copy = BAND_COPY[b.band];
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
              </div>
            );
          })}
        </div>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]" style={{ color: "var(--arbor-muted)" }}>
          {bands.map((b) => (
            <p key={b.domain}>
              <b style={{ color: DOMAIN_META[b.domain].color }}>{DOMAIN_META[b.domain].label}:</b> {BAND_COPY[b.band].note}. <i>Based on: {b.basis.join(" + ")}.</i>
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
          <button onClick={() => setActiveTab("missions")} className="inline-flex items-center gap-2 font-bold text-xs px-4 py-2.5 rounded-xl text-white transition" style={{ background: "#cf6f37" }}>
            Open the aimed mission →
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

      {/* Practice pulse */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`${cardCls} p-5 flex items-center gap-4`}>
          <ProgressRing value={data.score} size={64} stroke={6} color="#34b277">
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
            <button onClick={() => void copySummary()} className="inline-flex items-center gap-2 font-bold text-xs px-4 py-2.5 rounded-xl transition" style={{ background: "#e5f0fb", color: "#2f7bbf" }}>
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
