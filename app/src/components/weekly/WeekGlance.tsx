import React, { useId, type CSSProperties, type ReactNode } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { behaviorTypeLabel } from "../../content/behaviorTaxonomy";
import { DOMAIN_ICONS } from "../../lib/domains/icons";
import { domainName } from "../../lib/domains/registry";
import { milestoneText } from "../../lib/milestoneData";
import type { DayOutcome, WeekCountKey, WeekGlance as WeekGlanceData } from "../../lib/weekGlance";
import { topHelpedStep, type WeekAreaLine, type WeekPlace, type WeekReportLines, type WeekStepLine } from "../../lib/weekReport";
import { kidWorldByWorldId } from "../kidmode/kidWorlds";
import Icon from "../ui/Icon";
import "./weekGlance.css";

type TileKey = Exclude<WeekCountKey, "words">;

/**
 * The four tiles, always in this order and always four (a zero reads "—").
 * Each glyph names a CATEGORY, never a value.
 */
const TILES: readonly { key: TileKey; icon: string; label: string }[] = [
  { key: "moments", icon: "edit_note", label: "elev.wk.glance.moments" },
  { key: "helped", icon: "flag", label: "elev.wk.tile.steps" },
  { key: "milestones", icon: "check_circle", label: "elev.wk.tile.milestones" },
  { key: "kid", icon: "sports_esports", label: "elev.wk.tile.kid" },
];
/** A tile's fallback sub-line: on how many days it happened (never "n of 7"). */
const TILE_DAYS: Record<TileKey, string> = {
  moments: "elev.wk.glance.kept.days",
  helped: "elev.wk.glance.tried",
  milestones: "elev.wk.glance.marked.days",
  kid: "elev.wk.glance.played.days",
};
const PLACE_KEY: Record<WeekPlace, string> = {
  home: "elev.wk.place.home",
  school: "elev.wk.place.school",
  transit: "elev.wk.place.transit",
  public: "elev.wk.place.public",
};
/** One neutral glyph per recorded outcome; never a colour that grades it. */
const OUTCOME_GLYPH: Record<Exclude<DayOutcome, null>, { icon: string; label: string }> = {
  helped: { icon: "thumb_up", label: "elev.wk.glance.legend.helped" },
  "not-this-time": { icon: "replay", label: "elev.wk.glance.legend.again" },
};
/** Longest step text in the Steps tile before it is clipped (the card shows it whole). */
const TILE_STEP_MAX = 34;

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

/** Parts joined by " · ", each part a string or an isolated run of the parent's own words. */
function joined(parts: ReactNode[]): ReactNode {
  return parts.map((part, index) => (
    <React.Fragment key={index}>
      {index > 0 && " · "}
      {part}
    </React.Fragment>
  ));
}

/**
 * v3 F-NOW-3 — the Weekly report, as the v3 mock draws it: four count tiles,
 * then the day-by-day strip beside What helped (and, from md, the child's own
 * words), then every area in one card. The report week is the one the report
 * is filed under (recapWeekStartMs): the current week so far, or a past week
 * whole; WeeklyTab passes both the counts (lib/weekGlance) and the lines
 * (lib/weekReport) for that week.
 *
 * Clinical firewall: counts only. No share, no denominator ("5/7"), no gain
 * ("+3"), no trend, no colour that judges; a zero reads "—". The route's ONE
 * data-primary-move lives in WeeklyTab's carry band, never here; the only
 * controls are the Milestones tile's door to the milestones page and the share
 * action WeeklyTab hands to What helped.
 *
 * The strip is the REPORT week, and that week opens on a Saturday (recapWeekId's
 * stored-id algorithm; at the year cut, on Jan 1). So each column is named by
 * its DATE, not a weekday: weekday names would put Saturday (Shabbat, in
 * Hebrew) first. Today's date is set in body ink; days still ahead keep a
 * dashed baseline.
 */
export default function WeekGlance({ glance, lines, childFirst, helpedAction, onOpenMilestones }: {
  glance: WeekGlanceData;
  lines: WeekReportLines;
  childFirst: string;
  /** What helped's one action (the held sentences' text-only send), owned by WeeklyTab. */
  helpedAction?: ReactNode;
  /** The Milestones tile's door (My child → Milestones). */
  onOpenMilestones?: () => void;
}) {
  const { t, uiLang } = useLanguage();
  const locale = uiLang === "he" ? "he-IL" : "en-US";
  const id = useId();
  const date = (ms: number, options: Intl.DateTimeFormatOptions) => new Date(ms).toLocaleDateString(locale, options);

  const daysOf = (key: TileKey) => (key === "helped" ? glance.counts.tried : glance.perDay.filter((day) => day[key] > 0).length);
  const daysLine = (key: TileKey): string | null => {
    const n = daysOf(key);
    if (n === 0) return null;
    return n === 1 ? t(`${TILE_DAYS[key]}.one`) : t(TILE_DAYS[key], { n });
  };
  const helpedTimes = (n: number, one: string, many: string) => (n === 1 ? t(one) : t(many, { n }));

  const topStep = topHelpedStep(lines.steps);
  const world = lines.kidWorld ? kidWorldByWorldId(lines.kidWorld.worldId) : undefined;
  const sub: Record<TileKey, ReactNode> = {
    moments: lines.places.length > 0
      ? lines.places.map((p) => t(PLACE_KEY[p.place], { n: p.n })).join(" · ")
      : daysLine("moments"),
    helped: topStep
      ? joined([<bdi key="step">{clip(topStep.step, TILE_STEP_MAX)}</bdi>, helpedTimes(topStep.helped, "elev.wk.tile.helped.one", "elev.wk.tile.helped")])
      : daysLine("helped"),
    milestones: lines.milestoneAreas.length > 0
      ? lines.milestoneAreas.map((a) => t("elev.wk.tile.area", { area: domainName(a.domain, t), n: a.n })).join(" · ")
      : daysLine("milestones"),
    kid: world && lines.kidWorld
      ? t("elev.wk.tile.sessions", { game: t(world.doorNameKey), n: lines.kidWorld.n })
      : daysLine("kid"),
  };

  const stepSub = (line: WeekStepLine): ReactNode => {
    const parts: ReactNode[] = [];
    if (line.helped > 0) {
      const days = line.helpedDays.map((ms) => date(ms, { weekday: "short" })).join(", ");
      parts.push(`${helpedTimes(line.helped, "elev.wk.helped.once", "elev.wk.helped.times")} · ${days}`);
    }
    if (line.notThisTime > 0) parts.push(t("elev.wk.helped.not", { n: line.notThisTime }));
    return joined(parts);
  };

  const areaLine = (area: WeekAreaLine): ReactNode => {
    const parts: ReactNode[] = [];
    if (area.milestones.length === 1) parts.push(<bdi key="milestone">{milestoneText(area.milestones[0], "title", t)}</bdi>);
    else if (area.milestones.length > 1) parts.push(t("elev.wk.areas.milestones", { n: area.milestones.length }));
    if (area.latest?.kind === "word") parts.push(<bdi key="word">{t("elev.wk.words.quote", { phrase: area.latest.phrase })}</bdi>);
    else if (area.latest?.kind === "moment") parts.push(<bdi key="moment">{behaviorTypeLabel(area.latest.behaviorType, t)}</bdi>);
    return parts.length > 0 ? joined(parts) : "—";
  };

  const tileBody = (tile: (typeof TILES)[number]) => {
    const n = glance.counts[tile.key];
    return (
      <>
        <span className="wk-glance-tile-head">
          <Icon name={tile.icon} size={20} />
          <span>{t(tile.label)}</span>
        </span>
        <b>{n > 0 ? n : "—"}</b>
        {n > 0 && sub[tile.key] && <small>{sub[tile.key]}</small>}
      </>
    );
  };

  return (
    <section data-module="weekly-glance" data-testid="weekly-glance" className="wk-glance" aria-label={t("elev.wk.glance.title")}>
      <ul className="wk-glance-tiles" data-testid="weekly-glance-tiles">
        {TILES.map((tile) => (
          <li key={tile.key}>
            {tile.key === "milestones" && onOpenMilestones ? (
              <button type="button" className="wk-glance-tile wk-glance-door" data-tile={tile.key} data-testid="weekly-tile-milestones" onClick={onOpenMilestones}>
                {tileBody(tile)}
              </button>
            ) : (
              <div className="wk-glance-tile" data-tile={tile.key}>{tileBody(tile)}</div>
            )}
          </li>
        ))}
      </ul>

      <div className="wk-glance-row">
        <figure className="wk-glance-card wk-glance-days" data-testid="weekly-glance-days" aria-label={t("elev.wk.glance.days.aria")}>
          <figcaption>
            <span className="wk-glance-kicker">{t("elev.wk.glance.days")}</span>
            <span className="wk-glance-card-title">{t("elev.wk.days.title")}</span>
          </figcaption>
          <ol className="wk-glance-strip" aria-hidden="true" style={{ "--wk-max": glance.stackMax } as CSSProperties}>
            {glance.perDay.map((day, index) => (
              <li
                key={day.startMs}
                className="wk-glance-day"
                data-outcome={day.outcome ?? undefined}
                data-today={index === glance.today ? "" : undefined}
                data-ahead={index > glance.today ? "" : undefined}
              >
                <span className="wk-glance-col">
                  {day.moments > 0 && <i className="wk-glance-moments" style={{ "--n": day.moments } as CSSProperties} />}
                  {day.kid > 0 && <i className="wk-glance-kid" style={{ "--n": day.kid } as CSSProperties} />}
                </span>
                <span className="wk-glance-date">{date(day.startMs, { day: "numeric" })}</span>
                <span className="wk-glance-outcome">
                  {day.outcome && <Icon name={OUTCOME_GLYPH[day.outcome].icon} size={16} />}
                </span>
              </li>
            ))}
          </ol>
          <ul className="wk-glance-legend">
            <li><i className="wk-glance-swatch wk-glance-moments" aria-hidden="true" />{t("elev.wk.legend.moments")}</li>
            <li><i className="wk-glance-swatch wk-glance-kid" aria-hidden="true" />{t("elev.wk.glance.kid")}</li>
            <li><Icon name={OUTCOME_GLYPH.helped.icon} size={15} />{t(OUTCOME_GLYPH.helped.label)}</li>
            <li><Icon name={OUTCOME_GLYPH["not-this-time"].icon} size={15} />{t(OUTCOME_GLYPH["not-this-time"].label)}</li>
          </ul>
          {/* The strip is drawn for the eye (aria-hidden); a screen reader gets the same counts as a table, each day by its full date. */}
          <table className="sr-only">
            <caption>{t("elev.wk.glance.days.aria")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("elev.wk.glance.table.day")}</th>
                <th scope="col">{t("elev.wk.legend.moments")}</th>
                <th scope="col">{t("elev.wk.glance.kid")}</th>
                <th scope="col">{t("elev.wk.glance.table.step")}</th>
              </tr>
            </thead>
            <tbody>
              {glance.perDay.map((day) => (
                <tr key={day.startMs}>
                  <th scope="row">{date(day.startMs, { weekday: "long", month: "long", day: "numeric" })}</th>
                  <td>{day.moments}</td>
                  <td>{day.kid}</td>
                  <td>{day.outcome ? t(OUTCOME_GLYPH[day.outcome].label) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </figure>

        <div className="wk-glance-side">
          <section className="wk-glance-card" data-testid="weekly-what-helped" aria-labelledby={`${id}-helped`}>
            <h2 id={`${id}-helped`} className="wk-glance-card-head">
              <Icon name="flag" size={20} />
              <span>{t("elev.wk.helped.title")}</span>
            </h2>
            {lines.steps.length > 0 ? (
              <ul className="wk-glance-steps">
                {lines.steps.map((line) => (
                  <li key={line.step} data-testid="weekly-step" data-helped={line.helped > 0 ? "" : undefined}>
                    <Icon name={line.helped > 0 ? "thumb_up" : "replay"} size={18} />
                    <span>
                      <bdi className="wk-glance-step-title">{line.step}</bdi>
                      <small>{stepSub(line)}</small>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="wk-glance-note">{t("elev.wk.helped.none")}</p>
            )}
            {helpedAction}
          </section>

          {lines.words.length > 0 && (
            <section className="wk-glance-card wk-glance-words" data-testid="weekly-words" aria-labelledby={`${id}-words`}>
              <h2 id={`${id}-words`} className="wk-glance-card-head">
                <Icon name="auto_awesome" size={20} />
                <span>{t("elev.wk.words.title", { first: childFirst })}</span>
              </h2>
              <ul className="wk-glance-chips">
                {lines.words.map((word) => (
                  <li key={word} dir="auto"><bdi>{t("elev.wk.words.quote", { phrase: word })}</bdi></li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      <section className="wk-glance-card wk-glance-areas" data-testid="weekly-glance-areas" aria-labelledby={`${id}-areas`}>
        <div className="wk-glance-areas-head">
          <h2 id={`${id}-areas`} className="wk-glance-card-head">
            <Icon name="eco" size={20} />
            <span>{t("elev.wk.glance.areas")}</span>
          </h2>
          <p className="wk-glance-note">{t("elev.wk.areas.note")}</p>
        </div>
        <ul>
          {lines.areas.map((area) => (
            <li key={area.domain} data-area={area.domain} data-empty={area.n === 0 ? "" : undefined}>
              <Icon name={DOMAIN_ICONS[area.domain]} size={18} />
              <span className="wk-glance-area-text">
                <span className="wk-glance-area-name">{domainName(area.domain, t)}</span>
                <span className="wk-glance-area-line">{areaLine(area)}</span>
              </span>
              {area.n > 0 && <b>{area.n}</b>}
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
