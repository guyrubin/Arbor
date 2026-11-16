import React, { useMemo, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { domainName } from "../../lib/domains/registry";
import { DOMAIN_ICONS } from "../../lib/domains/icons";
import { milestoneText } from "../../lib/milestoneData";
import type { ObserveStatus } from "../../lib/milestones/observe";
import { nextNoticeIds, shelfOfMilestone } from "../../lib/milestones/selectByShelf";
import { shelfDef } from "../../lib/shelves/registry";
import type { Milestone } from "../../types";
import { Icon } from "../ui/Icon";
import { SegmentedAnswers } from "../ui/SegmentedAnswers";
import { PencilChip } from "../../design/primitives";
import { milestonesV10Copy } from "./milestonesV10Copy";

/**
 * v10.1 — "What to notice next" on the milestone map: up to three skills of
 * the child's current band, one per area, from the shared selector
 * (lib/milestones/selectByShelf, never ahead of band, never a shelf answered
 * today). Each card is a neutral surface named by its area's glyph and name, and carries the ONE answer control
 * (SegmentedAnswers, resting neutral). A card the parent answers stays in
 * place for the visit with its answer pressed, so nothing jumps under a tap.
 * The answer writes through the page's one seam (the same as an opened area).
 * The first card carries "Arbor suggests": the selector chose it; nothing is
 * written by Arbor and no reason is invented.
 */
export interface NoticeNextProps {
  childId: string;
  milestones: readonly Milestone[];
  /** The child's comparison age in months (preterm-corrected). */
  comparisonMonths: number;
  gender?: string | null;
  onAnswer: (milestoneId: string, status: ObserveStatus) => Promise<unknown> | undefined;
  /** How many cards at most (the selector may return fewer). */
  limit?: number;
}

export default function NoticeNext({ childId, milestones, comparisonMonths, gender = null, onAnswer, limit = 3 }: NoticeNextProps) {
  const { t, uiLang } = useLanguage();
  const copy = milestonesV10Copy(uiLang);
  // The picks are chosen once per child per visit; answers update in place.
  const [held, setHeld] = useState<{ childId: string; ids: string[] } | null>(null);
  const fresh = useMemo(
    () => nextNoticeIds(milestones, comparisonMonths, limit),
    [milestones, comparisonMonths, limit],
  );
  const ids = held && held.childId === childId ? held.ids : fresh;
  const picks = ids
    .map((id) => milestones.find((m) => m.id === id))
    .flatMap((m) => {
      const shelf = m ? shelfOfMilestone(m) : null;
      return m && shelf ? [{ m, domain: shelfDef(shelf).domain }] : [];
    });
  const [pending, setPending] = useState<string | null>(null);

  if (picks.length === 0) {
    return <p className="ms-next-empty" data-testid="ms-next-empty">{t("companion.devMap.empty")}</p>;
  }
  const answer = (m: Milestone, status: ObserveStatus) => {
    if (pending) return;
    if (!held || held.childId !== childId) setHeld({ childId, ids });
    const write = onAnswer(m.id, status);
    if (!write) return;
    setPending(m.id);
    write.then(() => setPending(null), () => setPending(null));
  };
  return (
    <ul className="ms-next" role="list" data-testid="ms-next">
      {picks.map(({ m, domain }, index) => {
        const title = milestoneText(m, "title", t, { gender });
        return (
          <li key={m.id} className="nx" data-testid="ms-next-card" data-milestone={m.id}>
            <div className="nh">
              <span className="tg" aria-hidden="true"><Icon name={DOMAIN_ICONS[domain]} size={15} /></span>
              <span className="nk">{domainName(domain, t)}</span>
              {/* The first pick is Arbor choosing an existing skill for the parent to watch. */}
              {index === 0 && <span data-testid="ms-next-suggests"><PencilChip>{copy.arborSuggests}</PencilChip></span>}
            </div>
            <p className="nm" dir="auto">{title}</p>
            <SegmentedAnswers
              className="ms-next-answers"
              ariaLabel={title}
              selected={m.observationStatus ?? (m.checked ? "yes" : null)}
              disabled={pending !== null}
              onAnswer={(status) => answer(m, status)}
            />
          </li>
        );
      })}
    </ul>
  );
}
