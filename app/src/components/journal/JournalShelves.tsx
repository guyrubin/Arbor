import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { useArbor, type CaptureMode } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useObservations } from "../../hooks/useObservations";
import { useTimeline } from "../../hooks/useTimeline";
import { useChildCollection } from "../../hooks/useChildCollection";
import { goToRoute } from "../../hooks/useHashQuery";
import { PRACTICES } from "../../content/practices";
import type { Milestone } from "../../types";
import { SHELF_IDS, shelfDef, type ShelfId } from "../../lib/shelves/registry";
import { shelfCoverage } from "../../lib/milestones/selectByShelf";
import { localDay, type ObserveStatus, type ObservedWhen } from "../../lib/milestones/observe";
import { keepsakeDoc, type KeepsakeDoc } from "../../lib/firstsKeepsake";
import { comparisonMonthsOf } from "../../lib/age/forChild";
import { recentPracticeIds, todayDose } from "../../lib/practice/choosePractice";
import { readTodayPin, writeTodayPin } from "../../lib/practice/todayPin";
import { latestOwnWords, latestWordsByShelf, proDomainCounts, shelfDayLabel, shelfNotice, shelfPractice, signalsOnShelf } from "../../lib/journal/shelfView";
import { practiceTitle } from "../../lib/practice/practiceTitle";
import { practiceText } from "../loop/PracticeCard";
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
export default function JournalShelves({ shelf, pro = false, intakeFor = null, primaryMoveProps }: {
  shelf: ShelfId | null;
  /** B-LOOP-12: `#/journal?view=pro` — the professional view. */
  pro?: boolean;
  /** B-LOOP-12: `&for=<profession>` preselects a chip (default: speech therapist). */
  intakeFor?: string | null;
  primaryMoveProps?: Record<string, string>;
}) {
  const { childProfile, milestones, behaviorLogs, actionLoop, setMilestoneObservation, restoreMilestone, requestJournalFocus, openHardMomentNow } = useArbor();
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
  const [held, setHeld] = useState<{ id: string; before: Milestone } | null>(null);
  const shownNotice = held && held.id !== notice?.milestone.id ? milestones.find((m) => m.id === held.id) ?? null : notice?.milestone ?? null;
  const keepsakes = useChildCollection<KeepsakeDoc>(childProfile.id, "keepsakes");
  const noticeHandlers = (m: Milestone) => ({
    onAnswer: (status: ObserveStatus) => {
      setHeld((p) => (p?.id === m.id ? p : { id: m.id, before: m }));
      setMilestoneObservation(m.id, status);
    },
    onWhen: (when: ObservedWhen) => setMilestoneObservation(m.id, "yes", { when }),
    onKeepQuote: (note: string) => {
      const at = new Date().toISOString();
      void keepsakes.upsert(keepsakeDoc({ milestoneId: m.id, note: note.slice(0, 280), noticedOn: localDay(new Date()), createdAt: at, updatedAt: at }));
    },
    onKeepPhoto: () => setCapture({ open: true, mode: "photo" }),
    onUndo: () => {
      if (held?.id === m.id) restoreMilestone(held.before);
      setHeld(null);
    },
  });

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
    }) : null),
    [pro, profession, childProfile, milestones, behaviorLogs, actionLoop, questions, comparisonMonths, now, uiLang],
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
  const wordsByShelf = useMemo(
    () => (onGrid ? latestWordsByShelf(observations, behaviorLogs, SHELF_IDS) : {}),
    [onGrid, observations, behaviorLogs],
  );
  const latestOwn = useMemo(() => latestOwnWords(wordsByShelf), [wordsByShelf]);
  const tileWords = useMemo(() => {
    const out: Partial<Record<ShelfId, { text: string; date: string }>> = {};
    for (const [id, w] of Object.entries(wordsByShelf) as [ShelfId, { text: string; at: string }][]) out[id] = { text: w.text, date: shelfDayLabel(w.at, now, locale) };
    return out;
  }, [wordsByShelf, now, locale]);
  const tileTry = useMemo(() => {
    const out: Partial<Record<ShelfId, string>> = {};
    if (!onGrid) return out;
    for (const id of SHELF_IDS) {
      if ((coverage[id] ?? 0) > 0) continue;
      const pick = shelfPractice({ childId: childProfile.id, milestones, comparisonMonths, practices: PRACTICES, coverage, today: now, recentPracticeIds: recentPracticeIds(actionLoop, childProfile.id, now) }, id);
      if (pick) out[id] = practiceTitle(practiceText(pick.practice, "do", locale, childProfile.gender), locale);
    }
    return out;
  }, [onGrid, coverage, childProfile.id, childProfile.gender, milestones, comparisonMonths, now, actionLoop, locale]);

  const openEntry = (id: string) => {
    goToRoute("journal", { view: "all" });
    requestJournalFocus(id);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="w-full min-w-0">
      {pro && intakePacket ? (
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
          onOpenEntry={openEntry}
          onBack={() => goToRoute("journal")}
          onAdd={() => setCapture({ open: true, mode: "text" })}
          primaryMoveProps={primaryMoveProps}
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
        />
      )}
      <QuickLogModal open={capture.open} mode={capture.mode} shelf={shelf ?? undefined} onClose={() => setCapture((c) => ({ ...c, open: false }))} />
    </motion.div>
  );
}
