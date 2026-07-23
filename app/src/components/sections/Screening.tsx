import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { useToast } from "../../context/ToastContext";
import { PageHeader, SectionCard, cardCls, Chip, IconBadge, TrustSafetyBar } from "../ui/kit";
import { bandForAge, scoreScreening, type ScreenAnswer, type ScreeningResult } from "../../lib/screening";
import { computeRecheckDueAt, isRecheckDue } from "../../lib/screeningRecheck";
import { buildMonitoringReportDoc, type DomainSignal } from "../../lib/monitoring";
import { useMonitoring } from "../../hooks/useMonitoring";
import { openPrintableReport } from "../../lib/reportExport";

type SavedScreening = ScreeningResult & { id: string; recheckDueAt?: string };

// UND-1 — answer labels resolve through i18n ("screen.answer.<key>").
const ANSWERS: ScreenAnswer[] = ["yes", "sometimes", "not_yet"];

/** Child Intelligence › Development Check — non-diagnostic, age-banded screener
 *  that surfaces "worth a professional conversation" areas and routes to care. */
export default function Screening() {
  const { childProfile, behaviorLogs, milestones } = useArbor();
  const { toast } = useToast();
  const { t } = useLanguage();
  const first = childProfile.name.split(" ")[0];

  // Passive developmental-monitoring layer (Mission M8): derived from the child's
  // own milestones + behavior logs, surfaced as calm, non-diagnostic watch notes.
  // The ONE shared derivation (hooks/useMonitoring) — this surface previously
  // passed the coarse childProfile.age while the noticed card and the bell fed a
  // months-precise age, so the same child could get different watch answers.
  const monitoring = useMonitoring();

  const exportMonitoring = () => {
    // The builder is clinician-ceiling-bound (IA W4.5) and fail-closed: a
    // blocked doc exports NOTHING.
    try {
      const doc = buildMonitoringReportDoc(monitoring, childProfile.name, childProfile.age);
      openPrintableReport(doc, childProfile.name);
      toast(t("screen.monitor.exportOpen"), "info");
    } catch {
      toast(t("screen.monitor.exportBlocked"), "error");
    }
  };

  // UND-1 — the parent-facing watch note renders through i18n templates built
  // from the signal's structured facts (counts + domain), mirroring
  // monitoring.ts buildNote(). monitoring.ts itself stays a pure EN-source
  // module feeding the clinician printable. Counts only — never a verdict.
  const watchNote = (d: DomainSignal): string => {
    const area = t(`screen.domain.${d.domain}`).toLowerCase();
    const parts: string[] = [];
    if (d.reasons.includes("milestone_overdue")) {
      parts.push(
        d.overdueMilestones.length === 1
          ? t("screen.monitor.note.milestone.one", { area, name: first })
          : t("screen.monitor.note.milestone.many", { n: d.overdueMilestones.length, area, name: first }),
      );
    }
    if (d.reasons.includes("behavior_pattern")) {
      parts.push(t("screen.monitor.note.pattern", { n: d.patternMoments, area }));
    }
    parts.push(t("screen.monitor.note.close"));
    return parts.join(" ");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-[920px]">
      <PageHeader
        eyebrow={t("screen.eyebrow")}
        title={t("sec.screen.title")}
        subtitle={t("sec.screen.sub", { name: first })}
      />

      <TrustSafetyBar note={t("screen.trustNote")} />

      {/* Passive developmental-monitoring layer — surveillance, never a test or diagnosis. */}
      <SectionCard
        title={t("monitor.title")}
        icon={<Icon name="visibility" size={20} />}
        tone={monitoring.elevated ? "yellow" : "mint"}
        action={
          monitoring.elevated ? (
            <button
              onClick={exportMonitoring}
              className="inline-flex items-center gap-2 font-bold text-xs rounded-xl px-3.5 py-2 bg-white"
              style={{ color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.30)" }}
            >
              <Icon name="description" size={14} /> {t("monitor.export")}
            </button>
          ) : undefined
        }
      >
        <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
          {t("monitor.sub")}
        </p>
        {monitoring.elevated ? (
          <div className="mt-3 space-y-2.5">
            <p className="text-sm font-bold" style={{ color: "var(--arbor-ink)" }}>
              {monitoring.watchAreas.length === 1
                ? t("screen.monitor.headline.one")
                : t("screen.monitor.headline.many", { n: monitoring.watchAreas.length })}.
            </p>
            {monitoring.watchAreas.map((d) => (
              <div key={d.domain} className="rounded-2xl p-3.5" style={{ background: "var(--arbor-yellow-soft)" }}>
                <div className="flex items-center gap-2">
                  <Icon name="warning" size={14} style={{ color: "var(--arbor-clay-deep)" }} />
                  <span className="text-sm font-bold" style={{ color: "var(--arbor-ink)" }}>{t(`screen.domain.${d.domain}`)}</span>
                </div>
                <p className="text-[12.5px] mt-1 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{watchNote(d)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
            <Icon name="check" size={14} /> {t("monitor.calm")}
          </div>
        )}
      </SectionCard>

      <ScreeningFlow />
    </motion.div>
  );
}

/** The screener phase machine (intro → questions → result), extracted so it can
 *  run as a full page OR inside an inline sheet (b2 My Child story spine). The
 *  optional `onClose` lets the sheet dismiss itself before routing to Care. */
export function ScreeningFlow({ onClose }: { onClose?: () => void }) {
  const { childProfile, setActiveTab } = useArbor();
  const { toast } = useToast();
  const { t } = useLanguage();
  const first = childProfile.name.split(" ")[0];
  const band = useMemo(() => bandForAge(childProfile.age), [childProfile.age]);

  const col = useChildCollection<SavedScreening>(childProfile.id, "screenings");
  const last = useMemo(
    () => [...col.items].sort((a, b) => (a.answeredAt < b.answeredAt ? 1 : -1))[0],
    [col.items]
  );

  const [phase, setPhase] = useState<"intro" | "questions" | "result">("intro");
  const [answers, setAnswers] = useState<Record<string, ScreenAnswer>>({});
  const [result, setResult] = useState<ScreeningResult | null>(null);
  // Id of the saved screening record the result screen is showing — the
  // re-check reminder is written onto THIS record (UND-2: no fake done-state).
  const [activeId, setActiveId] = useState<string | null>(null);

  const allAnswered = band.items.every((it) => answers[it.id]);

  const submit = () => {
    const r = scoreScreening(band.items, answers);
    setResult(r);
    setPhase("result");
    const id = `screen-${Date.now()}`;
    setActiveId(id);
    void col.upsert({ ...r, id });
  };

  // Live view of the active saved record (sandbox state / Firestore snapshot),
  // so the reminder button reflects a persisted — not merely toasted — due date.
  const activeSaved = useMemo(() => col.items.find((s) => s.id === activeId), [col.items, activeId]);
  const reminderDueAt = activeSaved?.recheckDueAt;

  // UND-2 — persist recheckDueAt (answeredAt + ~3 weeks) on the SAVED screening
  // record via the existing screenings upsert seam. No push channel is
  // registered here, so the toast claims only what happens: an in-app flag.
  const remind = () => {
    if (!activeId) return;
    const base = activeSaved ?? (result ? { ...result, id: activeId } : null);
    if (!base) return;
    void col.upsert({ ...base, recheckDueAt: computeRecheckDueAt(base.answeredAt) });
    toast(t("screen.recheck.toast"), "success");
  };

  const restart = () => { setAnswers({}); setResult(null); setPhase("questions"); };

  // From the sheet, close first then route so the parent lands on the Care surface.
  const routeTo = (tab: "reports" | "find-pro") => { onClose?.(); setActiveTab(tab); };

  return (
    <div className="space-y-4">
      {phase === "intro" && (
        <SectionCard title={t("screen.introTitle", { name: first, band: t(`screen.band.${band.id}`) })} icon={<Icon name="fact_check" size={20} />} tone="mint">
          <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
            {t("screen.intro.body", { n: band.items.length })}
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11.5px] font-bold" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>
            <Icon name="verified_user" size={14} style={{ color: "var(--arbor-green-ink)" }} />
            {t("screen.intro.basis")}
          </div>
          {last && (
            <div className="mt-4 rounded-2xl p-3.5 space-y-2" style={{ background: "var(--arbor-paper-deep)" }}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs" style={{ color: "var(--arbor-muted)" }}>
                  {t("screen.last.line", {
                    date: new Date(last.answeredAt).toLocaleDateString(),
                    status: last.elevated ? t("screen.last.flagged", { n: last.watchAreas.length }) : t("screen.last.calm"),
                  })}
                </span>
                <button onClick={() => { setActiveId(last.id); setResult(last); setPhase("result"); }} className="text-xs font-bold" style={{ color: "var(--arbor-green-ink)" }}>{t("screen.viewLast")}</button>
              </div>
              {/* UND-2 — the parent-requested re-check is a real, inspectable fact. */}
              {last.recheckDueAt && (
                <span
                  data-testid="screen-recheck-due"
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-bold"
                  style={isRecheckDue(last.recheckDueAt)
                    ? { background: "var(--arbor-yellow-soft)", color: "var(--arbor-ink)" }
                    : { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
                >
                  <Icon name="notifications" size={14} />
                  {isRecheckDue(last.recheckDueAt)
                    ? t("screen.recheck.dueNow")
                    : t("screen.recheck.dueOn", { date: new Date(last.recheckDueAt).toLocaleDateString() })}
                </span>
              )}
            </div>
          )}
          <button
            onClick={() => setPhase("questions")}
            className="mt-4 inline-flex items-center gap-2 text-white font-bold text-sm rounded-2xl px-5 py-3"
            style={{ background: "var(--arbor-gradient-primary)" }}
          >
            <Icon name="fact_check" size={16} /> {t("screen.start")}
          </button>
        </SectionCard>
      )}

      {phase === "questions" && (
        <div className="space-y-3">
          {band.items.map((it, idx) => (
            <div key={it.id} className={`${cardCls} p-4`}>
              <div className="flex items-start gap-3">
                <span className="text-[11px] font-extrabold mt-0.5" style={{ color: "var(--arbor-muted)" }}>{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--arbor-ink)" }}>{t(`screen.item.${it.id}`)}</p>
                  <div className="flex gap-2 mt-2.5">
                    {ANSWERS.map((a) => {
                      const on = answers[it.id] === a;
                      return (
                        <button
                          key={a}
                          onClick={() => setAnswers((p) => ({ ...p, [it.id]: a }))}
                          className="px-3 py-1.5 rounded-full text-xs font-bold transition"
                          style={on
                            ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.40)" }
                            : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
                        >
                          {t(`screen.answer.${a}`)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 pt-1">
            <button onClick={() => setPhase("intro")} className="text-sm font-bold" style={{ color: "var(--arbor-muted)" }}>{t("screen.cancel")}</button>
            <button
              onClick={submit}
              disabled={!allAnswered}
              className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-2xl px-5 py-3 disabled:opacity-50"
              style={{ background: "var(--arbor-gradient-primary)" }}
            >
              {t("screen.seeResult")} <Icon name="arrow_forward" size={16} />
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {phase === "result" && result && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Headline */}
            <div className="rounded-[22px] p-6" style={{ background: result.elevated ? "var(--arbor-yellow-soft)" : "var(--arbor-green-soft)" }}>
              <div className="flex items-center gap-3">
                <IconBadge tone={result.elevated ? "yellow" : "mint"}>
                  {result.elevated ? <Icon name="warning" size={20} /> : <Icon name="check_circle" size={20} />}
                </IconBadge>
                <div>
                  {/* UND-1 firewall condition: the calm headline is observational
                      ("nothing stands out"), never an "on track" verdict. */}
                  <h3 className="text-lg font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
                    {result.elevated ? t("screen.result.title.watch") : t("screen.result.title.calm", { name: first })}
                  </h3>
                  <p className="text-sm mt-0.5" style={{ color: "var(--arbor-muted)" }}>
                    {result.elevated ? t("screen.result.body.watch") : t("screen.result.body.calm")}
                  </p>
                </div>
              </div>
            </div>

            {/* Per-domain breakdown */}
            <div className="grid sm:grid-cols-2 gap-3">
              {result.domains.map((d) => (
                <div key={d.domain} className={`${cardCls} p-4 flex items-center justify-between gap-3`}>
                  <span className="text-sm font-bold" style={{ color: "var(--arbor-ink)" }}>{t(`screen.domain.${d.domain}`)}</span>
                  {d.status === "watch"
                    ? <Chip tone="yellow" icon={<Icon name="warning" size={14} />}>{t("screen.chip.watch")}</Chip>
                    : <Chip tone="mint" icon={<Icon name="check" size={14} />}>{t("screen.chip.calm")}</Chip>}
                </div>
              ))}
            </div>

            {/* Next steps */}
            <SectionCard title={t("screen.next.title")} icon={<Icon name="verified_user" size={20} />} tone="sky">
              <div className="flex flex-wrap gap-2">
                {result.elevated && (
                  <>
                    <button onClick={() => { routeTo("reports"); toast(t("screen.toast.handoff"), "info"); }} className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-2xl px-5 py-3" style={{ background: "var(--arbor-gradient-primary)" }}>
                      <Icon name="description" size={16} /> {t("screen.next.summary")}
                    </button>
                    <button onClick={() => routeTo("find-pro")} className="inline-flex items-center gap-2 font-bold text-sm rounded-2xl px-5 py-3 bg-white" style={{ color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.30)" }}>
                      <Icon name="search" size={16} /> {t("screen.next.findPro")}
                    </button>
                  </>
                )}
                <button
                  onClick={remind}
                  disabled={!!reminderDueAt}
                  aria-pressed={!!reminderDueAt}
                  data-testid="screen-recheck-btn"
                  className="inline-flex items-center gap-2 font-bold text-sm rounded-2xl px-5 py-3 disabled:opacity-70"
                  style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}
                >
                  <Icon name={reminderDueAt ? "check" : "notifications"} size={16} />
                  {reminderDueAt
                    ? t("screen.recheck.dueOn", { date: new Date(reminderDueAt).toLocaleDateString() })
                    : t("screen.recheck.btn")}
                </button>
                <button onClick={restart} className="inline-flex items-center gap-2 font-bold text-sm rounded-2xl px-5 py-3" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>
                  {t("screen.next.retake")}
                </button>
              </div>
              <p className="text-[11px] mt-3 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
                {t("screen.safetyNote")}
              </p>
            </SectionCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
