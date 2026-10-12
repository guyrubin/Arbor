/**
 * Learn reader — one read, on its own route.
 *
 * v3 F-FORYOU-1: #/learn is a reader only. The shelf it used to carry (search,
 * shelf tabs, the picked-for-you rail and the 93-read grid) is gone; reads are
 * found on For you, the parent (#/masterclasses): today's pick, the short
 * reads and the library of courses by area. A read opened there opens in a
 * sheet over that page (ForYouReadSheet); a link to a read (`#/learn?card=<id>`,
 * or another surface's requestLearnRead) still lands here, and its Back goes to
 * For you. A link with no read is sent on to For you's library.
 *
 * Every read is a Learn Card (5 key points → full read → one thing to try
 * today), saveable in one tap, shareable, and wired into Ask Arbor via the
 * seedCoach seam (prefill only, parent sends). Static catalogue, no AI call,
 * no child-data write beyond the bookmark (card id only). TOKEN-DRIVEN
 * styling; HE/RTL via logical CSS.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { EvidenceChip } from "../ui/EvidenceChip";
import { PASTEL } from "../../lib/tokens";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useArborVoice } from "../../hooks/useArborVoice";
import { track } from "../../lib/analytics";
import { hashQuery } from "../../lib/routes";
import { concernsForBehaviors } from "../../content/selectCards";
import { recentBehaviorTypes } from "../../content/hardMomentSurface";
import { readLearnFeedback, setLearnFeedback, type LearnFeedback } from "../../learn/learnFeedback";
import { markLearnCardRead } from "../../learn/learnReadState";
import { concernsContributed, learnCategoryById, type LearnCard } from "../../learn/learnLibrary";
import { learnCardById } from "../../learn/learnCards";
import { isLearnPilotCard, learnPilotText } from "../../learn/learnPilotRelease";
import { ContentActionBar } from "../ui/ContentActionBar";
import { TrustLink } from "../trust/TrustLink";
import { queueLibraryScroll } from "./forYouScroll";

const pick = (he: boolean, t: { en: string; he: string }) => (he ? t.he : t.en);

/** W2-SHELLPLAY critic r1: the page's ONE primary-move stamp (check:framework
 *  counts `data-primary-move` once in this file). v3 F-FORYOU-1: it rides the
 *  reader's own heading, the read the route opens — the shelf card that used
 *  to carry it is gone. A read in For you's sheet carries no stamp: that page
 *  has its own move. */
const LEARN_MOVE_STAMP = { "data-primary-move": "open-learn-card" } as const;

/** A card id this catalogue can open, or null. */
const knownCard = (id: string | null | undefined): string | null =>
  id && learnCardById(id) ? id : null;

/** The read the URL names (`#/learn?card=<id>`), or null. */
const cardFromHash = (): string | null => {
  if (typeof window === "undefined") return null;
  try { return knownCard(hashQuery(window.location.hash).get("card")); } catch { return null; }
};

export default function LearnLibrary() {
  const { pendingLearnRequest, consumeLearnRequest, setActiveTab } = useArbor();
  const [cardId, setCardId] = useState<string | null>(
    () => knownCard(pendingLearnRequest?.cardId) ?? cardFromHash(),
  );

  // LL — deep-link seam: another surface asked for one read. A request that
  // names a shelf only (or nothing) finds no shelf here any more: the effect
  // below sends it on to For you's library.
  useEffect(() => {
    if (!pendingLearnRequest) return;
    const asked = knownCard(pendingLearnRequest.cardId);
    if (asked) setCardId(asked);
    consumeLearnRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingLearnRequest]);

  // Back/forward between two reads keeps this route mounted: follow the URL.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onHash = () => { const id = cardFromHash(); if (id) setCardId(id); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // The URL names the read (replaceState: no extra entry, and ArborContext,
  // which reacts to hashchange only, keeps `learn` as the route). With no read
  // the route has nothing to show: replace this entry with For you and bring
  // its library into view, so Back never bounces through an empty #/learn.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (cardId) {
      const want = `#/learn?card=${encodeURIComponent(cardId)}`;
      if (window.location.hash !== want) {
        try { window.history.replaceState(window.history.state, "", want); } catch { /* history unavailable */ }
      }
      return;
    }
    queueLibraryScroll();
    try { window.history.replaceState(window.history.state, "", "#/masterclasses"); } catch { /* history unavailable */ }
    setActiveTab("masterclasses");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  if (!cardId) return null;
  return (
    <div data-module="learn-reader">
      <LearnReadHost key={cardId} cardId={cardId} onBack={() => setActiveTab("masterclasses")} moveProps={LEARN_MOVE_STAMP} />
    </div>
  );
}

/**
 * One read with everything it does: open bookkeeping, the helpful pulse, save,
 * share, listen, Ask Arbor, and "Add to today". Mounted by the #/learn route
 * and by For you's read sheet, so a read behaves the same wherever it opens.
 */
export function LearnReadHost({ cardId, onBack, moveProps }: {
  cardId: string;
  /** The route's Back (to For you). A read in the sheet closes with the sheet. */
  onBack?: () => void;
  /** The route's primary-move stamp, spread on the reader heading. */
  moveProps?: Readonly<Record<string, string>>;
}) {
  const {
    childProfile,
    seedCoach,
    savedLearnIds,
    toggleSavedLearn,
    behaviorLogs,
    acceptTodayAction,
    actionLoop,
    actionLoopConfirmed,
  } = useArbor();
  const { t, uiLang, aiLang } = useLanguage();
  const he = aiLang === "he";
  const isRtl = uiLang === "he";
  const card = learnCardById(cardId);
  const [feedback, setFeedback] = useState<LearnFeedback>(() => readLearnFeedback());

  // Opening a read is an open: LC-21 marks it read for THIS child on this
  // device (a count of what the parent read, never a verdict).
  useEffect(() => {
    if (!card) return;
    markLearnCardRead(childProfile.id, card.id);
    try { track("learn_open_card", { card: card.id }); } catch { /* noop */ }
  }, [card, childProfile.id]);

  // LL-A2 — observed-signal context for the ask: recent logged behavior types
  // through the controlled concern vocabulary. Counts, never verdicts.
  const recentConcerns = useMemo(
    () => concernsForBehaviors(recentBehaviorTypes(behaviorLogs, new Date())),
    [behaviorLogs]
  );

  // "Added to today" shows only after the write resolved (the course reader's
  // rule): "Adding…" while this tap's write is in flight, "Added" once it
  // resolved, a failed write says so; a row the ledger has not confirmed yet
  // reads the neutral "On today's list".
  const tryText = card ? pick(he, card.tryToday).trim() : "";
  const todayTaken = actionLoop.some((a) => a.source === "learn-read" && a.recommendation === tryText);
  const [addState, setAddState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const addedShown = addState === "saved" || (addState === "idle" && todayTaken && actionLoopConfirmed === true);
  const addListed = !addedShown && addState === "idle" && todayTaken;

  if (!card) return null;

  // LL-A8 — context-rich ask: mention recent related logging only when true.
  const related = concernsContributed(card, recentConcerns);
  const askPrompt = pick(he, card.ask) + (related ? ` ${t("learn.askContext")}` : "");
  const onAddToday = () => {
    if (todayTaken || addState === "saving") return;
    setAddState("saving");
    acceptTodayAction(tryText, "tiny", "learn-read").then(
      () => { if (mounted.current) setAddState("saved"); },
      () => { if (mounted.current) setAddState("failed"); },
    );
    try { track("learn_add_today", { card: card.id }); } catch { /* noop */ }
  };

  return (
    <LearnReader
      card={card}
      he={he}
      isRtl={isRtl}
      saved={savedLearnIds.includes(card.id)}
      onBack={onBack}
      onToggleSave={() => toggleSavedLearn(card.id)}
      onAsk={() => seedCoach({ prompt: askPrompt, source: "learn-library" })}
      pulse={feedback[card.id]}
      onPulse={(v) => {
        const next = setLearnFeedback(card.id, feedback[card.id] === v ? null : v);
        setFeedback({ ...next });
        try { track("learn_pulse", { card: card.id, value: String(v) }); } catch { /* noop */ }
      }}
      todayTaken={todayTaken}
      addState={addState}
      addedShown={addedShown}
      addListed={addListed}
      onAddToday={onAddToday}
      moveProps={moveProps}
      t={t}
    />
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
  addState,
  addedShown,
  addListed,
  onAddToday,
  moveProps,
  t,
}: {
  card: LearnCard;
  he: boolean;
  isRtl: boolean;
  saved: boolean;
  onBack?: () => void;
  onToggleSave: () => void;
  onAsk: () => void;
  pulse: 1 | -1 | undefined;
  onPulse: (v: 1 | -1) => void;
  todayTaken: boolean;
  addState: "idle" | "saving" | "saved" | "failed";
  addedShown: boolean;
  addListed: boolean;
  onAddToday: () => void;
  moveProps?: Readonly<Record<string, string>>;
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

  const addLabel = addState === "saving"
    ? t("elev.learnCare.addToday.saving")
    : addedShown
      ? t("learn.addedToday")
      : addListed
        ? t("elev.learnCare.addToday.listed")
        : t("learn.addToday");
  const addIcon = addedShown ? "check_circle" : addListed ? "event_available" : "add_task";

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-[760px] space-y-5"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* v3 F-FORYOU-1: Back names where it goes — For you, the parent. */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-bold min-h-[44px] rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{ color: "var(--arbor-muted)" }}
        >
          <Icon name="arrow_back" size={16} className="rtl:-scale-x-100" />
          {t("companion.door.learn")}
        </button>
      )}

      {/* Hero band — W2-SHELLPLAY r2 (learn design): ONE flat tone band. The old
          linear-gradient(tone.soft → paper-deep) nested a token that is itself a
          gradient (invalid CSS: the band rendered bare) and read as a second
          gradient family beside --gradient-cta. */}
      <div
        className="rounded-[22px] p-5 sm:p-6"
        data-testid="learn-reader-hero"
        style={{ background: tone.soft }}
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
              className="rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide"
              style={{ background: "var(--arbor-paper-elevated)", color: tone.ink }}
            >
              {pick(he, cat.label)}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: tone.ink }}>
              <Icon name="schedule" size={13} />
              {t("learn.minutes", { n: card.minutes })}
            </span>
            <span className="text-xs font-semibold" style={{ color: tone.ink }}>
              {t("learn.ages", { min: card.ageMin, max: card.ageMax })}
            </span>
          </div>
        </div>
        {/* OBJ-LEARN-02: focus moves here on open, so a screen reader announces
            the read instead of leaving the cursor where the parent tapped. */}
        <h2
          ref={headingRef}
          tabIndex={-1}
          data-testid="learn-reader-heading"
          className="text-xl md:text-[1.55rem] leading-tight tracking-tight focus:outline-none"
          dir="auto"
          style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}
          {...moveProps}
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
            active: addedShown,
            disabled: todayTaken || addState === "saving",
            label: addLabel,
            icon: addIcon,
            fill: addedShown ? 1 : 0,
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
      {addState === "failed" && (
        <p role="alert" data-testid="learn-add-today-failed" className="t-sm" style={{ color: "var(--arbor-ink-soft)" }}>{t("elev.learnCare.addToday.failed")}</p>
      )}

      {/* Key points */}
      <section aria-label={t("learn.keyPoints")}>
        <h3 className="text-lg font-bold mb-3" style={{ color: "var(--arbor-ink)" }}>
          {t("learn.keyPoints")}
        </h3>
        <ol className="space-y-3">
          {card.keyPoints.map((point, i) => (
            <li key={i} className="flex gap-3">
              <span
                className="inline-flex items-center justify-center rounded-full flex-shrink-0 w-6 h-6 text-xs font-extrabold mt-0.5"
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
        <h3 className="text-lg font-bold mb-3" style={{ color: "var(--arbor-ink)" }}>
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
          type="button"
          onClick={onAddToday}
          disabled={todayTaken}
          aria-busy={addState === "saving"}
          data-testid="learn-add-today"
          className="mt-3 inline-flex items-center gap-1.5 font-bold text-[13px] rounded-xl px-4 py-2.5 min-h-[44px] transition active:scale-[0.98] focus:outline-none focus-visible:ring-2 disabled:opacity-70"
          style={{
            background: "var(--arbor-paper-elevated)",
            color: tone.ink,
            border: "1px solid var(--arbor-rule)",
          }}
        >
          <Icon name={addIcon} size={16} fill={addedShown ? 1 : 0} />
          {addLabel}
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
          UI-WIRE 2026-08-20 inventory gap). v3 F-FORYOU-1: the evidence chip
          that sat on For you's header rides here, beside the read it backs. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{ color: "var(--arbor-faint)" }}>
        <span dir="auto">{t("learn.provenance")}</span>
        <TrustLink surface="learn-reader" />
        <EvidenceChip />
      </div>
    </motion.article>
  );
}
