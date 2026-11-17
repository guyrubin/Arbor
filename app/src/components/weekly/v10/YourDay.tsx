import React from "react";
import { LivingForm, MoreLink, RouteHead } from "../../../design/primitives";
import type { Composition } from "../../../design/useComposition";
import Icon from "../../ui/Icon";
import { DAY_PARTS, type DayField, type DayPart } from "../../../lib/dayField";
import type { DayWindowsSummary } from "../../../growth/dayWindowsAgg";
import { guideArtFor } from "../../../lib/guideArt";
import type { UiLang } from "../../../lib/i18n";
import { formatHour } from "../../../lib/pulse";
import type { WeeklyCopy } from "./weeklyCopy";

type T = (key: string, vars?: Record<string, string | number>) => string;

const PART_ICON: Record<DayPart, string> = { morning: "wb_sunny", afternoon: "light_mode", evening: "dark_mode", night: "dark_mode" };
/** Tokens drawn in one cell before the rest read "+n". */
const CELL_MAX = 3;
/** The day-windows strip's waking hours (growth/dayWindowsAgg). */
const EVENING_FROM = 17;

/**
 * Stop 4 — Your day at a glance, the home of the time-of-day chart (the
 * `day-windows` route lands here). Left: when the parent logs, by weekday and
 * part of the day (lib/dayField, the rhythm window). Right: the hard moments by
 * hour, the day-windows read production ships (growth/dayWindowsAgg: one ink,
 * the evidence floor, the "often trickier" window, the pattern line), and the
 * guard "tendencies, not predictions", said once.
 */
export default function YourDay({
  composition,
  copy,
  t,
  uiLang,
  locale,
  field,
  summary,
  onHardMoments,
  aside,
  foot = "",
}: {
  composition: Composition;
  copy: WeeklyCopy;
  t: T;
  uiLang: UiLang;
  locale: string;
  field: DayField;
  summary: DayWindowsSummary;
  onHardMoments: () => void;
  /** Rendered under the hour strip (the invite disclosure). */
  aside?: React.ReactNode;
  /** The lead line from the same logs ("12 at home, 4 on a Saturday."), or "". */
  foot?: string;
}) {
  const phone = composition === "phone";
  const partName: Record<DayPart, string> = { morning: copy.morning, afternoon: copy.afternoon, evening: copy.eveningPart, night: copy.night };
  const partSpan: Record<DayPart, string> = { morning: copy.morningSpan, afternoon: copy.afternoonSpan, evening: copy.eveningSpan, night: copy.nightSpan };
  // Weekday headers, Sunday first: 4 Jan 1970 was a Sunday.
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(1970, 0, 4 + i));
  const head = (d: Date, style: "short" | "narrow" | "long") => d.toLocaleDateString(locale, { weekday: style });
  const art = guideArtFor("bedtime", uiLang);
  const busiest = field.busiest;

  const dayFieldView = (
    <div className="wk10-dayfield">
      {busiest && (
        <div className="line wk10-dayfig">
          {art && !phone && <LivingForm src={art.src} srcSet={art.srcSet} width={52} height={34} crop={{ w: 131.4, h: 73.9, x: -72, y: -20.9 }} />}
          <h3 className="h3 wk10-dayhead">{copy.dayHead(partName[busiest], partSpan[busiest], field.totals[busiest])}</h3>
        </div>
      )}
      <div className={`wk-df${phone ? " m" : ""}`} aria-hidden="true" data-testid="weekly-day-field">
        <span />
        {weekdays.map((d) => (
          <span key={d.getDay()} className="h">{head(d, phone ? "narrow" : "short")}</span>
        ))}
        {DAY_PARTS.map((part) => (
          <React.Fragment key={part}>
            <div className={`r${part === "evening" ? " eve" : ""}`}>
              {!phone && <Icon name={PART_ICON[part]} size={22} className="ic" />}
              <span>
                {partName[part]}
                {!phone && <small>{partSpan[part]}</small>}
              </span>
              {!phone && <b>{field.totals[part]}</b>}
            </div>
            {field.cells[part].map((cell, i) => {
              const marks: Array<"moment" | "hard"> = [...Array(cell.moment).fill("moment"), ...Array(cell.hard).fill("hard")];
              return (
                <span key={i} className={`c${part === "evening" ? " eve" : ""}`}>
                  {marks.slice(0, CELL_MAX).map((k, j) => (
                    <i key={j} className={`tok ${k} sm`} />
                  ))}
                  {marks.length > CELL_MAX && <span className="wk10-more">{copy.more(marks.length - CELL_MAX)}</span>}
                </span>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div className="sr-only">
        <table>
          <caption>{copy.dayFieldAria}</caption>
          <thead>
            <tr>
              <th scope="col" />
              {weekdays.map((d) => (
                <th key={d.getDay()} scope="col">{head(d, "long")}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAY_PARTS.map((part) => (
              <tr key={part}>
                <th scope="row">{partName[part]}</th>
                {field.cells[part].map((cell, i) => (
                  <td key={i}>{cell.moment + cell.hard}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const max = Math.max(0, ...summary.hourCounts.map((c) => c.count));
  const hours = summary.hourCounts;
  const hourStrip = (
    <section className="wk10-hourblock" aria-labelledby="wk-hour-title">
      <h3 className="h3 wk10-hourhead" id="wk-hour-title">{copy.hardByHour}</h3>
      <div className="wk10-hours-strip" role="list" aria-label={t("dw.bars.aria")}>
        {hours.map((c) => (
          <div
            key={c.hour}
            role="listitem"
            data-testid="dw-hour-bar"
            className={`wk10-hour${c.hour >= EVENING_FROM ? " eve" : ""}`}
            aria-label={t(c.count === 1 ? "dw.hour.aria.one" : "dw.hour.aria", { hour: formatHour(c.hour, uiLang), n: c.count })}
          >
            {Array.from({ length: Math.min(c.count, CELL_MAX) }, (_, j) => (
              <i key={j} aria-hidden="true" className="tok hard sm" />
            ))}
            {c.count > CELL_MAX && <span className="wk10-more" aria-hidden="true">{copy.more(c.count - CELL_MAX)}</span>}
          </div>
        ))}
      </div>
      <div className="wk10-hour-ticks" aria-hidden="true">
        {hours.map((c, i) => (
          <span key={c.hour}>{i % 3 === 0 ? formatHour(c.hour, uiLang) : ""}</span>
        ))}
      </div>
      {summary.hasEnoughData ? (
        <>
          {summary.windows.map((w) => (
            <p
              key={w.label}
              className="wk10-window"
              aria-label={t("dw.window.aria", { label: t("dw.label.trickier"), startHour: formatHour(w.startHour, uiLang), endHour: formatHour(w.endHour, uiLang) })}
            >
              <Icon name="schedule" size={18} />
              <span>
                <b>{t("dw.label.trickier")}</b> {formatHour(w.startHour, uiLang)}–{formatHour(w.endHour, uiLang)}
              </span>
            </p>
          ))}
          {summary.patternObservation && (
            <p className="line1" data-testid="dw-pattern-observation">
              {t("dw.pattern", {
                n: summary.patternObservation.hardDays,
                m: summary.patternObservation.daysLogged,
                hour: formatHour(summary.patternObservation.peakHour, uiLang),
              })}
            </p>
          )}
          <p className="small wk10-days">{t("dw.daysLogged", { n: summary.daysLogged })}</p>
        </>
      ) : (
        <>
          <p className="line1 wk10-lowdata" data-testid="dw-low-data">
            <Icon name="hourglass_top" size={18} />
            <span>{t("dw.lowData")}</span>
          </p>
          {summary.daysNeeded > 0 && (
            <p className="small wk10-days" data-testid="dw-days-progress">
              {t("elev.dw.daysLoggedOf", { n: summary.daysLogged, total: summary.daysLogged + summary.daysNeeded })}
            </p>
          )}
        </>
      )}
      {max > 0 && <MoreLink onClick={onHardMoments} className="wk10-seehard">{copy.seeHard}</MoreLink>}
    </section>
  );

  return (
    <div className="wk10-day" role="region" aria-labelledby="wk-day-title">
      <RouteHead id="wk-day-title" title={copy.dayTitle} sub={copy.daySubV} />
      <section className="vt wk10-tile wk10-daycard">
        {dayFieldView}
        {hourStrip}
        <p className="line1 wk10-guard" role="note">
          {foot && <b data-testid="weekly-day-foot">{foot} </b>}
          <span data-testid="dw-determinism-guard">{t("dw.guard")}</span>
        </p>
      </section>
      {aside}
    </div>
  );
}
