import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ClipboardCheck, ShieldCheck, Check, AlertTriangle, RefreshCw, FileText, Search, ArrowRight, CheckCircle2, Eye } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { useToast } from "../../context/ToastContext";
import { PageHeader, SectionCard, cardCls, Chip, IconBadge, TrustSafetyBar } from "../ui/kit";
import { bandForAge, scoreScreening, type ScreenAnswer, type ScreeningResult } from "../../lib/screening";
import { deriveMonitoring, buildMonitoringReportDoc } from "../../lib/monitoring";
import { openPrintableReport } from "../../lib/reportExport";

type SavedScreening = ScreeningResult & { id: string };

const ANSWERS: { key: ScreenAnswer; label: string }[] = [
  { key: "yes", label: "Yes" },
  { key: "sometimes", label: "Sometimes" },
  { key: "not_yet", label: "Not yet" },
];

/** Child Intelligence › Development Check — non-diagnostic, age-banded screener
 *  that surfaces "worth a professional conversation" areas and routes to care. */
export default function Screening() {
  const { childProfile, behaviorLogs, milestones } = useArbor();
  const { toast } = useToast();
  const { t } = useLanguage();
  const first = childProfile.name.split(" ")[0];

  // Passive developmental-monitoring layer (Mission M8): derived from the child's
  // own milestones + behavior logs, surfaced as calm, non-diagnostic watch notes.
  const monitoring = useMemo(
    () => deriveMonitoring({ ageYears: childProfile.age, milestones, behaviorLogs }, first),
    [childProfile.age, milestones, behaviorLogs, first]
  );

  const exportMonitoring = () => {
    const doc = buildMonitoringReportDoc(monitoring, childProfile.name, childProfile.age);
    openPrintableReport(doc, childProfile.name);
    toast("Opening a provider-ready summary to print or save as PDF", "info");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-[920px]">
      <PageHeader
        eyebrow="My Child"
        title={t("sec.screen.title")}
        subtitle={t("sec.screen.sub", { name: first })}
      />

      <TrustSafetyBar note="Arbor is not a medical device and does not diagnose. This is a parent-awareness check — a conversation with a professional never hurts." />

      {/* Passive developmental-monitoring layer — surveillance, never a test or diagnosis. */}
      <SectionCard
        title={t("monitor.title")}
        icon={<Eye className="w-5 h-5" />}
        tone={monitoring.elevated ? "yellow" : "mint"}
        action={
          monitoring.elevated ? (
            <button
              onClick={exportMonitoring}
              className="inline-flex items-center gap-2 font-bold text-xs rounded-xl px-3.5 py-2 bg-white"
              style={{ color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.30)" }}
            >
              <FileText className="w-3.5 h-3.5" /> {t("monitor.export")}
            </button>
          ) : undefined
        }
      >
        <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
          {t("monitor.sub")}
        </p>
        {monitoring.elevated ? (
          <div className="mt-3 space-y-2.5">
            <p className="text-sm font-bold" style={{ color: "var(--arbor-ink)" }}>{monitoring.headline}.</p>
            {monitoring.watchAreas.map((d) => (
              <div key={d.domain} className="rounded-2xl p-3.5" style={{ background: "var(--arbor-yellow-soft)" }}>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5" style={{ color: "var(--arbor-clay-deep)" }} />
                  <span className="text-sm font-bold" style={{ color: "var(--arbor-ink)" }}>{d.label}</span>
                </div>
                <p className="text-[12.5px] mt-1 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{d.note}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
            <Check className="w-3.5 h-3.5" /> {t("monitor.ontrack")}
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

  const allAnswered = band.items.every((it) => answers[it.id]);

  const submit = () => {
    const r = scoreScreening(band.items, answers);
    setResult(r);
    setPhase("result");
    void col.upsert({ ...r, id: `screen-${Date.now()}` });
  };

  const restart = () => { setAnswers({}); setResult(null); setPhase("questions"); };

  // From the sheet, close first then route so the parent lands on the Care surface.
  const routeTo = (tab: "reports" | "find-pro") => { onClose?.(); setActiveTab(tab); };

  return (
    <div className="space-y-4">
      {phase === "intro" && (
        <SectionCard title={`Check for ${first} · ${band.label}`} icon={<ClipboardCheck className="w-5 h-5" />} tone="mint">
          <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
            You'll answer {band.items.length} quick questions about everyday things you can observe. It takes under 4 minutes.
            There's no score and no labels, just whether any area is worth keeping an eye on. Children develop at their own pace.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11.5px] font-bold" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>
            <ShieldCheck className="w-3.5 h-3.5" style={{ color: "var(--arbor-green-ink)" }} />
            Based on widely-used developmental guidance (CDC / AAP-style milestones). Non-diagnostic.
          </div>
          {last && (
            <div className="mt-4 rounded-2xl p-3.5 flex items-center justify-between gap-3" style={{ background: "var(--arbor-paper-deep)" }}>
              <span className="text-xs" style={{ color: "var(--arbor-muted)" }}>
                Last checked {new Date(last.answeredAt).toLocaleDateString()} ·{" "}
                {last.elevated ? `${last.watchAreas.length} area(s) flagged` : "all areas on track"}
              </span>
              <button onClick={() => { setResult(last); setPhase("result"); }} className="text-xs font-bold" style={{ color: "var(--arbor-green-ink)" }}>View last result</button>
            </div>
          )}
          <button
            onClick={() => setPhase("questions")}
            className="mt-4 inline-flex items-center gap-2 text-white font-bold text-sm rounded-2xl px-5 py-3"
            style={{ background: "var(--gradient-cta)" }}
          >
            <ClipboardCheck className="w-4 h-4" /> Start the check
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
                  <p className="text-sm font-semibold" style={{ color: "var(--arbor-ink)" }}>{it.prompt}</p>
                  <div className="flex gap-2 mt-2.5">
                    {ANSWERS.map((a) => {
                      const on = answers[it.id] === a.key;
                      return (
                        <button
                          key={a.key}
                          onClick={() => setAnswers((p) => ({ ...p, [it.id]: a.key }))}
                          className="px-3 py-1.5 rounded-full text-xs font-bold transition"
                          style={on
                            ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.40)" }
                            : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
                        >
                          {a.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 pt-1">
            <button onClick={() => setPhase("intro")} className="text-sm font-bold" style={{ color: "var(--arbor-muted)" }}>Cancel</button>
            <button
              onClick={submit}
              disabled={!allAnswered}
              className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-2xl px-5 py-3 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#3cc081,var(--arbor-clay-deep))" }}
            >
              See result <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {phase === "result" && result && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Headline */}
            <div className="rounded-[22px] p-6" style={{ background: result.elevated ? "var(--arbor-yellow-soft)" : "var(--arbor-green-soft)" }}>
              <div className="flex items-center gap-3">
                <IconBadge tone={result.elevated ? "yellow" : "mint"}>
                  {result.elevated ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                </IconBadge>
                <div>
                  <h3 className="text-lg font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
                    {result.elevated ? "A few areas worth a conversation" : `${first} looks on track across these areas`}
                  </h3>
                  <p className="text-sm mt-0.5" style={{ color: "var(--arbor-muted)" }}>
                    {result.elevated
                      ? "This isn't a diagnosis — it's a prompt to check in with a professional, which never hurts."
                      : "Keep noticing and re-check in a few weeks. Development changes fast."}
                  </p>
                </div>
              </div>
            </div>

            {/* Per-domain breakdown */}
            <div className="grid sm:grid-cols-2 gap-3">
              {result.domains.map((d) => (
                <div key={d.domain} className={`${cardCls} p-4 flex items-center justify-between gap-3`}>
                  <span className="text-sm font-bold" style={{ color: "var(--arbor-ink)" }}>{d.label}</span>
                  {d.status === "watch"
                    ? <Chip tone="yellow" icon={<AlertTriangle className="w-3.5 h-3.5" />}>Worth a conversation</Chip>
                    : <Chip tone="mint" icon={<Check className="w-3.5 h-3.5" />}>On track</Chip>}
                </div>
              ))}
            </div>

            {/* Next steps */}
            <SectionCard title="Your next step" icon={<ShieldCheck className="w-5 h-5" />} tone="sky">
              <div className="flex flex-wrap gap-2">
                {result.elevated && (
                  <>
                    <button onClick={() => { routeTo("reports"); toast("Build a handoff to share this with a professional", "info"); }} className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-2xl px-5 py-3" style={{ background: "linear-gradient(135deg,#3cc081,var(--arbor-clay-deep))" }}>
                      <FileText className="w-4 h-4" /> Prepare a professional summary
                    </button>
                    <button onClick={() => routeTo("find-pro")} className="inline-flex items-center gap-2 font-bold text-sm rounded-2xl px-5 py-3 bg-white" style={{ color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.30)" }}>
                      <Search className="w-4 h-4" /> Find a professional
                    </button>
                  </>
                )}
                <button onClick={() => { toast(`We'll remind you to re-check ${first} in a few weeks`, "success"); }} className="inline-flex items-center gap-2 font-bold text-sm rounded-2xl px-5 py-3" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}>
                  <RefreshCw className="w-4 h-4" /> Remind me to re-check
                </button>
                <button onClick={restart} className="inline-flex items-center gap-2 font-bold text-sm rounded-2xl px-5 py-3" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>
                  Retake
                </button>
              </div>
              <p className="text-[11px] mt-3 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
                If you ever notice a loss of skills your child already had, or you feel something is wrong, contact a professional directly — don't wait for a re-check.
              </p>
            </SectionCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
