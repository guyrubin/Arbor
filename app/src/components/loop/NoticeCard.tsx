import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { FreeText } from "../ui/FreeText";
import { useLanguage } from "../../context/LanguageContext";
import type { Milestone } from "../../types";
import { milestoneText } from "../../lib/milestoneData";
import { milestoneAgeLine } from "../../lib/milestoneAgeLine";
import { shelfLabel, type ShelfId } from "../../lib/shelves/registry";
import { OBSERVED_WHEN, type ObserveStatus, type ObservedWhen } from "../../lib/milestones/observe";
// B-DESIGN-04: the 44 px duotone shelf glyph (P7-DESIGN; the flat loop chip retired here).
import { ShelfGlyph } from "../ui/ShelfGlyph";
// B-DESIGN-03: the one segmented answer control (P7-DESIGN, from Option B).
// SegmentedAnswers reads NOTICE_ANSWER_KEYS / NOTICE_ANSWER_ORDER from this
// module; both sides use the other only at render time, so the cycle is inert.
import { SegmentedAnswers } from "../ui/SegmentedAnswers";
// B-STATUS-01: the one receipt line of parent mode.
import { PendingLine, Receipt } from "../ui/Receipt";
import { routeHash } from "../../lib/routes";
import { SHELF_ART } from "../../lib/parentArt";
import { NOTICE_OBJECT_COPY } from "./noticeObjectCopy";
import "./noticeObject.css";

/** Where the card is in its short life: asking · seen (When + keep) · thanked (not yet / not sure) · kept. */
export type NoticePhase = "ask" | "seen" | "thanked" | "kept";
export type NoticeUndoState = { selected: ObserveStatus | null; observedWhen: ObservedWhen | null };

/** The answer label keys, in display order ("Seen it" leads). */
export const NOTICE_ANSWER_KEYS: Readonly<Record<ObserveStatus, string>> = {
  yes: "elev.loop.notice.seen",
  not_yet: "ms.observe.notYet",
  not_sure: "ms.observe.notSure",
};
/** ONE answer order on every loop surface (P5 critic r1 P1-2): yes · not_yet · not_sure. */
export const NOTICE_ANSWER_ORDER: readonly ObserveStatus[] = ["yes", "not_yet", "not_sure"];

const pill = "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full px-4 t-base font-semibold";

/**
 * The ONE answer group of the loop (Notice card, the Milestones door rows,
 * the latest card's "Change"): three equal neutral 44 px pills.
 * The same sapphire treatment marks each stored answer. `selected` marks the stored
 * answer (aria-pressed); `attrs` carries the route's primary-move stamp onto
 * the answers themselves, never a wrapper.
 */
export function NoticeAnswers({
  onAnswer,
  selected,
  ariaLabel,
  attrs,
  className = "mt-3",
  disabled = false,
}: {
  onAnswer: (status: ObserveStatus) => void;
  selected?: ObserveStatus | null;
  ariaLabel: string;
  attrs?: Record<string, string>;
  className?: string;
  disabled?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div role="group" aria-label={ariaLabel} aria-busy={disabled || undefined} data-testid="notice-answers" {...(attrs ?? {})} className={`${className} flex flex-wrap gap-2`}>
      {NOTICE_ANSWER_ORDER.map((status) => {
        const on = selected === status;
        return (
          <button
            key={status}
            type="button"
            disabled={disabled}
            data-answer={status}
            {...(selected !== undefined ? { "aria-pressed": on } : {})}
            onClick={() => onAnswer(status)}
            className={`${pill} transition active:scale-[0.98]`}
            style={
              on
                ? { color: "var(--arbor-on-accent)", background: "var(--arbor-clay)", border: "1px solid var(--arbor-clay)" }
                : { color: "var(--arbor-ink)", background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }
            }
          >
            {t(NOTICE_ANSWER_KEYS[status])}
          </button>
        );
      })}
    </div>
  );
}

/** The same object appears on Now, its shelf and the canonical detail sheet. */
export interface NoticeCardProps {
  milestone: Milestone;
  shelf: ShelfId;
  gender?: string | null;
  childName?: string;
  /** Hosts await confirmed persistence; a queued write must reject, not report saved. */
  onAnswer: (status: ObserveStatus) => void | Promise<unknown>;
  onWhen?: (when: ObservedWhen) => void | Promise<unknown>;
  onKeepQuote?: (text: string) => void | Promise<unknown>;
  onKeepPhoto?: () => void;
  /** Restores the answer's previous document, leaving separate kept evidence intact. */
  onUndo?: () => void | NoticeUndoState | Promise<void | NoticeUndoState>;
  selected?: ObserveStatus | null;
  observedWhen?: ObservedWhen | null;
  observedAt?: string | null;
  savedWords?: string | null;
  savedAt?: string | null;
  inlineEvidenceAllowed?: boolean;
  confirmed?: boolean;
  /** Account + child. Catalogue IDs alone are not a family's record identity. */
  scopeKey?: string;
  onOpen?: () => void;
  onDetails?: () => void;
  variant?: "row" | "card" | "detail";
  hideShelf?: boolean;
  initialPhase?: NoticePhase;
  stampMove?: string;
  answersAttrs?: Record<string, string>;
  besideWords?: string | null;
  answers?: "pills" | "segmented";
}

type NoticeWrite = "answer" | "when" | "note" | "undo";

/** A new child/account gets a fresh UI lifetime even for the same catalogue ID. */
export default function NoticeCard(props: NoticeCardProps) {
  return <NoticeContent key={`${props.scopeKey ?? "legacy"}:${props.milestone.id}`} {...props} />;
}

/**
 * B-GROWTH-44. Identity, meaning, response, authentic words and destination stay
 * together. Art identifies the area only. No answer is a grade or a verdict.
 * The editor keeps its draft on failure and advances only after acknowledgement.
 */
export function NoticeContent({
  milestone, shelf, gender, childName, onAnswer, onWhen, onKeepQuote, onKeepPhoto,
  onUndo, selected, observedWhen, observedAt, savedWords, savedAt, inlineEvidenceAllowed = true, confirmed = true,
  onOpen, onDetails, variant = "card", hideShelf = false, initialPhase,
  stampMove, answersAttrs, besideWords, answers = "pills",
}: NoticeCardProps) {
  const { t, uiLang } = useLanguage();
  const copy = NOTICE_OBJECT_COPY[uiLang === "he" ? "he" : "en"];
  const [phase, setPhase] = useState<NoticePhase>(initialPhase ?? (selected ? selected === "yes" ? "seen" : "thanked" : "ask"));
  const [response, setResponse] = useState<ObserveStatus | null>(selected ?? null);
  const [when, setWhen] = useState<ObservedWhen>(observedWhen ?? "today");
  const [quote, setQuote] = useState("");
  const [kept, setKept] = useState(savedWords?.trim() ?? "");
  const [keptAt, setKeptAt] = useState<string | null>(null);
  const [pending, setPending] = useState<NoticeWrite | null>(null);
  const [error, setError] = useState<NoticeWrite | null>(null);
  const [acknowledged, setAcknowledged] = useState<NoticeWrite | null>(null);
  const lifetime = useRef({ active: true, busy: false, generation: 0 });
  const beforeEdit = useRef<NoticeUndoState | null>(null);
  const storedResponse = useRef(selected);
  useEffect(() => {
    const current = lifetime.current;
    current.active = true;
    return () => { current.active = false; current.generation += 1; };
  }, []);
  useEffect(() => {
    if (savedWords !== undefined) setKept(savedWords?.trim() ?? "");
  }, [savedWords]);
  useEffect(() => {
    if (!pending && observedWhen) setWhen(observedWhen);
  }, [observedWhen, pending]);
  useEffect(() => {
    if (pending || !confirmed || selected === undefined || selected === storedResponse.current) return;
    storedResponse.current = selected;
    setResponse(selected);
    setPhase(selected ? selected === "yes" ? "seen" : "thanked" : "ask");
    setError(null);
  }, [selected, confirmed, pending]);

  const title = milestoneText(milestone, "title", t, { gender: gender ?? null });
  const looks = milestoneText(milestone, "looks", t, { gender: gender ?? null }) || milestoneText(milestone, "desc", t, { gender: gender ?? null });
  const ageLine = milestoneAgeLine(milestone, t);
  const shelfName = shelfLabel(shelf, t);
  const name = childName || t("today.record.childFallback");
  const art = SHELF_ART[shelf];
  const dateValue = savedAt ?? keptAt;
  const date = dateValue && Number.isFinite(Date.parse(dateValue))
    ? new Date(dateValue).toLocaleDateString(uiLang === "he" ? "he-IL" : "en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;
  const busy = pending !== null;
  const observedAnchor = observedAt === undefined ? milestone.observedAt : observedAt;
  const datedAnswer = response === "yes" && when === "today" && !!observedAnchor && Number.isFinite(Date.parse(observedAnchor));
  const canKeepInline = (inlineEvidenceAllowed && (!!kept || datedAnswer || initialPhase === "seen")) || pending === "note" || error === "note";
  const rememberResponse = () => { beforeEdit.current ??= { selected: response, observedWhen: when }; };

  const run = async (kind: NoticeWrite, write: () => void | Promise<unknown>, success: () => void) => {
    const current = lifetime.current;
    if (!current.active || current.busy) return;
    current.busy = true;
    const generation = ++current.generation;
    setPending(kind);
    setError(null);
    setAcknowledged(null);
    try {
      await write();
      if (!current.active || generation !== current.generation) return;
      success();
      setAcknowledged(kind);
    } catch {
      if (current.active && generation === current.generation) setError(kind);
    } finally {
      if (current.active && generation === current.generation) {
        current.busy = false;
        setPending(null);
      }
    }
  };
  const answer = (status: ObserveStatus) => {
    void run("answer", () => { rememberResponse(); return onAnswer(status); }, () => {
      setResponse(status);
      setPhase(status === "yes" ? "seen" : "thanked");
    });
  };
  const undo = () => {
    if (!onUndo) return;
    let restored: NoticeUndoState | void;
    void run("undo", async () => { restored = await onUndo(); }, () => {
      const previous = restored && typeof restored === "object" ? restored : beforeEdit.current ?? { selected: selected ?? null, observedWhen: observedWhen ?? null };
      setResponse(previous.selected);
      setWhen(previous.observedWhen ?? "today");
      setPhase(previous.selected ? previous.selected === "yes" ? "seen" : "thanked" : "ask");
      beforeEdit.current = null;
    });
  };
  const pickWhen = (value: ObservedWhen) => {
    if (!onWhen) return;
    void run("when", () => { rememberResponse(); return onWhen(value); }, () => setWhen(value));
  };
  const keep = () => {
    const words = quote.trim();
    if (!words || !onKeepQuote) return;
    void run("note", () => onKeepQuote(words), () => {
      setKept(words);
      setKeptAt(new Date().toISOString());
      setPhase("kept");
      setQuote("");
    });
  };
  const undoAction = onUndo ? { label: t("elev.loop.notice.undo"), onUndo: undo, testId: "notice-undo", disabled: busy } : null;
  const shelfLink = variant === "detail" || hideShelf || onOpen || onDetails ? null : { where: shelfName, href: `#${routeHash("journal", { shelf })}`, testId: "notice-receipt-open" };
  const stamp = stampMove ? { "data-primary-move": stampMove } : {};
  const open = onDetails ?? onOpen;
  const hasResponse = phase !== "ask";

  return (
    <article data-testid="notice-card" data-milestone-id={milestone.id} data-shelf={shelf} data-phase={phase}
      aria-label={t("elev.loop.notice.aria")} aria-busy={busy || undefined}
      className={`notice-object notice-object--${variant}${variant === "card" ? " arbor-depth-card" : ""}`}>
      <div className="notice-object-identity">
        <div className="notice-object-heading">
          {!hideShelf && (
            <div data-testid="notice-shelf-line" className="notice-object-shelf">
              <ShelfGlyph shelf={shelf} />
              <p data-testid="notice-shelf" className="t-sm font-semibold">{shelfName}</p>
            </div>
          )}
          <h3 data-testid="notice-title" className="notice-object-title">{title}</h3>
        </div>
        <img data-testid="notice-area-art" className="notice-object-art" src={art.src} srcSet={art.srcSet}
          width={art.width} height={art.height} alt="" aria-hidden="true" loading="lazy" decoding="async" />
      </div>
      {looks && <p data-testid="notice-looks" className="notice-object-meaning t-base">{looks}</p>}
      {ageLine && (
        <p data-testid="notice-age-line" className="notice-object-source t-sm">
          <Icon name="menu_book" size={14} /><span data-testid="notice-age-text">{ageLine}</span>
        </p>
      )}
      <div className="notice-object-response">
        {phase === "ask" && (
          <>
            <p className="notice-object-prompt t-sm">{copy.prompt}</p>
            {answers === "segmented" ? (
              <SegmentedAnswers onAnswer={answer} selected={response} disabled={busy} ariaLabel={t("ms.observePrompt")} attrs={{ ...stamp, ...(answersAttrs ?? {}) }} className="mt-2" />
            ) : (
              <NoticeAnswers onAnswer={answer} selected={response} disabled={busy} ariaLabel={t("ms.observePrompt")} attrs={{ ...stamp, ...(answersAttrs ?? {}) }} className="mt-2" />
            )}
          </>
        )}
        {hasResponse && response && (
          <div className="notice-object-answer-summary" data-testid="notice-stored-answer">
            <span className="t-sm">{copy.response}</span>
            <strong className="t-base"><Icon name="check" size={16} />{t(NOTICE_ANSWER_KEYS[response])}</strong>
            <button type="button" className="notice-object-link min-h-[44px]" disabled={busy}
              data-testid="notice-change" onClick={() => { setPhase("ask"); setError(null); }}>{copy.change}</button>
          </div>
        )}
        {phase === "seen" && (
          <div data-testid="notice-seen-strip" className="notice-object-saved">
            {confirmed && (besideWords?.trim() ? (
              <Receipt testId="notice-receipt" data={{ "data-beside": "true" }} tone="soft" size="sm" link={shelfLink} undo={undoAction} announce={acknowledged === "answer" || acknowledged === "when"}>
                {t("elev.loop.notice.seenReceiptBeside", { shelf: shelfName, name })}{" "}
                <span dir="auto" style={{ fontFamily: "var(--font-editorial)" }}>{t("elev.loop.ms.quoted", { text: besideWords.trim() })}</span>
              </Receipt>
            ) : (
              <Receipt testId="notice-receipt" size="sm" link={shelfLink} undo={undoAction} announce={acknowledged === "answer" || acknowledged === "when"}>
                {t("elev.loop.notice.seenReceipt", { shelf: shelfName, name })}
              </Receipt>
            ))}
            {onWhen && <div role="group" aria-label={t("elev.loop.notice.when")} data-testid="notice-when">
              <p className="t-sm font-semibold">{t("elev.loop.notice.when")}</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {OBSERVED_WHEN.map(value => (
                  <button key={value} type="button" data-when={value} aria-pressed={value === when}
                    disabled={busy} onClick={() => pickWhen(value)} className="notice-object-when min-h-[44px] t-base">
                    {t(`elev.loop.notice.when.${value}`)}
                  </button>
                ))}
              </div>
            </div>}
          </div>
        )}
        {phase === "thanked" && confirmed && (
          <Receipt testId="notice-thanks" icon={null} size="sm" undo={undoAction} announce={acknowledged === "answer" || acknowledged === "when"}>
            {t("elev.loop.notice.thanks")}
          </Receipt>
        )}
        {kept && (
          <figure data-testid="notice-kept" className="notice-object-words">
            <p className="t-sm font-semibold">{copy.words}</p>
            <blockquote><FreeText text={t("elev.loop.ms.quoted", { text: kept })} /></blockquote>
            {confirmed && <figcaption>
              <Receipt testId="notice-kept-status" tone={phase === "kept" ? "kept" : "soft"} size="sm" undo={phase === "kept" ? undoAction : null} announce={acknowledged === "note"}>
                {date ? `${copy.kept} · ${date}` : copy.kept}
              </Receipt>
            </figcaption>}
          </figure>
        )}
        {hasResponse && (onKeepQuote || onKeepPhoto) && (
          <div data-testid="notice-keep" className="notice-object-keep">
            <p className="t-sm font-semibold">{kept ? copy.editWords : t("elev.loop.notice.keep")}</p>
            {onKeepQuote && canKeepInline && (
              <form className="notice-object-quote-form" onSubmit={event => { event.preventDefault(); keep(); }}>
                <input type="text" dir="auto" value={quote} maxLength={200} disabled={busy}
                  onChange={event => setQuote(event.target.value)} placeholder={t("elev.loop.notice.keep.placeholder")}
                  aria-label={t("elev.loop.notice.keep")} data-testid="notice-keep-quote" className="min-h-[44px] t-base" />
                <button type="submit" data-testid="notice-keep-save" disabled={busy || !quote.trim()}
                  className="notice-object-when min-h-[44px] t-base">{t("elev.loop.notice.keep.save")}</button>
              </form>
            )}
            {onKeepQuote && !canKeepInline && <p className="t-sm mt-2" style={{ color: "var(--arbor-muted)" }}>{copy.chooseDate}</p>}
            {onKeepPhoto && <button type="button" data-testid="notice-keep-photo" disabled={busy} onClick={onKeepPhoto}
              className="notice-object-link min-h-[44px]"><Icon name="photo_camera" size={18} />{t("elev.loop.notice.keep.photo")}</button>}
          </div>
        )}
        {acknowledged === "undo" && confirmed && <Receipt testId="notice-undo-receipt" size="sm">{copy.undone}</Receipt>}
        <PendingLine active={busy || !confirmed} className="notice-object-status t-sm" testId="notice-write-status">
          {busy ? copy.saving : copy.unconfirmed}
        </PendingLine>
        {error && <p role="alert" data-testid="notice-write-error" className="notice-object-error t-sm">{copy.errors[error]}</p>}
      </div>
      {open && <footer className="notice-object-footer">
        <span className="t-sm">{hasResponse && confirmed ? copy.home : copy.context}</span>
        <button type="button" disabled={busy} onClick={open} data-testid="notice-open"
          className="notice-object-link min-h-[44px]">{copy.open}<Icon name="arrow_forward" size={18} className="rtl:rotate-180" /></button>
      </footer>}
    </article>
  );
}
