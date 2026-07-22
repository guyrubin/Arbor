import React from "react";
import Icon from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import type { ActionLoopEntry } from "../../actionLoop/model";

type EvidenceItem = { id: string; timestamp: string; label: string };

export default function ProgressNarrative({
  childName,
  behaviorLogs,
  playLogs,
  noticedMilestones,
  actions,
  onOpenEvidence,
}: {
  childName: string;
  behaviorLogs: EvidenceItem[];
  playLogs: EvidenceItem[];
  noticedMilestones: number;
  actions: ActionLoopEntry[];
  onOpenEvidence: () => void;
}) {
  const { uiLang } = useLanguage();
  const he = uiLang === "he";
  const weekAgo = Date.now() - 7 * 86_400_000;
  const recentBehaviors = behaviorLogs.filter((item) => new Date(item.timestamp).getTime() >= weekAgo);
  const recentPlay = playLogs.filter((item) => new Date(item.timestamp).getTime() >= weekAgo);
  const latestOutcome = actions.find((item) => item.status === "completed" && item.outcome);
  const evidence = [...recentBehaviors, ...recentPlay]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 3);
  const copy = he ? {
    eyebrow: "התמונה המתפתחת", title: `מה השתנה אצל ${childName}`, changed: "מה השתנה",
    evidence: "הראיות שלכם", next: "מה הלאה", open: "פתיחת המקורות",
    noChange: "עוד אין מספיק רגעים מאושרים כדי לתאר שינוי. רגע אחד אמיתי מספיק כדי להתחיל.",
    changedBody: `${recentBehaviors.length} רגעים ו-${recentPlay.length} פעילויות נשמרו השבוע. ${noticedMilestones} אבני דרך סומנו עד כה.`,
    nextBody: latestOutcome?.outcome === "not_today" ? "הצעד האחרון לא התאים היום. Arbor תציע בפעם הבאה גרסה קלה או אחרת." : latestOutcome ? "התוצאה האחרונה תעזור ל-Arbor לדייק את הצעד הבא." : "בחרו צעד אחד קטן ודווחו מה קרה כדי שההמלצה הבאה תהיה מדויקת יותר.",
    parentOnly: "מבוסס רק על מה שתיעדתם — ללא ציון, אחוזון או אבחנה.",
  } : {
    eyebrow: "The developing picture", title: `What changed for ${childName}`, changed: "What changed",
    evidence: "Your evidence", next: "What comes next", open: "Open source moments",
    noChange: "There are not enough confirmed moments to describe change yet. One real moment is enough to begin.",
    changedBody: `${recentBehaviors.length} moments and ${recentPlay.length} activities were saved this week. ${noticedMilestones} milestones have been noticed so far.`,
    nextBody: latestOutcome?.outcome === "not_today" ? "The last step did not fit today. Arbor will offer a smaller or different version next time." : latestOutcome ? "Your latest outcome will help Arbor shape the next step." : "Choose one small step and report what happened so the next recommendation can become more precise.",
    parentOnly: "Based only on what you recorded — never a score, percentile, or diagnosis.",
  };
  const hasEvidence = evidence.length > 0 || noticedMilestones > 0;

  return (
    <section className="rounded-[20px] bg-white p-5 sm:p-6" style={{ border: "1px solid var(--arbor-rule)", boxShadow: "var(--shadow-xs)" }} aria-labelledby="progress-narrative-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--arbor-green-ink)" }}>{copy.eyebrow}</p>
          <h2 id="progress-narrative-title" className="mt-1 text-xl font-bold" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)" }}>{copy.title}</h2>
          <p className="mt-1 text-[11px]" style={{ color: "var(--arbor-muted)" }}>{copy.parentOnly}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}><Icon name="timeline" size={19} /></span>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <NarrativeCell icon="moving" title={copy.changed} body={hasEvidence ? copy.changedBody : copy.noChange} />
        <div className="rounded-2xl p-4" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}>
          <div className="flex items-center gap-2"><Icon name="fact_check" size={17} style={{ color: "var(--arbor-green-ink)" }} /><h3 className="text-xs font-extrabold" style={{ color: "var(--arbor-ink)" }}>{copy.evidence}</h3></div>
          {evidence.length ? <ul className="mt-3 space-y-2">{evidence.map((item) => <li key={item.id} className="line-clamp-2 text-[11px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{item.label}</li>)}</ul> : <p className="mt-3 text-[11px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{copy.noChange}</p>}
          <button type="button" onClick={onOpenEvidence} className="mt-3 min-h-10 text-xs font-extrabold" style={{ color: "var(--arbor-green-ink)" }}>{copy.open}</button>
        </div>
        <NarrativeCell icon="arrow_forward" title={copy.next} body={copy.nextBody} />
      </div>
    </section>
  );
}

function NarrativeCell({ icon, title, body }: { icon: string; title: string; body: string }) {
  return <div className="rounded-2xl p-4" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}><div className="flex items-center gap-2"><Icon name={icon} size={17} style={{ color: "var(--arbor-green-ink)" }} /><h3 className="text-xs font-extrabold" style={{ color: "var(--arbor-ink)" }}>{title}</h3></div><p className="mt-3 text-[11px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{body}</p></div>;
}
