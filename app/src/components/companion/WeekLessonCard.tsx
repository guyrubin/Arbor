/**
 * B-PROG-14 — "This week's idea" as one object: example, words, reason,
 * fallback. The longer Learn read, when this week has one, is the only move.
 */
import React, { useId } from "react";
import type { WeekLessonFace } from "../../lib/programs/weekLessonBrief";
import { resolveHebrewSlash, type ChildGenderish } from "../../lib/hebrewSlashGender";
import type { LocalizedText } from "../../content/governance";
import { BrandChip } from "../ui/BrandChip";
import Icon from "../ui/Icon";
import { NOW_COPY } from "./nowViewCopy";

function line(text: LocalizedText, lang: "en" | "he", gender: ChildGenderish): string {
  return lang === "he" ? resolveHebrewSlash(text.he, gender) : text.en;
}

export default function WeekLessonCard({
  face, lang, gender, readTitle, onOpen,
}: {
  face: WeekLessonFace;
  lang: "en" | "he";
  gender: ChildGenderish;
  /** The Learn read's title, when this week names one the parent has not opened. */
  readTitle?: string;
  onOpen?: () => void;
}) {
  const copy = NOW_COPY[lang];
  const headingId = useId();
  const rows = [
    [copy.weekExample, face.example],
    [copy.say, face.words],
    [copy.weekWhy, face.reason],
    [copy.weekFallback, face.fallback],
  ] as const;
  return (
    <section className="now-week-brief" data-testid="now-week-lesson" aria-labelledby={headingId}>
      <div className="now-week-brief-head">
        <BrandChip icon="lightbulb" tone="green" shape="leaf" />
        <h3 id={headingId}>{copy.weekIdea}</h3>
      </div>
      <dl>
        {rows.map(([label, text]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd dir="auto">{line(text, lang, gender)}</dd>
          </div>
        ))}
      </dl>
      {onOpen && (
        <button type="button" className="now-weekly-door now-week-brief-open" data-testid="now-week-lesson-open" onClick={onOpen}>
          <span><b>{copy.weekOpenRead}</b>{readTitle ? <small dir="auto">{readTitle}</small> : null}</span>
          <Icon name="arrow_forward" size={19} className="rtl:-scale-x-100" />
        </button>
      )}
    </section>
  );
}
