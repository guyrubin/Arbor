import React from "react";
import { useLanguage } from "../../context/LanguageContext";
import type { BasedOnModel } from "../trust/BasedOnReceipt";
import { Icon } from "../ui/Icon";
import { talkCopy } from "../companion/talkViewCopy";

/**
 * V77 (N-Talk-D/M) — "What Arbor used", READ-ONLY. It shows only what the
 * answer already carries:
 *  - the child line: the profile fields the send path disclosed (basedOn.fields);
 *  - the guides: the knowledge cards the server says grounded this answer
 *    (contract.sourceCards / sourceCardsUsed);
 *  - the remembered notes: the parent-approved facts sent with the question
 *    (basedOn.facts; each opens in the notebook, where Correct and Forget live);
 *  - this week: the counts on the send path (basedOn.weekly).
 * Nothing is removable here (removing a source needs server support), and
 * nothing is inferred: the answer payload names no plan and no individual
 * records, so neither is listed. Parent words and field names only.
 */
export default function WhatArborUsed({ basedOn, guides, childName, onOpenFact }: {
  basedOn: BasedOnModel | null | undefined;
  guides: readonly { id: string; title: string | null }[];
  childName?: string;
  onOpenFact?: (memoryId: string) => void;
}) {
  const { t, uiLang } = useLanguage();
  const copy = talkCopy(uiLang);
  const fields = (basedOn?.fields ?? [])
    .map((field) => t(`elev.memdisc.field.${field}`))
    .filter((label) => label && !label.startsWith("elev.memdisc.field."));
  const facts = basedOn?.facts ?? [];
  const weekly = basedOn?.weekly;
  const titled = guides.filter((g) => g.title);
  if (fields.length === 0 && facts.length === 0 && !weekly && guides.length === 0) return null;
  const weekLine = weekly
    ? typeof weekly.words === "number"
      ? t("companion.basedOn.weekWords", { n: weekly.moments, words: weekly.words })
      : t("companion.basedOn.week", { n: weekly.moments })
    : null;
  return (
    <section className="coach-used" data-testid="based-on" aria-labelledby="coach-used-title">
      <h3 id="coach-used-title" className="coach-used-title">{copy.usedTitle}</h3>
      <ul className="coach-used-grid">
        {fields.length > 0 && (
          <li className="coach-used-tile" data-used="child">
            <span className="coach-used-glyph k-date" aria-hidden="true"><Icon name="child_care" size={18} /></span>
            <span className="coach-used-text">
              {childName && <b dir="auto">{childName}</b>}
              <small data-testid="based-on-fields">{t("companion.basedOn.fields", { fields: fields.join(", ") })}</small>
            </span>
          </li>
        )}
        {guides.length > 0 && (
          <li className="coach-used-tile" data-used="guides">
            <span className="coach-used-glyph" aria-hidden="true"><Icon name="menu_book" size={18} /></span>
            <span className="coach-used-text">
              <b>{copy.usedGuides(guides.length)}</b>
              {titled.length > 0 && <small dir="auto">{titled.map((g) => g.title).join(" · ")}</small>}
            </span>
          </li>
        )}
        {facts.length > 0 && (
          <li className="coach-used-tile coach-used-notes" data-used="notes">
            <span className="coach-used-glyph" aria-hidden="true"><Icon name="psychology" size={18} /></span>
            <span className="coach-used-text">
              <b>{copy.usedNotes(facts.length)}</b>
              <small>{copy.usedNotesSub}</small>
              <span className="coach-used-facts">
                {facts.map((fact) => onOpenFact
                  ? <button key={fact.memoryId} type="button" className="coach-used-fact touch-target" data-testid="based-on-fact" dir="auto" onClick={() => onOpenFact(fact.memoryId)}>“{fact.fact}”</button>
                  : <span key={fact.memoryId} className="coach-used-fact" data-testid="based-on-fact" dir="auto">“{fact.fact}”</span>)}
              </span>
            </span>
          </li>
        )}
        {weekLine && (
          <li className="coach-used-tile" data-used="week">
            <span className="coach-used-glyph k-date" aria-hidden="true"><Icon name="calendar_month" size={18} /></span>
            <span className="coach-used-text">
              <b data-testid="based-on-week">{weekLine}</b>
            </span>
          </li>
        )}
      </ul>
    </section>
  );
}
