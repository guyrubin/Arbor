import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { useToast } from "../../context/ToastContext";
import { PageHeader, SectionCard, cardCls, TrustSafetyBar } from "../ui/kit";
import { AGE_BANDS, bandForAgeMonths, scoreScreening, type ScreenAnswer, type ScreeningResult } from "../../lib/screening";
import { domainLabel } from "../../lib/domains/registry";
import { comparisonAgeMonths, correctedAge } from "../../lib/milestoneData";
import { ageLabel } from "../../lib/childAge";
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
import { ageMonthsOf, ageYearsOf } from "../../lib/age/forChild";

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

/* B-OCCL-03 (6 Oct): the route's ONE data-primary-move literal, spread on the
   control that performs the move — "Start the check" on the intro, "See the
   result" on the questions — never on the module wrapper (353 px at 375 EN,
   it ran under the capture dock). The page renders ScreeningFlow `stamped`;
   the inline sheet (ScreeningSheet) does not, so its host route keeps its own.
   The spread is this static const or undefined — whiteLabelContrast resolves
   it as a data attribute and can still prove the button's fill. */
const CHECK_STAMP = { "data-primary-move": "complete-check" } as const;

/** Child Intelligence › Development Check — non-diagnostic, age-banded screener
 *  that surfaces "worth a professional conversation" areas and routes to care. */
export default function Screening() {
  const { childProfile, behaviorLogs, milestones } = useArbor();
  const { toast } = useToast();
  const { t, uiLang } = useLanguage();
  const first = childProfile.name.split(" ")[0];

  // Passive developmental-monitoring layer (Mission M8): derived from the child's
  // own milestones + behavior logs, surfaced as calm, non-diagnostic watch notes.
  // The ONE shared derivation (hooks/useMonitoring) — this surface previously
  // passed the coarse ageYearsOf(childProfile) while the noticed card and the bell fed a
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
    const area = domainLabel("screen", d.domain, t).toLowerCase();
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
      {/* B-OCCL-03: flush — the page's space-y-6 is the gap; mb-7 stacked on
          it pushed the check down 28 px at 375. */}
      <PageHeader
        flush
        eyebrow={t("screen.eyebrow")}
        title={t("sec.screen.title")}
        subtitle={t("sec.screen.sub", { name: first })}
      />

      {/* Item 11 (IA-02): the surface contract reaches the DOM. `data-module`
          marks a top-level sibling module (what moduleBudget counts);
          `data-primary-move` marks the ONE control that performs the move
          surfaceContract.ts declares for this route — B-OCCL-03: the flow's
          start / submit button (ScreeningFlow stamped), not this wrapper. */}
      {/* B-GROWTH-18: the check comes FIRST — "Start the check" was below the
          fold at 390 px under the monitoring card. The monitoring card is the
          second module, unchanged. */}
      <div data-module="screening-check" style={{ display: "contents" }}>
        <ScreeningFlow stamped />
      </div>

      {/* B-OCCL-03: the non-diagnostic note sits UNDER the check (it stood
          between the header and the check, ~150 px at 375, and pushed "Start
          the check" under the capture dock). The intro still says "no score
          and no labels" and the basis line still says "Non-diagnostic". */}
      <TrustSafetyBar note={t("screen.trustNote")} />

      {/* Passive developmental-monitoring layer — surveillance, never a test or diagnosis. */}
      <div data-module="screening-monitoring" style={{ display: "contents" }}>
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
              className="inline-flex min-h-11 items-center gap-2 font-bold text-xs rounded-xl px-3.5 py-2 bg-white"
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
                  <span className="text-sm font-bold" style={{ color: "var(--arbor-ink)" }}>{domainLabel("screen", d.domain, t)}</span>
                </div>
                <p className="text-[12.5px] mt-1 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{watchNote(d)}</p>
              </div>
            ))}
          </div>
        ) : (
          // B-CAREPRO-45: what the card does, never a reassurance ("Nothing stands out").
          <p data-testid="monitor-none" className="mt-3 t-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
            {tCalm(uiLang, "elev.screencalm.monitor.none")}
          </p>
        )}
      </SectionCard>
      </div>
    </motion.div>
  );
}

/** B-GROWTH-17 — the Consult reason box's prefill after an elevated check: the
 *  areas worth a conversation, named in the PAGE language via the domain registry.
 *  Pure so the wording and the area list are testable without a tap. */
export function visitPrefillReason(
  watchAreas: readonly { domain: string }[],
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const areas = watchAreas.map((d) => domainLabel("screen", d.domain, t)).join(", ");
  return t("screen.handoff.reason", { areas });
}

/** The screener phase machine (intro → questions → result), extracted so it can
 *  run as a full page OR inside an inline sheet (b2 My Child story spine). The
 *  optional `onClose` lets the sheet dismiss itself before routing to Care. */
export function ScreeningFlow({ onClose, stamped = false }: {
  onClose?: () => void;
  /** B-OCCL-03: the page's primary-move stamp (CHECK_STAMP) goes on the start
   *  / submit button only; the sheet leaves it off. */
  stamped?: boolean;
}) {
  const { childProfile, milestones, setActiveTab, requestConsultPrefill } = useArbor();
  const { toast } = useToast();
  const { t, uiLang } = useLanguage();
  const first = childProfile.name.split(" ")[0];

  // UND-5 — months-precise, corrected-age band selection: the SAME corrected
  // comparison age the Milestones map uses (B0 spine + AAP preterm correction),
  // so a preemie is never screened against the uncorrected band one click away
  // from the corrected milestone view. Term children: comparisonAgeMonths is
  // the chronological months, so band selection is unchanged.
  const chronoMonths = ageMonthsOf(childProfile);
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
  // B-CAREPRO-45 — the answers the result screen lists (band order), and the
  // areas holding a "not yet" (the quiet Care line's prefill). Records saved
  // before the answers were kept show the saved line only.
  const savedAnswers = useMemo(() => {
    if (!result?.answers) return [] as { id: string; answer: ScreenAnswer; domain: string }[];
    const items = AGE_BANDS.find((b) => b.id === result.bandId)?.items ?? [];
    return items
      .filter((it) => result.answers?.[it.id])
      .map((it) => ({ id: it.id, answer: result.answers![it.id], domain: it.domain as string }));
  }, [result]);
  const notYetAreas = useMemo(
    () => [...new Set(savedAnswers.filter((a) => a.answer === "not_yet").map((a) => a.domain))].map((domain) => ({ domain })),
    [savedAnswers],
  );
  const chooseWatch = (milestoneId: string, screenItemId: string) => {
    writeWatchFocus(childProfile.id, { milestoneId, screenItemId, chosenAt: new Date().toISOString() });
    setWatchingId(milestoneId);
    if (!reminderDueAt) remind();
  };

  // B-GROWTH-17 — ONE action after an elevated result: Consult, with the reason
  // box pre-filled naming the areas. It used to offer an export MENU ("reports",
  // with a toast promising a handoff builder it did not open) and an EMPTY
  // professional directory ("find-pro"). From the sheet, close first then route.
  // B-CAREPRO-13: the areas land in the REASON box (not the note field).
  const prepareForVisit = (watchAreas: readonly { domain: string }[]) => {
    requestConsultPrefill({ reason: visitPrefillReason(watchAreas, t) });
    onClose?.();
    setActiveTab("consult");
  };

  return (
    <div className="space-y-4">
      {phase === "intro" && (
        <SectionCard title={t("screen.introTitle", { name: first, band: t(`screen.band.${band.id}`) })} icon={<Icon name="fact_check" size={20} />} tone="mint">
          <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
            {t("screen.intro.body", { n: band.items.length })}
          </p>
          {/* B-OCCL-03: the move comes right after what it does — the basis
              line, the corrected-age note and the last check follow it. */}
          <button
            onClick={() => setPhase("questions")}
            {...(stamped ? CHECK_STAMP : undefined)}
            data-testid="screen-start"
            className="mt-4 inline-flex min-h-11 items-center gap-2 text-white font-bold text-sm rounded-2xl px-5 py-3"
            style={{ background: "var(--arbor-gradient-primary)" }}
          >
            <Icon name="fact_check" size={16} /> {t("screen.start")}
          </button>
          <div data-testid="screen-basis" className="mt-4 flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-bold" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>
            <Icon name="verified_user" size={14} style={{ color: "var(--arbor-green-ink)" }} />
            {t("screen.intro.basis")}
          </div>
          {/* UND-5 — corrected-age treatment is visible, not silent: badge (same
              pattern as the Milestones map) + one observational intro sentence. */}
          {corrected.applied && (
            <div className="mt-3 space-y-1.5" data-testid="screen-corrected-intro">
              <span className="inline-block text-[12px] font-extrabold px-1.5 py-0.5 rounded" style={{ color: "var(--arbor-green-ink)", background: "var(--arbor-green-soft)" }}>
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
                    // B-CAREPRO-45: the last check is a saved set of answers,
                    // never a verdict line (no "no area to talk over").
                    status: tCalm(uiLang, "elev.screencalm.saved.last"),
                  })}
                </span>
                <button onClick={() => { setActiveId(last.id); setResult(last); setPhase("result"); }} className="text-xs font-bold" style={{ color: "var(--arbor-green-ink)" }}>{t("screen.viewLast")}</button>
              </div>
              {/* UND-2 — the parent-requested re-check is a real, inspectable fact. */}
              {last.recheckDueAt && (
                <span
                  data-testid="screen-recheck-due"
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold"
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
              {...(stamped ? CHECK_STAMP : undefined)}
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
            {/* B-CAREPRO-45 — the Development Check never reassures and never
                grades. Every result reads the same way: the answers are saved
                for the next check-up, listed as the parent gave them. When any
                answer is "not yet", one quiet line routes to Care. No headline
                count, no per-area marker, no "nothing stood out". */}
            <div data-testid="screen-saved" className="rounded-[22px] p-6" style={{ background: "var(--arbor-paper-deep)" }}>
              <h3 className="t-lg font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
                {tCalm(uiLang, "elev.screencalm.saved.title")}
              </h3>
              {savedAnswers.length > 0 && (
                <>
                  <p className="mt-3 t-sm" style={{ color: "var(--arbor-muted)" }}>{tCalm(uiLang, "elev.screencalm.saved.listLabel")}</p>
                  <ul data-testid="screen-saved-answers" className="mt-1">
                    {savedAnswers.map(({ id, answer }) => (
                      <li key={id} className="flex items-start justify-between gap-3 border-b py-2.5 last:border-b-0" style={{ borderColor: "var(--arbor-rule)" }}>
                        <span className="min-w-0 flex-1 t-sm" style={{ color: "var(--arbor-ink)" }}>{t(`screen.item.${id}`)}</span>
                        <span className="flex-shrink-0 t-sm" style={{ color: "var(--arbor-ink-soft)" }}>{t(`screen.answer.${answer}`)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {notYetAreas.length > 0 && (
                <p data-testid="screen-worth" className="mt-3 t-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
                  {tCalm(uiLang, "elev.screencalm.saved.worth")}{" "}
                  <button
                    type="button"
                    data-testid="screen-prepare-visit"
                    onClick={() => prepareForVisit(notYetAreas)}
                    className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2"
                    style={{ color: "var(--arbor-ink)" }}
                  >
                    {t("screen.next.summary")}
                  </button>
                </p>
              )}
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
                          <span className="mt-0.5 block break-words text-xs leading-snug" style={{ color: "var(--arbor-muted)" }}>{domainLabel("screen", item.domain, t)}</span>
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

            {/* Next steps */}
            <SectionCard title={t("screen.next.title")} icon={<Icon name="verified_user" size={20} />} tone="sky">
              <div className="flex flex-wrap gap-2">
                {/* GP-11 — every result has somewhere to go: today's play idea or
                    the record (B-CAREPRO-45: no longer behind a "calm" card). */}
                <span data-testid="screen-calm-next" style={{ display: "contents" }}>
                  <button
                    onClick={() => { onClose?.(); setActiveTab("daily-play"); }}
                    className="inline-flex min-h-11 items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
                    style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}
                  >
                    <Icon name="toys" size={16} /> {tGCare(uiLang, "elev.gcare.screen.calm.play")}
                  </button>
                  <button
                    onClick={() => { onClose?.(); setActiveTab("milestones"); }}
                    className="inline-flex min-h-11 items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold"
                    style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}
                  >
                    <Icon name="edit_note" size={16} /> {tGCare(uiLang, "elev.gcare.screen.calm.record")}
                  </button>
                </span>
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
              <p className="t-sm mt-3 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
                {t("screen.safetyNote")}
              </p>
            </SectionCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
