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
import { ageYearsFromProfile } from "../../lib/childAge";
import { track } from "../../lib/analytics";
import { concernsForBehaviors } from "../../content/selectCards";
import { recentBehaviorTypes } from "../../content/hardMomentSurface";
import { readLearnFeedback, setLearnFeedback, type LearnFeedback } from "../../learn/learnFeedback";
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
import { ContentActionBar, ContentWhyLine } from "../ui/ContentActionBar";
import { TrustLink } from "../trust/TrustLink";

type Filter = "all" | "saved" | LearnCategoryId;

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

  // LL — deep-link seam: another surface asked for one read or one shelf.
  useEffect(() => {
    if (!pendingLearnRequest) return;
    if (pendingLearnRequest.cardId && learnCardById(pendingLearnRequest.cardId)) {
      setOpenId(pendingLearnRequest.cardId);
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

  const visible = useMemo(() => {
    let list = ranked;
    if (filter === "saved") list = list.filter((c) => savedLearnIds.includes(c.id));
    else if (filter !== "all") list = list.filter((c) => c.category === filter);
    return searchLearnCards(list, query, he);
  }, [ranked, filter, query, he, savedLearnIds]);

  const featured = ranked.slice(0, 2);
  const browsing = filter === "all" && query.trim() === "";
  // The featured rail already shows these two; don't repeat them in the grid.
  const gridCards = browsing ? visible.filter((c) => !featured.some((f) => f.id === c.id)) : visible;

  const openCard = (id: string) => {
    setOpenId(id);
    try { track("learn_open_card", { card: id }); } catch { /* noop */ }
  };

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
        onBack={() => setOpenId(null)}
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
                const base =
                  score.focusDomain && logsContributed ? t("learn.whyFullLogs", { name })
                  : score.focusDomain ? t("learn.whyFull", { name })
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
            <div className="flex items-baseline justify-between mb-2.5">
              <h2 className="text-[15px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>
                {t("learn.allReads")}
              </h2>
              <span className="text-[11.5px] font-bold" style={{ color: "var(--arbor-muted)" }}>
                {t("learn.count", { n: LEARN_CARDS.length })}
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
                onOpen={() => openCard(card.id)}
                onToggleSave={() => toggleSavedLearn(card.id)}
                t={t}
              />
            ))}
          </div>
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
            filter === "saved" ? undefined : { label: t("learn.clearSearch"), onClick: () => setQuery("") }
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
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 min-h-[38px] text-[12px] font-bold whitespace-nowrap transition active:scale-[0.98] focus:outline-none focus-visible:ring-2"
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
  featured,
  index,
  onOpen,
  onToggleSave,
  t,
}: {
  card: LearnCard;
  he: boolean;
  saved: boolean;
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
        <h2
          className="text-xl md:text-[1.55rem] leading-tight tracking-tight"
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
              <p className="text-[14px] leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink-soft)" }}>
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
              <p key={i} className="text-[14.5px] leading-relaxed max-w-[72ch]" dir="auto" style={{ color: "var(--arbor-ink-soft)" }}>
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
        <p className="text-[14px] leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink)" }}>
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
          className="inline-flex items-center gap-1.5 rounded-full px-3 min-h-[38px] text-[12px] font-bold transition active:scale-[0.96] focus:outline-none focus-visible:ring-2"
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
          className="inline-flex items-center gap-1.5 rounded-full px-3 min-h-[38px] text-[12px] font-bold transition active:scale-[0.96] focus:outline-none focus-visible:ring-2"
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
