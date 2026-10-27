import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { useArbor, type CaptureMode } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useObservations } from "../../hooks/useObservations";
import { useTimeline } from "../../hooks/useTimeline";
import { useChildCollection } from "../../hooks/useChildCollection";
import { useNoticeActions } from "../../hooks/useNoticeActions";
import { goToRoute } from "../../hooks/useHashQuery";
import { PRACTICES } from "../../content/practices";
import type { Milestone } from "../../types";
import { SHELF_IDS, shelfDef, type ShelfId } from "../../lib/shelves/registry";
import { shelfCoverage } from "../../lib/milestones/selectByShelf";
import type { ObserveStatus } from "../../lib/milestones/observe";
import { openNoticeDetail } from "../../lib/noticeNavigation";
import { comparisonMonthsOf } from "../../lib/age/forChild";
import { recentPracticeIds, todayDose } from "../../lib/practice/choosePractice";
import { readTodayPin, writeTodayPin } from "../../lib/practice/todayPin";
import { latestOwnEntry, ownWordsByShelf, practiceTryTitle, proDomainCounts, shelfDayLabel, shelfNotice, shelfPractice, shelfTryPractice, signalsOnShelf, tileWordsExcept } from "../../lib/journal/shelfView";
import { selectNextMilestonesByShelf } from "../../lib/milestones/selectByShelf";
import { milestoneText } from "../../lib/milestoneData";
import { quotesFromDocs } from "../../lib/loop/tonight";
import QuickCaptureBar from "../overview/QuickCaptureBar";
import { availableHardMomentCards } from "../../content/selectCards";
import { ageMonthsFromProfile } from "../../lib/childAge";
import { groupByDay, SIGNAL_PROVENANCE, signalDetail, signalTitle } from "../../lib/signalTimeline";
import { withChildSignals } from "../../lib/i18nElevation/childsignals";
import QuickLogModal from "../overview/QuickLogModal";
import ShelfGrid from "./ShelfGrid";
import ShelfPage, { type ShelfDayGroup } from "./ShelfPage";
import ProView from "./ProView";
import { buildIntakePacket, isIntakeProfession, type IntakeProfession } from "../../consult/packet";
import { intakeQuestionLines, readIntakeQuestionsText, writeIntakeQuestionsText } from "../../consult/intakeDraft";
import { programPageModel } from "../../lib/programPage";
import type { SleepLogEntry } from "../../types";
import type { FamilyGoal } from "../../lib/goals";
import PlansSection from "../plans/PlansSection";
import PlanComposer from "../plans/PlanComposer";
import { getPattern } from "../../lib/library/plans/planBooks";
import type { PlanBookDoc } from "../../lib/library/plans/planBookDoc";
import { closePlan, keepPlan, type ActivePlan } from "../../lib/plans/planWeek";
import { usePlanVisibility } from "../../lib/plans/usePlanVisibility";
import { isPatternId } from "../../lib/library/plans/planVisibility";
import { composerFromDoc } from "../../lib/plans/composerFromDoc";

/** A query value that names a shelf, or null (an unknown id falls back to the grid). */
export function shelfFromQuery(v: string | null): ShelfId | null {
  return v && (SHELF_IDS as readonly string[]).includes(v) ? (v as ShelfId) : null;
}

/**
 * B-LOOP-11 — the journal by shelves: the wiring behind ShelfGrid and
 * ShelfPage (both presentational). Reads the ONE read model
 * (useObservations), the ONE timeline stream (useTimeline) and the existing
 * seams: the B-LOOP-09 chooser scoped to a shelf, the B-LOOP-04 Notice
 * selection, setMilestoneObservation, the keepsake sink, the ONE capture sheet
 * (QuickLogModal, pre-filed on the shelf). No new write path except the
 * device-local "Try it today" pin (lib/practice/todayPin).
 */
export default function JournalShelves({ shelf, pro = false, intakeFor = null, plan = null, primaryMoveProps }: {
  shelf: ShelfId | null;
  /** B-BOOK-77: `#/journal?plan=<patternId>` — the Everyday Plans composer for that pattern. */
  plan?: string | null;
  /** B-LOOP-12: `#/journal?view=pro` — the professional view. */
  pro?: boolean;
  /** B-LOOP-12: `&for=<profession>` preselects a chip (default: speech therapist). */
  intakeFor?: string | null;
  primaryMoveProps?: Record<string, string>;
}) {
  const { childProfile, milestones, behaviorLogs, actionLoop, requestJournalFocus, openHardMomentNow } = useArbor();
  const notices = useNoticeActions();
  const keepsakes = notices.keepsakes;
  const { t, uiLang } = useLanguage();
  const locale = uiLang === "he" ? "he" : "en";
  const tt = useMemo(() => withChildSignals(t, uiLang === "he"), [t, uiLang]);
  const childName = (childProfile.name || "").split(" ")[0] || t("learn.yourChild");
  const observations = useObservations();
  const signals = useTimeline();
  const now = useMemo(() => new Date(), [observations, actionLoop, milestones]);
  const coverage = useMemo(() => shelfCoverage(observations, now), [observations, now]);

  // ── the ONE capture sheet, pre-filed on the open shelf ──
  const [capture, setCapture] = useState<{ open: boolean; mode: CaptureMode }>({ open: false, mode: "text" });

  // ── B-BOOK-77/78: Everyday Plans — the child's plan books (the `books` seam:
  //    the parent's choices, persisted here after the server's approval), the
  //    server's visibility table (never decided on the device), and the
  //    composer for `?plan=<pattern>`. Keep / close write the same row;
  //    "change" reopens the composer on the saved choices. ──
  const planRows = useChildCollection<PlanBookDoc>(childProfile.id, "books");
  const planVisibility = usePlanVisibility();
  const planDef = plan && isPatternId(plan) ? getPattern(plan) : undefined;
  const openPlanDoor = (pattern: string) => goToRoute("journal", { plan: pattern });
  const savePlanDoc = async (doc: PlanBookDoc) => { await planRows.upsert(doc); };
  const keepPlanRow = (p: ActivePlan) => { void planRows.upsert(keepPlan(p.doc, new Date())); };
  const closePlanRow = (p: ActivePlan) => { void planRows.upsert(closePlan(p.doc, new Date())); };
  const plansSectionFor = (scope?: ShelfId) => (
    <PlansSection
      childName={childName}
      planRows={planRows.items}
      visibility={planVisibility}
      now={now}
      shelf={scope}
      onOpenDoor={openPlanDoor}
      onOpenPlan={(p) => openPlanDoor(p.def.id)}
      onKeep={keepPlanRow}
      onChange={(p) => openPlanDoor(p.def.id)}
      onClose={closePlanRow}
    />
  );

  // ── the shelf's practice (the chooser, scoped) and "Try it today" ──
  const comparisonMonths = comparisonMonthsOf(childProfile, now);
  const practicePick = useMemo(
    () => (shelf ? shelfPractice({
      childId: childProfile.id,
      milestones,
      comparisonMonths,
      practices: PRACTICES,
      coverage,
      today: now,
      recentPracticeIds: recentPracticeIds(actionLoop, childProfile.id, now),
    }, shelf) : null),
    [shelf, childProfile.id, milestones, comparisonMonths, coverage, now, actionLoop],
  );
  const dose = useMemo(() => todayDose(actionLoop, childProfile.id, now), [actionLoop, childProfile.id, now]);
  const [pinned, setPinned] = useState<string | undefined>(() => readTodayPin(childProfile.id));
  const todaysId = dose?.practiceId ?? pinned;
  const tryToday = () => {
    if (!practicePick) return;
    writeTodayPin(childProfile.id, practicePick.practice.id);
    setPinned(practicePick.practice.id);
  };

  // ── the shelf's next thing to notice (the B-LOOP-04 handlers, as on Today) ──
  const notice = useMemo(() => (shelf ? shelfNotice(milestones, comparisonMonths, shelf, now) : null), [shelf, milestones, comparisonMonths, now]);
  const [held, setHeld] = useState<{ id: string; scope: string; shelf: ShelfId | null } | null>(null);
  const currentHeld = held?.scope === notices.scopeKey && held.shelf === shelf ? held : null;
  const shownNotice = currentHeld && currentHeld.id !== notice?.milestone.id ? milestones.find((m) => m.id === currentHeld.id) ?? null : notice?.milestone ?? null;
  const noticeHandlers = (m: Milestone) => {
    const actions = notices.forMilestone(m);
    return {
      ...actions,
      onAnswer: (status: ObserveStatus) => {
        setHeld({ id: m.id, scope: notices.scopeKey, shelf });
        return actions.onAnswer(status);
      },
      onOpen: () => openNoticeDetail(childProfile.id, m.id),
      onDetails: () => openNoticeDetail(childProfile.id, m.id),
      onKeepPhoto: () => openNoticeDetail(childProfile.id, m.id, { editEvidence: true }),
      ...(actions.onUndo ? { onUndo: async () => {
        const restored = await actions.onUndo!();
        setHeld(previous => previous?.scope === notices.scopeKey && previous.id === m.id ? null : previous);
        return restored;
      } } : {}),
    };
  };

  // ── the shelf's entries: the journal engine (groupByDay), filtered by shelfOf only ──
  const groups = useMemo<ShelfDayGroup[]>(() => {
    if (!shelf) return [];
    const onShelf = signalsOnShelf(signals, observations, shelf);
    return groupByDay(onShelf, Date.now(), { locale, ongoingLabel: t("timeline.ongoing") }).map((g) => ({
      key: g.key,
      label: g.label,
      rows: g.signals.map((s) => {
        const words = s.kind === "moment" && SIGNAL_PROVENANCE[s.kind] === "manual" ? signalDetail(s, tt).trim() : "";
        return {
          id: s.id,
          title: signalTitle(s, tt),
          ...(words ? { words } : {}),
          when: s.at ? new Date(s.at).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" }) : "",
        };
      }),
    }));
  }, [shelf, signals, observations, locale, t, tt]);

  // ── B-LOOP-12: the professional view — the intake packet per profession ──
  const [profession, setProfession] = useState<IntakeProfession>(() => (isIntakeProfession(intakeFor) ? intakeFor : "slp"));
  const [questions, setQuestions] = useState<string>(() => readIntakeQuestionsText(childProfile.id, isIntakeProfession(intakeFor) ? intakeFor : "slp"));
  const selectProfession = (p: IntakeProfession) => {
    setProfession(p);
    setQuestions(readIntakeQuestionsText(childProfile.id, p));
  };
  const changeQuestions = (text: string) => {
    setQuestions(text);
    writeIntakeQuestionsText(childProfile.id, profession, text);
  };
  // B-PROG-05: the enrolled program's line (only while an enrolment is active; the packet scopes it to the profession)
  const programRows = useChildCollection<{ id: string }>(childProfile.id, "programs");
  const sleepLogs = useChildCollection<SleepLogEntry & { id: string }>(childProfile.id, "sleepLogs");
  // B-PROG-09: the home program's goal words (the pro view renders the home-program line only, never the number)
  const familyGoalsCol = useChildCollection<FamilyGoal>(childProfile.id, "familyGoals");
  const intakeProgram = useMemo(
    () => (pro ? programPageModel(programRows.items, { childId: childProfile.id, actionLoops: actionLoop, sleepLogs: sleepLogs.items, observations }, now, uiLang === "he" ? "he" : "en", childProfile.gender ?? null) : null),
    [pro, programRows.items, childProfile.id, childProfile.gender, actionLoop, sleepLogs.items, observations, now, uiLang],
  );
  const intakePacket = useMemo(
    () => (pro ? buildIntakePacket(profession, {
      child: childProfile,
      milestones,
      behaviorLogs,
      actionLoops: actionLoop,
      questions: intakeQuestionLines(questions),
      comparisonMonths,
      nowMs: now.getTime(),
      lang: uiLang === "he" ? "he" : "en",
      // c2 r2 (G1-3): the child's kept quotes lead the SLP packet's Moments
      quotes: quotesFromDocs(keepsakes.items),
      program: intakeProgram,
      homePrograms: programRows.items,
      familyGoals: familyGoalsCol.items,
    }) : null),
    [pro, profession, childProfile, milestones, behaviorLogs, actionLoop, questions, comparisonMonths, now, uiLang, keepsakes.items, intakeProgram, programRows.items, familyGoalsCol.items],
  );
  const domainCounts = useMemo(() => proDomainCounts(observations, (s) => shelfDef(s).domain, now), [observations, now]);

  // ── B-LOOP-NEW-1c / 1d (P5-LOOP c2 r1): the grid remembers in the parent's
  //    words — the latest own entry under the lede, per tile the latest words
  //    (filled) or the shelf's practice (empty). Grid only; zero model calls. ──
  const onGrid = !shelf && !pro;
  // the hard-moment tile, as on Today: only when a card fits the child's age
  const hardMomentTile = useMemo(
    () => availableHardMomentCards({ now, ageMonths: ageMonthsFromProfile(childProfile, now), locale }).length > 0,
    [childProfile, now, locale],
  );
  // c2 r2 (journal P1 G1-1 + design P1, B-LOOP-NEW-2c/2d): the family's own
  // words per shelf — the parent's notes, and on Words the child's kept
  // quotes. The header carries the newest note; its tile shows the shelf's
  // PREVIOUS line instead, so no sentence renders twice.
  const keptQuotes = useMemo(() => quotesFromDocs(keepsakes.items), [keepsakes.items]);
  const ownWords = useMemo(
    () => (onGrid ? ownWordsByShelf(observations, behaviorLogs, keptQuotes, SHELF_IDS) : {}),
    [onGrid, observations, behaviorLogs, keptQuotes],
  );
  const latestOwn = useMemo(() => latestOwnEntry(ownWords), [ownWords]);
  // P7-DESIGN fix r1 (framer ruling R5): on a shelf page the shelf's newest own
  // words (the same source as its grid tile — on Words the child's kept quote)
  // lead "On this shelf" as its first ordinary row (ShelfPage shelfEntryGroups).
  const pageWords = useMemo(() => {
    if (!shelf) return null;
    const w = ownWordsByShelf(observations, behaviorLogs, keptQuotes, [shelf])[shelf]?.[0];
    return w ? { id: w.id, text: w.text, day: shelfDayLabel(w.at, now, locale) } : null;
  }, [shelf, observations, behaviorLogs, keptQuotes, now, locale]);
  const tileWords = useMemo(() => {
    const out: Partial<Record<ShelfId, { text: string; date: string }>> = {};
    for (const [id, w] of Object.entries(tileWordsExcept(ownWords, latestOwn?.id)) as [ShelfId, { text: string; at: string }][]) out[id] = { text: w.text, date: shelfDayLabel(w.at, now, locale) };
    return out;
  }, [ownWords, latestOwn, now, locale]);
  // (b) a filled shelf without words: its next thing to notice (the shelf
  // page's own pick — never ahead of band), as a title.
  const tileNotice = useMemo(() => {
    const out: Partial<Record<ShelfId, string>> = {};
    if (!onGrid || comparisonMonths === null) return out;
    for (const p of selectNextMilestonesByShelf(milestones, comparisonMonths, { perShelf: 1, total: 9, now })) {
      if (!out[p.shelf]) out[p.shelf] = milestoneText(p.milestone, "title", t, { gender: childProfile.gender });
    }
    return out;
  }, [onGrid, milestones, comparisonMonths, now, t, childProfile.gender]);
  // (c) the shelf's practice — an empty shelf's line, and a filled shelf's last
  // resort. Critic residue (7 Oct): a filled shelf whose chooser pick was
  // excluded by recency showed a bare count; shelfTryPractice falls back to
  // the pick without the recency exclusion, then the shelf's catalogue
  // practice, and the line names the child (never "your child").
  const tileTry = useMemo(() => {
    const out: Partial<Record<ShelfId, string>> = {};
    if (!onGrid) return out;
    const firstName = (childProfile.name || "").split(" ")[0] || "";
    for (const id of SHELF_IDS) {
      if ((coverage[id] ?? 0) > 0 && (tileWords[id] || tileNotice[id])) continue;
      const practice = shelfTryPractice({ childId: childProfile.id, milestones, comparisonMonths, practices: PRACTICES, coverage, today: now, recentPracticeIds: recentPracticeIds(actionLoop, childProfile.id, now) }, id);
      if (practice) out[id] = practiceTryTitle(practice, locale, firstName, childProfile.gender);
    }
    return out;
  }, [onGrid, coverage, tileWords, tileNotice, childProfile.id, childProfile.name, childProfile.gender, milestones, comparisonMonths, now, actionLoop, locale]);
  const openEntry = (id: string) => {
    if (id.startsWith("milestone-") && milestones.some(milestone => `milestone-${milestone.id}` === id)) {
      openNoticeDetail(childProfile.id, id.slice("milestone-".length));
      return;
    }
    goToRoute("journal", { view: "all" });
    requestJournalFocus(id);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="w-full min-w-0">
      {planDef ? (
        <PlanComposer
          key={planDef.id}
          def={planDef}
          child={{ id: childProfile.id, name: childProfile.name, gender: childProfile.gender }}
          initialState={composerFromDoc(planDef, planRows.items.find((r) => r?.id === `${planDef.id}.${childProfile.id}` && r.status === "active"), locale)}
          onSaved={savePlanDoc}
          onClose={() => goToRoute("journal")}
          onSafety={() => goToRoute("safety")}
        />
      ) : pro && intakePacket ? (
        <ProView
          childName={childName}
          profession={profession}
          onSelectProfession={selectProfession}
          packet={intakePacket}
          questions={questions}
          onQuestionsChange={changeQuestions}
          onEgress={() => goToRoute("consult", { intake: profession })}
          counts={domainCounts}
          onBack={() => goToRoute("journal")}
          primaryMoveProps={primaryMoveProps}
        />
      ) : shelf ? (
        <ShelfPage
          shelf={shelf}
          childName={childName}
          gender={childProfile.gender}
          count={coverage[shelf] ?? 0}
          practice={practicePick?.practice ?? null}
          practiceIsToday={!!practicePick && todaysId === practicePick.practice.id}
          onTryToday={tryToday}
          notice={shownNotice}
          noticeHandlers={shownNotice ? noticeHandlers(shownNotice) : { onAnswer: () => undefined }}
          groups={groups}
          leadWords={pageWords}
          onOpenEntry={openEntry}
          onBack={() => goToRoute("journal")}
          onAdd={() => setCapture({ open: true, mode: "text" })}
          primaryMoveProps={primaryMoveProps}
          plansSection={plansSectionFor(shelf)}
        />
      ) : (
        <ShelfGrid
          childName={childName}
          counts={coverage}
          onOpenShelf={(id) => goToRoute("journal", { shelf: id })}
          onOpenPro={() => goToRoute("journal", { view: "pro" })}
          onOpenAll={() => goToRoute("journal", { view: "all" })}
          primaryMoveProps={primaryMoveProps}
          latest={latestOwn ? { text: latestOwn.text, shelf: latestOwn.shelf, day: shelfDayLabel(latestOwn.at, now, locale) } : null}
          tileWords={tileWords}
          tileTry={tileTry}
          tileNotice={tileNotice}
          captureDock={
            /* The ONE capture sheet, UNFILED: extract_log proposes the shelf and
               the parent confirms it in the sheet (B-LOOP-06) — no filing
               decision before writing. */
            <QuickCaptureBar
              childName={childName}
              onText={() => setCapture({ open: true, mode: "text" })}
              onMode={(mode) => setCapture({ open: true, mode })}
              onHardMoment={hardMomentTile ? () => openHardMomentNow() : undefined}
            />
          }
          plansSection={plansSectionFor()}
        />
      )}
      <QuickLogModal open={capture.open} mode={capture.mode} shelf={shelf ?? undefined} onClose={() => setCapture((c) => ({ ...c, open: false }))} />
    </motion.div>
  );
}
