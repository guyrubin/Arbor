import React, { useId, type CSSProperties } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { DOMAIN_ICONS } from "../../lib/domains/icons";
import { DOMAIN_IDS, domainName } from "../../lib/domains/registry";
import { glanceHasCounts, type DayOutcome, type WeekCountKey, type WeekGlance as WeekGlanceData } from "../../lib/weekGlance";
import Icon from "../ui/Icon";
import "./weekGlance.css";

/** The glance's tile order: at most four tiles, and a zero is never shown. */
const TILE_ORDER: readonly WeekCountKey[] = ["moments", "helped", "milestones", "kid", "words"];
const TILE_LABEL: Record<WeekCountKey, string> = {
  moments: "elev.wk.glance.moments",
  helped: "elev.wk.glance.helped",
  milestones: "elev.wk.glance.milestones",
  kid: "elev.wk.glance.kid",
  words: "elev.wk.glance.words",
};
/**
 * Each tile's one sub-line: on how many days of the week it happened. Steps
 * count the days a step was tried at all (any outcome), the others the days
 * that hold one of their own records. A count of days, never "n of 7".
 */
const TILE_DAYS: Record<WeekCountKey, string> = {
  moments: "elev.wk.glance.kept.days",
  helped: "elev.wk.glance.tried",
  milestones: "elev.wk.glance.marked.days",
  kid: "elev.wk.glance.played.days",
  words: "elev.wk.glance.kept.days",
};
/** One neutral glyph per recorded outcome; never a colour that grades it. */
const OUTCOME_GLYPH: Record<Exclude<DayOutcome, null>, { icon: string; label: string }> = {
  helped: { icon: "thumb_up", label: "elev.wk.glance.legend.helped" },
  "not-this-time": { icon: "replay", label: "elev.wk.glance.legend.again" },
};

/**
 * v3 EXTRA-WEEKLY — the Weekly tab's glance: the current report week as
 * COUNTS (lib/weekGlance, the same numbers Now's "This week so far" shows).
 * Up to four count tiles, a day-by-day strip of moments and Kid Mode
 * sessions with the step outcome the parent recorded that day, and the areas
 * of the parent's moments. Clinical firewall: no share, no denominator, no
 * trend sign, no colour that judges; a zero is left out. It carries no move:
 * the route's one data-primary-move stays on the letter or the generate
 * control. Renders nothing when the week holds nothing.
 *
 * The strip is the REPORT week (recapWeekStartMs), the week the letter is
 * filed under, and that week opens on a Saturday (recapWeekId's stored-id
 * algorithm; at the year cut, on Jan 1). So each column is named by its DATE,
 * not a weekday: weekday names would put Saturday (Shabbat, in Hebrew) first.
 * The week's date span heads the strip, today's date is set in body ink, and
 * the days still ahead keep a dashed baseline.
 */
export default function WeekGlance({ glance }: { glance: WeekGlanceData }) {
  const { t, uiLang } = useLanguage();
  const locale = uiLang === "he" ? "he-IL" : "en-US";
  const id = useId();
  if (!glanceHasCounts(glance)) return null;

  const tiles = TILE_ORDER.filter((key) => glance.counts[key] > 0).slice(0, 4);
  const areas = DOMAIN_IDS.filter((domain) => (glance.byDomain[domain] ?? 0) > 0);
  const date = (ms: number, options: Intl.DateTimeFormatOptions) => new Date(ms).toLocaleDateString(locale, options);
  const days = (key: WeekCountKey) => (key === "helped" ? glance.counts.tried : glance.perDay.filter((day) => day[key] > 0).length);
  const daysLine = (key: WeekCountKey) => {
    const n = days(key);
    return n === 1 ? t(`${TILE_DAYS[key]}.one`) : t(TILE_DAYS[key], { n });
  };
  const first = glance.perDay[0].startMs;
  const last = glance.perDay[glance.perDay.length - 1].startMs;
  let span: string;
  try {
    span = new Intl.DateTimeFormat(locale, { month: "long", day: "numeric" }).formatRange(new Date(first), new Date(last));
  } catch {
    span = `${date(first, { month: "long", day: "numeric" })} – ${date(last, { month: "long", day: "numeric" })}`;
  }

  return (
    <section data-module="weekly-glance" data-testid="weekly-glance" className="wk-glance" aria-label={t("elev.wk.glance.title")}>
      {/* Phones: the page header's "Counts, not scores." line is folded away
          (WeeklyTab, the letter's move keeps its place at 375), so the glance
          opens with it instead. From 768 px the header carries it. */}
      <p className="wk-glance-sub" data-testid="weekly-glance-sub-phone">{t("elev.wk.glance.sub")}</p>

      {tiles.length > 0 && (
        <ul className="wk-glance-tiles" data-testid="weekly-glance-tiles">
          {tiles.map((key) => (
            <li key={key} className="wk-glance-tile" data-tile={key}>
              <b>{glance.counts[key]}</b>
              <span>{t(TILE_LABEL[key])}</span>
              {days(key) > 0 && <small>{daysLine(key)}</small>}
            </li>
          ))}
        </ul>
      )}

      <figure className="wk-glance-days" data-testid="weekly-glance-days" aria-label={t("elev.wk.glance.days.aria")}>
        <figcaption className="wk-glance-heading">
          {t("elev.wk.glance.days")}
          <span className="wk-glance-span" data-testid="weekly-glance-span">{span}</span>
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
          <li><i className="wk-glance-swatch wk-glance-moments" aria-hidden="true" />{t("elev.wk.glance.moments")}</li>
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
              <th scope="col">{t("elev.wk.glance.moments")}</th>
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

      {areas.length > 0 && (
        <section className="wk-glance-areas" data-testid="weekly-glance-areas" aria-labelledby={`${id}-areas`}>
          <h3 id={`${id}-areas`} className="wk-glance-heading">{t("elev.wk.glance.areas")}</h3>
          <ul>
            {areas.map((domain) => (
              <li key={domain} data-area={domain}>
                <Icon name={DOMAIN_ICONS[domain]} size={18} />
                <span>{domainName(domain, t)}</span>
                <b>{glance.byDomain[domain]}</b>
              </li>
            ))}
          </ul>
          <p className="wk-glance-note">{t("elev.wk.glance.areas.blank")}</p>
        </section>
      )}
    </section>
  );
}
