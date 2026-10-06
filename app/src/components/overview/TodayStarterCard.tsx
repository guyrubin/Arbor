import React from "react";
import { useLanguage } from "../../context/LanguageContext";
import { genderedKey, type ChildGender } from "../../lib/today/fromRecord";
import { formatAgeMonths } from "../../lib/age/format";
import type { TodayStarter } from "../../lib/today/starters";

/**
 * B-TODAY-35 — Today's band starter for a toddler (lib/today/starters): ONE
 * card in the record's slot when the record has nothing to say back. A title
 * (the card's largest line, display serif), one honest sentence, one action.
 * Parent register; tokens only; no upper-case label, no gradient, nothing
 * under 12 px; no count, no verdict, never "behind".
 */
export default function TodayStarterCard({
  starter,
  childName,
  gender,
  onAct,
}: {
  starter: TodayStarter;
  childName: string;
  gender?: ChildGender;
  onAct: (starter: TodayStarter) => void;
}) {
  const { t } = useLanguage();
  const titleKey = starter.kind === "words" ? genderedKey(`${starter.key}.title`, gender) : `${starter.key}.title`;
  const age = typeof starter.visitMonths === "number" ? formatAgeMonths(starter.visitMonths, t) : "";
  const title = t(titleKey, { name: childName, age });
  return (
    <section
      data-testid="today-starter"
      data-starter-kind={starter.kind}
      aria-label={t("elev.ages.starter.aria")}
      className="rounded-[20px] p-4 sm:p-5"
      style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}
    >
      <h2
        data-testid="today-starter-title"
        className="font-semibold leading-tight"
        style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)", fontSize: "var(--t-xl)" }}
      >
        {title}
      </h2>
      <p className="mt-2 text-[14px] leading-snug" style={{ color: "var(--arbor-ink)" }}>
        {t(`${starter.key}.body`, { name: childName })}
      </p>
      <div className="mt-3">
        <button
          type="button"
          data-testid="today-starter-action"
          onClick={() => onAct(starter)}
          className="inline-flex min-h-[44px] items-center rounded-full px-4 text-[14px] font-semibold transition active:scale-[0.98]"
          style={{ color: "var(--arbor-ink)", background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }}
        >
          {t(`${starter.key}.action`)}
        </button>
      </div>
    </section>
  );
}
