import React, { useState } from "react";
import Icon from "../ui/Icon";
import type { CoachContract, CouncilTake } from "../../types";
import type { UiLang } from "../../lib/i18n";
import { translate } from "../../lib/i18n";
import { SpeakButton } from "../ui/SpeakButton";
import { trackShareInitiated, trackShareCompleted } from "../../lib/loopEvents";

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

export default function CoachAnswerCards({ contract, lens, council, lang = "en", onSaveToPlan, onCreateLog, onAddToHandoff, onManageMemory }: {
  contract: CoachContract;
  lens?: string;
  council?: CouncilTake[];
  lang?: UiLang;
  onSaveToPlan: (topic: string) => void;
  onCreateLog: () => void;
  onAddToHandoff: (note: string) => void;
  /** ASK-6: deep link to Profile › Child Memory (route "memory"). */
  onManageMemory?: () => void;
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
                  <span className="mt-0.5 w-4 h-4 rounded-md flex items-center justify-center flex-shrink-0 transition" style={done[i] ? { background: "var(--arbor-clay)", border: "1px solid var(--arbor-clay)" } : { border: "1px solid var(--arbor-rule-strong)" }}>
                    {done[i] && <Icon name="check" size={12} className="text-white" />}
                  </span>
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
      {(memoryFooterLabel(contract.approvedMemoryFactsUsed, lang) !== "" || (contract.memoryProposals?.length ?? 0) > 0) && (
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
          {(contract.memoryProposals?.length ?? 0) > 0 && (
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
    </div>
  );
}
