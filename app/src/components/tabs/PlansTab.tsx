import React, { useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { SectionSkeleton } from "../ui/Skeleton";
import { EmptyState, GhostBlock } from "../ui/EmptyState";
import { statesText } from "../../lib/i18nElevation/states";
import { track } from "../../lib/analytics";
import { ContentWhyLine } from "../ui/ContentActionBar";
import PlanSteps from "../plans/PlanSteps";
import { planAdjustSeed } from "../plans/planTrack";
import RoutinesCard from "../plans/RoutinesCard";
// B-GROWTH-25: the ready-made routines, as one-tap plan templates.
import RoutineTemplates from "../plans/RoutineTemplates";
// v3 FEAT-07: a routine plan runs again every day, on its own board.
import RoutineRunBoard from "../plans/RoutineRunBoard";
import PlanComposer from "../plans/PlanComposer";
import { nextStartedPlan, routineIdOfPlan, routineTemplatesForAge } from "../../lib/routineTemplates";
import { ReceiptNoteLine, useReceiptNote } from "../ui/Receipt";
import { UrgentSupport } from "../safety/UrgentSupport";
import { useChildCollection } from "../../hooks/useChildCollection";
import { goToRoute, useHashQuery } from "../../hooks/useHashQuery";
/* B-ASKJB-28: the routines row only counts docs; their shape stays RoutinesCard's. */
import { lastPlanOutcomes, planDoneSteps, planEcho, suggestedChallenges, todaysPlanStep } from "../../lib/plans";
import { dayKey } from "../../practice/signals";
import { EMPTY_ART } from "../../lib/parentArt";
import { ageMonthsFromProfile } from "../../lib/childAge";
import { authoredPatterns, getPattern } from "../../lib/library/plans/planBooks";
import { heGender } from "../../lib/library/bookText";
import type { PlanBookDoc } from "../../lib/library/plans/planBookDoc";
import type { PatternDef } from "../../lib/library/plans/patterns";
import { activePlans, closePlan, keepPlan, nightMomentText, recordNight, unrecordNight, type ActivePlan } from "../../lib/plans/planWeek";
import { composerFromDoc } from "../../lib/plans/composerFromDoc";
import { openPrintablePlan } from "../../lib/plans/planPrint";
import { usePlanVisibility } from "../../lib/plans/usePlanVisibility";
import { readChallengeQuery } from "../../lib/plans/challengeLinks";
import { DsRoot, Guide, Route, RouteHead, RouteSection, type GuideStop } from "../../design/primitives";
import { useComposition } from "../../design/useComposition";
import { ActionPlanStage } from "../plans/v10/ActionPlanStage";
import { PlanPicker } from "../plans/v10/PlanPicker";
import { PlanScripts } from "../plans/v10/PlanScripts";
import { PlanWhole } from "../plans/v10/PlanWhole";
import { StartAnother } from "../plans/v10/StartAnother";
import { ChallengeScreen } from "../plans/v10/ChallengeScreen";
import { PrintPreview } from "../plans/v10/PrintPreview";
import { plansCopy } from "../plans/v10/plansCopy";
import "../plans/v10/plans.css";

/**
 * Now › Plans (v10.1, boards N-Plans and N-Challenge). The pill shows the
 * family's action plan(s) and Challenge plan(s) side by side, each named by its
 * own title; the action plan's trail and steps live here (their only home).
 *
 *   1 Your plans   the picker, then the open action plan's stage (today's step,
 *                  the trail, "I'll try it") and, beside it,
 *   2 What to say  the plan's scripts (Say / Read aloud / Avoid),
 *   3 The whole plan  "Working on:", the phases and every step (tap to move on,
 *                  edit, Delete plan),
 *   4 Start another plan  Challenge Plans · a ready-made routine or your own
 *                  routines · "Create a plan for a specific challenge".
 *
 * `#/plans?challenge=…` opens Challenge Plans here (lib/plans/challengeLinks):
 * a running plan's page, the list, or the composer (recognise → agree → preview
 * → approve), whose approved row is the same `books` document as before.
 * No "Worth knowing" note on Plans (COPY-RULES).
 */
export default function PlansTab() {
  const {
    childProfile,
    behaviorLogs,
    planChallengeTopic,
    setPlanChallengeTopic,
    handleGenerateActionPlan,
    isPlanGenerating,
    actionPlans,
    plansLoaded,
    seedCoach,
    actionLoop,
    activeTodayAction,
    acceptTodayAction,
    removeTodayAction,
    recordPlanWeeklyCheck,
    escalatedSurface,
    setActiveTab,
    addMoment,
  } = useArbor();
  const now = Date.now();
  const todayKey = dayKey(new Date(now));
  const { t, uiLang, aiLang } = useLanguage();
  const lang = uiLang === "he" ? "he" : "en";
  const c = plansCopy(lang);
  const composition = useComposition();
  const desk = composition === "desk";
  const first = childProfile.name.split(" ")[0];
  const query = useHashQuery();
  const target = readChallengeQuery(query);
  // B-ASKJB-28: the routines row's count (the same collection RoutinesCard reads).
  const routinesCol = useChildCollection<{ id: string }>(childProfile.id, "routines");
  const routineCount = routinesCol.items.length;
  const readyMadeCount = useMemo(() => routineTemplatesForAge(ageMonthsFromProfile(childProfile)).length, [childProfile]);

  // Challenge Plans: the child's plan books (the `books` seam) and the server's table.
  const planRows = useChildCollection<PlanBookDoc>(childProfile.id, "books");
  const planVisibility = usePlanVisibility();
  const nowDate = useMemo(() => new Date(now), [planRows.items]); // eslint-disable-line react-hooks/exhaustive-deps
  const running = useMemo(() => activePlans(planRows.items, nowDate), [planRows.items, nowDate]);
  const composable = useMemo(() => authoredPatterns().filter((d) => planVisibility?.composable[d.id]?.[lang]), [planVisibility, lang]);
  const runningIds = new Set(running.map((r) => r.def.id));
  const choosable = composable.filter((d) => !runningIds.has(d.id));
  const challengeCount = running.length + choosable.length;
  const openChallenge = (pattern?: string, compose = false) => goToRoute("plans", { challenge: pattern ?? "all", compose: compose ? "1" : null });
  const printPlan = (doc: PlanBookDoc) => void openPrintablePlan({ doc, child: childProfile, lang, now: new Date() });

  // Masterplan 4.3 teach-empty: the ONE CTA focuses the existing challenge input.
  const topicInputRef = useRef<HTMLInputElement | null>(null);
  const focusTopicInput = () => {
    try { track("empty_cta_tap", { surface: "plans" }); } catch { /* noop */ }
    const el = topicInputRef.current;
    if (!el) return;
    try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* jsdom/SSR */ }
    el.focus();
  };

  // Closed loop: plan topics suggested from {name}'s own recent logged behavior.
  const suggestions = useMemo(
    () => suggestedChallenges(behaviorLogs, new Date().toISOString().slice(0, 10)),
    [behaviorLogs]
  );

  // B-ASKJB-26: a plan that has just started leads the page, with one receipt line.
  const startedReceipt = useReceiptNote();
  const seenPlanIds = useRef<Set<string> | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  React.useEffect(() => {
    if (!plansLoaded) return;
    const { seen, leadId } = nextStartedPlan(seenPlanIds.current, actionPlans, Date.now());
    seenPlanIds.current = seen;
    const lead = leadId ? actionPlans[0] : null;
    if (lead) {
      setSelectedId(lead.id);
      startedReceipt.show({ text: `${lead.title} · ${t("elev.plans.startedToday")}` });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plansLoaded, actionPlans]);
  const hasPlan = actionPlans.length > 0;
  const plan = actionPlans.find((p) => p.id === selectedId) ?? actionPlans[0] ?? null;
  const primaryStamp = {
    "data-primary-move": "advance-plan-step",
    style: { background: "var(--arbor-gradient-primary)", color: "var(--arbor-on-accent)", border: "1px solid transparent" },
  } as const;

  /* ── Challenge Plans: the composer and the plan's page ─────────────────── */
  const composerDef = target.kind === "pattern" && (target.compose || !runningIds.has(target.pattern)) ? getPattern(target.pattern) : undefined;
  if (composerDef) {
    const saved = planRows.items.find((r) => r?.id === `${composerDef.id}.${childProfile.id}` && r.status === "active");
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="w-full min-w-0" data-plans-view="compose">
        <DsRoot composition={composition} className="ds-plans">
          <PlanComposer
            key={composerDef.id}
            def={composerDef}
            child={{ id: childProfile.id, name: childProfile.name, nameLatin: childProfile.nameLatin, gender: childProfile.gender }}
            initialState={composerFromDoc(composerDef, saved, lang)}
            ownerPaint={planVisibility?.admin === true}
            onSaved={async (doc) => { await planRows.upsert(doc); }}
            onClose={() => (runningIds.has(composerDef.id) ? openChallenge(composerDef.id) : openChallenge())}
            onPrint={printPlan}
            onSafety={() => setActiveTab("safety")}
          />
        </DsRoot>
      </motion.div>
    );
  }
  const printing = target.kind === "pattern" && target.print ? running.find((r) => r.def.id === target.pattern) : undefined;
  if (printing) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="w-full min-w-0" data-plans-view="parent-copy">
        <DsRoot composition={composition} className="ds-plans">
          <PrintPreview input={{ doc: printing.doc, child: childProfile, lang, now: nowDate }} childName={first} lang={lang} onPrint={() => printPlan(printing.doc)} />
        </DsRoot>
      </motion.div>
    );
  }
  if (target.kind !== "none") {
    const focus = target.kind === "pattern" ? target.pattern : null;
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="w-full min-w-0" data-plans-view="challenge">
        <DsRoot composition={composition} className="ds-plans">
          <ChallengeScreen
            lang={lang}
            composition={composition}
            childName={first}
            gender={heGender(childProfile.gender)}
            planRows={planRows.items}
            composable={composable}
            now={nowDate}
            focus={focus}
            onFocus={(id) => openChallenge(id)}
            onStart={(d: PatternDef) => openChallenge(d.id)}
            onOpenBook={(p: ActivePlan) => openChallenge(p.def.id, true)}
            onChange={(p) => openChallenge(p.def.id, true)}
            onPrint={(p) => goToRoute("plans", { challenge: p.def.id, printout: "1" })}
            onKeep={(p) => void planRows.upsert(keepPlan(p.doc, new Date()))}
            onClose={(p) => void planRows.upsert(closePlan(p.doc, new Date()))}
            onNight={(p) => void planRows.upsert(recordNight(p.doc, new Date()))}
            onUndoNight={(p) => void planRows.upsert(unrecordNight(p.doc, new Date()))}
            onJournal={(p) => void addMoment(nightMomentText(p.def, lang, first))}
          />
        </DsRoot>
      </motion.div>
    );
  }

  /* ── the Plans home ─────────────────────────────────────────────────────── */
  const writeOwn = (
    <>
      {/* Data-driven: suggestions from {name}'s recent logged behavior, each
          with its evidence as a visible why-line (a COUNT of the parent's logs). */}
      {suggestions.length > 0 && (
        <div className="stack ds-col" style={{ gap: 8 }}>
          <span className="small" style={{ fontWeight: 700, color: "var(--green-ink)" }}>{t("plan.suggestedFor", { name: first })}</span>
          {suggestions.map((s) => (
            <div key={s.topic} className="stack ds-col" style={{ gap: 4, alignItems: "flex-start" }}>
              <button type="button" onClick={() => setPlanChallengeTopic(s.topic)} className="ds-pencil ds-plans-suggest min-h-11">
                <Icon name="auto_awesome" size={12} /> <span dir="auto">{s.topic.split("—")[0].trim()}</span>
              </button>
              <ContentWhyLine why={s.reason} />
            </div>
          ))}
        </div>
      )}
      <input
        ref={topicInputRef}
        type="text"
        value={planChallengeTopic}
        onChange={(e) => setPlanChallengeTopic(e.target.value)}
        placeholder={t("plan.placeholder")}
        aria-label={t("plan.create")}
        className="nx-in ds-plans-input"
        dir="auto"
      />
      <button
        type="button"
        onClick={handleGenerateActionPlan}
        disabled={isPlanGenerating}
        className={hasPlan ? "btn ghost block" : "btn primary block"}
        {...(hasPlan ? { style: { background: "var(--card)" } } : primaryStamp)}
      >
        {isPlanGenerating ? (<><Icon name="progress_activity" size={16} className="animate-spin" /> {t("plan.creating")}</>) : (<><Icon name="auto_awesome" size={16} /> {t("plan.createBtn")}</>)}
      </button>
      {/* B-ASKJB-49: the crisis screen answered 409 to this challenge: the
          shared crisis card (helplines in the request's language). */}
      {escalatedSurface === "plans" && (
        <UrgentSupport testId="plans-urgent-support" requestLang={aiLang} lead={t("elev.safety.paused")} onSafety={() => setActiveTab("safety")}
          className="mt-3 min-w-0 rounded-xl border border-[var(--arbor-rule-strong)] bg-[var(--arbor-paper-deep)] px-3 py-2 t-sm leading-relaxed text-[var(--arbor-ink)]" />
      )}
    </>
  );

  /* B-ASKJB-28: the family's own routines fold into ONE quiet row: "Your
     routines ({n})" opens the same RoutinesCard (open, reset, edit, add:
     unchanged); with none it reads "Add a routine". */
  const routinesRow = (
    <details data-testid="plans-routines-row" className="group">
      <summary className="ds-link" style={{ paddingInline: 0, listStyle: "none", cursor: "pointer" }}>
        <Icon name={routineCount > 0 ? "checklist" : "add"} size={16} />
        <span>{routineCount > 0 ? t("elev.plans.routines.row", { n: routineCount }) : t("elev.plans.routines.add")}</span>
        <Icon name="expand_more" size={16} className="transition group-open:rotate-180" />
      </summary>
      <div className="mt-3"><RoutinesCard /></div>
    </details>
  );

  const routine = plan ? routineIdOfPlan(plan) !== null : false;
  const step = plan && !routine ? todaysPlanStep(plan, actionLoop, todayKey) : null;
  const showScripts = !!plan && !routine && plan.scripts.length > 0;
  const steps = plan ? plan.phases.reduce((n, ph) => n + ph.steps.length, 0) : 0;
  const stepsDone = plan ? planDoneSteps(plan) : 0;
  const todaySteps: Record<string, string | null> = {};
  for (const p of actionPlans) todaySteps[p.id] = routineIdOfPlan(p) !== null ? null : todaysPlanStep(p, actionLoop, todayKey)?.text ?? null;

  const anyPlan = hasPlan || running.length > 0;
  const stops: GuideStop[] = [
    ...(anyPlan || !plansLoaded ? [{ id: "plans-stage", title: c.yourPlans, sub: c.yourPlansSub(actionPlans.length, running.length) }] : []),
    ...(showScripts ? [{ id: "plans-rail", title: c.whatToSay, sub: c.whatToSaySub(plan!.scripts.length) }] : []),
    ...(plan ? [{ id: "plans-whole", title: c.wholePlan, sub: routine ? undefined : c.stepsDoneSub(stepsDone, steps) }] : []),
    { id: "plans-start", title: c.startAnother },
  ];
  const n = (id: string) => stops.findIndex((s) => s.id === id) + 1;

  const stage = plan && (routine ? (
    /* v3 FEAT-07: an active routine plan runs as its day board; the contract
       stamp lands on its first step still to do today. */
    <div className="vt" data-testid="plan-tracks" data-routine-plan="true">
      <RoutineRunBoard plan={plan} primaryProps={primaryStamp} now={now} />
    </div>
  ) : (
    <ActionPlanStage
      plan={plan}
      step={step}
      today={activeTodayAction}
      lang={lang}
      now={now}
      composition={composition}
      primary={primaryStamp}
      echo={planEcho(plan.id, actionLoop, step, todayKey, planDoneSteps(plan))}
      childName={first}
      onTryIt={(text, ref) => acceptTodayAction(text, "standard", "plan", ref)}
      onUndo={(id) => removeTodayAction(id)}
      onCheck={(answer) => recordPlanWeeklyCheck(plan.id, answer)}
      onAdjust={() => seedCoach({ prompt: planAdjustSeed(lang, plan.title, lastPlanOutcomes(plan.id, actionLoop)), source: "plans-adjust" })}
    />
  ));
  const scripts = showScripts && plan && (
    <PlanScripts plan={plan} lang={lang} composition={composition} n={n("plans-rail")} onRefine={() => seedCoach({ prompt: t("seed.planCoreg", { title: plan.title }), source: "plans-coreg" })} />
  );

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-full min-w-0" data-plans-view="home">
      <DsRoot composition={composition} className="ds-plans">
        {stops.length > 1 && <Guide stops={stops} label={c.onThisPage} mini={!desk} />}
        <Route composition={composition} tight={!desk}>
          {(anyPlan || !plansLoaded) && (
            <RouteSection id="plans-stage" n={1} on>
              <div data-module="plans-yours" className="stack ds-col" style={{ gap: desk ? 0 : 12 }}>
                <ReceiptNoteLine note={startedReceipt.note} testId="plans-started-receipt" />
                {!plansLoaded && <SectionSkeleton title={false} rows={2} rowClassName="h-48" loaded={plansLoaded} testId="plans-skeleton" />}
                <PlanPicker
                  actionPlans={actionPlans}
                  selectedId={plan?.id ?? null}
                  todaySteps={todaySteps}
                  challenges={running}
                  lang={lang}
                  composition={composition}
                  onSelect={setSelectedId}
                  onOpenChallenge={(p) => openChallenge(p.def.id)}
                />
                {plan && desk && (
                  <div className="g12" data-testid={routine ? undefined : "plan-tracks"}>
                    <div className={showScripts ? "x8" : "x12"} style={{ display: "flex", flexDirection: "column" }}>{stage}</div>
                    {scripts}
                  </div>
                )}
                {plan && !desk && <div data-testid={routine ? undefined : "plan-tracks"}>{stage}</div>}
              </div>
            </RouteSection>
          )}
          {!desk && scripts && (
            <RouteSection id="plans-rail" n={n("plans-rail")}>{scripts}</RouteSection>
          )}
          {plan && (
            <RouteSection id="plans-whole" n={n("plans-whole")} stopTop={2}>
              <div data-module="plans-whole" className="stack ds-col" style={{ gap: 12 }}>
                {routine ? (
                  <>
                    <RouteHead title={c.wholePlan} />
                    <PlanSteps plan={plan} now={now} beside="board" />
                  </>
                ) : (
                  <PlanWhole plan={plan} todayStep={step} lang={lang} composition={composition} />
                )}
              </div>
            </RouteSection>
          )}
          <RouteSection id="plans-start" n={n("plans-start")} on={!anyPlan && plansLoaded} stopTop={2}>
            <div data-module="plans-start" className="stack ds-col" style={{ gap: 12 }}>
              <RouteHead title={c.startAnother} />
              {plansLoaded && !anyPlan && (
                /* Masterplan 4.3 teach-empty: a ghost of a filled plan card and
                   the ONE CTA focusing the challenge input below. */
                <EmptyState
                  icon={<Icon name="tune" size={32} />}
                  illustration={EMPTY_ART.plans}
                  headline={t("plan.empty.head")}
                  body={t("plan.empty.body")}
                  cta={statesText("elev.states.plans.cta", uiLang === "he")}
                  onCta={focusTopicInput}
                  ctaTestId="plans-empty-cta"
                  preview={
                    <div className="mx-auto w-full max-w-md rounded-2xl border p-4 text-start" style={{ borderColor: "var(--arbor-rule)" }}>
                      <div className="flex items-center justify-between gap-3">
                        <GhostBlock className="h-4 w-40 rounded-full" />
                        <GhostBlock className="h-3 w-16 rounded-full" />
                      </div>
                      <GhostBlock className="mt-3 h-2 w-full rounded-full" />
                      <div className="mt-3 space-y-2">
                        <GhostBlock className="h-3 w-4/5" />
                        <GhostBlock className="h-3 w-3/5" />
                      </div>
                    </div>
                  }
                />
              )}
              <StartAnother
                lang={lang}
                composition={composition}
                childName={first}
                choosable={choosable}
                challengeCount={challengeCount}
                onAllChallenges={() => openChallenge()}
                onOpenPattern={(d) => openChallenge(d.id)}
                readyMadeCount={readyMadeCount}
                readyMade={<RoutineTemplates />}
                onTogether={() => setActiveTab("practice")}
                routines={routinesRow}
                writeOwnTitle={t("plan.create")}
                writeOwn={writeOwn}
              />
            </div>
          </RouteSection>
        </Route>
      </DsRoot>
    </motion.div>
  );
}
