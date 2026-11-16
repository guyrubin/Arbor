import type { Composition } from "../../../design/useComposition";
import { LivingForm, Token } from "../../../design/primitives";
import { DOMAIN_ART } from "../../../lib/parentArt";
import type { DomainId } from "../../../lib/domains/registry";
import type { AreaRow, MonthBucket } from "../momentsModel";
import { squareCrop } from "./livingFormCrop";

/**
 * Moments · Across areas — production's area × month record, drawn as the
 * boards draw it: one card (desk) or one row (phone) per area, one token per
 * moment the parent kept in the month it was kept, the count printed under
 * every month. Fixed scale (each moment is one token, at most TOKEN_CAP drawn;
 * the number is always printed), so a count is never normalised against
 * another area or month. A blank month is a dash and "no record", never a
 * missing ability. Every month with a record opens that month Over time; the
 * card's name opens the area Over time.
 */

/** Tokens drawn per month before the printed count carries the rest. */
export const TOKEN_CAP = 8;
/** Past this many months a cell is its count alone (tokens would not fit). */
const TOKEN_COLUMNS = 4;

export type AreaLabels = {
  areaName: (domain: DomainId) => string;
  total: (n: number) => string;
  none: string;
  noRecord: string;
  momentToken: string;
  cellAria: (domain: DomainId, column: MonthBucket, n: number) => string;
  columnLabel: (column: MonthBucket) => string;
};

export default function MomentsAreas({ composition, rows, columns, latest, labels, onOpenArea, onOpenCell, listLabel }: {
  composition: Composition;
  rows: AreaRow[];
  /** Oldest month first. */
  columns: MonthBucket[];
  /** The newest kept words per area in the range ("" when none). */
  latest: (domain: DomainId) => string;
  labels: AreaLabels;
  onOpenArea: (domain: DomainId) => void;
  onOpenCell: (domain: DomainId, column: MonthBucket) => void;
  listLabel: string;
}) {
  const tokens = columns.length <= TOKEN_COLUMNS;
  const grid = { gridTemplateColumns: `repeat(${Math.max(1, columns.length)}, minmax(0, 1fr))` };

  const cells = (row: AreaRow, phone: boolean) => (
    <span className={phone ? "mcs" : "mc"} style={grid}>
      {row.counts.map((n, i) => {
        const column = columns[i];
        const pile = tokens && (
          <span className="pl" aria-hidden="true">
            {Array.from({ length: Math.min(n, TOKEN_CAP) }, (_, k) => <Token key={k} kind="moment" size="sm" className="xs" label={labels.momentToken} />)}
          </span>
        );
        return n > 0 ? (
          <button key={column.id} type="button" className="mcol mcell" data-moments-count={n} aria-label={labels.cellAria(row.domain, column, n)} onClick={() => onOpenCell(row.domain, column)}>
            {pile}
            <span className="ncnt has arbor-num" aria-hidden="true">{n}</span>
            {!phone && <span className="ml" aria-hidden="true">{labels.columnLabel(column)}</span>}
          </button>
        ) : (
          <span key={column.id} className="mcol">
            {tokens && <span className="pl" aria-hidden="true" />}
            <span className="ncnt" aria-hidden="true">–</span>
            {!phone && <span className="ml" aria-hidden="true">{labels.columnLabel(column)}</span>}
            <span className="sr-only">{labels.noRecord}</span>
          </span>
        );
      })}
    </span>
  );

  if (composition === "phone") {
    return (
      <div className="mstack" style={{ gap: 0 }}>
        <div className="arow2 arow2-head" aria-hidden="true">
          <span /><span />
          <span className="mcs mlabels" style={grid}>{columns.map((column) => <span key={column.id}>{labels.columnLabel(column)}</span>)}</span>
        </div>
        <ul className="arows" aria-label={listLabel}>
          {rows.map((row) => {
            const total = row.counts.reduce((sum, n) => sum + n, 0);
            const art = DOMAIN_ART[row.domain];
            return (
              <li key={row.domain} className={total ? "arow2" : "arow2 none"} data-moments-area={row.domain}>
                <LivingForm src={art.src} srcSet={art.srcSet} width={40} height={28} crop={squareCrop(40, 28)} />
                <button type="button" className="an aopen" onClick={() => onOpenArea(row.domain)}>
                  {labels.areaName(row.domain)}
                  <small>{total ? labels.total(total) : labels.none}</small>
                </button>
                {total ? cells(row, true) : <span />}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <ul className="acards" aria-label={listLabel}>
      {rows.map((row) => {
        const total = row.counts.reduce((sum, n) => sum + n, 0);
        const art = DOMAIN_ART[row.domain];
        const words = latest(row.domain);
        return (
          <li key={row.domain} className={total ? "acard" : "acard none"} data-moments-area={row.domain}>
            <button type="button" className="ah aopen" onClick={() => onOpenArea(row.domain)}>
              <LivingForm src={art.src} srcSet={art.srcSet} width={32} height={24} crop={squareCrop(32, 24)} />
              <span className="an">
                {labels.areaName(row.domain)}
                <small>{total ? labels.total(total) : labels.none}</small>
              </span>
            </button>
            {total > 0 && cells(row, false)}
            {total > 0 && <span className="lt" dir="auto">{words}</span>}
          </li>
        );
      })}
    </ul>
  );
}
