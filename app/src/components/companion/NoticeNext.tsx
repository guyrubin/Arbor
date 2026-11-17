import React, { useMemo, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { domainName, type DomainId } from "../../lib/domains/registry";
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
import { EarlierLater } from "./AreaRowDetail";

/**
 * v10.1 — the skills Arbor picks for the parent to notice next, from the
 * shared selector (lib/milestones/selectByShelf: the child's current band,
 * one per shelf, never ahead of band, never a shelf answered today).
 *
 * The first pick is "Arbor suggests" (Arbor chose an existing skill; nothing
 * is written by Arbor and no reason is invented) and sits in the rail beside
 * the open area; the rest are What to notice next. Each card is a neutral
 * surface named by its area's glyph and name, and carries the ONE answer
 * control (SegmentedAnswers, resting neutral). The picks are chosen once per
 * child per visit, so a card the parent answers stays in place with its
 * answer pressed. The answer writes through the page's one seam.
 */
export interface NoticePick {
  milestone: Milestone;
  domain: DomainId;
}

/** The picks for this child, held for the visit once the parent answers one. */
export function useNoticePicks(childId: string, milestones: readonly Milestone[], comparisonMonths: number, limit = 4) {
  const [held, setHeld] = useState<{ childId: string; ids: string[] } | null>(null);
  const fresh = useMemo(() => nextNoticeIds(milestones, comparisonMonths, limit), [milestones, comparisonMonths, limit]);
  const ids = held && held.childId === childId ? held.ids : fresh;
  const picks: NoticePick[] = ids.flatMap((id) => {
    const m = milestones.find((item) => item.id === id);
    const shelf = m ? shelfOfMilestone(m) : null;
    return m && shelf ? [{ milestone: m, domain: shelfDef(shelf).domain }] : [];
  });
  const hold = () => { if (!held || held.childId !== childId) setHeld({ childId, ids }); };
  return { picks, hold };
}

/**
 * Arbor suggests: the pick in the open area, else the first pick, and never a
 * skill the open area already lists to mark (it would show twice). What to
 * notice next: the picks in the other areas only (never the open one, which
 * the page already shows). Pure.
 */
export function splitPicks(picks: readonly NoticePick[], openDomain: DomainId | null, listed: ReadonlySet<string> = new Set()): { first: NoticePick | undefined; rest: NoticePick[] } {
  const own = picks.find((p) => p.domain === openDomain);
  const first = own ? (listed.has(own.milestone.id) ? undefined : own) : picks[0];
  return { first, rest: picks.filter((p) => p !== first && p.domain !== openDomain) };
}

export interface NoticePickCardProps {
  pick: NoticePick;
  gender?: string | null;
  suggested?: boolean;
  onAnswer: (milestoneId: string, status: ObserveStatus) => Promise<unknown> | undefined;
  /** Called before the first answer, so the picks stay in place. */
  onHold: () => void;
  /** The child's milestones, for the card's Earlier and later (reading only). */
  milestones?: readonly Milestone[];
}

export function NoticePickCard({ pick, gender = null, suggested = false, onAnswer, onHold, milestones }: NoticePickCardProps) {
  const { t, uiLang } = useLanguage();
  const copy = milestonesV10Copy(uiLang);
  const [pending, setPending] = useState(false);
  const { milestone: m, domain } = pick;
  const title = milestoneText(m, "title", t, { gender });
  const answer = (status: ObserveStatus) => {
    if (pending) return;
    onHold();
    const write = onAnswer(m.id, status);
    if (!write) return;
    setPending(true);
    write.then(() => setPending(false), () => setPending(false));
  };
  return (
    <div className={`mcc${suggested ? " ai" : ""}`} data-testid={suggested ? "ms-suggest" : "ms-next-card"} data-milestone={m.id}>
      <div className="ch">
        {suggested ? (
          <span data-testid="ms-next-suggests"><PencilChip>{copy.arborSuggests}</PencilChip></span>
        ) : (
          <span className="tg" aria-hidden="true"><Icon name={DOMAIN_ICONS[domain]} size={15} /></span>
        )}
        <span className={suggested ? "mr" : undefined}>{domainName(domain, t)}</span>
      </div>
      <p className="nm" dir="auto">{title}</p>
      <SegmentedAnswers
        className="ms-next-answers"
        ariaLabel={title}
        selected={m.observationStatus ?? (m.checked ? "yes" : null)}
        disabled={pending}
        onAnswer={answer}
      />
      {milestones && <EarlierLater milestone={m} milestones={milestones} gender={gender} />}
    </div>
  );
}

export interface NoticeNextProps {
  picks: readonly NoticePick[];
  gender?: string | null;
  onAnswer: (milestoneId: string, status: ObserveStatus) => Promise<unknown> | undefined;
  onHold: () => void;
  milestones?: readonly Milestone[];
}

/** What to notice next: the picks after Arbor's suggestion. */
export default function NoticeNext({ picks, gender = null, onAnswer, onHold, milestones }: NoticeNextProps) {
  const { t } = useLanguage();
  if (picks.length === 0) {
    return <p className="ms-next-empty" data-testid="ms-next-empty">{t("companion.devMap.empty")}</p>;
  }
  return (
    <ul className="ms-next" role="list" data-testid="ms-next">
      {picks.map((pick) => (
        <li key={pick.milestone.id}>
          <NoticePickCard pick={pick} gender={gender} onAnswer={onAnswer} onHold={onHold} milestones={milestones} />
        </li>
      ))}
    </ul>
  );
}
