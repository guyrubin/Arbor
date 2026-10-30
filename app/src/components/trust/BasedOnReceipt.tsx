import React from "react";
import { useLanguage } from "../../context/LanguageContext";
import type { BasedOnFact } from "../../lib/basedOn";
import type { DisclosedProfileField } from "../../lib/coachDisclosure";
import "./basedOn.css";

/** Weekly counts already on the send path. Absent when that path left them off. */
export interface BasedOnWeekly {
  moments: number;
  /** Present only when the send path included the words-logged count. */
  words?: number;
}

export interface BasedOnModel {
  facts: readonly BasedOnFact[];
  fields: readonly DisclosedProfileField[];
  weekly?: BasedOnWeekly | null;
}

/**
 * A short receipt under a Talk answer or the Now recommendation.
 * Parent words and field names only. A fact opens it in the notebook,
 * where Correct and Forget already live.
 */
export default function BasedOnReceipt({ model, onOpenFact }: {
  model: BasedOnModel | null;
  onOpenFact: (memoryId: string) => void;
}) {
  const { t } = useLanguage();
  if (!model) return null;
  const fields = model.fields.map((field) => t(`elev.memdisc.field.${field}`)).filter((label) => label && !label.startsWith("elev.memdisc.field."));
  const weekly = model.weekly;
  if (model.facts.length === 0 && fields.length === 0 && !weekly) return null;
  const weekLine = weekly
    ? typeof weekly.words === "number"
      ? t("companion.basedOn.weekWords", { n: weekly.moments, words: weekly.words })
      : t("companion.basedOn.week", { n: weekly.moments })
    : null;
  return (
    <div className="based-on" data-testid="based-on">
      <p className="based-on-label">{t("companion.basedOn.label")}</p>
      {model.facts.length > 0 && (
        <ul className="based-on-facts">
          {model.facts.map((fact) => (
            <li key={fact.memoryId}>
              <button type="button" className="based-on-fact" data-testid="based-on-fact" dir="auto" onClick={() => onOpenFact(fact.memoryId)}>
                {fact.fact}
              </button>
            </li>
          ))}
        </ul>
      )}
      {fields.length > 0 && <p className="based-on-meta" data-testid="based-on-fields">{t("companion.basedOn.fields", { fields: fields.join(", ") })}</p>}
      {weekLine && <p className="based-on-meta" data-testid="based-on-week">{weekLine}</p>}
    </div>
  );
}
