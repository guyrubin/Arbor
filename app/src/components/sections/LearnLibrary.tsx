/**
 * Learn Library — Academy's browsable developmental-education shelf.
 *
 * The clarity+capture surface: every read is a Learn Card (5 key points →
 * full read → one thing to try today), saveable in one tap, shareable, and
 * wired into Ask Arbor via the seedCoach seam (prefill only, parent sends).
 *
 * Personalization is explainable and nothing more: the child's age and the
 * Development Map focus domain float matching cards up, and the rail says so
 * in one sentence. FRAMING GATE (inherited from Scholar Hub AP-055): the
 * focus domain is an opportunity to nurture, never a deficit.
 *
 * Static catalogue, no AI call at browse time, no child-data write beyond
 * the bookmark (card id only). TOKEN-DRIVEN styling; HE/RTL via logical CSS.
 */
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { cardCls } from "../ui/kit";
import { PASTEL } from "../../lib/tokens";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useDevScore } from "../../hooks/useDevScore";
import { useArborVoice } from "../../hooks/useArborVoice";
import { ageMonthsFromProfile, ageYearsFromProfile } from "../../lib/childAge";
import { filterByAge, loadShowAllAges, saveShowAllAges, windowFromYears } from "../../lib/ageFilter";
import { agefilterText } from "../../lib/i18nElevation/agefilter";
import { track } from "../../lib/analytics";
import { concernsForBehaviors } from "../../content/selectCards";
import { recentBehaviorTypes } from "../../content/hardMomentSurface";
import { readLearnFeedback, setLearnFeedback, type LearnFeedback } from "../../learn/learnFeedback";
import { learnReadCount, markLearnCardRead, readLearnReadIds } from "../../learn/learnReadState";
import {
  LEARN_CATEGORIES,
  concernsContributed,
  continuesSaved,
  learnCategoryById,
  learnContinuationTopics,
  rankLearnCards,
  searchLearnCards,
  type LearnCard,
  type LearnCategoryId,
  type LearnRankSignals,
} from "../../learn/learnLibrary";
import { continueText } from "../../lib/i18nElevation/continue";
import { LEARN_CARDS, learnCardById } from "../../learn/learnCards";
import { isLearnPilotCard, learnPilotText } from "../../learn/learnPilotRelease";
import { focusDomainContributed } from "../../learn/todaysPick";
import { ContentActionBar, ContentWhyLine } from "../ui/ContentActionBar";
import { TrustLink } from "../trust/TrustLink";

type Filter = "all" | "saved" | LearnCategoryId;

/**
 * R12 — how many reads the browse shelf shows before the parent asks for more.
 *
 * The age filter is ON and IS applied (filterByAge below); it removes 14 of 93
 * cards for a five-year-old, because 79 of the 93 declare a band that really
 * does contain age 5 (0–12, 1–10, 2–8 …). So age alone cannot make this shelf
 * short, and pushing in-band cards behind the "hidden by age" toggle would put
 * a false sentence on screen. The LENGTH problem gets its own, truthfully
 * labelled control: the shelf pages, the age toggle filters, and each says
 * only what it does. Every card stays one tap away (law 6).
 */
const SHELF_PAGE = 30;

const pick = (he: boolean, t: { en: string; he: string }) => (he ? t.he : t.en);

export default function LearnLibrary() {
  const {
    childProfile,
    seedCoach,
    savedLearnIds,
    toggleSavedLearn,
    behaviorLogs,
    pendingLearnRequest,
    consumeLearnRequest,
    acceptTodayAction,
    actionLoop,
  } = useArbor();
  const { t, uiLang, aiLang } = useLanguage();
  const he = aiLang === "he";
  const isRtl = uiLang === "he";
  const firstName = (childProfile.name || "").split(" ")[0];
  const score = useDevScore();
  const ageYears = ageYearsFromProfile(childProfile);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<LearnFeedback>(() => readLearnFeedback());

  // LC-21 — reads the parent has already opened, on this device, for THIS
  // child (the shelf is child-scoped throughout: age window, ranking, saved).
  // Storage that is unavailable or cleared yields [], which renders the same
  // correct, unmarked library the surface shipped with.
  const [readIds, setReadIds] = useState<string[]>(() => readLearnReadIds(childProfile.id));
  useEffect(() => {
    setReadIds(readLearnReadIds(childProfile.id));
  }, [childProfile.id]);
  const markRead = (cardId: string) => setReadIds(markLearnCardRead(childProfile.id, cardId));

  // LL — deep-link seam: another surface asked for one read or one shelf.
  useEffect(() => {
    if (!pendingLearnRequest) return;
    if (pendingLearnRequest.cardId && learnCardById(pendingLearnRequest.cardId)) {
      setOpenId(pendingLearnRequest.cardId);
      // A deep-linked open is an open: mark it here too, or arriving from the
      // hub's "today's read" would leave the library still showing it unread.
      markRead(pendingLearnRequest.cardId);
    } else if (pendingLearnRequest.category) {
      setFilter(pendingLearnRequest.category as Filter);
      setOpenId(null);
    }
    consumeLearnRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingLearnRequest]);

  // LL-A2 — observed-signal ranking input: recent logged behavior types mapped
  // through the controlled concern vocabulary. Counts, never verdicts.
  const recentConcerns = useMemo(
    () => concernsForBehaviors(recentBehaviorTypes(behaviorLogs, new Date())),
    [behaviorLogs]
  );

  // W2 2.5: saved bookmarks feed the ranking as a topic-continuation nudge
  // ("continues what you saved") — card ids only, no child data.
  const signals: LearnRankSignals = useMemo(
    () => ({
      ageYears,
      focusDomain: score.focusDomain,
      recentConcerns,
      helpfulness: feedback,
      savedIds: savedLearnIds,
    }),
    [ageYears, score.focusDomain, recentConcerns, feedback, savedLearnIds]
  );

  const ranked = useMemo(() => rankLearnCards(LEARN_CARDS, signals), [signals]);

  // OBJ-LEARN-01 — the surface contract says the shelf is age-banded, and it
  // was not: 93 cards, 0–1 bands included, in one 23,000 px column for a
  // five-year-old. This is the SAME mechanism Masterclasses already uses
  // (lib/ageFilter `filterByAge` + `windowFromYears`, the per-surface
  // "Show all ages" preference, and the "N hidden by age" toggle) — ported,
  // not reinvented, so both shelves behave identically. LearnCard states its
  // band in YEARS, which is exactly what `windowFromYears` takes.
  const [showAllAges, setShowAllAges] = useState<boolean>(() => loadShowAllAges("learn"));
  const childMonths = ageMonthsFromProfile(childProfile);
  const { visible: ageVisible, hidden: ageHidden } = useMemo(
    () => filterByAge(ranked, (c) => windowFromYears(c.ageMin, c.ageMax), childMonths),
    [ranked, childMonths]
  );
  const toggleShowAllAges = () => {
    setShowAllAges((prev) => {
      const next = !prev;
      saveShowAllAges("learn", next);
      try { track("agefilter_toggle", { surface: "learn", showAll: next }); } catch { /* noop */ }
      return next;
    });
  };
  const inScope = showAllAges ? ranked : ageVisible;

  const visible = useMemo(() => {
    let list = inScope;
    if (filter === "saved") list = list.filter((c) => savedLearnIds.includes(c.id));
    else if (filter !== "all") list = list.filter((c) => c.category === filter);
    return searchLearnCards(list, query, he);
  }, [inScope, filter, query, he, savedLearnIds]);

  const featured = inScope.slice(0, 2);
  const browsing = filter === "all" && query.trim() === "";
  // The featured rail already shows these two; don't repeat them in the grid.
  const gridAll = browsing ? visible.filter((c) => !featured.some((f) => f.id === c.id)) : visible;
  // R12: page the BROWSE shelf only. Once the parent has filtered or searched
  // they have narrowed it themselves, and every match should land. Order is
  // rankLearnCards' — the first page is the best-ranked page, not a slice of
  // the catalogue file. featured + grid together stay within SHELF_PAGE.
  const [showAllShelf, setShowAllShelf] = useState(false);
  const shelfCapped = browsing && !showAllShelf && gridAll.length > SHELF_PAGE - featured.length;
  const gridCards = shelfCapped ? gridAll.slice(0, SHELF_PAGE - featured.length) : gridAll;
  const shelfRest = gridAll.length - (SHELF_PAGE - featured.length);

  // OBJ-LEARN-02 — a read used to open in place: focus stayed on the card the
  // parent had just left, and the browser Back button left the library
  // entirely. The reader now pushes ONE history entry carrying the card id, so
  // Back closes the read and returns to the shelf. The entry keeps the CURRENT
  // hash on purpose: ArborContext owns `#/<tab>` and rewrites anything else, so
  // a `#/learn/<cardId>` hash would be fought back within a tick. The card id
  // rides in history state instead, and only `popstate` (never `hashchange`)
  // drives this, so the two mechanisms never collide.
  const openCard = (id: string) => {
    setOpenId(id);
    markRead(id);
    try {
      window.history.pushState({ ...(window.history.state ?? {}), arborLearnCard: id }, "", window.location.href);
    } catch { /* history unavailable — the reader still opens */ }
    try { track("learn_open_card", { card: id }); } catch { /* noop */ }
  };

  useEffect(() => {
    const onPop = () => {
      const state = (window.history.state ?? {}) as { arborLearnCard?: string };
      setOpenId(state.arborLearnCard && learnCardById(state.arborLearnCard) ? state.arborLearnCard : null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /** Closing from inside the reader must retire the history entry it pushed,
   *  or Back would re-open the read the parent just closed. */
  const closeCard = () => {
    setOpenId(null);
    const state = (window.history.state ?? {}) as { arborLearnCard?: string };
    if (state.arborLearnCard) { try { window.history.back(); } catch { /* noop */ } }
  };

  // A count of what the PARENT read. Intersected with the catalogue so a read
  // id left behind by a card that has gone dark cannot overstate it. Never a
  // fraction, a ring, or anything that reads as a verdict on the child.
  const readCount = useMemo(
    () => learnReadCount(readIds, LEARN_CARDS.map((c) => c.id)),
    [readIds]
  );

  const open = openId ? learnCardById(openId) : undefined;
  if (open) {
    // LL-A8 — context-rich ask: mention recent related logging only when true.
    const related = concernsContributed(open, recentConcerns);
    const askPrompt = pick(he, open.ask) + (related ? ` ${t("learn.askContext")}` : "");
    const todayTaken = actionLoop.some(
      (a) => a.source === "learn-read" && a.recommendation === pick(he, open.tryToday).trim()
    );
    return (
      <LearnReader
        card={open}
        he={he}
        isRtl={isRtl}
        saved={savedLearnIds.includes(open.id)}
        onBack={closeCard}
        onToggleSave={() => toggleSavedLearn(open.id)}
        onAsk={() => seedCoach({ prompt: askPrompt, source: "learn-library" })}
        pulse={feedback[open.id]}
        onPulse={(v) => {
          const next = setLearnFeedback(open.id, feedback[open.id] === v ? null : v);
          setFeedback({ ...next });
          try { track("learn_pulse", { card: open.id, value: String(v) }); } catch { /* noop */ }
        }}
        todayTaken={todayTaken}
        onAddToday={() => {
          acceptTodayAction(pick(he, open.tryToday).trim(), "tiny", "learn-read");
          try { track("learn_add_today", { card: open.id }); } catch { /* noop */ }
        }}
        t={t}
      />
    );
  }

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-5 max-w-[980px]">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.6rem] leading-tight tracking-tight" style={{ color: "var(--arbor-ink)" }}>
            {t("learn.title")}
          </h1>
          <p className="text-[13px] mt-1 max-w-[52ch]" style={{ color: "var(--arbor-muted)" }}>
            {t("learn.subtitle")}
          </p>
        </div>
        <label className="relative block w-full sm:w-[260px]">
          <span className="sr-only">{t("learn.search")}</span>
          <span className="absolute inset-y-0 start-3 flex items-center" style={{ color: "var(--arbor-muted)" }}>
            <Icon name="search" size={18} />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("learn.search")}
            className="w-full h-11 rounded-xl ps-10 pe-3 text-[13.5px] focus:outline-none focus-visible:ring-2"
            style={{
              background: "var(--arbor-paper-elevated)",
              border: "1px solid var(--arbor-rule)",
              color: "var(--arbor-ink)",
            }}
          />
        </label>
      </div>

      {/* Category pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mb-1" role="tablist" aria-label={t("learn.title")}>
        <FilterPill active={filter === "all"} onClick={() => setFilter("all")} label={t("learn.all")} />
        <FilterPill
          active={filter === "saved"}
          onClick={() => setFilter("saved")}
          label={`${t("learn.saved")}${savedLearnIds.length > 0 ? ` · ${savedLearnIds.length}` : ""}`}
          msIcon="bookmark"
        />
        {LEARN_CATEGORIES.map((c) => (
          <FilterPill
            key={c.id}
            active={filter === c.id}
            onClick={() => setFilter(filter === c.id ? "all" : c.id)}
            label={pick(he, c.label)}
            msIcon={c.msIcon}
          />
        ))}
      </div>

      {/* Picked-for-you rail — explainable personalization, opportunity framing */}
      {browsing && featured.length > 0 && (
        <section aria-label={t("learn.pickedTitle", { name: firstName || t("learn.yourChild") })}>
          <div className="flex items-baseline gap-2 flex-wrap mb-2.5">
            <h2 className="text-[15px] font-extrabold inline-flex items-center gap-1.5" style={{ color: "var(--arbor-ink)" }}>
              <Icon name="auto_awesome" size={16} className="opacity-80" />
              {t("learn.pickedTitle", { name: firstName || t("learn.yourChild") })}
            </h2>
            {/* Why-line rides the shared slot (masterplan 3.1) — TrustLink mounts
                directly after the why text ("How Arbor decides →"). */}
            <ContentWhyLine
              surface="learn-rail"
              trustLink
              why={(() => {
                // Honest why-line: claim only the signals that actually contributed.
                const name = firstName || t("learn.yourChild");
                const logsContributed = featured.some((c) => concernsContributed(c, recentConcerns));
                // ENG-07: `score.focusDomain` alone is NOT evidence of a
                // Development Map. It is set for a day-0 profile too (the
                // lowest-scoring domain with catalogue room to grow), so this
                // line told parents with zero milestones and zero logs that
                // their reading came from a map they had never filled in.
                // focusDomainContributed applies fromFocus's standard: the map
                // must hold an observation AND the domain must carry one of the
                // cards actually being shown. At zero data the line falls to the
                // age-only variant, which is true.
                const focusContributed = focusDomainContributed(score, featured);
                const base =
                  focusContributed && logsContributed ? t("learn.whyFullLogs", { name })
                  : focusContributed ? t("learn.whyFull", { name })
                  : logsContributed ? t("learn.whyAgeLogs", { name })
                  : t("learn.whyAge", { name });
                // W2 2.5: append the continuation variant ONLY when a saved
                // read's topic actually boosted a featured card — the
                // bookmark signal, never an outcome claim.
                const topics = learnContinuationTopics(LEARN_CARDS, signals);
                const savedBoosted = featured.some((c) => continuesSaved(c, topics));
                return savedBoosted
                  ? `${base} ${continueText("elev.continue.learn.why", uiLang === "he")}`
                  : base;
              })()}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {featured.map((card, i) => (
              <LearnGridCard
                key={card.id}
                card={card}
                he={he}
                featured
                index={i}
                saved={savedLearnIds.includes(card.id)}
                read={readIds.includes(card.id)}
                onOpen={() => openCard(card.id)}
                onToggleSave={() => toggleSavedLearn(card.id)}
                t={t}
              />
            ))}
          </div>
        </section>
      )}

      {/* Grid */}
      {gridCards.length > 0 ? (
        <section aria-label={t("learn.allReads")}>
          {browsing && (
            /* R12 → R20: this row did not wrap, so at 390 the "Show all ages"
               switch sat outside the viewport and the age control read as
               absent. `flex-wrap` alone left the outcome to how wide the
               heading and the count happened to render, which is why the
               re-measure was ambiguous. Below sm the meta group now claims a
               full row of its own (`w-full`), so the switch is on-screen at
               any phone width regardless of string length — EN or HE. From sm
               up `sm:w-auto` restores the single justified line. */
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5 mb-2.5">
              <h2 className="text-[15px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>
                {t("learn.allReads")}
              </h2>
              <span className="inline-flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <span className="text-[11.5px] font-bold" style={{ color: "var(--arbor-muted)" }}>
                  {t("learn.count", { n: inScope.length })}
                  {readCount > 0 && ` · ${t("elev.learnCare.read.count", { n: readCount })}`}
                </span>
                {/* OBJ-LEARN-01 — the Masterclasses toggle, verbatim: rendered
                    only when the age view actually hides something (or the
                    parent already opted in), so every card stays reachable. */}
                {(ageHidden.length > 0 || showAllAges) && (
                  <>
                    {!showAllAges && ageHidden.length > 0 && (
                      <span className="text-[11px] font-bold" style={{ color: "var(--arbor-faint)" }} dir="auto">
                        {agefilterText("elev.agefilter.hiddenCount", he, { n: ageHidden.length })}
                      </span>
                    )}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={showAllAges}
                      onClick={toggleShowAllAges}
                      data-testid="agefilter-toggle-learn"
                      className="inline-flex items-center gap-1.5 rounded-full px-3 min-h-11 text-[11.5px] font-extrabold transition"
                      style={
                        showAllAges
                          ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid color-mix(in srgb, var(--arbor-green-ink) 25%, transparent)" }
                          : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }
                      }
                    >
                      <Icon name={showAllAges ? "check" : "unfold_more"} size={14} />
                      {agefilterText("elev.agefilter.showAll", he)}
                    </button>
                  </>
                )}
              </span>
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            {gridCards.map((card, i) => (
              <LearnGridCard
                key={card.id}
                card={card}
                he={he}
                index={i}
                saved={savedLearnIds.includes(card.id)}
                read={readIds.includes(card.id)}
                onOpen={() => openCard(card.id)}
                onToggleSave={() => toggleSavedLearn(card.id)}
                t={t}
              />
            ))}
          </div>
          {/* R12: the shelf's own length control. Separate from the age switch
              above, and worded so neither one borrows the other's claim. */}
          {browsing && (shelfCapped || showAllShelf) && (
            <button
              type="button"
              onClick={() => {
                setShowAllShelf((prev) => {
                  const next = !prev;
                  try { track("learn_shelf_page", { showAll: next }); } catch { /* noop */ }
                  return next;
                });
              }}
              data-testid="learn-shelf-more"
              aria-expanded={showAllShelf}
              className="mt-4 w-full inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl px-4 text-[12.5px] font-extrabold transition"
              style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
            >
              <Icon name={showAllShelf ? "expand_less" : "expand_more"} size={15} />
              {showAllShelf
                ? t("elev.learnCare.shelf.fewer")
                : t("elev.learnCare.shelf.more", { n: shelfRest })}
            </button>
          )}
        </section>
      ) : (
        <EmptyState
          icon={filter === "saved" ? "bookmark" : "search_off"}
          text={
            filter === "saved"
              ? t("learn.emptySaved")
              : t("learn.emptySearch", { q: query.trim() })
          }
          action={
            // LC-33: the saved shelf's empty state was a dead end — the one
            // state a parent reaches by tapping "Saved" before saving anything.
            filter === "saved"
              ? { label: t("elev.learnCare.saved.browse", { name: firstName }), onClick: () => { setFilter("all"); setQuery(""); } }
              : { label: t("learn.clearSearch"), onClick: () => setQuery("") }
          }
        />
      )}

      {/* Provenance — editorial stance, no assessment */}
      <p className="text-[11px] pt-1" style={{ color: "var(--arbor-faint)" }}>
        {t("learn.provenance")}
      </p>
    </div>
  );
}

/* ── Pills ──────────────────────────────────────────────────────────────── */

function FilterPill({
  active,
  onClick,
  label,
  msIcon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  msIcon?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 min-h-11 text-[12px] font-bold whitespace-nowrap transition active:scale-[0.98] focus:outline-none focus-visible:ring-2"
      style={
        active
          ? { background: "var(--arbor-subtab-active)", color: "var(--arbor-subtab-on-ink)" }
          : {
              background: "var(--arbor-paper-elevated)",
              color: "var(--arbor-ink-soft)",
              border: "1px solid var(--arbor-rule)",
            }
      }
    >
      {msIcon && <Icon name={msIcon} size={15} />}
      {label}
    </button>
  );
}

/* ── Grid card ──────────────────────────────────────────────────────────── */

function LearnGridCard({
  card,
  he,
  saved,
  read,
  featured,
  index,
  onOpen,
  onToggleSave,
  t,
}: {
  card: LearnCard;
  he: boolean;
  saved: boolean;
  /** LC-21 — the parent already opened this read on this device. */
  read?: boolean;
  featured?: boolean;
  index: number;
  onOpen: () => void;
  onToggleSave: () => void;
  t: (k: string, vars?: Record<string, string | number>) => string;
}) {
  const cat = learnCategoryById(card.category);
  const tone = PASTEL[cat.tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.24) }}
      className="relative"
    >
      <button
        onClick={onOpen}
        className={`${cardCls} w-full h-full flex flex-col text-start overflow-hidden transition motion-safe:hover:-translate-y-0.5 active:scale-[0.99] focus:outline-none focus-visible:ring-2`}
      >
        {/* Tone band */}
        <div
          className={`w-full flex items-center ps-4 ${featured ? "h-[84px]" : "h-[64px]"}`}
          style={{ background: `linear-gradient(135deg, ${tone.soft}, var(--arbor-paper-elevated))` }}
          aria-hidden
        >
          <span
            className="inline-flex items-center justify-center rounded-2xl"
            style={{
              background: "var(--arbor-paper-elevated)",
              color: tone.ink,
              width: featured ? 48 : 40,
              height: featured ? 48 : 40,
              boxShadow: "var(--shadow-xs)",
            }}
          >
            <Icon name={cat.msIcon} size={featured ? 24 : 20} />
          </span>
        </div>
        {/* Body */}
        <div className="p-4 pt-3 flex flex-col gap-1.5 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide"
              style={{ background: tone.soft, color: tone.ink }}
            >
              {pick(he, cat.label)}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: "var(--arbor-muted)" }}>
              <Icon name="schedule" size={13} />
              {t("learn.minutes", { n: card.minutes })}
            </span>
            <span className="text-[11px] font-bold" style={{ color: "var(--arbor-muted)" }}>
              {t("learn.ages", { min: card.ageMin, max: card.ageMax })}
            </span>
            {/* LC-21 — a quiet marker for a read the PARENT already opened.
                Absent when nothing is known (cleared or blocked storage), which
                is exactly the unmarked library this surface shipped with. */}
            {read && (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-bold"
                style={{ color: "var(--arbor-muted)" }}
              >
                <Icon name="check" size={13} />
                {t("elev.learnCare.read.badge")}
              </span>
            )}
          </div>
          <h3 className="text-[15px] font-extrabold leading-snug" dir="auto" style={{ color: "var(--arbor-ink)" }}>
            {pick(he, card.title)}
          </h3>
          <p
            className={`text-[12.5px] leading-relaxed ${featured ? "line-clamp-3" : "line-clamp-2"}`}
            dir="auto"
            style={{ color: "var(--arbor-muted)" }}
          >
            {pick(he, card.hook)}
          </p>
          <span className="mt-auto pt-1 inline-flex items-center gap-1 text-[12.5px] font-bold" style={{ color: "var(--arbor-clay-deep)" }}>
            {t("learn.readCard")}
            <Icon name="arrow_forward" size={14} className="rtl:-scale-x-100" />
          </span>
        </div>
      </button>
      {/* Bookmark — sibling, never nested inside the open button. The card-level
          save is the shared bar's compact variant: same verb, same order canon,
          same handler as the reader's segmented bar. */}
      <div className="absolute top-2.5 end-2.5">
        <ContentActionBar
          variant="inline"
          surface="learn-card"
          actions={[
            {
              verb: "save",
              onClick: onToggleSave,
              active: saved,
              label: saved ? t("learn.savedLabel") : t("learn.save"),
              icon: saved ? "bookmark_added" : "bookmark",
              fill: saved ? 1 : 0,
            },
          ]}
        />
      </div>
    </motion.div>
  );
}

/* ── Reader ─────────────────────────────────────────────────────────────── */

function LearnReader({
  card,
  he,
  isRtl,
  saved,
  onBack,
  onToggleSave,
  onAsk,
  pulse,
  onPulse,
  todayTaken,
  onAddToday,
  t,
}: {
  card: LearnCard;
  he: boolean;
  isRtl: boolean;
  saved: boolean;
  onBack: () => void;
  onToggleSave: () => void;
  onAsk: () => void;
  pulse: 1 | -1 | undefined;
  onPulse: (v: 1 | -1) => void;
  todayTaken: boolean;
  onAddToday: () => void;
  t: (k: string, vars?: Record<string, string | number>) => string;
}) {
  const cat = learnCategoryById(card.category);
  const tone = PASTEL[cat.tone];
  const [copied, setCopied] = useState(false);
  // LL-A7 — listen mode: the whole read, spoken via the shared voice stack.
  const voice = useArborVoice();
  const listenText = useMemo(
    () =>
      [pick(he, card.title), ...card.keyPoints.map((k) => pick(he, k)), pick(he, card.body)].join(
        "\n\n"
      ),
    [card, he]
  );
  useEffect(() => () => voice.stop(), [card.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const share = async () => {
    const points = card.keyPoints.map((k, i) => `${i + 1}. ${pick(he, k)}`).join("\n");
    // A pilot read leaving the app keeps its label. Without this, unreviewed
    // content travels attributed to Arbor with nothing saying it is a pilot.
    const pilotLine = isLearnPilotCard(card.id) ? `\n\n${learnPilotText(he ? "he" : "en").note}` : "";
    const text = `${pick(he, card.title)}\n\n${points}${pilotLine}\n\n— Arbor`;
    try { track("learn_share", { card: card.id }); } catch { /* noop */ }
    try {
      if (navigator.share) {
        await navigator.share({ title: pick(he, card.title), text });
        return;
      }
    } catch { /* fall through to clipboard */ }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };

  const headingRef = React.useRef<HTMLHeadingElement | null>(null);
  useEffect(() => { headingRef.current?.focus(); }, [card.id]);

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-[760px] space-y-5"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-bold min-h-[44px] rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{ color: "var(--arbor-muted)" }}
      >
        <Icon name="arrow_back" size={16} className="rtl:-scale-x-100" />
        {t("learn.back")}
      </button>

      {/* Hero band */}
      <div
        className="rounded-[22px] p-5 sm:p-6"
        style={{ background: `linear-gradient(135deg, ${tone.soft}, var(--arbor-paper-deep))` }}
      >
        <div className="flex items-center gap-3 mb-4">
          <span
            className="inline-flex items-center justify-center rounded-2xl flex-shrink-0"
            style={{ background: "var(--arbor-paper-elevated)", color: tone.ink, width: 52, height: 52, boxShadow: "var(--shadow-xs)" }}
          >
            <Icon name={cat.msIcon} size={26} />
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide"
              style={{ background: "var(--arbor-paper-elevated)", color: tone.ink }}
            >
              {pick(he, cat.label)}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: tone.ink }}>
              <Icon name="schedule" size={13} />
              {t("learn.minutes", { n: card.minutes })}
            </span>
            <span className="text-[11px] font-bold" style={{ color: tone.ink }}>
              {t("learn.ages", { min: card.ageMin, max: card.ageMax })}
            </span>
          </div>
        </div>
        {/* OBJ-LEARN-02: focus moves here on open, so a screen reader announces
            the read instead of leaving the cursor on the shelf behind it. It is
            an h2, not an h1 — the page's one h1 belongs to the hub (CR-21). */}
        <h2
          ref={headingRef}
          tabIndex={-1}
          data-testid="learn-reader-heading"
          className="text-xl md:text-[1.55rem] leading-tight tracking-tight focus:outline-none"
          dir="auto"
          style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}
        >
          {pick(he, card.title)}
        </h2>
        <p className="text-[13.5px] mt-2 leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink-soft)" }}>
          {pick(he, card.hook)}
        </p>
        {isLearnPilotCard(card.id) && (
          <p
            className="mt-3 rounded-xl px-3 py-2 text-xs leading-relaxed"
            dir="auto"
            data-testid="learn-pilot-note"
            style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink-soft)" }}
          >
            <span className="font-bold" style={{ color: "var(--arbor-ink)" }}>
              {learnPilotText(he ? "he" : "en").status}
            </span>
            {" — "}
            {learnPilotText(he ? "he" : "en").note}
          </p>
        )}
      </div>

      {/* Action bar — the shared ContentActionBar: canonical done · save ·
          share, then this surface's extras (listen · ask). "Add to today" also
          keeps its in-context CTA in the try-today section below — same
          handler, contextual primary (documented judgment call). */}
      <ContentActionBar
        variant="bar"
        surface="learn-reader"
        actions={[
          {
            verb: "done",
            onClick: onAddToday,
            active: todayTaken,
            disabled: todayTaken,
            label: todayTaken ? t("learn.addedToday") : t("learn.addToday"),
            icon: todayTaken ? "check_circle" : "add_task",
            fill: todayTaken ? 1 : 0,
          },
          {
            verb: "save",
            onClick: onToggleSave,
            active: saved,
            label: saved ? t("learn.savedLabel") : t("learn.save"),
            icon: saved ? "bookmark_added" : "bookmark",
            fill: saved ? 1 : 0,
          },
          {
            verb: "share",
            onClick: () => void share(),
            label: copied ? t("learn.copied") : t("learn.share"),
            icon: copied ? "check" : "ios_share",
          },
        ]}
        extras={[
          ...(voice.supported
            ? [
                {
                  id: "listen",
                  label: voice.speaking ? t("learn.listening") : t("learn.listen"),
                  icon: voice.speaking ? "stop_circle" : "graphic_eq",
                  active: voice.speaking,
                  onClick: () => {
                    voice.toggle(listenText);
                    try { track("learn_listen", { card: card.id }); } catch { /* noop */ }
                  },
                },
              ]
            : []),
          { id: "ask", label: t("nav.tab.coach"), icon: "forum", onClick: onAsk },
        ]}
      />

      {/* Key points */}
      <section aria-label={t("learn.keyPoints")}>
        <h3 className="text-[15px] font-extrabold mb-3" style={{ color: "var(--arbor-ink)" }}>
          {t("learn.keyPoints")}
        </h3>
        <ol className="space-y-3">
          {card.keyPoints.map((point, i) => (
            <li key={i} className="flex gap-3">
              <span
                className="inline-flex items-center justify-center rounded-full flex-shrink-0 w-6 h-6 text-[11px] font-extrabold mt-0.5"
                style={{ background: tone.soft, color: tone.ink }}
                aria-hidden
              >
                {i + 1}
              </span>
              <p className="t-base leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink-soft)" }}>
                {pick(he, point)}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Full read */}
      <section aria-label={t("learn.fullRead")}>
        <h3 className="text-[15px] font-extrabold mb-3" style={{ color: "var(--arbor-ink)" }}>
          {t("learn.fullRead")}
        </h3>
        <div className="space-y-3.5">
          {pick(he, card.body)
            .split("\n\n")
            .map((para, i) => (
              <p key={i} className="t-base leading-relaxed max-w-[72ch]" dir="auto" style={{ color: "var(--arbor-ink-soft)" }}>
                {para}
              </p>
            ))}
        </div>
      </section>

      {/* Try this today */}
      <section
        aria-label={t("learn.tryToday")}
        className="rounded-[18px] p-5"
        style={{ background: tone.soft }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Icon name="flag" size={18} style={{ color: tone.ink }} />
          <h3 className="text-[14px] font-extrabold" style={{ color: tone.ink }}>
            {t("learn.tryToday")}
          </h3>
        </div>
        <p className="t-base leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink)" }}>
          {pick(he, card.tryToday)}
        </p>
        {/* LL-A6 — one tap into the Today action loop, honest provenance */}
        <button
          onClick={onAddToday}
          disabled={todayTaken}
          className="mt-3 inline-flex items-center gap-1.5 font-bold text-[13px] rounded-xl px-4 py-2.5 min-h-[44px] transition active:scale-[0.98] focus:outline-none focus-visible:ring-2 disabled:opacity-70"
          style={{
            background: "var(--arbor-paper-elevated)",
            color: tone.ink,
            border: "1px solid var(--arbor-rule)",
          }}
        >
          <Icon name={todayTaken ? "check_circle" : "add_task"} size={16} fill={todayTaken ? 1 : 0} />
          {todayTaken ? t("learn.addedToday") : t("learn.addToday")}
        </button>
      </section>

      {/* LL-A11 — helpful pulse: counts only, tunes this device's ranking */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="text-[12px] font-bold" style={{ color: "var(--arbor-muted)" }}>
          {t("learn.pulseAsk")}
        </span>
        <button
          onClick={() => onPulse(1)}
          aria-pressed={pulse === 1}
          className="inline-flex items-center gap-1.5 rounded-full px-3 min-h-11 text-[12px] font-bold transition active:scale-[0.96] focus:outline-none focus-visible:ring-2"
          style={
            pulse === 1
              ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid transparent" }
              : { background: "var(--arbor-paper-elevated)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }
          }
        >
          <Icon name="thumb_up" size={15} fill={pulse === 1 ? 1 : 0} />
          {t("learn.pulseYes")}
        </button>
        <button
          onClick={() => onPulse(-1)}
          aria-pressed={pulse === -1}
          className="inline-flex items-center gap-1.5 rounded-full px-3 min-h-11 text-[12px] font-bold transition active:scale-[0.96] focus:outline-none focus-visible:ring-2"
          style={
            pulse === -1
              ? { background: "var(--arbor-paper-deep)", color: "var(--arbor-ink-soft)", border: "1px solid transparent" }
              : { background: "var(--arbor-paper-elevated)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }
          }
        >
          <Icon name="thumb_down" size={15} fill={pulse === -1 ? 1 : 0} />
          {t("learn.pulseNo")}
        </button>
      </div>

      {/* Provenance hedge — editorial, not diagnostic. Masterplan 3.1: the
          TrustLink chip closes the why → Trust Center chain, after the
          provenance text on the same wrapping row (scholar-hub-reader parity;
          UI-WIRE 2026-08-20 inventory gap). */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]" style={{ color: "var(--arbor-faint)" }}>
        <span dir="auto">{t("learn.provenance")}</span>
        <TrustLink surface="learn-reader" />
      </div>
    </motion.article>
  );
}

/* ── Empty state ────────────────────────────────────────────────────────── */

function EmptyState({
  icon,
  text,
  action,
}: {
  icon: string;
  text: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className={`${cardCls} p-8 flex flex-col items-center text-center gap-3`}>
      <span
        className="inline-flex items-center justify-center rounded-2xl w-12 h-12"
        style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}
      >
        <Icon name={icon} size={24} />
      </span>
      <p className="text-[13px] max-w-[40ch]" style={{ color: "var(--arbor-muted)" }}>
        {text}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-1.5 font-bold text-[13px] rounded-xl px-4 py-2.5 min-h-[44px] transition active:scale-[0.98] focus:outline-none focus-visible:ring-2"
          style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-clay-deep)", border: "1px solid var(--arbor-clay-border)" }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
