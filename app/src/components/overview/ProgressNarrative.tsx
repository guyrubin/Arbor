import React from "react";
import Icon from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import type { ActionLoopEntry } from "../../actionLoop/model";

/** An evidence row. `id` is the JOURNAL TIMELINE SIGNAL id (already prefixed
 *  `moment-`/`play-` by the caller) so tapping a row can deep-link to exactly
 *  that entry. Carries only id/timestamp/label — never a derived score. */
type EvidenceItem = { id: string; timestamp: string; label: string };

export default function ProgressNarrative({
  childName,
  behaviorLogs,
  playLogs,
  noticedMilestones,
  momentsLastWeek,
  actions,
  onOpenEvidence,
}: {
  childName: string;
  behaviorLogs: EvidenceItem[];
  playLogs: EvidenceItem[];
  noticedMilestones: number;
  /** Logged-moment count for the PREVIOUS 7-day window (days 8–14), derived in
   *  OverviewTab where behaviorLogs are in scope (TODAY-6). A count, never a
   *  trend verdict. */
  momentsLastWeek: number;
  actions: ActionLoopEntry[];
  /** Open the journal: with a signal id → deep-link to that exact entry;
   *  without → the whole journal feed. The id is the only payload (firewall:
   *  evidence deep-links carry no derived scores). */
  onOpenEvidence: (evidenceId?: string) => void;
}) {
  // TODAY-5/PLAT-4/CODEX-6: copy lives in i18n.ts (today.narrative.*), never an
  // inline per-language ternary object — keys stay visible to the parity test.
  const { t } = useLanguage();
  const weekAgo = Date.now() - 7 * 86_400_000;
  const recentBehaviors = behaviorLogs.filter((item) => new Date(item.timestamp).getTime() >= weekAgo);
  const recentPlay = playLogs.filter((item) => new Date(item.timestamp).getTime() >= weekAgo);
  const latestOutcome = actions.find((item) => item.status === "completed" && item.outcome);
  const evidence = [...recentBehaviors, ...recentPlay]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 3);
  // TODAY-6: ONE firewall-safe comparative sentence — this week's logged-moment
  // count vs last week's, phrased as bare counts. No trend adjective, %, or
  // score may ever join this template (pinned by the wave-3-style token scan).
  const weekCompare = t("today.narrative.weekCompare", { thisWeek: recentBehaviors.length, lastWeek: momentsLastWeek });
  const copy = {
    eyebrow: t("today.narrative.eyebrow"), title: t("today.narrative.title", { name: childName }), changed: t("today.narrative.changed"),
    evidence: t("today.narrative.evidence"), next: t("today.narrative.next"), open: t("today.narrative.open"),
    noChange: t("today.narrative.noChange"),
    changedBody: t("today.narrative.changedBody", { moments: recentBehaviors.length, plays: recentPlay.length, milestones: noticedMilestones }),
    nextBody: latestOutcome?.outcome === "not_today" ? t("today.narrative.nextNotToday") : latestOutcome ? t("today.narrative.nextOutcome") : t("today.narrative.nextNone"),
    parentOnly: t("today.narrative.parentOnly"),
  };
  const hasEvidence = evidence.length > 0 || noticedMilestones > 0;

  return (
    <section className="rounded-[20px] p-5 sm:p-6" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)", boxShadow: "var(--shadow-xs)" }} aria-labelledby="progress-narrative-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--arbor-green-ink)" }}>{copy.eyebrow}</p>
          <h2 id="progress-narrative-title" className="mt-1 text-xl font-bold" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)" }}>{copy.title}</h2>
          <p className="mt-1 text-[11px]" style={{ color: "var(--arbor-muted)" }}>{copy.parentOnly}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}><Icon name="timeline" size={19} /></span>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <NarrativeCell icon="moving" title={copy.changed} body={hasEvidence ? `${copy.changedBody} ${weekCompare}` : copy.noChange} />
        <div className="rounded-2xl p-4" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}>
          <div className="flex items-center gap-2"><Icon name="fact_check" size={17} style={{ color: "var(--arbor-green-ink)" }} /><h3 className="text-xs font-extrabold" style={{ color: "var(--arbor-ink)" }}>{copy.evidence}</h3></div>
          {/* TODAY-6 / AR-CAP-03: every cited row is TAPPABLE and deep-links to
              that exact journal entry via onOpenEvidence(item.id) — the section
              earns its card by connecting inference to source signal. */}
          {evidence.length ? <ul className="mt-3 space-y-1">{evidence.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onOpenEvidence(item.id)}
                aria-label={t("today.narrative.openItem", { label: item.label })}
                className="flex w-full min-h-10 items-start gap-1.5 rounded-lg py-1.5 text-start"
              >
                <span className="line-clamp-2 flex-1 text-[11px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{item.label}</span>
                <Icon name="arrow_forward" size={14} className="mt-0.5 flex-shrink-0 rtl:-scale-x-100" style={{ color: "var(--arbor-green-ink)" }} />
              </button>
            </li>
          ))}</ul> : <p className="mt-3 text-[11px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{copy.noChange}</p>}
          <button type="button" onClick={() => onOpenEvidence()} className="mt-3 min-h-10 text-xs font-extrabold" style={{ color: "var(--arbor-green-ink)" }}>{copy.open}</button>
        </div>
        <NarrativeCell icon="arrow_forward" title={copy.next} body={copy.nextBody} />
      </div>
    </section>
  );
}

function NarrativeCell({ icon, title, body }: { icon: string; title: string; body: string }) {
  return <div className="rounded-2xl p-4" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}><div className="flex items-center gap-2"><Icon name={icon} size={17} style={{ color: "var(--arbor-green-ink)" }} /><h3 className="text-xs font-extrabold" style={{ color: "var(--arbor-ink)" }}>{title}</h3></div><p className="mt-3 text-[11px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{body}</p></div>;
}
