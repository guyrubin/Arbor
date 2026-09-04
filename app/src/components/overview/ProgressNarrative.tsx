import React from "react";
import Icon from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import type { ActionLoopEntry } from "../../actionLoop/model";

/** An evidence row. `id` is the JOURNAL TIMELINE SIGNAL id (already prefixed
 *  `moment-`/`play-` by the caller) so tapping a row can deep-link to exactly
 *  that entry. Carries only id/timestamp/label — never a derived score. */
type EvidenceItem = { id: string; timestamp: string; label: string };

/**
 * ENG-18 — the cold-start progress line ("3 more days and Arbor can read her
 * rhythm"). `predictRhythm` already computes `daysNeeded`, and RhythmStrip
 * already renders it — but RhythmStrip is not mounted on Today, so a parent in
 * the first fortnight got no answer to "how long until this is worth it?".
 *
 * Pure + exported so the gating is unit-testable in the node harness (same
 * pattern as RhythmStrip.shouldShowRememberRow). Returns the i18n key to
 * render, or null when the line has nothing honest to say — a coverage number
 * of zero is not a promise, and once the rhythm reads there is no countdown.
 *
 * FIREWALL: the line states what ARBOR needs, never anything about the child.
 */
export function coldStartLineKey(daysNeeded: number | undefined): string | null {
  if (typeof daysNeeded !== "number" || !Number.isFinite(daysNeeded)) return null;
  if (daysNeeded <= 0) return null;
  return daysNeeded === 1 ? "elev.closeloop.coldstart.one" : "elev.closeloop.coldstart.many";
}

export default function ProgressNarrative({
  childName,
  behaviorLogs,
  playLogs,
  noticedMilestones,
  actions,
  rhythmDaysNeeded,
  onOpenEvidence,
}: {
  childName: string;
  behaviorLogs: EvidenceItem[];
  playLogs: EvidenceItem[];
  noticedMilestones: number;
  /** @deprecated NOT RENDERED. Logged-moment count for the PREVIOUS 7-day
   *  window (days 8–14), derived in OverviewTab. It used to feed a
   *  week-vs-week sentence in the "What changed" cell — a COMPARATIVE trend
   *  delta about the CHILD on a child-data parent surface, which the standing
   *  clinical firewall bans (IA masterplan §2; UI masterplan §1: the continuity
   *  surfaces are event language only, never comparative). The prop is retained
   *  only so the existing OverviewTab call site keeps compiling; nothing here
   *  may read it, and ProgressNarrative.firewall.test.ts fails the build if a
   *  prior-window count is ever interpolated into rendered copy again. */
  momentsLastWeek?: number;
  actions: ActionLoopEntry[];
  /** ENG-18: days of logging still needed before predictRhythm can read the
   *  child's daily rhythm (`RhythmPrediction.daysNeeded`). Optional — omit it
   *  and the cold-start line simply does not render. */
  rhythmDaysNeeded?: number;
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
  // Pluralization: each count in changedBody resolves its own .one/.many
  // fragment (the shared convention — cf. elev.sincevisit.row.moment.one/.many)
  // before the composite template stitches them, so "1 activities" can't render
  // in either language. n === 1 is the ONLY singular case; 0 takes .many in both
  // EN and HE.
  const plural = (base: string, n: number) => t(`${base}.${n === 1 ? "one" : "many"}`, { n });
  // AR-UI (2026-08-12) firewall fix: this cell used to close with a week-vs-week
  // sentence ("3 moments this week vs 0 last week"). Two week counts side by
  // side ARE a trend delta, and this cell is titled "What changed for <name>" —
  // the comparison read as the CHILD's progress, which the clinical firewall
  // bans on child-data parent surfaces (counts only; the since-visit strip
  // directly above is scrupulously event-only). The prior-window count is gone;
  // what remains is the PARENT's own capture momentum for the current week,
  // stated as one bare count with no prior window to measure it against.
  const weekCount = t("today.narrative.weekCount", {
    moments: plural("today.narrative.changedBody.moments", recentBehaviors.length),
  });
  const copy = {
    eyebrow: t("today.narrative.eyebrow"), title: t("today.narrative.title", { name: childName }), changed: t("today.narrative.changed"),
    evidence: t("today.narrative.evidence"), next: t("today.narrative.next"), open: t("today.narrative.open"),
    noChange: t("today.narrative.noChange"),
    // RUN-19: the evidence cell's empty state is its OWN line — the "not
    // enough confirmed moments" sentence renders once, in "What changed".
    evidenceEmpty: t("today.narrative.evidenceEmpty"),
    changedBody: t("today.narrative.changedBody", {
      moments: plural("today.narrative.changedBody.moments", recentBehaviors.length),
      plays: plural("today.narrative.changedBody.plays", recentPlay.length),
      milestones: plural("today.narrative.changedBody.milestones", noticedMilestones),
    }),
    nextBody: latestOutcome?.outcome === "not_today" ? t("today.narrative.nextNotToday") : latestOutcome ? t("today.narrative.nextOutcome") : t("today.narrative.nextNone"),
    parentOnly: t("today.narrative.parentOnly"),
  };
  const hasEvidence = evidence.length > 0 || noticedMilestones > 0;
  const coldStartKey = coldStartLineKey(rhythmDaysNeeded);

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
        <NarrativeCell icon="moving" title={copy.changed} body={hasEvidence ? `${copy.changedBody} ${weekCount}` : copy.noChange} />
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
          ))}</ul> : <p className="mt-3 text-[11px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{copy.evidenceEmpty}</p>}
          <button type="button" onClick={() => onOpenEvidence()} className="mt-3 min-h-10 text-xs font-extrabold" style={{ color: "var(--arbor-green-ink)" }}>{copy.open}</button>
        </div>
        <NarrativeCell icon="arrow_forward" title={copy.next} body={copy.nextBody} />
      </div>
      {/* ENG-18 cold-start: what Arbor still needs before it can read the
          daily rhythm. A quiet footer LINE (Rule A: never a sixth module),
          and it disappears the moment the rhythm reads. */}
      {coldStartKey && (
        <p
          data-testid="today-coldstart-line"
          className="mt-4 border-t pt-3 text-[11.5px] leading-relaxed"
          style={{ borderColor: "var(--arbor-rule)", color: "var(--arbor-muted)" }}
        >
          <Icon name="hourglass_top" size={13} className="inline-block align-[-1px] me-1.5" style={{ color: "var(--arbor-clay)" }} />
          {t(coldStartKey, { n: rhythmDaysNeeded ?? 0, name: childName })}
        </p>
      )}
    </section>
  );
}

function NarrativeCell({ icon, title, body }: { icon: string; title: string; body: string }) {
  return <div className="rounded-2xl p-4" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}><div className="flex items-center gap-2"><Icon name={icon} size={17} style={{ color: "var(--arbor-green-ink)" }} /><h3 className="text-xs font-extrabold" style={{ color: "var(--arbor-ink)" }}>{title}</h3></div><p className="mt-3 text-[11px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{body}</p></div>;
}
