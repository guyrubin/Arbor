import type { Composition } from "../../../design/useComposition";
import { Token } from "../../../design/primitives";
import { Icon } from "../../ui/Icon";
import { DOMAIN_ICONS } from "../../../lib/domains/icons";
import type { DomainId } from "../../../lib/domains/registry";
import type { AreaRow, MonthBucket } from "../momentsModel";

/**
 * Moments · Across areas — production's area × month record as the v10.3
 * board draws it: a table on the desk (area, one cell per month, the total),
 * rows on the phone. One mark per moment the parent kept, in the month it was
 * kept: a fixed scale (each moment one mark, at most TOKEN_CAP drawn; the
 * number always printed), never normalised against another area or month. A
 * blank month is a dash and "no record", never a missing ability. A month
 * with a record opens that month Over time; an area's name opens the area.
 */

/** Marks drawn per month before the printed count carries the rest. */
export const TOKEN_CAP = 8;
/** Past this many months a cell is its count alone (marks would not fit). */
const TOKEN_COLUMNS = 4;

export type AreaLabels = {
  areaName: (domain: DomainId) => string;
  total: (n: number) => string;
  none: string;
  noRecord: string;
  momentToken: string;
  cellAria: (domain: DomainId, column: MonthBucket, n: number) => string;
  noRecordAria: (domain: DomainId, column: MonthBucket) => string;
  columnLabel: (column: MonthBucket) => string;
  area: string;
  totalHead: string;
};

export default function MomentsAreas({ composition, rows, columns, labels, onOpenArea, onOpenCell, listLabel }: {
  composition: Composition;
  rows: AreaRow[];
  /** Oldest month first. */
  columns: MonthBucket[];
  labels: AreaLabels;
  onOpenArea: (domain: DomainId) => void;
  onOpenCell: (domain: DomainId, column: MonthBucket) => void;
  listLabel: string;
}) {
  const phone = composition === "phone";
  const marks = columns.length <= TOKEN_COLUMNS;
  const months = { gridTemplateColumns: `repeat(${Math.max(1, columns.length)}, minmax(0, 1fr))` };

  const cell = (row: AreaRow, n: number, i: number) => {
    const column = columns[i];
    return n > 0 ? (
      <button key={column.id} type="button" role="cell" className="cl has" data-moments-count={n} aria-label={labels.cellAria(row.domain, column, n)} onClick={() => onOpenCell(row.domain, column)}>
        {marks && Array.from({ length: Math.min(n, TOKEN_CAP) }, (_, k) => <Token key={k} kind="moment" size="sm" className="xs" label={labels.momentToken} />)}
        <b className="arbor-num" aria-hidden="true">{n}</b>
      </button>
    ) : (
      <span key={column.id} role="cell" className="cl no">
        <span aria-hidden="true">–</span>
        <span className="sr-only">{labels.noRecordAria(row.domain, column)}</span>
      </span>
    );
  };

  if (phone) {
    return (
      <div className="mmxm" role="table" aria-label={listLabel}>
        <div className="mdh" role="row" aria-hidden="true">
          <span /><span />
          <span className="mcols" style={months}>{columns.map((c) => <span key={c.id}>{labels.columnLabel(c)}</span>)}</span>
        </div>
        {rows.map((row) => {
          const total = row.counts.reduce((sum, n) => sum + n, 0);
          return (
            <div key={row.domain} role="row" className={total ? "mdrow" : "mdrow q"} data-moments-area={row.domain}>
              <i className="tg" aria-hidden="true"><Icon name={DOMAIN_ICONS[row.domain]} size={16} /></i>
              <button type="button" role="rowheader" className="aopen" onClick={() => onOpenArea(row.domain)}>
                {labels.areaName(row.domain)}
                <small>{total ? labels.total(total) : labels.none}</small>
              </button>
              {total ? <span className="mcols" style={months}>{row.counts.map((n, i) => cell(row, n, i))}</span> : <span />}
            </div>
          );
        })}
      </div>
    );
  }

  const grid = { gridTemplateColumns: `224px repeat(${Math.max(1, columns.length)}, minmax(0, 1fr)) 64px` };
  return (
    <div className="mmx" role="table" aria-label={listLabel}>
      <div className="mr hd" role="row" style={grid}>
        <span role="columnheader">{labels.area}</span>
        {columns.map((c) => <span key={c.id} role="columnheader">{labels.columnLabel(c)}</span>)}
        <span role="columnheader">{labels.totalHead}</span>
      </div>
      {rows.map((row) => {
        const total = row.counts.reduce((sum, n) => sum + n, 0);
        return (
          <div key={row.domain} role="row" className={total ? "mr" : "mr q"} style={grid} data-moments-area={row.domain}>
            <button type="button" role="rowheader" className="an aopen" onClick={() => onOpenArea(row.domain)}>
              <i className="tg" aria-hidden="true"><Icon name={DOMAIN_ICONS[row.domain]} size={16} /></i>
              <span>{labels.areaName(row.domain)}{!total && <small>{labels.none}</small>}</span>
            </button>
            {row.counts.map((n, i) => cell(row, n, i))}
            <span role="cell" className="tt arbor-num">{total || "–"}</span>
          </div>
        );
      })}
    </div>
  );
}
