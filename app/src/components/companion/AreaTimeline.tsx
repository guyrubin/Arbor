import React, { useMemo } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { Token } from "../../design/primitives";
import type { Composition } from "../../design/useComposition";
import type { DomainId } from "../../lib/domains/registry";
import { milestoneText } from "../../lib/milestoneData";
import { groupMilestonesByShelf } from "../../lib/milestones/shelfMap";
import { shelvesOfDomain } from "../../lib/shelves/registry";
import type { Milestone } from "../../types";
import { NOTICE_ANSWER_KEYS } from "../loop/NoticeCard";
import { milestonesV10Copy } from "./milestonesV10Copy";

/**
 * v10.1 — the open area's dated line on My child › Milestones: each skill the
 * parent marked Seen it in this area, on the day they marked it, and today at
 * the end. Desk: one horizontal line, the gaps between leaves growing with the
 * days between them (flex weights, never a share of anything), titles above
 * and below in turn. Phone: the same leaves as a dated list.
 *
 * Only dated Seen-it answers appear (observationUpdatedAt); an undated tick or
 * a Not yet / Not sure answer is never drawn. With nothing dated the line is
 * absent: a missing date is unknown, never a gap to fill. Counts nothing.
 */
export interface AreaTimelineProps {
  domain: DomainId;
  milestones: readonly Milestone[];
  composition: Composition;
  gender?: string | null;
  /** The clock "today" reads (tests pin it). */
  nowMs?: number;
}

/** At most this many leaves (the newest); every one is still in the area below. */
const MAX_LEAVES = 5;
const DAY_MS = 86_400_000;

export interface TimelineLeaf {
  id: string;
  title: string;
  at: string;
}

/** The area's dated Seen-it skills, oldest first, the newest MAX_LEAVES. Pure. */
export function areaLeaves(milestones: readonly Milestone[], domain: DomainId, nowMs: number): Milestone[] {
  const byShelf = groupMilestonesByShelf([...milestones]);
  const seen = shelvesOfDomain(domain)
    .flatMap((shelf) => byShelf[shelf])
    .filter((m) => (m.checked === true || m.observationStatus === "yes") && typeof m.observationUpdatedAt === "string")
    .filter((m) => {
      const ms = Date.parse(m.observationUpdatedAt!);
      return Number.isFinite(ms) && ms <= nowMs;
    })
    .sort((a, b) => Date.parse(a.observationUpdatedAt!) - Date.parse(b.observationUpdatedAt!));
  return seen.slice(-MAX_LEAVES);
}

export default function AreaTimeline({ domain, milestones, composition, gender = null, nowMs }: AreaTimelineProps) {
  const { t, uiLang } = useLanguage();
  const copy = milestonesV10Copy(uiLang);
  const seenIt = t(NOTICE_ANSWER_KEYS.yes);
  const now = nowMs ?? Date.now();
  const leaves: TimelineLeaf[] = useMemo(
    () => areaLeaves(milestones, domain, now).map((m) => ({ id: m.id, title: milestoneText(m, "title", t, { gender }), at: m.observationUpdatedAt! })),
    [milestones, domain, now, t, gender],
  );
  if (leaves.length === 0) return null;
  const day = (at: string | number) => new Intl.DateTimeFormat(uiLang === "he" ? "he-IL" : "en-GB", { weekday: "short", day: "numeric", month: "short" }).format(new Date(at));
  const leafLabel = (leaf: TimelineLeaf) => `${seenIt}: ${leaf.title}, ${day(leaf.at)}`;

  if (composition !== "desk") {
    return (
      <ol className="ms-tl-list" data-testid="area-timeline">
        {leaves.map((leaf) => (
          <li key={leaf.id} data-testid="area-timeline-leaf">
            <Token kind="moment" size="md" label={seenIt} />
            <span>
              <b dir="auto">{leaf.title}</b>
              <time dateTime={leaf.at}>{day(leaf.at)}</time>
            </span>
          </li>
        ))}
      </ol>
    );
  }

  // The weight of each gap is the days it spans (at least one, so no leaf sits on another).
  const gaps = leaves.map((leaf, i) => (i === 0 ? 1 : Math.max(1, Math.round((Date.parse(leaf.at) - Date.parse(leaves[i - 1].at)) / DAY_MS))));
  const tail = Math.max(1, Math.round((now - Date.parse(leaves[leaves.length - 1].at)) / DAY_MS));
  return (
    <div className="ms-tl" data-testid="area-timeline" role="list" aria-label={copy.timelineLabel}>
      {leaves.map((leaf, i) => (
        <React.Fragment key={leaf.id}>
          <span className={`ms-tl-gap${i === 0 ? " lead" : ""}`} style={{ flexGrow: gaps[i] }} aria-hidden="true" />
          <span className={`ms-tl-leaf${i % 2 ? " down" : ""}`} role="listitem" aria-label={leafLabel(leaf)} data-testid="area-timeline-leaf">
            <span aria-hidden="true"><Token kind="moment" size="md" label={seenIt} isNew={i === leaves.length - 1} /></span>
            <span className="ms-tl-lb" aria-hidden="true">
              <small><time dateTime={leaf.at}>{day(leaf.at)}</time></small>
              <span dir="auto">{leaf.title}</span>
            </span>
          </span>
        </React.Fragment>
      ))}
      <span className="ms-tl-gap" style={{ flexGrow: tail }} aria-hidden="true" />
      <span className="ms-tl-today">
        {copy.today}
        <small><time dateTime={new Date(now).toISOString()}>{day(now)}</time></small>
      </span>
    </div>
  );
}
