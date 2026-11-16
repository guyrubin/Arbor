import React, { type ReactNode } from "react";
import { LivingForm, MoreLink, Pile, RouteHead, Tile, Fig } from "../../../design/primitives";
import type { Composition } from "../../../design/useComposition";
import { behaviorTypeLabel } from "../../../content/behaviorTaxonomy";
import { domainName } from "../../../lib/domains/registry";
import { milestoneText } from "../../../lib/milestoneData";
import { DOMAIN_ART } from "../../../lib/parentArt";
import { guideArtFor } from "../../../lib/guideArt";
import type { UiLang } from "../../../lib/i18n";
import type { WeekAreaLine } from "../../../lib/weekReport";
import type { WeeklyCopy } from "./weeklyCopy";

type T = (key: string, vars?: Record<string, string | number>) => string;

/** The next visit inside its Prepare window, as WeeklyTab reads it (lib/careTrack nextPrepareVisit). */
export type WeekVisit = { startMs: number; role: string };

const DAY_MS = 86_400_000;
const startOfDay = (ms: number) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/**
 * Stop 3 — Carry into next week: the carry tile (Arbor's suggestion and the
 * route's one primary move, rendered by WeeklyTab), the areas that hold a
 * record this week, and the next visit. An area appears only when something
 * was recorded in it; the rest are named as "no record", never as a gap.
 */
export default function CarryNextWeek({
  composition,
  copy,
  t,
  uiLang,
  locale,
  forNextWeek,
  areas,
  visit,
  nowMs,
  onHardMoments,
  onMilestoneMap,
  onPrepare,
}: {
  composition: Composition;
  copy: WeeklyCopy;
  t: T;
  uiLang: UiLang;
  locale: string;
  /** The carry band's body: the suggestion and its moves (WeeklyTab owns them). */
  forNextWeek: ReactNode;
  areas: readonly WeekAreaLine[];
  visit: WeekVisit | null;
  nowMs: number;
  onHardMoments: () => void;
  onMilestoneMap: () => void;
  onPrepare: () => void;
}) {
  const phone = composition === "phone";
  const recorded = areas.filter((a) => a.n > 0);
  const others = areas.length - recorded.length;

  const areaLine = (area: WeekAreaLine): ReactNode => {
    const parts: ReactNode[] = [];
    if (area.milestones.length === 1) parts.push(<bdi key="m">{milestoneText(area.milestones[0], "title", t)}</bdi>);
    else if (area.milestones.length > 1) parts.push(t("elev.wk.areas.milestones", { n: area.milestones.length }));
    if (area.latest?.kind === "word") parts.push(<bdi key="w">{t("elev.wk.words.quote", { phrase: area.latest.phrase })}</bdi>);
    else if (area.latest?.kind === "moment") parts.push(<bdi key="b">{behaviorTypeLabel(area.latest.behaviorType, t)}</bdi>);
    return parts.map((p, i) => (
      <React.Fragment key={i}>
        {i > 0 && " · "}
        {p}
      </React.Fragment>
    ));
  };

  const byArea = (
    <Tile
      icon="eco"
      kind="plan"
      title={copy.byArea}
      titleId="wk-areas-title"
      link={<MoreLink onClick={onMilestoneMap}>{copy.milestoneMap}</MoreLink>}
      className="wk10-tile"
    >
      <div data-testid="weekly-glance-areas" className="stack wk10-areas">
        {recorded.map((area) => {
          const art = DOMAIN_ART[area.domain];
          return (
            <div key={area.domain} className="nx-area" data-area={area.domain}>
              {!phone && <LivingForm src={art.src} srcSet={art.srcSet} width={26} height={26} />}
              <span className="wk10-area-text">
                <b>{domainName(area.domain, t)}</b>
                <span className="small">{areaLine(area)}</span>
              </span>
              <span role="img" aria-label={copy.areaRecords(area.n)}>
                <Pile layout="line">
                  {Array.from({ length: Math.min(area.n, 3) }, (_, i) => (
                    <i key={i} aria-hidden="true" className="tok moment sm" />
                  ))}
                </Pile>
              </span>
            </div>
          );
        })}
      </div>
      <p className="line1 wk10-note">
        <b>{recorded.length === 0 ? copy.noAreas : copy.otherAreas(others)}</b>
      </p>
    </Tile>
  );

  let visitBody: ReactNode;
  if (visit) {
    const days = Math.max(0, Math.round((startOfDay(visit.startMs) - startOfDay(nowMs)) / DAY_MS));
    const when = new Date(visit.startMs).toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
    const art = guideArtFor("new-words", uiLang);
    visitBody = (
      <>
        <div className="line wk10-visit">
          {art && !phone && <LivingForm src={art.src} srcSet={art.srcSet} width={84} height={60} crop={{ w: 202.6, h: 114, x: -110.2, y: -28.7 }} />}
          {days > 0 ? (
            <Fig n={days} unit={copy.daysToVisit(days)} sub={<bdi>{`${visit.role} · ${when}`}</bdi>} />
          ) : (
            <Fig n={copy.keyToday} unit={copy.visitToday} sub={<bdi>{`${visit.role} · ${when}`}</bdi>} size="md" />
          )}
        </div>
        {days > 0 && days <= 14 && (
          <div className="wk10-runway" aria-hidden="true">
            <span className="runway">
              <i aria-hidden="true" className="tok here sm" />
              {Array.from({ length: days - 1 }, (_, i) => (
                <span key={i} className="rd" />
              ))}
              <i aria-hidden="true" className="tok date sm">{new Date(visit.startMs).toLocaleDateString(locale, { day: "numeric" })}</i>
            </span>
            <span className="small wk10-runway-ends">
              <span>{copy.todayOn(new Date(nowMs).toLocaleDateString(locale, { weekday: "short", day: "numeric" }))}</span>
              <span>{new Date(visit.startMs).toLocaleDateString(locale, { weekday: "short", day: "numeric" })}</span>
            </span>
          </div>
        )}
      </>
    );
  } else {
    visitBody = <p className="line1 wk10-note">{copy.noVisit}</p>;
  }

  const nextVisit = (
    <Tile
      icon="group"
      kind="date"
      title={copy.nextVisit}
      titleId="wk-visit-title"
      link={<MoreLink onClick={onPrepare}>{copy.prepare}</MoreLink>}
      className="wk10-tile"
    >
      <div data-testid="weekly-next-visit" className="stack">{visitBody}</div>
    </Tile>
  );

  const carry = (
    <Tile
      icon="flag"
      title={copy.forNextWeek}
      titleId="wk-carry-title"
      link={<MoreLink onClick={onHardMoments}>{t("nav.view.behaviors")}</MoreLink>}
      className="wk10-tile"
    >
      {forNextWeek}
    </Tile>
  );

  return (
    <div className="wk10-next">
      <RouteHead id="wk-next-title" title={copy.carryTitle} sub={phone ? undefined : copy.stopNextSub} />
      {phone ? (
        <div className="stack wk10-next-stack">
          {carry}
          {byArea}
          {nextVisit}
        </div>
      ) : (
        <div className="g12">
          <div className="x4">{carry}</div>
          <div className="x4">{byArea}</div>
          <div className="x4">{nextVisit}</div>
        </div>
      )}
    </div>
  );
}
