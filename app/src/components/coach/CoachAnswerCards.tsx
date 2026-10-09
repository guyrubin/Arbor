import { translate as inputText } from "../../lib/i18n";
import React, { useState } from "react";
import Icon from "../ui/Icon";
import type { CoachContract, CouncilTake } from "../../types";
import type { UiLang } from "../../lib/i18n";
import { translate } from "../../lib/i18n";
import { SayThis } from "../ui/AiBlock";
import { MarkdownBlock } from "../ui/MarkdownBlock";
import type { KeepableField } from "../../lib/captureProposals";
import "./coachReport.css";
import { TrustLink } from "../trust/TrustLink";
import { trackShareInitiated, trackShareCompleted } from "../../lib/loopEvents";
import { track } from "../../lib/analytics";
import { toDomains, domainLabel } from "../../lib/domains/registry";

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

/** B-ASKJB-04 — today's step as the answer card sees it (ids/status/text only). */
export type CoachTodayStep = { id: string; recommendation: string; status: "accepted" | "completed" | "superseded" };

/**
 * Pure helper (B-ASKJB-04): what the "I'll try it" control under step 1 shows.
 *  - "accepted": this step IS today's step and still waits for an outcome →
 *    "Today's step · we'll ask how it went" + Undo.
 *  - "replace": another step is accepted today and unrated → "Make this
 *    today's step" with the one-line "Replaces …" confirm (B-AI-05 marks the
 *    old row superseded; a completed row is never overwritten).
 *  - "hidden": today's step already has an outcome — one step per day.
 *  - "accept": no step today → "I'll try it".
 */
export function tryItState(step: string, today: CoachTodayStep | null | undefined): "accept" | "replace" | "accepted" | "hidden" {
  if (!today || today.status === "superseded") return "accept";
  if (today.status === "completed") return "hidden";
  return today.recommendation.trim() === step.trim() ? "accepted" : "replace";
}

/** B-ASKJB-04 — the control under step 1 that enters the action loop. */
/** Extra props a host surface puts on the "I'll try it" button — its own
 *  contract stamp and, when the step IS that surface's primary move, the
 *  primary fill (critic r1, W2-ASKJB plans). The host owns both spellings. */
export type TryItButtonProps = { style?: React.CSSProperties } & { [attr: `data-${string}`]: string };

export function CoachTryIt({ step, today, lang, onTryIt, onUndo, buttonProps }: {
  step: string;
  today: CoachTodayStep | null | undefined;
  lang: UiLang;
  onTryIt: (step: string) => void;
  onUndo: (id: string) => void;
  buttonProps?: TryItButtonProps;
}) {
  const { style: hostStyle, ...hostAttrs } = buttonProps ?? {};
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
  const state = tryItState(step, today);
  if (state === "hidden") return null;
  if (state === "accepted" && today) {
    return (
      <div data-testid="coach-try-it" data-state="accepted" role="status" className="mt-2 flex flex-wrap items-center gap-x-2 pt-2" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
        <span className="inline-flex flex-1 min-w-0 items-center gap-1.5 text-[12px] font-bold" style={{ color: "var(--arbor-green-ink)" }}>
          <Icon name="check_circle" size={14} /> {t("coach.tryIt.accepted")}
        </span>
        <button type="button" {...hostAttrs} onClick={() => onUndo(today.id)} className="inline-flex min-h-11 items-center px-2 text-[12px] font-bold underline underline-offset-2" style={{ color: "var(--arbor-muted)" }}>
          {t("coach.tryIt.undo")}
        </button>
      </div>
    );
  }
  return (
    <div data-testid="coach-try-it" data-state={state} className="mt-2 space-y-1 pt-2" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
      <button
        type="button"
        {...hostAttrs}
        onClick={() => onTryIt(step)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[13px] font-extrabold"
        style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-rule-strong)", ...hostStyle }}
      >
        <Icon name="flag" size={14} /> {state === "replace" ? t("coach.tryIt.replace") : t("coach.tryIt")}
      </button>
      {state === "replace" && today && (
        <p className="text-[11px] leading-snug" style={{ color: "var(--arbor-muted)" }}>{t("coach.tryIt.replaces", { current: today.recommendation })}</p>
      )}
    </div>
  );
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

/**
 * B-AI-14 (reopened 6 Oct): the lines the escalation slot shows. A seeded
 * hard-moment answer carries the governed card's sentence in its own field,
 * `governedEscalation` (server-set, byte-identical); then that string is the
 * slot's ONLY line, untouched — the model's escalateIf is never shown beside
 * it. Without it, the model's escalateIf renders as before.
 */
export function escalationLines(contract: Pick<CoachContract, "escalateIf" | "governedEscalation">): string[] {
  if (typeof contract.governedEscalation === "string" && contract.governedEscalation.length > 0) return [contract.governedEscalation];
  return Array.isArray(contract.escalateIf) ? contract.escalateIf : [];
}

/**
 * OBJ-ASK-02 — the attribution chips printed the model's own identifiers.
 * `domains` are framework ids (`independence_adaptive_skills`) and the chip
 * rendered `d.replace(/_/g, " ")`, so a parent read "independence adaptive
 * skills"; `ageBand` is the retrieval vocabulary ("3-5y") and was printed raw.
 *
 * Both now resolve through dictionaries that already exist: the domain
 * registry (B-GROWTH-26: every framework id → its registry domain name(s),
 * EN + HE, the same names Growth and Milestones print) and
 * `elev.band.*` (the five KNOWLEDGE_AGE_BANDS). A value outside either
 * vocabulary — the model can emit one — is de-identified into words rather
 * than rendered as an id, and never as a raw key: translate() falls back to
 * the key, so the fallback is taken on key-identity, not on emptiness.
 * Exported so tests cover them without mounting the component.
 */
export function domainChipLabel(domain: string, lang: UiLang = "en"): string {
  if (toDomains("developmental", domain).length > 0) {
    return domainLabel("developmental", domain, (k) => translate(lang, k));
  }
  const words = domain.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function ageBandChipLabel(band: string, lang: UiLang = "en"): string {
  const key = "elev.band." + band;
  const label = translate(lang, key);
  if (label !== key) return label;
  // A band outside the vocabulary ("3-4y" is emitted by stubs and by the model)
  // still reads as a range, not as a token. The hyphen is MEANINGFUL here, so
  // it is parsed rather than blanked — blanking it turns "3-4y" into "3 4y".
  const range = /^(\d{1,2})\s*-\s*(\d{1,3})\s*([ym])$/i.exec(band.trim());
  if (range) {
    return translate(lang, range[3].toLowerCase() === "y" ? "elev.band.rangeYears" : "elev.band.rangeMonths", {
      from: range[1],
      to: range[2],
    });
  }
  return band.trim();
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
      : { background: "var(--arbor-paper-elevated)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" };

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
        className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1 min-h-11 rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
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
        className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1 min-h-11 rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
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
 * One report owns the lead, reasoning and actions. The host must not print
 * contract.text above it. Optional keep controls sit beside their original
 * text; they never repeat it in a second proposal card.
 */
export default function CoachAnswerCards({
  contract, lens, council, lang = "en", onSaveToPlan, onGoDeeper,
  onAddToHandoff, onManageMemory, reviewUnavailable = false,
  todayStep, onTryIt, onUndoTryIt, renderKeepAction, onProposeMemory,
}: {
  contract: CoachContract;
  todayStep?: CoachTodayStep | null;
  onTryIt?: (step: string) => void;
  onUndoTryIt?: (id: string) => void;
  lens?: string;
  council?: CouncilTake[];
  lang?: UiLang;
  onSaveToPlan: (topic: string) => void;
  onGoDeeper?: () => void;
  /** One prefill seam for every note; the audience defaults to the teacher. */
  onAddToHandoff: (note: string, audience?: "teacher" | "pediatrician") => void;
  onManageMemory?: () => void;
  /** A document's suggested fact, chosen by the parent: proposes it to the
   *  PENDING memory queue (Profile › Child Memory approves; nothing is used
   *  before that). Rejects on failure so the row can offer a retry. */
  onProposeMemory?: (fact: string) => Promise<void>;
  reviewUnavailable?: boolean;
  /** Only provide this for the latest settled typed turn. Persistence remains
   *  in CaptureProposalsTray's shared explicit commit / edit / undo seam. */
  renderKeepAction?: (field: KeepableField, text: string) => React.ReactNode;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [copyFallback, setCopyFallback] = useState<string | null>(null);
  const [citationsOpen, setCitationsOpen] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [proposed, setProposed] = useState<Record<number, "saving" | "saved" | "error">>({});
  const doc = contract.fileDeclined ? undefined : contract.document;
  const proposeFact = async (fact: string, index: number) => {
    if (!onProposeMemory || proposed[index] === "saving" || proposed[index] === "saved") return;
    setProposed((state) => ({ ...state, [index]: "saving" }));
    try { await onProposeMemory(fact); setProposed((state) => ({ ...state, [index]: "saved" })); }
    catch { setProposed((state) => ({ ...state, [index]: "error" })); }
  };
  const docNote = doc ? [doc.handoffNote, ...doc.questionsForProfessional.map((q) => `- ${q}`)].filter(Boolean).join("\n") : "";
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
  const sources = citationRows(contract);
  const escalation = escalationLines(contract);
  const prominentHelp = escalation.length > 0 && escalationTier(contract.riskLevel) === "prominent";
  const showLens = lens && lens !== "Integrated Balanced";
  const hasPlan = Boolean(contract.todayPlan?.length || contract.nonDiagnosticHypotheses?.length);
  const copy = async (text: string, key: string) => {
    setCopied(null);
    setCopyFallback(null);
    trackShareInitiated("answer_card", "coach");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      trackShareCompleted("answer_card", "clipboard");
      setCopied(key);
    } catch {
      // A success label must mean the clipboard actually received the text.
      setCopyFallback(text);
    }
  };

  return (
    <article className="coach-report" data-testid="coach-answer-cards" dir={lang === "he" ? "rtl" : "ltr"}>
      {/* Acute help stays ahead of every explanation and optional action.
          Only presentation tier changes; the server-governed sentence is
          never rewritten, replaced, scored, or made keepable here. */}
      {prominentHelp && (
        <section className="coach-report__help" data-testid="coach-report-urgent-help">
          <h3><Icon name="warning" size={18} />{t("coach.escalate.headline")}</h3>
          <ul>{escalation.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </section>
      )}

      {contract.text?.trim() && (
        <header className="coach-report__opening" data-testid="coach-report-opening">
          <p className="coach-report__eyebrow">{inputText(lang, "companion.input.making-sense-of-it")}</p>
          <MarkdownBlock text={contract.text} className="coach-report__lead" />
        </header>
      )}

      {doc && (
        <section className="coach-report__section coach-report__document" data-testid="coach-report-document">
          <h3><Icon name="description" size={18} />{doc.documentType ? t("coach.doc.titleTyped", { type: doc.documentType }) : t("coach.doc.title")}</h3>
          {doc.keyPoints.length > 0 && <>
            <p className="coach-report__eyebrow">{t("coach.doc.keyPoints")}</p>
            <ul className="coach-report__list">{doc.keyPoints.map((point, i) => <li key={i} dir="auto">{point}</li>)}</ul>
          </>}
          {doc.questionsForProfessional.length > 0 && <>
            <p className="coach-report__eyebrow">{t("coach.doc.askPro")}</p>
            <ul className="coach-report__list">{doc.questionsForProfessional.map((q, i) => <li key={i} dir="auto">{q}</li>)}</ul>
          </>}
          {docNote && (
            <button type="button" className="coach-report__doc-handoff" data-testid="coach-doc-handoff" onClick={() => onAddToHandoff(docNote, "pediatrician")}>
              <Icon name="send" size={17} />{t("coach.doc.toConsult")}
            </button>
          )}
          {doc.suggestedMemory.length > 0 && onProposeMemory && <>
            <p className="coach-report__eyebrow">{t("coach.doc.remember")}</p>
            <ul className="coach-report__list" data-testid="coach-doc-memory">
              {doc.suggestedMemory.map((fact, i) => (
                <li key={i}>
                  <p dir="auto">{fact}</p>
                  <button type="button" disabled={proposed[i] === "saving" || proposed[i] === "saved"} onClick={() => void proposeFact(fact, i)}>
                    <Icon name={proposed[i] === "saved" ? "check" : "bookmark_add"} size={16} />
                    {proposed[i] === "saved" ? t("coach.doc.saved") : proposed[i] === "error" ? t("coach.doc.retry") : t("coach.doc.save")}
                  </button>
                </li>
              ))}
            </ul>
            <p className="coach-report__meta">{t("coach.doc.pendingNote")}</p>
          </>}
        </section>
      )}

      {contract.nonDiagnosticHypotheses?.length > 0 && (
        <section className="coach-report__section" data-testid="coach-report-understanding">
          <h3>{t("coach.cards.why")}</h3>
          <ul className="coach-report__understanding">
            {contract.nonDiagnosticHypotheses.map((h, i) => (
              <li key={i} dir="auto">
                <strong>{h.label}</strong>
                {h.rationale && <p>{h.rationale}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {contract.todayPlan?.length > 0 && (
        <section className="coach-report__section coach-report__next" data-testid="coach-report-next">
          <h3><Icon name="checklist" size={19} />{t("coach.cards.tryToday")}</h3>
          <ol className="coach-report__steps">
            {contract.todayPlan.map((step, index) => (
              <li key={index}>
                <span className="coach-report__step-number" aria-hidden="true">{index + 1}</span>
                <div className="coach-report__step-content">
                  <p dir="auto">{step}</p>
                  {index === 0 && onTryIt && onUndoTryIt && (
                    <CoachTryIt step={step} today={todayStep} lang={lang} onTryIt={onTryIt} onUndo={onUndoTryIt} />
                  )}
                  {renderKeepAction?.("todayPlan", step)}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {contract.parentScript && (
        <section className="coach-report__section coach-report__script">
          <SayThis
            text={contract.parentScript}
            title={t("coach.cards.sayThis")}
            lang={lang}
            copyLabel={t("coach.action.copy")}
            copiedLabel={t("coach.cards.copied")}
            copied={copied === "script"}
            onCopy={() => void copy(contract.parentScript, "script")}
          />
          {renderKeepAction?.("parentScript", contract.parentScript)}
        </section>
      )}

      {(contract.observe?.length > 0 || contract.avoid?.length > 0) && (
        <div className="coach-report__considerations">
          {contract.observe?.length > 0 && (
            <section className="coach-report__section" data-testid="coach-report-observe">
              <h3><Icon name="visibility" size={18} />{t("coach.cards.watchFor")}</h3>
              <ul className="coach-report__list">
                {contract.observe.map((line, index) => (
                  <li key={index}><p dir="auto">{line}</p>{renderKeepAction?.("observe", line)}</li>
                ))}
              </ul>
            </section>
          )}
          {contract.avoid?.length > 0 && (
            <section className="coach-report__section" data-testid="coach-report-avoid">
              <h3>{t("coach.cards.avoid")}</h3>
              <ul className="coach-report__list">
                {contract.avoid.map((line, index) => <li key={index} dir="auto">{line}</li>)}
              </ul>
            </section>
          )}
        </div>
      )}

      {escalation.length > 0 && !prominentHelp && (
        <section className="coach-report__disclosure" data-testid="coach-report-help">
          <button type="button" onClick={() => setEscalateOpen((open) => !open)} aria-expanded={escalateOpen}>
            <span><Icon name="health_and_safety" size={17} />{t("coach.escalate.title")}</span>
            <Icon name={escalateOpen ? "expand_less" : "expand_more"} size={19} />
          </button>
          <div hidden={!escalateOpen} className="coach-report__disclosure-body">
            <ul className="coach-report__list">{escalation.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        </section>
      )}

      {/* These actions extend the answer; none hide its reasoning or steps. */}
      <div className="coach-report__tools">
        {hasPlan && (
          <button type="button" data-testid="coach-plan-door" onClick={() => onSaveToPlan(contract.nonDiagnosticHypotheses?.[0]?.label || contract.todayPlan?.[0] || "")}>
            <Icon name="playlist_add" size={18} />{t("coach.cards.turnIntoPlan")}
          </button>
        )}
        {contract.handoffNotes?.teacher && (
          <button type="button" onClick={() => onAddToHandoff(contract.handoffNotes.teacher)}>
            <Icon name="send" size={17} />{t("coach.cards.teacherNote")}
          </button>
        )}
        {contract.handoffNotes?.professional && (
          <button type="button" data-testid="coach-professional-note" onClick={() => onAddToHandoff(contract.handoffNotes.professional, "pediatrician")}>
            <Icon name="send" size={17} />{t("coach.cards.professionalNote")}
          </button>
        )}
        {!council?.length && onGoDeeper && (
          <button type="button" data-testid="coach-go-deeper" onClick={onGoDeeper}>
            <Icon name="group" size={18} />{t("coach.cards.goDeeper")}
          </button>
        )}
      </div>

      {council && council.length > 0 && (
        <section className="coach-report__section coach-report__council">
          <h3>{t("coach.cards.council", { n: council.length })}</h3>
          <ul className="coach-report__understanding">
            {council.map((c) => (
              <li key={c.scholarId} dir="auto">
                <strong>{c.name}</strong><span className="coach-report__meta"> · {c.concept}</span>
                {c.takeaway && <p>{c.takeaway}</p>}
                {c.suggestion && <p>{c.suggestion}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {sources.length > 0 && (
        <section className="coach-report__disclosure" data-testid="coach-report-sources">
          <button type="button" onClick={() => setCitationsOpen((open) => !open)} aria-expanded={citationsOpen}>
            <span><Icon name="menu_book" size={17} />{sourcesLabel(sources.length, lang)}</span>
            <span className="coach-report__meta">{t("cite.badge")}<Icon name={citationsOpen ? "expand_less" : "expand_more"} size={19} /></span>
          </button>
          <div hidden={!citationsOpen} className="coach-report__disclosure-body">
            <ul className="coach-report__source-list">
              {sources.map((src) => (
                <li key={src.id}>
                  <span>{src.title || t("cite.based", { source: src.id.replace(/-/g, " ") })}</span>
                  {src.type && <span className="coach-report__meta">{src.type.replace(/_/g, " ")}</span>}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <footer className="coach-report__footer" data-testid="coach-answer-footer">
        <div className="coach-report__attribution">
          <TrustLink surface="coach-answer" />
          {showLens && <span>{t("coach.alignedWith", { lens: lens! })}</span>}
          {contract.ageBand && <span>{ageBandChipLabel(contract.ageBand, lang)}</span>}
          {Array.from(new Set(contract.domains ?? [])).slice(0, 3).map((d) => (
            <span key={d}>{domainChipLabel(d, lang)}</span>
          ))}
        </div>
        {(memoryFooterLabel(contract.approvedMemoryFactsUsed, lang) !== "" || (!reviewUnavailable && (contract.memoryProposals?.length ?? 0) > 0)) && (
          <div className="coach-report__memory">
            {memoryFooterLabel(contract.approvedMemoryFactsUsed, lang) !== "" && (
              <div>
                <Icon name="psychology" size={17} aria-hidden />
                <span>{memoryFooterLabel(contract.approvedMemoryFactsUsed, lang)}</span>
                {onManageMemory && <button type="button" onClick={onManageMemory}>{t("coach.memory.manage")}</button>}
              </div>
            )}
            {!reviewUnavailable && onManageMemory && (contract.memoryProposals?.length ?? 0) > 0 && (
              <button type="button" onClick={onManageMemory}>
                <Icon name="lightbulb" size={17} aria-hidden />{t("coach.memory.reviewChip")}
              </button>
            )}
          </div>
        )}
        <AnswerFeedback
          key={answerSignature(contract)}
          contract={contract} lens={lens} surface={council && council.length > 0 ? "council" : "coach"}
          lang={lang} sources={sources.length}
        />
      </footer>
      {copyFallback !== null && (
        <label className="coach-report__copy-fallback">
          <span>{inputText(lang, "companion.input.select-the-text-to-copy-it")}</span>
          <textarea readOnly value={copyFallback} dir="auto" autoFocus onFocus={(event) => event.currentTarget.select()} />
        </label>
      )}
    </article>
  );
}
