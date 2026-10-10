import React, { useMemo } from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { cardCls } from "../ui/kit";
import PatternInsights from "../behaviors/PatternInsights";
import HardMomentsSection from "../behaviors/HardMomentsSection";
import { heldRowsSince } from "../behaviors/hardMomentLastTime";
import QuickCaptureBar from "../overview/QuickCaptureBar";
import { availableHardMomentCards, matchToRecentBehaviors } from "../../content/selectCards";
import { locText, recentBehaviorTypes } from "../../content/hardMomentSurface";
import { ageMonthsFromProfile } from "../../lib/childAge";
import { behaviorTypeLabel } from "../../content/behaviorTaxonomy";
import { ContentActionBar } from "../ui/ContentActionBar";
import { fmtDay, fmtDayShort } from "../../lib/formatDate";
import { patternEchoFor } from "../../lib/patternEcho";

const DAY = 86_400_000;

export default function BehaviorsTab() {
  const {
    handleAnalyzeBehaviors, isAnalyzingBehavior, behaviorLogs, behaviorAnalysis,
    behaviorAnalysisRecord, keepBehaviorInsight, seedCoach, setActiveTab,
    childProfile, openCaptureSheet, openHardMomentNow, actionLoop,
    requestJournalFilter, lastSavedBehavior, dismissBehaviorEcho,
  } = useArbor();
  const { t, uiLang } = useLanguage();
  const behFirst = (childProfile.name || "").split(" ")[0];
  const analysisWhy = t("beh.analysis.why", {
    n: behaviorAnalysisRecord?.inputs?.logCount ?? behaviorLogs.length,
    date: fmtDay(behaviorAnalysisRecord?.createdAt ?? Date.now(), uiLang),
  });
  // The shared capture sheet owns saving. Echo only its last newly committed
  // row for this child; edits never arm it, and Undo/deletion removes it.
  const echoLog = lastSavedBehavior?.childId === childProfile.id
    ? behaviorLogs.find((log) => log.id === lastSavedBehavior.id) : undefined;
  const patternEcho = useMemo(
    () => patternEchoFor(behaviorLogs, echoLog?.behaviorType ?? null, new Date().toISOString().slice(0, 10)),
    [behaviorLogs, echoLog],
  );
  const types = useMemo(() => Array.from(new Set(behaviorLogs.map((l) => l.behaviorType))), [behaviorLogs]);
  const heroStats = useMemo(() => {
    const now = Date.now();
    const last7 = behaviorLogs.filter((l) => now - new Date(l.timestamp).getTime() < 7 * DAY);
    const resolvedWeek = last7.filter((l) => l.resolved).length;
    const contexts = new Set(last7.map((l) => l.context).filter(Boolean)).size;
    return {
      events: last7.length,
      contexts,
      // B-ASKJB-22 (was RUN-08's ratio): the resolved stat is the plain count
      // of moments that settled this week — never "{n}/{total}", which reads
      // as a grade on the child's week. Zero stays 0, so the teach line fires.
      resolved: resolvedWeek,
    };
  }, [behaviorLogs]);
  const hasWeek = heroStats.events > 0;

  // Critic r2 (behaviors design P1 G2 / B-ASKJB-NEW-2f): the shelf's lead guide
  // — the same deterministic match HardMomentsSection rests on (the parent's
  // own logged types against the guide concerns; catalogue order otherwise).
  const guideLead = useMemo(() => {
    const now = new Date();
    const locale = uiLang === "he" ? "he" : "en";
    const ageMonths = ageMonthsFromProfile(childProfile, now);
    const cards = availableHardMomentCards({ now, ageMonths, locale });
    const matched = matchToRecentBehaviors(recentBehaviorTypes(behaviorLogs || [], now), cards, now, ageMonths, locale);
    const top = (matched.length ? matched : cards)[0];
    return { any: cards.length > 0, title: top ? locText(top.title, locale) : "" };
  }, [childProfile, uiLang, behaviorLogs]);

  // One warm line in the capture card: the parent's own last words (never
  // generated; first 70 characters; the date is the fact), else — on day 0 —
  // the child's top matched guide by name. No count, no verdict, no colour on
  // a hard moment beyond the page's one peach accent.
  // P1-NEXTLEVEL critic r2 (one warm moment per screen): while the hard-moment
  // section leads with a held "Last time, this helped" row (peach + editorial
  // serif), the capture card's last-words line is quiet body text.
  const heldRowShown = heldRowsSince(actionLoop ?? [], 0).length > 0;
  const warmLine = useMemo((): { kind: "quote"; words: string; day: string } | { kind: "guide"; guide: string } | null => {
    const latest = [...behaviorLogs]
      .filter((l) => (l.trigger || "").trim())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    if (latest) {
      const words = latest.trigger.trim();
      return { kind: "quote", words: words.length > 70 ? `${words.slice(0, 70).trimEnd()}…` : words, day: fmtDayShort(latest.timestamp, uiLang) };
    }
    return guideLead.title ? { kind: "guide", guide: guideLead.title } : null;
  }, [behaviorLogs, guideLead.title, uiLang]);

  // Per-type 30-day FLAT COUNT (Wave-3 clinical subtraction, 2026-06-26).
  // Replaces the prior 30-day intensity-over-time sparkline series — a behavior-
  // intensity trend per type on a child metric = verdict-shaped (same firewall
  // class as TrendsChart). The replacement is a flat parent-log count per type
  // in the window; no time axis, no avg, no line, no verdict.
  const typeCounts30d = useMemo(() => {
    const now = Date.now();
    return types.map((type) => ({
      type,
      count: behaviorLogs.filter(
        (l) => l.behaviorType === type && now - new Date(l.timestamp).getTime() < 30 * DAY,
      ).length,
    }));
  }, [behaviorLogs, types]);

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto w-full min-w-0 max-w-[1180px] space-y-6">
      {/* B-ASKJB-23: capture, guides and patterns only. Preserve the current
          action-first H1 and desktop rail; Journal owns the complete record. */}
      <div data-testid="behaviors-grid" className="min-w-0 space-y-6 lg:grid lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:items-start lg:gap-6 lg:space-y-0">
        <section data-module="behaviors-capture" data-primary-move="log-behavior" className="min-w-0 lg:col-span-7 lg:col-start-1 lg:row-start-1" aria-label={t("beh.captureTitle")}>
        <div data-testid="behaviors-capture-card" className="min-w-0 space-y-3 rounded-[var(--r-xl)] p-4 sm:p-5" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule-strong)", boxShadow: "var(--shadow-sm)" }}>
          <div className="min-w-0">
            <h1 data-testid="behaviors-capture-label" className="t-xl font-extrabold leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
              {t("beh.capture.label", { name: behFirst })}
            </h1>
            <p className="mt-1 t-sm leading-snug" style={{ color: "var(--arbor-muted)" }}>
              {t("beh.hero.sub")}
              {hasWeek && (
                <span data-testid="behaviors-week-line">
                  {" · "}{t(heroStats.events === 1 ? "elev.beh.week.one" : "elev.beh.week", { n: heroStats.events })}
                  {heroStats.resolved > 0 && <>{" · "}{t("elev.beh.week.settled", { n: heroStats.resolved })}</>}
                </span>
              )}
            </p>
          </div>
          {warmLine && (
            /* NEXTLEVEL critic r1 (Law 8): the paragraph keeps the PAGE
               direction; only the parent's words (with their quote marks) are
               an auto-direction island and the day is its own island — an
               English quote on a Hebrew page no longer flips its marks. */
            <p data-testid="behaviors-warm-line" data-warm={warmLine.kind} data-quiet={heldRowShown ? "true" : undefined} dir={uiLang === "he" ? "rtl" : "ltr"} className={heldRowShown ? "t-sm leading-snug" : "px-3 py-2 t-sm leading-snug"} style={heldRowShown ? { fontFamily: "var(--font-sans)", color: "var(--arbor-muted)" } : { borderRadius: "var(--r-sm)", fontFamily: "var(--font-editorial)", background: "var(--arbor-peach-soft)", color: "var(--arbor-peach-ink)" }}>
              {warmLine.kind === "quote"
                ? <>{t("beh.warm.quoteLead")}{" "}<bdi dir="auto">{uiLang === "he" ? "„" : "“"}{warmLine.words}{"”"}</bdi>{" · "}<bdi>{warmLine.day}</bdi></>
                : t("beh.warm.guide", { guide: warmLine.guide, name: behFirst })}
            </p>
          )}
          <QuickCaptureBar
            childName={behFirst}
            onText={() => openCaptureSheet({ mode: "text" })}
            onMode={(mode) => openCaptureSheet({ mode })}
            onHardMoment={guideLead.any ? () => openHardMomentNow() : undefined}
          />
        </div>


          <button type="button" data-testid="behaviors-journal-link" onClick={() => { requestJournalFilter("hard"); setActiveTab("journal"); }} className="mt-3 flex min-h-11 w-full items-center justify-between gap-3 px-1 text-start t-sm font-semibold" style={{ color: "var(--arbor-ink-soft)" }}>
            {t("beh.journal.hardMoments")}
            <Icon name="arrow_forward" size={18} className="flex-none rtl:-scale-x-100" />
          </button>
        {patternEcho && (
          <div
            data-testid="behaviors-pattern-echo"
            className="mt-3 flex flex-col gap-3 rounded-[16px] p-4 sm:flex-row sm:items-center"
            style={{ background: "var(--arbor-green-soft)" }}
            role="status"
          >
            <Icon name="loop" size={19} className="flex-none" style={{ color: "var(--arbor-green-ink)" }} />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-extrabold leading-snug" dir="auto" style={{ color: "var(--arbor-green-ink)" }}>
                {t("elev.closeloop.echo.title", {
                  type: behaviorTypeLabel(patternEcho.type, t),
                  n: patternEcho.count,
                  days: patternEcho.windowDays,
                })}
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
                {t("elev.closeloop.echo.body")}
              </p>
            </div>
            <div className="flex flex-none items-center gap-2">
              <button
                type="button"
                onClick={() => { dismissBehaviorEcho(echoLog?.id ?? ""); setActiveTab("plans"); }}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 text-[12.5px] font-extrabold"
                style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-green-ink)" }}
              >
                {t("elev.closeloop.echo.cta")}
                <Icon name="arrow_forward" size={15} className="rtl:-scale-x-100" />
              </button>
              <button
                type="button"
                onClick={() => dismissBehaviorEcho(echoLog?.id ?? "")}
                className="min-h-11 px-2 text-[12px] font-bold"
                style={{ color: "var(--arbor-muted)" }}
              >
                {t("elev.closeloop.echo.dismiss")}
              </button>
            </div>
          </div>
        )}
      </section>


        <div data-module="behaviors-hard-moments" className="min-w-0 lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1"><HardMomentsSection /></div>
        <section data-module="behaviors-patterns" className="min-w-0 space-y-6 lg:col-span-7 lg:col-start-1 lg:row-start-2" aria-label={t("beh.analyze")}>
          <PatternInsights logs={behaviorLogs} />
          <div className={`${cardCls} p-5 space-y-4`}>
            <button type="button" onClick={handleAnalyzeBehaviors} disabled={isAnalyzingBehavior} data-testid="behaviors-find-pattern" className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 t-sm font-bold transition disabled:opacity-60" style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)", background: "var(--arbor-paper-elevated)" }}>
              {isAnalyzingBehavior ? (<><Icon name="progress_activity" size={15} className="animate-spin" /> {t("beh.synthesizing")}</>) : (<><Icon name="psychology" size={15} /> {t("beh.analyze")}</>)}
            </button>
            {behaviorAnalysis && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="p-5 rounded-2xl space-y-4 text-xs" style={{ background: "linear-gradient(120deg,var(--arbor-paper-tinted),var(--arbor-lav-soft))", border: "1px solid var(--arbor-rule)" }}>
                <h4 className="text-sm font-extrabold flex items-center gap-1.5" style={{ color: "var(--arbor-green-ink)" }}><Icon name="auto_awesome" size={15} fill={1} /> {t("beh.patternShows")}</h4>
                {/* W0.4: the "Parent Response Evaluation" (effectivenessRating) card was
                    removed — the app never grades the parent's responses. */}
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2"><span className="font-bold block" style={{ color: "var(--arbor-ink)" }}>{t("beh.devRec")}</span><p className="leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{behaviorAnalysis.actionPlanSuggestion}</p></div>
                </div>
                <div className="space-y-2 pt-3" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
                  <span className="font-bold block" style={{ color: "var(--arbor-ink)" }}>{t("beh.expertInsights")}</span>
                  <div className="space-y-2">
                    {behaviorAnalysis.expertInsights.map((ins, i) => (
                      <div key={i} className="p-2.5 rounded-xl bg-white" style={{ border: "1px solid var(--arbor-rule)" }}>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider block" style={{ color: "var(--arbor-green-ink)" }}>{ins.scholarLens || t("beh.theoryFallback")}</span>
                        <strong className="font-bold block mt-1" style={{ color: "var(--arbor-ink)" }}>{ins.heading}</strong>
                        <p className="mt-0.5 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{ins.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
                {/* TJB-04 (law #4): every model output carries a visible why /
                    provenance line chained to the Trust Center, and ONE tap keeps
                    the suggestion into the child's record (insights subcollection).
                    The shared ContentActionBar owns the slot: why-line + TrustLink
                    surface "behavior-analysis", "Keep this" as the canonical save
                    verb, and the existing Ask-Arbor hand-off as an extra. */}
                <div className="pt-3" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
                  <ContentActionBar
                    surface="behavior-analysis"
                    why={analysisWhy}
                    trustLink
                    variant="bar"
                    actions={[
                      { verb: "save", label: t("beh.analysis.keep"), icon: "bookmark_add", onClick: () => keepBehaviorInsight(behaviorAnalysis.actionPlanSuggestion) },
                    ]}
                    extras={[
                      {
                        id: "coach",
                        label: t("beh.analyzeCoachCta"),
                        icon: "auto_awesome",
                        fill: 1,
                        onClick: () => {
                          seedCoach({ prompt: `${t("beh.analyzeCoachPrompt", { name: behFirst })}\n\n${behaviorAnalysis.actionPlanSuggestion}`, source: "behavior-analysis" });
                        },
                      },
                    ]}
                  />
                </div>
              </motion.div>
            )}

          </div>
          {typeCounts30d.length > 0 && (
            <div className={`${cardCls} p-5 space-y-3`}>
              <span className="text-xs font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-green-ink)" }}>{t("beh.countLabel")}</span>
              <div className="space-y-2">
                {typeCounts30d.map(({ type, count }) => (
                  <div key={type} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
                    <span className="text-[11px] truncate" style={{ color: "var(--arbor-muted)" }}>{behaviorTypeLabel(type, t)}</span>
                    <span className="text-[11px] font-bold flex-shrink-0" style={{ color: "var(--arbor-ink)" }}>
                      {t("beh.countEntry", { count })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </motion.div>
  );
}
