import React, { useEffect, useId, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { FreeText } from "../ui/FreeText";
import { BrandChip, DOMAIN_CHIP_TONE, brandChipShape } from "../ui/BrandChip";
import { PendingLine } from "../ui/Receipt";
import { useLanguage } from "../../context/LanguageContext";
import { milestoneText } from "../../lib/milestoneData";
import { milestoneAgeLine } from "../../lib/milestoneAgeLine";
import { shelfDef, shelfLabel } from "../../lib/shelves/registry";
import { OBSERVED_WHEN, type ObserveStatus, type ObservedWhen } from "../../lib/milestones/observe";
import { NOTICE_ANSWER_KEYS, NOTICE_ANSWER_ORDER, type NoticeCardProps, type NoticeUndoState } from "../loop/NoticeCard";
import { NOTICE_OBJECT_COPY } from "../loop/noticeObjectCopy";

/**
 * v4 — one compact row of Notice today (Arbor v4 · "NOTICE TODAY").
 *
 * The area chip, the milestone's title over its shelf (a tap opens what it
 * looks like and the age line), and three answers inline: Seen it · Not yet ·
 * Not sure. An answer turns into its pill with an undo; Seen it opens When
 * and a "Keep" line for the child's words, kept as a quote under the row.
 *
 * Same write semantics as the full Notice object (loop/NoticeCard): a write
 * advances only after the host confirms it, a failed write keeps the draft and
 * says so, undo restores the previous document, and the route's primary-move
 * stamp rides the answer group itself. No answer is a grade.
 */
type Write = "answer" | "when" | "note" | "undo";

/** Each answer's glyph and ink (Seen it green, Not yet amber, Not sure muted). */
export const NOTICE_ROW_ANSWER_ICON: Readonly<Record<ObserveStatus, { icon: string; ink: string }>> = {
  yes: { icon: "check", ink: "var(--arbor-green-ink)" },
  not_yet: { icon: "schedule", ink: "var(--arbor-yellow-ink)" },
  not_sure: { icon: "help", ink: "var(--arbor-muted)" },
};

export type NowNoticeRowProps = Omit<NoticeCardProps, "variant" | "hideShelf" | "answers" | "stampMove" | "besideWords" | "initialPhase"> & {
  /** Position in Notice today: picks a silhouette so neighbouring chips differ. */
  index: number;
};

export function NowNoticeRow(props: NowNoticeRowProps) {
  return <NowNoticeRowContent key={`${props.scopeKey ?? "legacy"}:${props.milestone.id}`} {...props} />;
}

function NowNoticeRowContent({
  milestone, shelf, gender, childName, onAnswer, onWhen, onKeepQuote, onKeepPhoto, onUndo,
  selected, observedWhen, observedAt, savedWords, savedAt, inlineEvidenceAllowed = true, confirmed = true,
  onOpen, onDetails, answersAttrs, index,
}: NowNoticeRowProps) {
  const { t, uiLang } = useLanguage();
  const he = uiLang === "he";
  const copy = NOTICE_OBJECT_COPY[he ? "he" : "en"];
  const uid = useId();
  const [response, setResponse] = useState<ObserveStatus | null>(selected ?? null);
  const [when, setWhen] = useState<ObservedWhen>(observedWhen ?? "today");
  const [info, setInfo] = useState(false);
  /** An answer from an earlier visit, reopened: the three answers show beside it. */
  const [asking, setAsking] = useState(false);
  const [keepOpen, setKeepOpen] = useState(false);
  const [quote, setQuote] = useState("");
  const [kept, setKept] = useState(savedWords?.trim() ?? "");
  const [keptAt, setKeptAt] = useState<string | null>(null);
  const [pending, setPending] = useState<Write | null>(null);
  const [error, setError] = useState<Write | null>(null);
  const [acknowledged, setAcknowledged] = useState<Write | null>(null);
  const lifetime = useRef({ active: true, busy: false, generation: 0 });
  const beforeEdit = useRef<NoticeUndoState | null>(null);
  const storedResponse = useRef(selected);
  const keepInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const current = lifetime.current;
    current.active = true;
    return () => { current.active = false; current.generation += 1; };
  }, []);
  useEffect(() => { if (savedWords !== undefined) setKept(savedWords?.trim() ?? ""); }, [savedWords]);
  useEffect(() => { if (!pending && observedWhen) setWhen(observedWhen); }, [observedWhen, pending]);
  useEffect(() => {
    if (pending || !confirmed || selected === undefined || selected === storedResponse.current) return;
    storedResponse.current = selected;
    setResponse(selected);
    setError(null);
  }, [selected, confirmed, pending]);
  useEffect(() => { if (keepOpen) keepInput.current?.focus(); }, [keepOpen]);

  const title = milestoneText(milestone, "title", t, { gender: gender ?? null });
  const looks = milestoneText(milestone, "looks", t, { gender: gender ?? null }) || milestoneText(milestone, "desc", t, { gender: gender ?? null });
  const ageLine = milestoneAgeLine(milestone, t);
  const def = shelfDef(shelf);
  const shelfName = shelfLabel(shelf, t);
  const name = childName || t("today.record.childFallback");
  const busy = pending !== null;
  const observedAnchor = observedAt === undefined ? milestone.observedAt : observedAt;
  const datedAnswer = response === "yes" && when === "today" && !!observedAnchor && Number.isFinite(Date.parse(observedAnchor));
  // The quote is dated by the observation: inline only for a dated Seen it (or words already kept here).
  const canKeepInline = (inlineEvidenceAllowed && (!!kept || datedAnswer)) || pending === "note" || error === "note";
  const open = onDetails ?? onOpen;
  const canUndo = !!onUndo && beforeEdit.current !== null;
  const keptDateValue = savedAt ?? keptAt;
  const keptDate = keptDateValue && Number.isFinite(Date.parse(keptDateValue)) ? new Date(keptDateValue) : null;
  const keptToday = !!keptDate && keptDate.toDateString() === new Date().toDateString();
  const keptMeta = keptToday || !keptDate
    ? t("elev.loop.today.notice.keptToday")
    : t("elev.loop.today.notice.keptOn", { date: keptDate.toLocaleDateString(he ? "he-IL" : "en-GB", { day: "numeric", month: "short" }) });

  const rememberResponse = () => { beforeEdit.current ??= { selected: response, observedWhen: when }; };
  const run = async (kind: Write, write: () => void | Promise<unknown>, success: () => void) => {
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
    void run("answer", () => { rememberResponse(); return onAnswer(status); }, () => { setResponse(status); setAsking(false); });
  };
  const undo = () => {
    if (!onUndo) return;
    let restored: NoticeUndoState | void;
    void run("undo", async () => { restored = await onUndo(); }, () => {
      const previous = restored && typeof restored === "object" ? restored : beforeEdit.current ?? { selected: selected ?? null, observedWhen: observedWhen ?? null };
      setResponse(previous.selected);
      setWhen(previous.observedWhen ?? "today");
      setKeepOpen(false);
      setAsking(false);
      beforeEdit.current = null;
    });
  };
  // An answer from an earlier visit: the icon reopens the three answers (the next tap writes).
  const change = () => { setAsking(true); setKeepOpen(false); setError(null); };
  const pickWhen = (value: ObservedWhen) => {
    if (!onWhen || value === when) return;
    void run("when", () => { rememberResponse(); return onWhen(value); }, () => setWhen(value));
  };
  const keep = () => {
    const words = quote.trim();
    if (!words || !onKeepQuote) return;
    void run("note", () => onKeepQuote(words), () => {
      setKept(words);
      setKeptAt(new Date().toISOString());
      setQuote("");
      setKeepOpen(false);
    });
  };
  const openKeep = () => {
    if (canKeepInline) setKeepOpen(true);
    else (onKeepPhoto ?? open)?.();
  };

  const answerLabel = (status: ObserveStatus) => t(NOTICE_ANSWER_KEYS[status]);
  const announce = acknowledged === "answer" || acknowledged === "when"
    ? response === "yes" ? t("elev.loop.notice.seenReceipt", { shelf: shelfName, name }) : response ? t("elev.loop.notice.thanks") : ""
    : acknowledged === "note" ? t("elev.loop.notice.keptReceipt")
    : acknowledged === "undo" ? copy.undone : "";
  const undoLabel = canUndo ? t("elev.loop.notice.undo") : copy.change;

  return (
    <article className="now-notice-item" data-testid="notice-card" data-milestone-id={milestone.id} data-shelf={shelf}
      data-phase={response && !asking ? (response === "yes" ? (kept ? "kept" : "seen") : "thanked") : "ask"}
      aria-label={t("elev.loop.notice.aria")} aria-busy={busy || undefined}>
      <div className="now-notice-item-main">
        <BrandChip icon={def.glyph} tone={DOMAIN_CHIP_TONE[def.domain] ?? "sky"} shape={brandChipShape(index + 1)} size={36} />
        <button type="button" className="now-notice-item-name" aria-expanded={info} aria-controls={`${uid}-info`}
          data-testid="notice-info-toggle" onClick={() => setInfo(v => !v)}>
          <span data-testid="notice-title" className="now-notice-item-title">{title}</span>
          <span className="now-notice-item-shelf"><span data-testid="notice-shelf">{shelfName}</span><Icon name={info ? "expand_less" : "expand_more"} size={15} /></span>
        </button>
        {!response || asking ? (
          <div role="group" aria-label={t("ms.observePrompt")} aria-busy={busy || undefined} data-testid="notice-answers"
            {...(answersAttrs ?? {})} className="now-notice-answers">
            {NOTICE_ANSWER_ORDER.map((status) => (
              <button key={status} type="button" className="now-notice-answer" data-answer={status} disabled={busy}
                aria-label={answerLabel(status)} title={answerLabel(status)} {...(response ? { "aria-pressed": response === status } : {})}
                onClick={() => answer(status)}>
                <Icon name={NOTICE_ROW_ANSWER_ICON[status].icon} size={17} style={{ color: NOTICE_ROW_ANSWER_ICON[status].ink }} />
                <span className="now-notice-answer-label" aria-hidden="true">{answerLabel(status)}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="now-notice-answered" data-testid="notice-stored-answer">
            <span className="now-notice-pill" data-answer={response}>
              <Icon name={NOTICE_ROW_ANSWER_ICON[response].icon} size={16} />{answerLabel(response)}
            </span>
            <button type="button" className="now-notice-undo" data-testid={canUndo ? "notice-undo" : "notice-change"} disabled={busy}
              aria-label={undoLabel} title={undoLabel} onClick={canUndo ? undo : change}>
              <Icon name="undo" size={18} />
            </button>
          </div>
        )}
      </div>
      <div id={`${uid}-info`} className="now-notice-item-more" data-testid="notice-info" hidden={!info}>
        {looks && <p data-testid="notice-looks">{looks}</p>}
        {ageLine && <p className="now-notice-item-age" data-testid="notice-age-line"><Icon name="menu_book" size={14} /><span data-testid="notice-age-text">{ageLine}</span></p>}
        {open && <button type="button" className="now-notice-link" data-testid="notice-open" disabled={busy} onClick={open}>
          {copy.open}<Icon name="arrow_forward" size={15} className="rtl:-scale-x-100" />
        </button>}
      </div>
      {response === "yes" && !asking && (onWhen || (onKeepQuote && !kept)) && (
        <div className="now-notice-item-more now-notice-seen" data-testid="notice-seen-strip">
          {onWhen && <div role="group" aria-label={t("elev.loop.notice.when")} data-testid="notice-when" className="now-notice-whens">
            {OBSERVED_WHEN.map(value => (
              <button key={value} type="button" className="now-notice-when" data-when={value} aria-pressed={value === when}
                disabled={busy} onClick={() => pickWhen(value)}>{t(`elev.loop.notice.when.${value}`)}</button>
            ))}
          </div>}
          {onKeepQuote && !kept && !keepOpen && (
            <button type="button" className="now-notice-link" data-testid="notice-keep-open" disabled={busy}
              aria-label={t("elev.loop.today.notice.keepAria")} onClick={openKeep}>
              <Icon name="format_quote" size={16} />{t("elev.loop.today.notice.keep")}
            </button>
          )}
        </div>
      )}
      {response === "yes" && !asking && onKeepQuote && keepOpen && canKeepInline && (
        <form className="now-notice-item-more now-notice-keep" data-testid="notice-keep" onSubmit={event => { event.preventDefault(); keep(); }}>
          <input ref={keepInput} type="text" dir="auto" value={quote} maxLength={200} disabled={busy}
            onChange={event => setQuote(event.target.value)} onKeyDown={event => { if (event.key === "Escape") setKeepOpen(false); }}
            placeholder={t("elev.loop.today.notice.keepPlaceholder", { name })}
            aria-label={t("elev.loop.today.notice.keepAria")} data-testid="notice-keep-quote" />
          <button type="submit" data-testid="notice-keep-save" disabled={busy || !quote.trim()}>{t("elev.loop.today.notice.save")}</button>
        </form>
      )}
      {kept && (
        <p className="now-notice-item-more now-notice-kept" data-testid="notice-kept">
          <span className="now-notice-kept-words"><FreeText text={t("elev.loop.ms.quoted", { text: kept })} /></span>{" "}
          {confirmed && <span className="now-notice-kept-meta">{keptMeta}</span>}
        </p>
      )}
      {acknowledged === "answer" && response && response !== "yes" && confirmed && (
        <p className="now-notice-item-more now-notice-note" data-testid="notice-thanks">{t("elev.loop.notice.thanks")}</p>
      )}
      <PendingLine active={busy || !confirmed} className="now-notice-item-more now-notice-note" testId="notice-write-status">
        {busy ? copy.saving : copy.unconfirmed}
      </PendingLine>
      {error && <p role="alert" data-testid="notice-write-error" className="now-notice-item-more now-notice-error">{copy.errors[error]}</p>}
      <span className="sr-only" role="status" aria-live="polite" data-testid="notice-row-status">{confirmed ? announce : ""}</span>
    </article>
  );
}

export default NowNoticeRow;
