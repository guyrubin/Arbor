import React, { useMemo } from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { cardCls } from "../ui/kit";
import PatternInsights from "../behaviors/PatternInsights";
import { HardMomentGuides, HardMomentLastTimeCard } from "../behaviors/HardMomentsV10";
import { heldRowsSince, scriptCard } from "../behaviors/hardMomentLastTime";
import { availableHardMomentCards, matchToRecentBehaviors } from "../../content/selectCards";
import { locText, recentBehaviorTypes } from "../../content/hardMomentSurface";
import { ageMonthsFromProfile } from "../../lib/childAge";
import { parentWritten } from "../../lib/kept/parentWritten";
import { ContentActionBar } from "../ui/ContentActionBar";
import { fmtDay, fmtDayMonthLongV10, fmtDayShort } from "../../lib/formatDate";
import { useShellRowEnd } from "../../lib/shellSlots";
import { patternEchoFor } from "../../lib/patternEcho";
import { UrgentSupport } from "../safety/UrgentSupport";
import KindSwitch from "../moments/v10/KindSwitch";
import { goToRoute, useHashQuery } from "../../hooks/useHashQuery";
import HourDial from "../moments/v10/HourDial";
import { Draw, FrameFigure, FrameHead, IndexRow, RailTile, ReadGuide, RowLink, StageCard, type IndexItem } from "../moments/v10/frame";
import { STAGE_ORBS } from "../moments/v10/stageOrbs";
import { DsRoot, Guide, Route, RouteSection, Scene, Token } from "../../design/primitives";
import { useComposition } from "../../design/useComposition";
import { behaviorTypeLabel, isIncidentType } from "../../content/behaviorTaxonomy";
import "../moments/mychild.css";
import { MOMENTS_V10_COPY } from "../moments/momentsV10Copy";
import { ReceiptNoteLine, undoThen, useReceiptNote } from "../ui/Receipt";

const DAY = 86_400_000;

export default function BehaviorsTab() {
  const {
    handleAnalyzeBehaviors, isAnalyzingBehavior, behaviorLogs, behaviorAnalysis,
    behaviorAnalysisRecord, keepBehaviorInsight, unkeepBehaviorInsight, seedCoach, setActiveTab,
    childProfile, openCaptureSheet, openHardMomentNow, actionLoop,
    requestJournalFilter, lastSavedBehavior, dismissBehaviorEcho, escalatedSurface,
  } = useArbor();
  const { t, uiLang, aiLang } = useLanguage();
  const composition = useComposition();
  const desk = composition === "desk";
  const v = MOMENTS_V10_COPY[uiLang === "he" ? "he" : "en"];
  const locale = uiLang === "he" ? "he-IL" : "en-GB";
  // The picked entry lives in the address (`?entry=`), so Back returns to it.
  const selectedId = useHashQuery().get("entry");
  // v10.3: the hard moments the parent logged (an incident type, never the neutral "Moment"), newest first.
  const hardLogs = useMemo(() => [...behaviorLogs].filter((l) => isIncidentType(l.behaviorType))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()), [behaviorLogs]);
  const behFirst = (childProfile.name || "").split(" ")[0];
  // B-STATUS-01: "Keep this" answers under the bar it was tapped on, with Undo.
  const keptReceipt = useReceiptNote();
  const answerKept = (id: string | null) => {
    if (!id) return;
    keptReceipt.show({
      text: t("beh.analysis.kept", { name: behFirst }),
      undo: { label: t("elev.keep.undo"), testId: "beh-kept-undo", onUndo: undoThen(() => unkeepBehaviorInsight(id), keptReceipt.clear) },
    });
  };
  // N-Hard-D: the pill row ends with the day and "since you started on <the first hard moment logged>"; nothing logged, no suffix.
  const firstLogged = hardLogs.length ? hardLogs[hardLogs.length - 1].timestamp : null;
  useShellRowEnd(firstLogged ? { suffix: v.hard.sinceStarted(fmtDayMonthLongV10(firstLogged, uiLang)) } : null);
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
  // B-DATA-16: a hard moment logged with a guide's words leads that section too.
  const heldRowShown = heldRowsSince(actionLoop ?? [], 0).length > 0 || behaviorLogs.some((l) => !!scriptCard(l.coRegulationScript));
  const warmLine = useMemo((): { kind: "quote"; words: string; day: string } | { kind: "guide"; guide: string } | null => {
    // "Last time you wrote" quotes only a row the parent wrote: never a
    // conversation proposal, an Arbor draft or a co-parent's note
    // (kept/parentWritten, the provenance rule every quote reader shares).
    const latest = [...behaviorLogs]
      .filter((l) => (l.trigger || "").trim() && parentWritten(l))
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

  // v10.3 (the My child frame): #/behaviors is Moments with the kind Hard
  // moments selected — the band (kinds switch, the one way to log, one
  // figure), the newest entries as the index, the stage (when they happened,
  // the last time something helped, the guides) and the rail (how to read,
  // what helped in your own log, the patterns). B-ASKJB-23: capture, guides
  // and patterns only; Journal owns the complete record.
  const hc = v.hard;
  const settledAll = hardLogs.length > 0 && hardLogs.every((l) => l.resolved);
  const settledCount = hardLogs.filter((l) => l.resolved).length;
  const timeOf = (iso: string) => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
  const dayOf = (iso: string) => new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
  const entries = hardLogs.slice(0, 3);
  const selectedLog = entries.find((l) => l.id === selectedId) ?? entries[0] ?? null;
  const entryName = (l: (typeof hardLogs)[number]) => (parentWritten(l) && (l.trigger || "").trim()) || behaviorTypeLabel(l.behaviorType, t);
  const entryIndex: IndexItem[] = entries.map((l) => ({
    id: l.id, icon: "favorite", figure: timeOf(l.timestamp), name: entryName(l),
    meta: l.resolved ? `${dayOf(l.timestamp)} · ${hc.settled}` : dayOf(l.timestamp),
    on: selectedLog?.id === l.id, onOpen: () => goToRoute("behaviors", { entry: l.id }),
  }));
  const dialMarks = hardLogs.slice(0, 24).map((l) => { const d = new Date(l.timestamp); return { id: l.id, hour: d.getHours(), minute: d.getMinutes() }; });
  const capture = (
    /* v10.1: the dock owns voice, photo and "A hard moment?" (the same
       handlers and the same guide gate, launcher-hard-moment); N-Hard V77:
       the page keeps one way to log. */
    <section data-module="behaviors-capture" data-primary-move="log-behavior" className="hm-capture" aria-label={t("beh.captureTitle")}>
      <button type="button" data-testid="behaviors-log-hard" onClick={() => openCaptureSheet({ mode: "text" })}
        className={desk ? "btn primary sm nowrap" : "btn primary sm nowrap grow"}>
        <Icon name="favorite" size={16} />{v.logHard}
      </button>
    </section>
  );
  const band = (
    <Scene field="now" className="mband" orbs={STAGE_ORBS[composition]}>
      <div className="mstack mtools">
        <FrameHead phone={!desk} kicker={hc.kicker} startHere={v.startHere} title={hc.title} sub={hc.sub}
          switcher={<KindSwitch kind="hard" />} action={capture}
          figure={hardLogs.length > 0 ? <FrameFigure n={hardLogs.length} unit={hc.figureUnit(hardLogs.length)} sub={settledAll ? hc.allSettled : settledCount > 0 ? hc.someSettled(settledCount) : undefined} /> : undefined} />
        {entryIndex.length > 0 && <IndexRow phone={!desk} label={hc.entriesLabel} items={entryIndex} figureClass="tm" />}
      </div>
      {entryIndex.length > 0 && <div className="mcap"><span>{hardLogs.length < 5 ? hc.capFew : hc.cap}</span></div>}
    </Scene>
  );
  const stage = (
    <StageCard icon="schedule" title={hc.stage} end={desk && selectedLog ? hc.selected(`${dayOf(selectedLog.timestamp)} · ${timeOf(selectedLog.timestamp)}`) : undefined} className="hm-stage">
      <div className="hdl">
        <div className="dl">
          {dialMarks.length > 0
            ? <HourDial marks={dialMarks} selected={selectedLog?.id} center={hc.dialCenter} label={hc.dialLabel(dialMarks.map((m) => `${String(m.hour).padStart(2, "0")}:${String(m.minute).padStart(2, "0")}`).join(", "))} size={desk ? 240 : 204} />
            : <p className="line1">{hc.noEntries}</p>}
          {/* V77 phone: one caption carries the picked hour (the stage head has no room). */}
          {dialMarks.length > 0 && <span className="cap" aria-hidden={desk ? true : undefined}>{!desk && selectedLog ? `${hc.dialCaption} · ${hc.selected(timeOf(selectedLog.timestamp))}` : hc.dialCaption}</span>}
        </div>
        <div className="mstack hm-right">
          {/* N-Hard V77: with no hard moment logged the stage asks the question; once there is one, the dial and the last-time card carry it. */}
          {dialMarks.length === 0 && (
            <>
          <div className="min-w-0">
            <h2 data-testid="behaviors-capture-label" className="hm-question">
              {t("beh.capture.label", { name: behFirst })}
            </h2>
            {hasWeek && (
            <p className="mt-1 t-sm leading-snug" style={{ color: "var(--arbor-muted)" }}>
                <span data-testid="behaviors-week-line">
                  {t(heroStats.events === 1 ? "elev.beh.week.one" : "elev.beh.week", { n: heroStats.events })}
                  {heroStats.resolved > 0 && <>{" · "}{t("elev.beh.week.settled", { n: heroStats.resolved })}</>}
                </span>
            </p>
            )}
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
            </>
          )}
          <HardMomentLastTimeCard phone={!desk} />
        </div>
      </div>
      {patternEcho && (
        /* Arbor's draft step (N-Hard "Arbor draft · you decide"): a count of
           the parent's own logs and one step for the plans page; never a verdict. */
        <div data-testid="behaviors-pattern-echo" className="mcc ai hm-draft" role="status">
          <span className="by"><Icon name="edit" size={14} />{t("coach.report.draftLabel")}</span>
          <b className="hm-draft-t" dir="auto">
            {t("elev.closeloop.echo.title", { type: behaviorTypeLabel(patternEcho.type, t), n: patternEcho.count, days: patternEcho.windowDays })}
          </b>
          <p>{t("elev.closeloop.echo.body")}</p>
          <div className="line hm-draft-acts">
            <button type="button" onClick={() => { dismissBehaviorEcho(echoLog?.id ?? ""); setActiveTab("plans"); }} className="btn ink sm grow nowrap">
              {t("elev.closeloop.echo.cta")}<Icon name="arrow_forward" size={15} className="rtl:-scale-x-100" />
            </button>
            <button type="button" onClick={() => dismissBehaviorEcho(echoLog?.id ?? "")} className="btn sm ghost nowrap card-btn">
              {t("elev.closeloop.echo.dismiss")}
            </button>
          </div>
        </div>
      )}
    </StageCard>
  );
  const readGuide = (
    <RailTile icon="grid_view" title={v.howToRead} className="mguide">
      <ReadGuide phone={!desk}
        steps={[
          { drawing: Draw.pick(3), label: hc.steps.pick },
          { drawing: <span className="ddial" />, label: hc.steps.read },
          { drawing: Draw.cards(), label: hc.steps.use },
        ]}
        keyItems={[
          { mark: <Token kind="hard" size="sm" label={hc.keyHard} />, label: hc.keyHard },
          { mark: <Token kind="stp" size="sm" label={hc.keyHelped} />, label: hc.keyHelped },
        ]} />
    </RailTile>
  );
  const findPattern = (
    <div className="line between hm-pat-acts">
      <button type="button" onClick={handleAnalyzeBehaviors} disabled={isAnalyzingBehavior} data-testid="behaviors-find-pattern" className="btn sm nowrap tint-btn">
        {isAnalyzingBehavior ? (<><Icon name="progress_activity" size={15} className="animate-spin" /> {t("beh.synthesizing")}</>) : t("beh.analyze")}
      </button>
      <button type="button" data-testid="behaviors-day-glance" onClick={() => setActiveTab("day-windows")} className="ds-link nowrap">
        {hc.dayAtAGlance}<Icon name="chevron_right" size={16} className="rtl:-scale-x-100" />
      </button>
    </div>
  );
  // N-Hard V77: the detected patterns read as one line and their two moves.
  const patternsHead = behaviorLogs.length > 0
    ? <PatternInsights logs={behaviorLogs} compact={desk ? "tile" : "inline"} actions={findPattern} />
    : <div className="hm-pat inline">{findPattern}</div>;
  const helped = heldRowsSince(actionLoop ?? [], 0).slice(0, 4);
  const helpedTile = (
    <RailTile icon="flag" title={hc.helped} className="hm-helped">
      {helped.length > 0 ? (
        <ul className="hlist">
          {helped.map((r) => (
            <li key={r.id} className="hlr"><Token kind="stp" size="md" label={hc.tokenHelped} /><span className="t" dir="auto">{r.recommendation}</span></li>
          ))}
        </ul>
      ) : <p className="line1">{hc.helpedNone}</p>}
      {helped.length > 0 && <p className="line1">{hc.helpedKey}</p>}
      {/* N-Hard-M: on the phone the detected patterns sit inside this tile. */}
      {!desk && patternsHead}
    </RailTile>
  );
  const patterns = (
    <section data-module="behaviors-patterns" className="mstack hm-patterns" aria-label={t("beh.analyze")}>
      {desk && patternsHead}
      {(escalatedSurface === "behaviors" || behaviorAnalysis) && (
        <div className={`${cardCls} p-5 space-y-4`}>
            {/* B-ASKJB-49: the crisis screen answered 409: the shared crisis
                card (helplines in the request's language) in the result's place. */}
            {escalatedSurface === "behaviors" && (
              <UrgentSupport testId="behaviors-urgent-support" requestLang={aiLang} lead={t("elev.safety.paused")} onSafety={() => setActiveTab("safety")}
                className="min-w-0 rounded-xl border border-[var(--arbor-rule-strong)] bg-[var(--arbor-paper-deep)] px-3 py-2 t-sm leading-relaxed text-[var(--arbor-ink)]" />
            )}
            {behaviorAnalysis && escalatedSurface !== "behaviors" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="p-5 rounded-2xl space-y-4 text-xs" style={{ background: "var(--arbor-k-moment-w)", border: "1px solid var(--arbor-rule)" }}>
                <h4 className="text-sm font-extrabold flex items-center gap-1.5" style={{ color: "var(--arbor-k-plan-i)" }}><Icon name="auto_awesome" size={15} fill={1} /> {t("beh.patternShows")}</h4>
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
                        <span className="text-[12px] font-extrabold uppercase tracking-wider block" style={{ color: "var(--arbor-k-plan-i)" }}>{ins.scholarLens || t("beh.theoryFallback")}</span>
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
                      { verb: "save", label: t("beh.analysis.keep"), icon: "bookmark_add", onClick: () => answerKept(keepBehaviorInsight(behaviorAnalysis.actionPlanSuggestion)) },
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
                  <ReceiptNoteLine note={keptReceipt.note} testId="beh-kept-receipt" size="sm" className="mt-2" />
                </div>
              </motion.div>
            )}

        </div>
      )}
          {typeCounts30d.length > 0 && (
            <details className={`${cardCls} hm-counts`}>
              <summary className="hm-counts-s">{t("beh.countLabel")}<Icon name="expand_more" size={16} /></summary>
              <div className="space-y-2">
                {typeCounts30d.map(({ type, count }) => (
                  <div key={type} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
                    <span className="text-[12px] truncate" style={{ color: "var(--arbor-muted)" }}>{behaviorTypeLabel(type, t)}</span>
                    <span className="text-[12px] font-bold flex-shrink-0" style={{ color: "var(--arbor-ink)" }}>
                      {t("beh.countEntry", { count })}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
      <RowLink icon="auto_stories" label={t("beh.journal.hardMoments")} testId="behaviors-journal-link" onOpen={() => { requestJournalFilter("hard"); setActiveTab("journal"); }} />
    </section>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-full min-w-0">
      <DsRoot composition={composition} className="ds-mychild hard-v10" dir={uiLang === "he" ? "rtl" : "ltr"} data-testid="behaviors-v10">
        <Guide mini={!desk} label={v.onThisPage} stops={[
          { id: "h-entries", title: desk ? hc.guideEntriesN(entries.length) : hc.guideEntriesShort(entries.length), sub: hc.guideEntriesSub },
          { id: "h-hour", title: desk ? hc.guideHour : hc.guideHourShort, sub: hc.guideHourSub },
          { id: "h-guides", title: desk ? hc.guideGuides : hc.guideGuidesShort, sub: hc.guideGuidesSub },
        ]} />
        <Route composition={composition}>
          <RouteSection id="h-entries" n={1} on>{band}</RouteSection>
          <RouteSection id="h-hour" n={2}>
            {desk ? (
              <div className="rowa">
                <div className="stg">{stage}</div>
                <aside className="rlc">{readGuide}{helpedTile}{patterns}</aside>
              </div>
            ) : (
              <div className="mstack" style={{ gap: 14 }}>{stage}{readGuide}{helpedTile}{patterns}</div>
            )}
          </RouteSection>
          {/* N-Hard V77 stop 3: the closest guides, under the stage and the rail. */}
          <RouteSection id="h-guides" n={3}>
            <div data-module="behaviors-hard-moments" className="min-w-0"><HardMomentGuides phone={!desk} /></div>
          </RouteSection>
        </Route>
      </DsRoot>
    </motion.div>
  );
}
