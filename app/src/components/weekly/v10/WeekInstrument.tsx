import React, { useState, type CSSProperties } from "react";
import { Token, type TokenKind, type TokenState } from "../../../design/primitives";
import type { Composition } from "../../../design/useComposition";
import type { InstrumentKind, LaneKind, TimedToken, WeekInstrument as WeekInstrumentData } from "../../../lib/weekInstrument";
import { fmtTimeV10 } from "../../../lib/formatDate";
import type { WeeklyCopy } from "./weeklyCopy";

/**
 * The week instrument (board object "week instrument"): days across and time
 * of day down on desktop, one row per day with the hours across on phones.
 * Each token is one record, at its clock time when the record holds one; steps
 * and date-only records sit in the day's "no time" lane. The kind chips are the
 * legend and the filter. Drawn for the eye; a screen reader gets the same
 * counts as a table.
 */

const KIND_ORDER: readonly InstrumentKind[] = ["moment", "hard", "helped", "not", "date"];
const TOKEN_OF: Record<InstrumentKind, { kind: TokenKind; state?: TokenState }> = {
  moment: { kind: "moment" },
  hard: { kind: "hard" },
  helped: { kind: "stp" },
  not: { kind: "stp", state: "open" },
  date: { kind: "date" },
};
const CHIP_CLASS: Record<InstrumentKind, string> = { moment: "k-moment", hard: "k-hard", helped: "k-stp", not: "k-not", date: "k-date" };
const EVENING = { from: 17, to: 21 };

type Props = {
  data: WeekInstrumentData;
  composition: Composition;
  copy: WeeklyCopy;
  locale: string;
  /** Rendered under the plot: the Milestones door and the Kids Studio line. */
  footer?: React.ReactNode;
  /** The next visit when it falls after this week: the end of the dates rail. */
  beyond?: { label: string; sub?: string; ms: number; nobody?: boolean } | null;
  /** Today's step is taken and not yet answered: a ring in today's lane. */
  todayStep?: boolean;
};

export default function WeekInstrument({ data, composition, copy, locale, footer, beyond = null, todayStep = false }: Props) {
  const [hidden, setHidden] = useState<ReadonlySet<InstrumentKind>>(new Set());
  const shown = (kind: InstrumentKind) => !hidden.has(kind);
  const toggle = (kind: InstrumentKind) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });

  const kindLabel: Record<InstrumentKind, string> = { moment: copy.kindMoment, hard: copy.kindHard, helped: copy.kindHelped, not: copy.kindNot, date: copy.kindDate };
  const tokenLabel: Record<InstrumentKind, string> = { moment: copy.tokenMoment, hard: copy.tokenHard, helped: copy.tokenHelped, not: copy.tokenNot, date: copy.tokenDate };
  const weekday = (ms: number) => new Date(ms).toLocaleDateString(locale, { weekday: "short" });
  const dayNum = (ms: number) => new Date(ms).toLocaleDateString(locale, { day: "numeric" });
  const lang = locale.startsWith("he") ? "he" : "en";
  const clock = (ms: number) => fmtTimeV10(ms, lang);
  const todayLane = (size: "sm" | "md") =>
    todayStep ? (
      <span className="wk10-todaystep">
        <Token kind="plan" state="here" size={size} label={copy.todaysStep} />
        {size === "md" && <span>{copy.todaysStep}</span>}
      </span>
    ) : null;
  const kinds = KIND_ORDER.filter((k) => data.counts[k] > 0);
  const span = data.hours.to - data.hours.from;
  const pos = (hour: number) => `${((hour - data.hours.from) / span) * 100}%`;

  const timedToken = (tok: TimedToken, size: "sm" | "md", style?: CSSProperties) => (
    <Token
      key={tok.id}
      kind={TOKEN_OF[tok.kind].kind}
      size={size}
      isNew={tok.latest}
      label={`${tok.latest ? copy.tokenMomentNew : tokenLabel[tok.kind]}, ${weekday(tok.ms)} ${clock(tok.ms)}`}
      className="wk10-tok"
      style={style}
    />
  );
  const laneToken = (id: string, kind: LaneKind, size: "sm" | "md") => (
    <Token key={id} kind={TOKEN_OF[kind].kind} state={TOKEN_OF[kind].state} size={size} label={tokenLabel[kind]} />
  );

  const chips = (
    <>
      {kinds.map((k) => {
        const t = TOKEN_OF[k];
        return (
          <button
            key={k}
            type="button"
            className={`wk-chip ${CHIP_CLASS[k]}`}
            aria-pressed={shown(k)}
            aria-label={`${copy.showKind(kindLabel[k])}: ${data.counts[k]}`}
            data-testid={`weekly-kind-${k}`}
            onClick={() => toggle(k)}
          >
            <i aria-hidden="true" className={["tok", t.kind, t.state, "sm"].filter(Boolean).join(" ")} />
            <span>{kindLabel[k]}</span>
            <b>{data.counts[k]}</b>
          </button>
        );
      })}
    </>
  );
  const keys = (
    <>
      {data.days.some((d) => d.isToday) && (
        <span className="wk-chip k-today wk10-key">
          <i className="wk-sw today" aria-hidden="true" />
          <span>
            {copy.keyToday}
            {data.nowHour !== null && <small>{`${new Date().toLocaleDateString(locale, { weekday: "short", day: "numeric" })}, ${clock(Date.now())}`}</small>}
          </span>
          <b />
        </span>
      )}
      {data.days.some((d) => d.isAhead) && (
        <span className="wk-chip k-ahead wk10-key">
          <i className="wk-sw ahead" aria-hidden="true" />
          <span>
            {copy.keyAhead}
            <small>{copy.keyAheadSub}</small>
          </span>
          <b />
        </span>
      )}
    </>
  );

  /* A token's horizontal seat inside its day: records close in time sit side by side. */
  const seats = new Map<string, number>();
  for (let day = 0; day < 7; day += 1) {
    const placed: TimedToken[] = [];
    for (const tok of data.timed.filter((x) => x.day === day && shown(x.kind))) {
      const near = placed.filter((p) => Math.abs(p.hour - tok.hour) < 1.4).map((p) => seats.get(p.id) ?? 0);
      let seat = 0;
      while (near.includes(seat)) seat += 1;
      seats.set(tok.id, seat);
      placed.push(tok);
    }
  }

  const table = (
    <div className="sr-only">
      <table>
        <caption>{copy.weekAria}</caption>
        <thead>
          <tr>
            <th scope="col">{copy.tableDay}</th>
            <th scope="col">{copy.tableTimed}</th>
            <th scope="col">{copy.tableSteps}</th>
          </tr>
        </thead>
        <tbody>
          {data.days.map((d, i) => (
            <tr key={d.startMs}>
              <th scope="row">{new Date(d.startMs).toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" })}</th>
              <td>{data.timed.filter((x) => x.day === i).length + data.lane.filter((x) => x.day === i && (x.kind === "moment" || x.kind === "hard")).length}</td>
              <td>{data.lane.filter((x) => x.day === i && (x.kind === "helped" || x.kind === "not")).length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (composition === "phone") {
    const ticks = [6, 9, 12, 15, 18, 21].filter((h) => h >= data.hours.from && h <= data.hours.to);
    return (
      <div className="wk10-inst m" data-testid="weekly-instrument">
        <figure className="wk10-mi" aria-label={copy.weekAria}>
          <div className="wk10-mr wk10-maxis" aria-hidden="true">
            <span />
            <span className="wk10-mstrip">
              {ticks.map((h) => (
                <span key={h} className="wk10-tick" style={{ insetInlineStart: pos(h) }}>{String(h).padStart(2, "0")}</span>
              ))}
            </span>
            <span />
          </div>
          {data.days.map((d, i) => {
            const lane = data.lane.filter((x) => x.day === i && shown(x.kind));
            const dates = shown("date") ? data.dates.filter((x) => x.day === i) : [];
            return (
              <div key={d.startMs} className={`wk10-mr${d.isToday ? " today" : ""}${d.isAhead ? " ahead" : ""}`} aria-hidden="true">
                <span className={`wk-mdh${d.isToday ? " today" : ""}`}>
                  <span>{weekday(d.startMs)}</span>
                  <b>{dayNum(d.startMs)}</b>
                </span>
                <span className={`wk10-mstrip wk-ms${d.isAhead ? " wk-ahead" : ""}`}>
                  <i className="wk10-eve" style={{ insetInlineStart: pos(EVENING.from), inlineSize: `${((EVENING.to - EVENING.from) / span) * 100}%` }} />
                  {d.isToday && data.nowHour !== null && (
                    <>
                      <i className="wk10-nowline v" style={{ insetInlineStart: pos(data.nowHour) }} />
                      <span className="wk10-nowpill m" style={{ insetInlineStart: pos(data.nowHour) }}>{`${copy.now} ${clock(Date.now())}`}</span>
                    </>
                  )}
                  {data.timed
                    .filter((x) => x.day === i && shown(x.kind))
                    .map((tok) => timedToken(tok, "sm", { insetInlineStart: `calc(${pos(tok.hour)} - 11px + ${(seats.get(tok.id) ?? 0) * 14}px)`, top: 6 }))}
                </span>
                <span className="wk10-mlane">
                  {lane.map((x) => laneToken(x.id, x.kind, "sm"))}
                  {d.isToday && todayLane("sm")}
                  {dates.map((x) => (
                    <span key={x.id} className="wk10-mdate">
                      <Token kind="date" state={x.nobody ? "none" : "solid"} size="sm" label={`${copy.tokenDate}, ${x.label}`}>{dayNum(x.ms)}</Token>
                      <span className="wk10-mdate-t"><b>{x.label}</b>{x.sub && <small>{x.sub}</small>}</span>
                    </span>
                  ))}
                </span>
              </div>
            );
          })}
          {beyond && shown("date") && (
            <div className="wk10-mr wk10-beyond" aria-hidden="true">
              <span className="wk-mdh">
                <span>{weekday(beyond.ms)}</span>
                <b>{dayNum(beyond.ms)}</b>
              </span>
              <span className="wk10-beyond-t">
                <b>{`${clock(beyond.ms)} ${beyond.label}`}</b>
                {beyond.sub && <small>{beyond.sub}</small>}
              </span>
              <span className="wk10-mlane">
                <Token kind="date" state={beyond.nobody ? "none" : "solid"} size="sm" label={`${copy.tokenDate}, ${beyond.label}`}>{dayNum(beyond.ms)}</Token>
              </span>
            </div>
          )}
        </figure>
        <div className="wk-lg ds-snap-scroll" role="group" aria-label={copy.kinds}>
          {chips}
          {keys}
        </div>
        <p className="wk10-legend">{copy.legend}</p>
        {footer}
        {table}
      </div>
    );
  }

  const hourMarks: number[] = [];
  for (let h = Math.ceil(data.hours.from / 3) * 3; h <= data.hours.to; h += 3) hourMarks.push(h);
  const hasLane = data.lane.length > 0 || (todayStep && data.days.some((d) => d.isToday));
  return (
    <div className="wk10-inst d" data-testid="weekly-instrument">
      <div className="wk10-kinds" role="group" aria-label={copy.kinds}>
        <span className="kicker">{copy.kinds}</span>
        {chips}
        <span className="wk10-gap" aria-hidden="true" />
        {keys}
        <p className="wk10-legend">{copy.legend}</p>
      </div>
      <div className="wk10-plotwrap">
        <figure className="wk10-plot" aria-label={copy.weekAria}>
          {(data.dates.length > 0 || beyond) && shown("date") && (
            <div className="wk10-row wk10-dates" aria-hidden="true">
              <span className="wk-kick">{copy.datesAhead}</span>
              <span />
              {data.days.map((d, i) => (
                <span key={d.startMs} className="wk10-cell">
                  {beyond && i === 6 && (
                    <span className="wk10-date beyond">
                      <Token kind="date" state={beyond.nobody ? "none" : "solid"} size="md" label={`${copy.tokenDate}, ${beyond.label}`}>{dayNum(beyond.ms)}</Token>
                      <span className="wk-lab">
                        <span>{beyond.label}</span>
                        <small>{new Date(beyond.ms).toLocaleDateString(locale, { weekday: "short", day: "numeric" })}</small>
                      </span>
                    </span>
                  )}
                  {data.dates
                    .filter((x) => x.day === i)
                    .map((x) => (
                      <span key={x.id} className="wk10-date">
                        <Token kind="date" state={x.nobody ? "none" : "solid"} size="md" label={`${copy.tokenDate}, ${x.label}`}>{dayNum(x.ms)}</Token>
                        <span className="wk-lab">
                          <span>{x.label}</span>
                          <small>{x.sub ?? clock(x.ms)}</small>
                        </span>
                      </span>
                    ))}
                </span>
              ))}
            </div>
          )}
          <div className="wk10-row wk10-heads" aria-hidden="true">
            <span />
            {data.days.map((d) => (
              <span key={d.startMs} className={`wk-dh${d.isToday ? " today" : ""}`}>
                {weekday(d.startMs)}
                <b>{dayNum(d.startMs)}</b>
              </span>
            ))}
          </div>
          <div className="wk10-row wk10-field" aria-hidden="true" style={{ "--wk10-h": `${span * 11}px` } as CSSProperties}>
            <span className="wk10-hours">
              {hourMarks.map((h) => (
                <span key={h} className="wk-hr" style={{ top: pos(h) }}>{String(h).padStart(2, "0")}</span>
              ))}
            </span>
            <span className="wk10-ground">
              {hourMarks.map((h) => (
                <i key={h} className="wk10-rule" style={{ top: pos(h) }} />
              ))}
              <i className="wk10-eve" style={{ top: pos(EVENING.from), blockSize: `${((EVENING.to - EVENING.from) / span) * 100}%` }}>
                <span>{copy.evening}</span>
              </i>
              {data.days.map((d, i) => (
                <span key={d.startMs} className={`wk10-col${d.isToday ? " today" : ""}${d.isAhead ? " wk-ahead" : ""}`}>
                  {d.isToday && data.nowHour !== null && (
                    <>
                      <i className="wk10-ahead-rest wk-ahead" style={{ top: pos(data.nowHour) }} />
                      <i className="wk10-nowline" style={{ top: pos(data.nowHour) }} />
                      <span className="wk10-nowpill" style={{ top: pos(data.nowHour) }}>{`${copy.now} ${clock(Date.now())}`}</span>
                    </>
                  )}
                  {data.timed
                    .filter((x) => x.day === i && shown(x.kind))
                    .map((tok, _j, col) => (
                      <React.Fragment key={tok.id}>
                        {timedToken(tok, "md", { top: `calc(${pos(tok.hour)} - 13px)`, insetInlineStart: 6 + (seats.get(tok.id) ?? 0) * 30 })}
                        {col.length <= 3 && (
                          <span className="wk-tl wk10-tl" style={{ top: `calc(${pos(tok.hour)} + 14px)`, insetInlineStart: (seats.get(tok.id) ?? 0) * 30 }}>{clock(tok.ms)}</span>
                        )}
                      </React.Fragment>
                    ))}
                </span>
              ))}
            </span>
          </div>
          {hasLane && (
            <>
              <div className="wk10-row wk10-lanehead" aria-hidden="true">
                <span />
                <span className="wk-kick">{copy.noTime}</span>
              </div>
              <div className="wk10-row wk10-lane" aria-hidden="true">
                <span />
                {data.days.map((d, i) => (
                  <span key={d.startMs} className={`wk10-cell${d.isToday ? " today" : ""}${d.isAhead ? " wk-ahead" : ""}`}>
                    {data.lane.filter((x) => x.day === i && shown(x.kind)).map((x) => laneToken(x.id, x.kind, "md"))}
                    {d.isToday && todayLane("md")}
                  </span>
                ))}
              </div>
            </>
          )}
        </figure>
        {footer}
      </div>
      {table}
    </div>
  );
}
