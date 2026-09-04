import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { useToast } from "../../context/ToastContext";
import { PageHeader, SectionCard, cardCls, Chip, IconBadge, TrustSafetyBar } from "../ui/kit";
import { bandForAgeMonths, scoreScreening, type ScreenAnswer, type ScreeningResult } from "../../lib/screening";
import { comparisonAgeMonths, correctedAge } from "../../lib/milestoneData";
import { ageLabel, ageMonthsFromProfile } from "../../lib/childAge";
import { computeRecheckDueAt, isRecheckDue } from "../../lib/screeningRecheck";
import { buildMonitoringReportDoc, type DomainSignal } from "../../lib/monitoring";
import { useMonitoring } from "../../hooks/useMonitoring";
import { openPrintableReport } from "../../lib/reportExport";
import { en as screenCalmEn, he as screenCalmHe } from "../../lib/i18nElevation/screeningcalm";
import { fmtDay } from "../../lib/formatDate";
// GP-11 / GP-34 — answers survive a refresh; an uncertain answer becomes
// something the parent can actually watch for this week.
import { clearScreeningDraft, readScreeningDraft, writeScreeningDraft } from "../../lib/screeningDraft";
import { watchOffersForScreening, writeWatchFocus } from "../../lib/screeningWatch";
import { tGCare } from "../../lib/growthCareText";

/** W0.3 — module-local string resolution for the calm-result reframe.
 *  i18nElevation/index.ts registration is that file's own recipe (one line per
 *  module, owned separately); resolving directly here keeps this workstream
 *  inside the files it owns while mirroring i18n.ts {var} interpolation. */
function tCalm(uiLang: string, key: string, vars?: Record<string, string | number>): string {
  let s = (uiLang === "he" ? screenCalmHe[key] : undefined) ?? screenCalmEn[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

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
      // GP-01: the printable carries the months-precise label ("7 months"),
      // never the legacy whole-years number ("age 0"). English on purpose —
      // the doc is the clinician-facing export.
      const doc = buildMonitoringReportDoc(monitoring, childProfile.name, ageLabel(childProfile));
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
        // W0.3 clinical firewall — ONE card tone regardless of outcome; the
        // old outcome-flipped amber/green tone was verdict coloring in disguise.
        tone="mint"
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
            {/* W0.3 — neutral surface + observational eye icon: the amber wash
                and warning triangle were traffic-light semantics. */}
            {monitoring.watchAreas.map((d) => (
              <div key={d.domain} className="rounded-2xl p-3.5" style={{ background: "var(--arbor-paper-deep)" }}>
                <div className="flex items-center gap-2">
                  <Icon name="visibility" size={14} style={{ color: "var(--arbor-muted)" }} />
                  <span className="text-sm font-bold" style={{ color: "var(--arbor-ink)" }}>{t(`screen.domain.${d.domain}`)}</span>
                </div>
                <p className="text-[12.5px] mt-1 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{watchNote(d)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>
            <Icon name="visibility" size={14} /> {t("monitor.calm")}
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
  const { childProfile, milestones, setActiveTab } = useArbor();
  const { toast } = useToast();
  const { t, uiLang } = useLanguage();
  const first = childProfile.name.split(" ")[0];

  // UND-5 — months-precise, corrected-age band selection: the SAME corrected
  // comparison age the Milestones map uses (B0 spine + AAP preterm correction),
  // so a preemie is never screened against the uncorrected band one click away
  // from the corrected milestone view. Term children: comparisonAgeMonths is
  // the chronological months, so band selection is unchanged.
  const chronoMonths = ageMonthsFromProfile(childProfile) ?? Math.round((childProfile.age || 0) * 12);
  const gestationalWeeks = childProfile.preterm?.gestationalWeeks;
  const corrected = correctedAge(chronoMonths, gestationalWeeks);
  const comparisonMonths = comparisonAgeMonths(chronoMonths, gestationalWeeks);
  const band = useMemo(() => bandForAgeMonths(comparisonMonths), [comparisonMonths]);

  const col = useChildCollection<SavedScreening>(childProfile.id, "screenings");
  const last = useMemo(
    () => [...col.items].sort((a, b) => (a.answeredAt < b.answeredAt ? 1 : -1))[0],
    [col.items]
  );

  // GP-11 — the questions phase is restored from sessionStorage on mount, so a
  // phone call mid-check no longer costs the parent every answer. Keyed by
  // child + band; unknown ids and values are dropped on read. A restored draft
  // also lands the parent back ON the questions — showing the intro again,
  // silently pre-filled, would read as if the answers were lost.
  const itemIds = useMemo(() => band.items.map((it) => it.id), [band]);
  const initialDraft = useMemo(
    () => readScreeningDraft(childProfile.id, band.id, itemIds) ?? {},
    // Read ONCE per mount; later reads go through the child/band effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [phase, setPhase] = useState<"intro" | "questions" | "result">(
    Object.keys(initialDraft).length > 0 ? "questions" : "intro",
  );
  const [answers, setAnswers] = useState<Record<string, ScreenAnswer>>(initialDraft);
  const [restored, setRestored] = useState(Object.keys(initialDraft).length > 0);
  const [result, setResult] = useState<ScreeningResult | null>(null);
  // GP-34 — the milestone the parent chose to watch for after this check.
  const [watchingId, setWatchingId] = useState<string | null>(null);

  // Which child+band the CURRENT `answers` belong to. It is state, not a ref,
  // so it is set in the same batch as `answers` and the two can never disagree.
  //
  // Without it these two effects leaked answers ACROSS SIBLINGS: passive effects
  // run in declaration order, so on a child switch the persist effect fired in a
  // render where `childProfile.id` was already the NEW child while `answers` was
  // still the previous child's — writing sibling A's answers under sibling B's
  // key. Same-band siblings (twins, or two children in one age band) then had
  // the item ids match, nothing filtered, and B's Development Check opened
  // pre-filled with A's answers, labelled as B's and submittable as B's record.
  const [answersFor, setAnswersFor] = useState(`${childProfile.id}|${band.id}`);

  useEffect(() => {
    const draft = readScreeningDraft(childProfile.id, band.id, itemIds);
    setAnswers(draft ?? {});
    setAnswersFor(`${childProfile.id}|${band.id}`);
    setRestored(Object.keys(draft ?? {}).length > 0);
    // A switch also has to drop the previous child's in-flight screen: an open
    // result, the record it was written onto, and any watch choice.
    setPhase("intro");
    setResult(null);
    setActiveId(null);
    setWatchingId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childProfile.id, band.id]);

  useEffect(() => {
    // Stale answers (still the previous child's) are never persisted.
    if (answersFor !== `${childProfile.id}|${band.id}`) return;
    writeScreeningDraft(childProfile.id, band.id, answers);
  }, [childProfile.id, band.id, answers, answersFor]);
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
    // The answers are now a saved record; the draft has done its job.
    clearScreeningDraft(childProfile.id, band.id);
    setRestored(false);
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

  const restart = () => {
    setAnswers({});
    setRestored(false);
    clearScreeningDraft(childProfile.id, band.id);
    setResult(null);
    setWatchingId(null);
    setPhase("questions");
  };

  // GP-34 — carry ONE uncertain answer forward as this week's thing to watch
  // for, and book the re-check in the same tap. The offers are derived from
  // the answers the parent just gave (never from a score): "sometimes"/"not
  // yet" items mapped to an open milestone in the SAME domain inside the
  // child's corrected age window.
  const watchOffers = useMemo(
    () => (result ? watchOffersForScreening(band.items, answers, milestones, comparisonMonths).slice(0, 3) : []),
    [result, band.items, answers, milestones, comparisonMonths],
  );
  const chooseWatch = (milestoneId: string, screenItemId: string) => {
    writeWatchFocus(childProfile.id, { milestoneId, screenItemId, chosenAt: new Date().toISOString() });
    setWatchingId(milestoneId);
    if (!reminderDueAt) remind();
  };

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
          {/* UND-5 — corrected-age treatment is visible, not silent: badge (same
              pattern as the Milestones map) + one observational intro sentence. */}
          {corrected.applied && (
            <div className="mt-3 space-y-1.5" data-testid="screen-corrected-intro">
              <span className="inline-block text-[11px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ color: "var(--arbor-green-ink)", background: "var(--arbor-green-soft)" }}>
                {t("ms.correctedBadge")} · {corrected.correctedMonths}m
              </span>
              <p className="text-[12px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
                {t("screen.intro.corrected", { name: first, months: Math.round(corrected.correctedMonths) })}
              </p>
            </div>
          )}
          {last && (
            <div className="mt-4 rounded-2xl p-3.5 space-y-2" style={{ background: "var(--arbor-paper-deep)" }}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs" style={{ color: "var(--arbor-muted)" }}>
                  {t("screen.last.line", {
                    date: fmtDay(last.answeredAt, uiLang),
                    // GP-11 — the calm reframe reworded the RESULT screen but
                    // left "flagged" on the line above it. One register.
                    status: last.elevated
                      ? (last.watchAreas.length === 1
                        ? tGCare(uiLang, "elev.gcare.screen.last.worth.one")
                        : tGCare(uiLang, "elev.gcare.screen.last.worth.many", { n: last.watchAreas.length }))
                      : t("screen.last.calm"),
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
                    : t("screen.recheck.dueOn", { date: fmtDay(last.recheckDueAt, uiLang) })}
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
          {/* GP-11 — say that the answers came back; a silently pre-filled form
              reads as a bug. The escape hatch is right next to it. */}
          {restored && (
            <div
              data-testid="screen-draft-restored"
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3"
              style={{ background: "var(--arbor-paper-deep)" }}
            >
              <span className="text-xs" style={{ color: "var(--arbor-muted)" }}>
                {tGCare(uiLang, "elev.gcare.screen.draft.restored")}
              </span>
              <button
                type="button"
                onClick={() => { setAnswers({}); setRestored(false); clearScreeningDraft(childProfile.id, band.id); }}
                className="inline-flex min-h-11 items-center text-xs font-bold"
                style={{ color: "var(--arbor-green-ink)" }}
              >
                {tGCare(uiLang, "elev.gcare.screen.draft.clear")}
              </button>
            </div>
          )}
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
                          // GP-12 — 44px. These chips were ~30px tall and are
                          // the surface's primary move on a 390px phone; a
                          // mis-tap between "Not sure" and "Not yet" changes
                          // what monitoring counts as an answer.
                          className="min-h-11 px-4 rounded-full text-xs font-bold transition"
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
            {/* Headline — W0.3 clinical firewall: ONE neutral card regardless of
                outcome. UND-1 removed the verdict WORDS; this removes the verdict
                COLOR mechanism (the amber-vs-green wash + badge flip). The
                headline reports a count, observationally — which is what the
                safetyNote below has promised all along. */}
            <div className="rounded-[22px] p-6" style={{ background: "var(--arbor-paper-deep)" }}>
              <div className="flex items-center gap-3">
                <IconBadge tone="lav">
                  <Icon name="fact_check" size={20} />
                </IconBadge>
                <div>
                  <h3 className="text-lg font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
                    {result.watchAreas.length === 0
                      ? tCalm(uiLang, "elev.screencalm.title.none", { total: result.domains.length })
                      : result.watchAreas.length === 1
                        ? tCalm(uiLang, "elev.screencalm.title.one")
                        : tCalm(uiLang, "elev.screencalm.title.many", { n: result.watchAreas.length })}
                  </h3>
                  <p className="text-sm mt-0.5" style={{ color: "var(--arbor-muted)" }}>
                    {result.watchAreas.length > 0
                      ? tCalm(uiLang, "elev.screencalm.body.some")
                      : tCalm(uiLang, "elev.screencalm.body.none")}
                  </p>
                </div>
              </div>
            </div>

            {/* Per-domain breakdown — same neutral marker tone for EVERY domain;
                the row wording routes ("worth a conversation" / "reviewed"),
                it never grades. */}
            <div className="grid sm:grid-cols-2 gap-3">
              {result.domains.map((d) => (
                <div key={d.domain} className={`${cardCls} p-4 flex items-center justify-between gap-3`}>
                  <span className="text-sm font-bold" style={{ color: "var(--arbor-ink)" }}>{t(`screen.domain.${d.domain}`)}</span>
                  <Chip tone="lav">
                    {tCalm(uiLang, d.status === "watch" ? "elev.screencalm.row.discuss" : "elev.screencalm.row.reviewed")}
                  </Chip>
                </div>
              ))}
            </div>

            {/* GP-34 — close the loop. Every "sometimes"/"not yet" answer that
                maps to an open milestone in the SAME domain and the child's own
                age window becomes one concrete thing to watch for this week.
                Choosing one writes the Development hub's focus and books the
                re-check in the same tap. Observational language only; the offer
                exists whether or not the check came back calm. */}
            {watchOffers.length > 0 && (
              <SectionCard title={tGCare(uiLang, "elev.gcare.screen.watch.title")} icon={<Icon name="visibility" size={20} />} tone="mint">
                <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
                  {tGCare(uiLang, "elev.gcare.screen.watch.body")}
                </p>
                <ul className="mt-3 space-y-2" data-testid="screen-watch-offers">
                  {watchOffers.map(({ item, milestone }) => {
                    const chosen = watchingId === milestone.id;
                    return (
                      <li key={item.id} className={`${cardCls} flex flex-wrap items-center justify-between gap-3 p-3.5`}>
                        <span className="min-w-0 flex-1">
                          <span className="block break-words text-sm font-bold" style={{ color: "var(--arbor-ink)" }}>{milestone.title}</span>
                          <span className="mt-0.5 block break-words text-xs leading-snug" style={{ color: "var(--arbor-muted)" }}>{t(`screen.domain.${item.domain}`)}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => chooseWatch(milestone.id, item.id)}
                          disabled={chosen}
                          aria-pressed={chosen}
                          data-testid="screen-watch-cta"
                          className="inline-flex min-h-11 flex-shrink-0 items-center gap-2 rounded-2xl px-4 text-sm font-bold disabled:opacity-70"
                          style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}
                        >
                          <Icon name={chosen ? "check" : "visibility"} size={16} />
                          {chosen
                            ? tGCare(uiLang, "elev.gcare.screen.watch.chosen")
                            : tGCare(uiLang, "elev.gcare.screen.watch.cta")}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </SectionCard>
            )}

            {/* GP-11 — a calm result used to dead-end: "nothing asks for action"
                and then only "remind me" / "Retake". Most checks come back calm,
                so that was the common case with nowhere to go. The offered next
                move is the ordinary one — play together, or open the record. */}
            {!result.elevated && (
              <SectionCard title={tGCare(uiLang, "elev.gcare.screen.calm.title")} icon={<Icon name="wb_sunny" size={20} />} tone="mint">
                <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
                  {tGCare(uiLang, "elev.gcare.screen.calm.body")}
                </p>
                <div className="mt-3 flex flex-wrap gap-2" data-testid="screen-calm-next">
                  <button
                    onClick={() => { onClose?.(); setActiveTab("daily-play"); }}
                    className="inline-flex min-h-11 items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-white"
                    style={{ background: "var(--arbor-gradient-primary)" }}
                  >
                    <Icon name="toys" size={16} /> {tGCare(uiLang, "elev.gcare.screen.calm.play")}
                  </button>
                  <button
                    onClick={() => { onClose?.(); setActiveTab("milestones"); }}
                    className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold"
                    style={{ color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.30)" }}
                  >
                    <Icon name="edit_note" size={16} /> {tGCare(uiLang, "elev.gcare.screen.calm.record")}
                  </button>
                </div>
              </SectionCard>
            )}

            {/* Next steps */}
            <SectionCard title={t("screen.next.title")} icon={<Icon name="verified_user" size={20} />} tone="sky">
              <div className="flex flex-wrap gap-2">
                {result.elevated && (
                  <>
                    <button onClick={() => { routeTo("reports"); toast(t("screen.toast.handoff"), "info"); }} className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-2xl px-5 py-3" style={{ background: "var(--arbor-gradient-primary)" }}>
                      <Icon name="description" size={16} /> {t("screen.next.summary")}
                    </button>
                    <button onClick={() => routeTo("find-pro")} className="inline-flex items-center gap-2 font-bold text-sm rounded-2xl px-5 py-3 bg-white" style={{ color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-green-ink)" }}>
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
                    ? t("screen.recheck.dueOn", { date: fmtDay(reminderDueAt, uiLang) })
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
