import React from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { languageName } from "../../lib/languageName";
import { ageMonthsOf } from "../../lib/age/forChild";
import { parentWritten } from "../../lib/kept/parentWritten";
import type { ActionLoopEntry } from "../../actionLoop/model";
import {
  SAID_ANSWERS,
  answeredToday,
  fromRecordRowId,
  fromRecordAnswerKey,
  fromRecordQuestionKey,
  selectFromRecord,
  type FromRecordOpener,
  type SaidQuoteRow,
} from "../../lib/today/fromRecord";

/** What the say-back door line shows today: the question, its receipt, or nothing. */
export type SayBackDoorLine =
  | { kind: "ask"; opener: FromRecordOpener }
  | { kind: "answered"; answer: "yes" | "not_today" }
  | null;

/** The kept quotes as the selector reads them (the Tonight shape + the
 *  language the parent kept it under, when #/language wrote one). */
export function saidQuoteRows(docs: readonly unknown[]): SaidQuoteRow[] {
  const out: SaidQuoteRow[] = [];
  for (const raw of docs) {
    if (!raw || typeof raw !== "object") continue;
    const d = raw as Record<string, unknown>;
    if (d.kind !== "quote" || typeof d.id !== "string" || typeof d.note !== "string" || !d.note.trim()) continue;
    if (!parentWritten(d)) continue;
    out.push({
      id: d.id,
      note: d.note,
      noticedOn: typeof d.noticedOn === "string" ? d.noticedOn : "",
      language: typeof d.language === "string" && d.language.trim() ? d.language : null,
    });
  }
  return out;
}

/**
 * B-GROWTH-36 (framer ruling, P2-WORDS) — the door's say-back line. The data
 * source is `selectFromRecord`'s priority-0 say-back opener (a quote kept
 * the day before, in the language in transition: mode "cross"); every other
 * opener kind and a monolingual "same" say-back stay off Today. The door
 * holds ONE question line at a time and the accepted step comes first
 * (Law 6): while a coach step is still open (`stepOpen`), this line is null.
 * Once answered today, the line keeps a receipt. Pure: same input, same output.
 */
export function sayBackDoorLine(input: {
  now: Date;
  loop: readonly ActionLoopEntry[];
  keepsakeDocs: readonly unknown[];
  languages: readonly string[];
  months: number;
  childId: string;
  stepOpen: boolean;
}): SayBackDoorLine {
  if (input.stepOpen) return null;
  const answered = answeredToday(input.loop, input.childId, input.now);
  if (answered?.sayBack && answered.recordKey?.startsWith("said:")) return { kind: "answered", answer: answered.sayBack };
  if (answered) return null;
  const opener = selectFromRecord({
    now: input.now,
    plans: [],
    loop: input.loop,
    logs: [],
    facts: [],
    said: { quotes: saidQuoteRows(input.keepsakeDocs), languages: input.languages, months: input.months },
  });
  if (!opener || opener.kind !== "said" || opener.sayBackMode !== "cross" || !opener.sayBackIn) return null;
  return { kind: "ask", opener };
}

/**
 * ONE line in Today's "More for today" door, the TodayStepLine shape: "Did
 * you get to say it back in Hebrew?" with Yes · Not today. The answer writes
 * `ActionLoopEntry.sayBack` through `recordFromRecordAnswer` (the
 * from-record row, d0e2b440). The parent's act only: no count of the child,
 * no rating of the child's language, never a card.
 */
export default function TodaySayBackLine({ keepsakeDocs, now }: { keepsakeDocs: readonly unknown[]; now: Date }) {
  const { actionLoop, activeTodayAction, childProfile, recordFromRecordAnswer, recordAnswerWrites, recordAnswersConfirmed } = useArbor();
  const { t } = useLanguage();
  const write = recordAnswerWrites?.[fromRecordRowId(childProfile.id, now)];
  const line: SayBackDoorLine = write?.status === "saved" && write.entry?.sayBack ? { kind: "answered", answer: write.entry.sayBack } : write?.status === "failed" && write.opener.kind === "said" ? { kind: "ask", opener: write.opener } : sayBackDoorLine({
    now,
    loop: actionLoop,
    keepsakeDocs,
    languages: (childProfile.languages ?? []).map((l) => l.trim()).filter(Boolean),
    months: ageMonthsOf(childProfile, now),
    childId: childProfile.id,
    stepOpen: activeTodayAction?.status === "accepted",
  });
  const waiting = write?.status === "saving" || (recordAnswersConfirmed === false && !!line && !write);
  if (activeTodayAction?.status === "accepted") return null;
  if (write && write.opener.kind !== "said") return null;
  if (waiting) return <p role="status" className="now-inline-status" data-testid="today-door-saidback-pending">{t("elev.today.record.confirming")}</p>;
  if (!line) return null;
  if (line.kind === "answered") {
    return (
      <div data-testid="today-door-saidback" data-answered={line.answer} className="flex min-h-11 flex-wrap items-center gap-2 rounded-xl px-3 py-1.5">
        <Icon name="record_voice_over" size={18} style={{ color: "var(--arbor-muted)" }} />
        <span role="status" data-testid="today-door-saidback-receipt" style={{ color: "var(--arbor-muted)", fontSize: "var(--t-sm)" }}>
          {t("today.record.receipt")}
        </span>
      </div>
    );
  }
  const { opener } = line;
  const question = t(fromRecordQuestionKey(opener), { kept: languageName(opener.sayBackIn ?? "", t) });
  return (
    <div data-testid="today-door-saidback" className="flex min-h-11 flex-wrap items-center gap-2 rounded-xl px-3 py-1.5">
      <Icon name="record_voice_over" size={18} style={{ color: "var(--arbor-muted)" }} />
      <span className="line-clamp-2 min-w-0 flex-1 font-semibold leading-snug" style={{ color: "var(--arbor-ink)", fontSize: "var(--t-base)" }}>
        {question}
      </span>
      {write?.status === "failed" && <p role="alert">{t("companion.arbor-context.your-response-wasn-t-saved-please-try-agai")}</p>}
      <span className="flex gap-2" role="group" aria-label={question}>
        {SAID_ANSWERS.map((answer) => (
          <button
            key={answer}
            type="button"
            data-answer={answer}
            onClick={() => { void recordFromRecordAnswer(opener, answer, now).catch(() => { /* The unchanged question remains available to retry. */ }); }}
            className="inline-flex min-h-11 items-center rounded-full px-3 font-semibold"
            style={{ border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)", background: "var(--arbor-paper-elevated)", fontSize: "var(--t-sm)" }}
          >
            {t(fromRecordAnswerKey(opener, answer))}
          </button>
        ))}
      </span>
    </div>
  );
}
