import React from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { FreeText } from "../ui/FreeText";
import { useLanguage } from "../../context/LanguageContext";
import {
  FROM_RECORD_ANSWERS,
  fromRecordAnswerKey,
  fromRecordMetaKey,
  fromRecordQuestionKey,
  type FromRecordAnswer,
  type FromRecordOpener,
} from "../../lib/today/fromRecord";

/** "9 Jul" / "9 ביולי" — the date the quoted words were written. */
export function recordDate(iso: string | null, lang: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString(lang === "he" ? "he-IL" : "en-GB", { day: "numeric", month: "short" });
}

/**
 * B-TODAY-28 — Today's first card when the record holds something to say
 * back: the parent's own words (editorial serif inside a 2 px inline-start
 * rule), the date they were written, ONE question (the card's largest sans
 * line) and three answer pills ≥ 44 px. No illustration, no greeting, no
 * count. Answering writes one reflection row (recordFromRecordAnswer) and
 * the card becomes a one-line receipt — no celebration.
 *
 * Parent register; tokens only; logical properties (border-s / ps) so the
 * rule sits on the reading side in both locales. The quote is user text:
 * FreeText (B-SHELL-28) so a Hebrew name at the start never flips an English
 * sentence (and the reverse).
 */
export default function FromRecordCard({
  opener,
  onAnswer,
}: {
  opener: FromRecordOpener;
  onAnswer: (answer: FromRecordAnswer) => void;
}) {
  const { t, uiLang } = useLanguage();
  const question = t(fromRecordQuestionKey(opener));
  const metaKey = fromRecordMetaKey(opener);
  const date = recordDate(opener.quoteAt, uiLang);
  return (
    <section
      data-testid="today-record-card"
      data-record-kind={opener.kind}
      aria-label={t("today.record.aria")}
      className="rounded-[20px] p-4 sm:p-5"
      style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}
    >
      {opener.topic && (
        <p data-testid="today-record-topic" className="text-[13px] font-semibold" style={{ color: "var(--arbor-muted)" }}>
          <FreeText text={opener.topic} />
        </p>
      )}
      {opener.quote && (
        <figure className={opener.topic ? "mt-2" : ""}>
          <blockquote
            data-testid="today-record-quote"
            className="border-s-2 ps-3 text-[17px] leading-snug sm:text-[19px]"
            style={{ borderColor: "var(--arbor-rule-strong)", color: "var(--arbor-ink)", fontFamily: "var(--font-editorial)" }}
          >
            <FreeText text={opener.quote} />
          </blockquote>
          {metaKey && date && (
            <figcaption data-testid="today-record-meta" className="mt-1.5 ps-3 text-[12px]" style={{ color: "var(--arbor-muted)" }}>
              {t(metaKey, { date })}
            </figcaption>
          )}
        </figure>
      )}
      <h2
        data-testid="today-record-question"
        className="mt-3 text-[20px] font-semibold leading-tight sm:text-[22px]"
        style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-sans)" }}
      >
        {question}
      </h2>
      <div role="group" aria-label={question} data-testid="today-record-answers" className="mt-3 flex flex-wrap gap-2">
        {FROM_RECORD_ANSWERS.map((answer) => (
          <button
            key={answer}
            type="button"
            data-answer={answer}
            onClick={() => onAnswer(answer)}
            className="inline-flex min-h-[44px] items-center rounded-full px-4 text-[14px] font-semibold transition active:scale-[0.98]"
            style={{ color: "var(--arbor-ink)", background: "var(--arbor-paper)", border: "1px solid var(--arbor-rule-strong)" }}
          >
            {t(fromRecordAnswerKey(opener, answer))}
          </button>
        ))}
      </div>
    </section>
  );
}

/** The one-line receipt after an answer ("Noted · today"). The page's one movement. */
export function FromRecordReceipt() {
  const { t } = useLanguage();
  return (
    <motion.p
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      data-testid="today-record-receipt"
      role="status"
      className="flex items-center gap-1.5 px-1 text-[13px]"
      style={{ color: "var(--arbor-muted)" }}
    >
      <Icon name="check" size={16} />
      {t("today.record.receipt")}
    </motion.p>
  );
}
