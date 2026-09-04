import React, { useState } from "react";
import Icon from "../ui/Icon";
import type { CoachContract, CouncilTake } from "../../types";
import type { UiLang } from "../../lib/i18n";
import { translate } from "../../lib/i18n";
import { SpeakButton } from "../ui/SpeakButton";
import { TrustLink } from "../trust/TrustLink";
import { trackShareInitiated, trackShareCompleted } from "../../lib/loopEvents";
import { track } from "../../lib/analytics";

/**
 * Pure helper: returns the G2-safe disclosure header for N sources.
 * "Grounded in N sources" — mechanism/source only, never an outcome claim.
 * Exported so tests can cover it without mounting the full component.
 */
export function sourcesLabel(n: number, lang: UiLang = "en"): string {
  if (n <= 0) return "";
  if (n === 1) return translate(lang, "cite.drawer.header.one");
  return translate(lang, "cite.drawer.header", { n, plural: lang === "he" ? "ות" : "s" });
}

/** COACH-6: one resolved citation drawer row. `title`/`type` are null when the
 *  server sent no metadata for the id (the row falls back to slug rendering). */
export type CitationRow = { id: string; title: string | null; type: string | null };

/**
 * Pure helper (COACH-6): the citation drawer rows for a contract. Ids from
 * sourceCardsUsed lead (compatibility); each is enriched with the real title +
 * card type the server resolved into sourceCards. Ids without metadata keep a
 * null title so the renderer can fall back to the legacy slug row. Exported so
 * tests can cover it without a DOM harness.
 */
export function citationRows(contract: CoachContract): CitationRow[] {
  const byId = new Map((contract.sourceCards ?? []).map((card) => [card.id, card]));
  const ids = contract.sourceCardsUsed?.length
    ? contract.sourceCardsUsed
    : (contract.sourceCards ?? []).map((card) => card.id);
  return ids.map((id) => {
    const card = byId.get(id);
    return card
      ? { id, title: card.title, type: card.type || null }
      : { id, title: null, type: null };
  });
}

/**
 * Pure helper (ASK-6): the calm memory-visibility footer label. COUNT ONLY —
 * the clinical firewall shape: never fact content, never a percentage or
 * confidence figure. Empty string when nothing grounded the answer, so no
 * false "uses your memory" claim renders on ungrounded answers.
 * Exported so tests can cover it without mounting the full component.
 */
export function memoryFooterLabel(n: number | undefined, lang: UiLang = "en"): string {
  if (typeof n !== "number" || n <= 0) return "";
  if (n === 1) return translate(lang, "coach.memory.grounded.one");
  return translate(lang, "coach.memory.grounded", { n });
}

/**
 * Pure helper: presentation tier for the "Reach out for help if" footer.
 * Low (or absent) risk → "quiet": a calm, collapsed disclosure so routine
 * questions don't read as alarms. Anything else — including unrecognized
 * levels, which fail safe upward — → "prominent": the full warning panel.
 * The escalateIf CONTENT is always rendered; only the framing is tiered.
 * Exported so tests can cover it without mounting the full component.
 */
export function escalationTier(riskLevel?: string): "quiet" | "prominent" {
  return (riskLevel || "low").toLowerCase() === "low" ? "quiet" : "prominent";
}

/* ══ AI-10 — in-product quality signal on a coach answer ═════════════════════
   Before this, answer quality was unmeasured in production: a parent who got a
   bad answer had no way to tell us, so nothing about answer quality reached us
   except churn. This is a thumbs up / down about THE ANSWER.

   CLINICAL FIREWALL. This is a signal about Arbor's output, never a judgement
   about the child. Nothing here scores, rates, grades or renders a verdict on
   a child, and nothing about the child is stored: the emitted props are the
   answer fingerprint, the vote, the scholar lens, which coach surface produced
   it, the UI language, and the COUNT of sources — no question text, no answer
   text, no name, no age band, no domains, no risk level. `feedbackProps` is
   the single place those props are built, and its test asserts the exclusions.

   The signal goes through the EXISTING first-party telemetry seam
   (lib/analytics `track`), which writes to the signed-in parent's own
   Firestore collection `users/{uid}/events` — fire-and-forget, best effort,
   and a no-op when Firebase is unconfigured or the parent is anonymous. No new
   store was invented for it. ═════════════════════════════════════════════ */

/** The analytics event name. Stable — retrieval queries key on this string. */
export const COACH_FEEDBACK_EVENT = "coach_answer_feedback";

export type CoachAnswerVote = "up" | "down";

/**
 * FNV-1a, 32-bit. A ONE-WAY fingerprint: it is what identifies an answer in
 * the telemetry stream (so a vote and its later un-vote are the same answer),
 * and it is NOT a way to recover what the answer said. The source text never
 * leaves the device.
 */
function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * Stable per-answer id. Derived from the answer's own prose so the same
 * rendered answer keeps the same id across remounts (the vote survives leaving
 * and reopening the thread) while two different answers do not collide.
 * Exported so tests can cover it without mounting the component.
 */
export function answerSignature(contract: CoachContract): string {
  const basis = [contract.text ?? "", contract.parentScript ?? "", ...(contract.todayPlan ?? [])].join(" ");
  return `a-${fnv1a(basis)}`;
}

/**
 * Pure helper: the telemetry props for one vote. ALLOW-LIST shaped — the
 * returned object is built field by field and never spreads the contract, so a
 * new contract field cannot silently start shipping child data.
 * `vote: "cleared"` is the un-vote, recorded rather than merely forgotten:
 * a parent taking a downvote back is itself a signal.
 */
export function feedbackProps(args: {
  answerId: string;
  vote: CoachAnswerVote | "cleared";
  lens?: string;
  surface: "coach" | "council";
  lang: UiLang;
  sources: number;
}): Record<string, string | number> {
  return {
    answer_id: args.answerId,
    vote: args.vote,
    lens: args.lens || "default",
    surface: args.surface,
    lang: args.lang,
    sources: args.sources,
  };
}

const VOTE_KEY_PREFIX = "arbor.coachVote.";

/** Per-device memory of this parent's vote. Every access is guarded: a private
 *  window, blocked site data or a non-browser render must degrade to "no vote
 *  recorded", never throw into the answer render. */
export function readStoredVote(answerId: string): CoachAnswerVote | null {
  try {
    const raw = localStorage.getItem(VOTE_KEY_PREFIX + answerId);
    return raw === "up" || raw === "down" ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredVote(answerId: string, vote: CoachAnswerVote | null): void {
  try {
    if (vote) localStorage.setItem(VOTE_KEY_PREFIX + answerId, vote);
    else localStorage.removeItem(VOTE_KEY_PREFIX + answerId);
  } catch {
    /* storage unavailable — the vote still sends, it just isn't remembered */
  }
}

/**
 * The control itself. Deliberately the quietest row on the card: it must never
 * compete with the answer, never block it, and never delay it — it renders
 * after the answer has already settled and every write is fire-and-forget.
 */
function AnswerFeedback({ contract, lens, surface, lang, sources }: {
  contract: CoachContract;
  lens?: string;
  surface: "coach" | "council";
  lang: UiLang;
  sources: number;
}) {
  const answerId = answerSignature(contract);
  const [vote, setVote] = useState<CoachAnswerVote | null>(() => readStoredVote(answerId));
  const t = (key: string) => translate(lang, key);

  const cast = (next: CoachAnswerVote) => {
    // Reversible: tapping the active thumb clears the vote.
    const resolved = vote === next ? null : next;
    setVote(resolved);
    writeStoredVote(answerId, resolved);
    try {
      track(COACH_FEEDBACK_EVENT, feedbackProps({ answerId, vote: resolved ?? "cleared", lens, surface, lang, sources }));
    } catch {
      /* telemetry is never allowed to break an answer */
    }
  };

  const buttonStyle = (active: boolean) =>
    active
      ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-green-ink)" }
      : { background: "white", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" };

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
      <span className="text-[11px] font-bold" style={{ color: "var(--arbor-muted)" }}>
        {vote ? t("elev.coachcontract.feedback.thanks") : t("elev.coachcontract.feedback.prompt")}
      </span>
      <button
        type="button"
        onClick={() => cast("up")}
        aria-pressed={vote === "up"}
        aria-label={t("elev.coachcontract.feedback.up")}
        title={vote === "up" ? t("elev.coachcontract.feedback.undo") : t("elev.coachcontract.feedback.up")}
        className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 min-h-[32px] rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
        style={buttonStyle(vote === "up")}
      >
        <Icon name="thumb_up" size={13} aria-hidden /> {t("elev.coachcontract.feedback.up")}
      </button>
      <button
        type="button"
        onClick={() => cast("down")}
        aria-pressed={vote === "down"}
        aria-label={t("elev.coachcontract.feedback.down")}
        title={vote === "down" ? t("elev.coachcontract.feedback.undo") : t("elev.coachcontract.feedback.down")}
        className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 min-h-[32px] rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
        style={buttonStyle(vote === "down")}
      >
        <Icon name="thumb_down" size={13} aria-hidden /> {t("elev.coachcontract.feedback.down")}
      </button>
      {/* States plainly what the control is about, so a thumb is never read as
          a judgement on the child (clinical firewall, stated in the UI). */}
      <span className="text-[10px] w-full" style={{ color: "var(--arbor-muted)" }}>
        {t("elev.coachcontract.feedback.note")}
      </span>
    </div>
  );
}

/**
 * Generative answer surface (v6 UX-3 / v5 GUI-1·2·3). Renders the coach's real
 * structured `contract` as an attributed, actionable card stack instead of a
 * markdown wall — each block is a thing the parent can DO (check off, say aloud,
 * save to a plan, prefill a log, hand off). The data already exists server-side;
 * this stops it being flattened to prose and regex-scraped.
 */

// Risk-tone verdict palette removed: Arbor renders counts and observations, never a graded
// child risk verdict on a parent-facing surface (clinical firewall). See council 2026-07-18.

// ASK-3: the six-frame routing panel is GONE from the parent render — frame
// ids ("shadow", "marriage", "shepherd") are internal orchestration vocabulary,
// pure noise on a parent surface. frameRouting stays in the contract for
// telemetry/evals (and inside the screened renderCoachResponse text) — it is
// simply never rendered here.

function Panel({ icon, title, tint, children, action }: {
  icon: React.ReactNode; title: string; tint: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl p-3.5 bg-white" style={{ border: "1px solid var(--arbor-rule)" }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider" style={{ color: tint }}>
          {icon} {title}
        </span>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function CoachAnswerCards({ contract, lens, council, lang = "en", onSaveToPlan, onCreateLog, onAddToHandoff, onManageMemory, reviewUnavailable = false }: {
  contract: CoachContract;
  lens?: string;
  council?: CouncilTake[];
  lang?: UiLang;
  onSaveToPlan: (topic: string) => void;
  onCreateLog: () => void;
  onAddToHandoff: (note: string) => void;
  /** ASK-6: deep link to Profile › Child Memory (route "memory"). */
  onManageMemory?: () => void;
  /** OWN-1: true while the memory review ledger is unreadable — suppresses the
   *  review-invite chip so the footer never deep-links into a broken queue. */
  reviewUnavailable?: boolean;
}) {
  const [done, setDone] = useState<Record<number, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [citationsOpen, setCitationsOpen] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);
  // ASK-3: hypotheses are analysis, not action — collapsed by default behind
  // a "Why this might be happening" disclosure (same idiom as the citation
  // drawer). Hidden, never unmounted, so the content stays in the DOM.
  const [whyOpen, setWhyOpen] = useState(false);

  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
  // COACH-6: real titles + type chips from the server registry, slug fallback.
  const sources = citationRows(contract);
  const hasSources = sources.length > 0;

  const showLens = lens && lens !== "Integrated Balanced";

  const copy = (text: string, key: string) => {
    // Growth loop (P0-4): copying an answer card is a share intent → completion.
    trackShareInitiated("answer_card", "coach");
    void Promise.resolve(navigator.clipboard?.writeText(text)).then(() =>
      trackShareCompleted("answer_card", "clipboard")
    );
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
  };

  return (
    <div className="space-y-2.5">
      {/* Meta header: attribution + age + domains (counts/observations only —
          never a graded risk verdict; clinical firewall) */}
      <div className="flex flex-wrap items-center gap-1.5">
        {showLens && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>{t("coach.alignedWith", { lens: lens! })}</span>
        )}
        {contract.ageBand && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>{contract.ageBand}</span>}
        {contract.domains?.slice(0, 3).map((d) => (
          <span key={d} className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>{d.replace(/_/g, " ")}</span>
        ))}
        {/* Masterplan 3.1: the why → Trust Center chain on the highest-trust
            surface — the fixed "How Arbor decides →" chip rides the attribution
            row (UI-WIRE 2026-08-20 inventory gap; label is fixed, callers
            inject no copy). */}
        <TrustLink surface="coach-answer" />
      </div>

      {/* ASK-3: a stressed parent wants the exact words and the 1-3 steps
          FIRST — parentScript ("Say this") and todayPlan lead the stack;
          analysis (hypotheses) collapses into a disclosure further down. */}

      {/* Parent script — say aloud */}
      {contract.parentScript && (
        <Panel
          icon={<Icon name="format_quote" size={12} />} title={t("coach.cards.sayThis")} tint="var(--arbor-sky-ink)"
          action={
            <div className="flex items-center gap-2">
              <SpeakButton text={contract.parentScript} lang={lang} className="text-[10px]" />
              <button onClick={() => copy(contract.parentScript, "script")} className="text-[10px] font-bold inline-flex items-center gap-1" style={{ color: "var(--arbor-muted)" }}>
                {copied === "script" ? <><Icon name="check" size={12} /> {t("coach.cards.copied")}</> : <><Icon name="content_copy" size={12} /> {t("coach.action.copy")}</>}
              </button>
            </div>
          }
        >
          <p className="text-[13px] leading-relaxed italic" style={{ color: "var(--arbor-ink)" }}>&ldquo;{contract.parentScript}&rdquo;</p>
        </Panel>
      )}

      {/* Today's plan — interactive checklist */}
      {contract.todayPlan?.length > 0 && (
        <Panel
          icon={<Icon name="checklist" size={12} />} title={t("coach.cards.tryToday")} tint="var(--arbor-green-ink)"
          action={
            <button onClick={() => onSaveToPlan(contract.nonDiagnosticHypotheses?.[0]?.label || contract.todayPlan[0])}
              className="text-[10px] font-bold inline-flex items-center gap-1" style={{ color: "var(--arbor-muted)" }}>
              <Icon name="playlist_add" size={12} /> {t("coach.cards.saveAsPlan")}
            </button>
          }
        >
          <ul className="space-y-1">
            {contract.todayPlan.map((step, i) => (
              <li key={i}>
                <button onClick={() => setDone((d) => ({ ...d, [i]: !d[i] }))} className="flex items-start gap-2 text-start w-full group">
                  {/* CR-01: the checked and unchecked boxes are separate
                      elements rather than one box with a conditional fill.
                      Same pixels either way — but the contrast ratchet can only
                      prove a tick's legibility when the fill it sits on is
                      statically known, and a ternary hid that. The glyph moves
                      from a text-white class to --arbor-on-accent, the token
                      that exists for ink on a saturated accent fill, so the
                      pairing is expressed in tokens the checker can resolve. */}
                  {done[i] ? (
                    <span
                      className="mt-0.5 w-4 h-4 rounded-md flex items-center justify-center flex-shrink-0 transition"
                      style={{ background: "var(--arbor-clay)", border: "1px solid var(--arbor-clay)" }}
                    >
                      <Icon name="check" size={12} style={{ color: "var(--arbor-on-accent)" }} />
                    </span>
                  ) : (
                    <span
                      className="mt-0.5 w-4 h-4 rounded-md flex items-center justify-center flex-shrink-0 transition"
                      style={{ border: "1px solid var(--arbor-rule-strong)" }}
                    />
                  )}
                  <span className="text-[12.5px] leading-snug" style={done[i] ? { color: "var(--arbor-muted)", textDecoration: "line-through" } : { color: "var(--arbor-ink)" }}>{step}</span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* Scholar council — each agent's lens, before the synthesis (SAGE-2) */}
      {council && council.length > 0 && (
        <Panel icon={<Icon name="group" size={12} />} title={t("coach.cards.council", { n: council.length })} tint="var(--arbor-sky-ink)">
          <ul className="space-y-2">
            {council.map((c) => (
              <li key={c.scholarId} className="text-[12.5px] leading-snug">
                <span className="font-bold" style={{ color: "var(--arbor-ink)" }}>{c.name}</span>
                <span className="text-[10px] font-bold" style={{ color: "var(--arbor-muted)" }}> · {c.concept}</span>
                {c.takeaway && <span className="block mt-0.5" style={{ color: "var(--arbor-muted)" }}>{c.takeaway}</span>}
                {c.suggestion && <span className="block mt-0.5" style={{ color: "var(--arbor-ink)" }}>→ {c.suggestion}</span>}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* ASK-3: "Why this might be happening" — the hypotheses collapse into a
          calm disclosure (citation-drawer idiom). Content identical, hidden
          rather than unmounted when collapsed. */}
      {contract.nonDiagnosticHypotheses?.length > 0 && (
        <div className="rounded-xl" style={{ border: "1px solid var(--arbor-rule)", overflow: "hidden" }}>
          <button
            onClick={() => setWhyOpen((o) => !o)}
            aria-expanded={whyOpen}
            className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 min-h-[44px] transition"
            style={{ background: "var(--arbor-paper-deep)" }}
          >
            <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-muted)" }}>
              <Icon name="lightbulb" size={12} /> {t("coach.cards.why")}
            </span>
            <span className="text-[10px] font-bold inline-flex items-center gap-0.5" style={{ color: "var(--arbor-muted)" }}>
              {whyOpen
                ? <><Icon name="expand_less" size={14} />{t("coach.escalate.toggle.close")}</>
                : <><Icon name="expand_more" size={14} />{t("coach.escalate.toggle.open")}</>}
            </span>
          </button>
          <div hidden={!whyOpen} className="px-3.5 pb-3 pt-2" style={{ background: "white", borderTop: "1px solid var(--arbor-rule)" }}>
            <ul className="space-y-1.5">
              {contract.nonDiagnosticHypotheses.map((h, i) => (
                <li key={i} className="text-[12.5px] leading-snug" style={{ color: "var(--arbor-ink)" }}>
                  <span className="font-bold" style={{ color: "var(--arbor-ink)" }}>{h.label}</span>
                  {h.confidence && <span className="ms-1.5 text-[10px] font-bold" style={{ color: "var(--arbor-muted)" }}>({h.confidence})</span>}
                  {h.rationale && <span className="block mt-0.5" style={{ color: "var(--arbor-muted)" }}>{h.rationale}</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Avoid / Observe */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {contract.avoid?.length > 0 && (
          <Panel icon={<Icon name="block" size={12} />} title={t("coach.cards.avoid")} tint="var(--arbor-peach-ink)">
            <ul className="space-y-1 text-[12px] leading-snug list-disc ps-4" style={{ color: "var(--arbor-muted)" }}>
              {contract.avoid.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </Panel>
        )}
        {contract.observe?.length > 0 && (
          <Panel icon={<Icon name="visibility" size={12} />} title={t("coach.cards.watchFor")} tint="var(--arbor-lav-ink)">
            <ul className="space-y-1 text-[12px] leading-snug list-disc ps-4" style={{ color: "var(--arbor-muted)" }}>
              {contract.observe.map((o, i) => <li key={i}>{o}</li>)}
            </ul>
          </Panel>
        )}
      </div>

      {/* Escalate — content is ALWAYS rendered when present; only its PROMINENCE
          is tiered by riskLevel. Low risk gets a calm, collapsed disclosure (same
          idiom as the citation drawer) so routine questions don't read as alarms;
          moderate and above keep the full pink warning panel untouched. The list
          is identical in both tiers and is never conditionally dropped — when
          collapsed it is hidden, not unmounted, so it stays in the DOM. */}
      {contract.escalateIf?.length > 0 && (escalationTier(contract.riskLevel) === "prominent" ? (
        <Panel icon={<Icon name="warning" size={12} />} title={t("coach.escalate.headline")} tint="var(--arbor-pink-ink)">
          <ul className="space-y-1 text-[12px] leading-snug list-disc ps-4" style={{ color: "var(--arbor-pink-ink)" }}>
            {contract.escalateIf.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </Panel>
      ) : (
        <div className="rounded-xl" style={{ border: "1px solid var(--arbor-rule)", overflow: "hidden" }}>
          <button
            onClick={() => setEscalateOpen((o) => !o)}
            aria-expanded={escalateOpen}
            className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 min-h-[44px] transition"
            style={{ background: "var(--arbor-paper-deep)" }}
          >
            <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-muted)" }}>
              <Icon name="health_and_safety" size={12} /> {t("coach.escalate.title")}
            </span>
            <span className="text-[10px] font-bold inline-flex items-center gap-0.5" style={{ color: "var(--arbor-muted)" }}>
              {escalateOpen
                ? <><Icon name="expand_less" size={14} />{t("coach.escalate.toggle.close")}</>
                : <><Icon name="expand_more" size={14} />{t("coach.escalate.toggle.open")}</>}
            </span>
          </button>
          <div hidden={!escalateOpen} className="px-3.5 pb-3 pt-2" style={{ background: "white", borderTop: "1px solid var(--arbor-rule)" }}>
            <ul className="space-y-1 text-[12px] leading-snug list-disc ps-4" style={{ color: "var(--arbor-muted)" }}>
              {contract.escalateIf.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        </div>
      ))}

      {/* Citation panel (R1) — visible grounding; badge + disclosure drawer.
          G2 gate: copy states mechanism/source only — never an outcome claim.
          Hidden when no sources present; no empty-state clutter. */}
      {hasSources && (
        <div className="rounded-xl" style={{ border: "1px solid var(--arbor-rule)", overflow: "hidden" }}>
          {/* Toggle row — 44px min tap target, reduced-motion respected */}
          <button
            onClick={() => setCitationsOpen((o) => !o)}
            aria-expanded={citationsOpen}
            className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 min-h-[44px] transition"
            style={{ background: "var(--arbor-paper-deep)" }}
          >
            <span className="inline-flex items-center gap-1.5">
              {/* Calm "Cited" badge */}
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
              >
                <Icon name="menu_book" size={12} />
                {t("cite.badge")}
              </span>
              <span className="text-[11px] font-bold" style={{ color: "var(--arbor-muted)" }}>
                {sourcesLabel(sources.length, lang)}
              </span>
            </span>
            <span className="text-[10px] font-bold inline-flex items-center gap-0.5" style={{ color: "var(--arbor-muted)" }}>
              {citationsOpen
                ? <><Icon name="expand_less" size={14} />{t("cite.toggle.close")}</>
                : <><Icon name="expand_more" size={14} />{t("cite.toggle.open")}</>}
            </span>
          </button>

          {/* Disclosure drawer — real source titles + type chips (COACH-6).
              Collapsed = hidden, not unmounted (same idiom as the escalation
              disclosure) so the rows are testable and stay in the DOM. */}
          <div
            hidden={!citationsOpen}
            className="px-3.5 pb-3 pt-2 space-y-1.5"
            style={{ background: "white", borderTop: "1px solid var(--arbor-rule)" }}
            dir={lang === "he" ? "rtl" : "ltr"}
          >
            {sources.map((src) => (
              <div
                key={src.id}
                className="rounded-lg px-2.5 py-1.5 text-[11.5px] leading-snug flex flex-wrap items-center gap-x-2 gap-y-1"
                style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
              >
                {src.title ? (
                  <>
                    <span className="font-bold" style={{ color: "var(--arbor-ink)" }}>{src.title}</span>
                    {src.type && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: "white", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
                      >
                        {src.type.replace(/_/g, " ")}
                      </span>
                    )}
                  </>
                ) : (
                  // Slug fallback: no registry metadata for this id.
                  <span>{t("cite.based", { source: src.id.replace(/-/g, " ") })}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ASK-6: felt memory — a calm counts-only footer. CLINICAL FIREWALL:
          the grounded row renders an integer COUNT only (no fact content, no
          percentage/confidence wording) and the review chip names THAT
          something is pending, never WHAT — zero memory content in-thread.
          Queue mechanics live untouched in Profile › Child Memory. */}
      {(memoryFooterLabel(contract.approvedMemoryFactsUsed, lang) !== "" || (!reviewUnavailable && (contract.memoryProposals?.length ?? 0) > 0)) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-0.5">
          {memoryFooterLabel(contract.approvedMemoryFactsUsed, lang) !== "" && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold" style={{ color: "var(--arbor-muted)" }}>
              <Icon name="psychology" size={13} aria-hidden />
              {memoryFooterLabel(contract.approvedMemoryFactsUsed, lang)}
              <span aria-hidden>·</span>
              <button
                type="button"
                onClick={onManageMemory}
                className="font-extrabold underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 rounded"
                style={{ color: "var(--arbor-green-ink)" }}
              >
                {t("coach.memory.manage")}
              </button>
            </span>
          )}
          {!reviewUnavailable && (contract.memoryProposals?.length ?? 0) > 0 && (
            <button
              type="button"
              onClick={onManageMemory}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 min-h-[32px] rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
              style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
            >
              <Icon name="lightbulb" size={13} aria-hidden /> {t("coach.memory.reviewChip")}
            </button>
          )}
        </div>
      )}

      {/* Structured actions — the answer feeds the rest of the app (ECO-3) */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button onClick={() => onSaveToPlan(contract.nonDiagnosticHypotheses?.[0]?.label || contract.todayPlan?.[0] || "")}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
          <Icon name="playlist_add" size={14} /> {t("coach.cards.saveToPlan")}
        </button>
        {contract.handoffNotes?.teacher && (
          <button onClick={() => { onAddToHandoff(contract.handoffNotes.teacher); copy(contract.handoffNotes.teacher, "handoff"); }}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition bg-white" style={{ color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}>
            {copied === "handoff" ? <><Icon name="check" size={14} /> {t("coach.cards.copiedNote")}</> : <><Icon name="send" size={14} /> {t("coach.cards.teacherNote")}</>}
          </button>
        )}
      </div>

      {/* AI-10: the in-product quality signal. Last row on the card, after the
          answer has fully settled — it never gates or delays the answer. */}
      <AnswerFeedback
        contract={contract}
        lens={lens}
        surface={council && council.length > 0 ? "council" : "coach"}
        lang={lang}
        sources={sources.length}
      />
    </div>
  );
}
