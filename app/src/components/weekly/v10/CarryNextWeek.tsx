import React, { type ReactNode } from "react";
import { LivingForm, MoreLink, RouteHead, Tile } from "../../../design/primitives";
import type { Composition } from "../../../design/useComposition";
import { behaviorTypeLabel } from "../../../content/behaviorTaxonomy";
import { domainName } from "../../../lib/domains/registry";
import { milestoneText } from "../../../lib/milestoneData";
import { DOMAIN_ART } from "../../../lib/parentArt";
import { guideArtFor } from "../../../lib/guideArt";
import type { UiLang } from "../../../lib/i18n";
import type { WeekAreaLine } from "../../../lib/weekReport";
import Icon from "../../ui/Icon";
import { fmtDayTimeV10 } from "../../../lib/formatDate";
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
  areaDetail,
  visit,
  nowMs,
  onHardMoments,
  onMoments,
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
  /** Per area, the newest record the parent kept this week (its day and words). */
  areaDetail: Partial<Record<WeekAreaLine["domain"], { ms: number; text: string; hard: boolean; settled: boolean }>>;
  visit: WeekVisit | null;
  nowMs: number;
  onHardMoments: () => void;
  onMoments: () => void;
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
      link={<MoreLink onClick={onMoments}>{copy.momentsLink}</MoreLink>}
      className="wk10-tile"
    >
      <div data-testid="weekly-glance-areas" className="stack wk10-areas">
        {recorded.map((area) => {
          const art = DOMAIN_ART[area.domain];
          const detail = areaDetail[area.domain];
          const hard = !!detail?.hard;
          return (
            <div key={area.domain} className={`nx-area${hard ? " hard" : ""}`} data-area={area.domain}>
              {!phone && <LivingForm src={art.src} srcSet={art.srcSet} width={26} height={26} />}
              <span className="wk10-area-text">
                <b>{domainName(area.domain, t)}</b>
                <span className="small">
                  {detail ? (
                    <>
                      {new Date(detail.ms).toLocaleDateString(locale, { weekday: "short", day: "numeric" })}
                      {" · "}
                      <bdi>{detail.settled ? copy.settledNote : detail.text}</bdi>
                    </>
                  ) : (
                    areaLine(area)
                  )}
                </span>
              </span>
              <i role="img" aria-label={copy.areaRecords(area.n)} className={`tok ${hard ? "hard" : "moment"} md`} />
            </div>
          );
        })}
      </div>
      <p className="line1 wk10-note">
        <b>{recorded.length === 0 ? copy.noAreas : copy.otherAreas(others)}</b>
      </p>
    </Tile>
  );

  /* The next visit (canvas V77): one card, the whole of it the door to
     Care › Visits ("Prepare"); its days to go, its profession and its time. */
  const art = guideArtFor("new-words", uiLang);
  let visitTitle: string;
  let visitSub: string;
  if (visit) {
    const days = Math.max(0, Math.round((startOfDay(visit.startMs) - startOfDay(nowMs)) / DAY_MS));
    const when = fmtDayTimeV10(visit.startMs, uiLang);
    visitTitle = copy.visitCard(days);
    visitSub = copy.visitCardSub(visit.role, when);
  } else {
    visitTitle = copy.nextVisit;
    visitSub = copy.noVisitSub;
  }
  const nextVisit = (
    <button type="button" className="nx-co wk10-linkcard" data-testid="weekly-next-visit" onClick={onPrepare}>
      {art && <LivingForm src={art.src} srcSet={art.srcSet} width={52} height={37} crop={{ w: 125.4, h: 70.6, x: -68.2, y: -17.8 }} />}
      <span className="ct">
        <b>{visitTitle}</b>
        <bdi>{visitSub}</bdi>
      </span>
      <Icon name="chevron_right" size={18} className="rtl:-scale-x-100" />
    </button>
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
      <RouteHead id="wk-next-title" title={copy.carryTitle} sub={phone ? undefined : copy.carrySub} />
      {phone ? (
        <div className="stack wk10-next-stack">
          {carry}
          {byArea}
          {nextVisit}
        </div>
      ) : (
        <div className="g12">
          <div className="x6">{byArea}</div>
          <div className="x6 stack wk10-next-stack">
            {carry}
            {nextVisit}
          </div>
        </div>
      )}
    </div>
  );
}
