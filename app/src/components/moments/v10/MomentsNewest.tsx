import { useState } from "react";
import { Icon } from "../../ui/Icon";
import type { Observation } from "../../../lib/observations";
import { SHELF_IDS, type ShelfId } from "../../../lib/shelves/registry";
import { RailTile } from "./frame";

/**
 * Moments · The newest moment (the rail): the parent's latest kept moment as
 * a thread — their words in ink; the shelf it sits on in pencil ("Arbor
 * suggests · you can move it", only for a moment the parent can refile); the
 * areas it shows under on the milestone map. "Move shelf" lists the nine
 * shelves and refiles through the one parent-tap seam (fileMomentOnShelf).
 */
export type NewestLabels = {
  title: string;
  by: (o: Observation) => string;
  words: (o: Observation) => string;
  shelf: (o: Observation) => string | null;
  shelfName: (id: ShelfId) => string;
  arborSuggests: string;
  canMove: string;
  onTheMap: string;
  areas: (o: Observation) => string;
  seeOnMap: string;
  more: string;
  moveShelf: string;
  moved: string;
  moveFailed: string;
  nothing: string;
};

export default function MomentsNewest({ newest, initial, labels, onMap, onMore, onMove }: {
  newest: Observation | null;
  initial: string;
  labels: NewestLabels;
  onMap: (o: Observation) => void;
  onMore: (o: Observation) => void;
  /** Present only when this moment can be refiled (a parent's own log). */
  onMove?: (o: Observation, shelf: ShelfId) => Promise<unknown>;
}) {
  const [picking, setPicking] = useState(false);
  const [status, setStatus] = useState<"moved" | "failed" | null>(null);
  if (!newest) {
    return <RailTile icon="edit" title={labels.title}><p className="line1">{labels.nothing}</p></RailTile>;
  }
  const shelf = labels.shelf(newest);
  const areas = labels.areas(newest);
  const move = (id: ShelfId) => {
    if (!onMove) return;
    setPicking(false);
    onMove(newest, id).then(() => setStatus("moved"), () => setStatus("failed"));
  };
  return (
    <RailTile icon="edit" title={labels.title} className="newest" style={{ gap: 8 }}>
      <div className="thread newest-thread">
        <div className="knot you">
          <span className="by">{initial && <span className="av sm ds-ink-av" aria-hidden="true">{initial}</span>}{labels.by(newest)}</span>
          <span className="q" dir="auto">{labels.words(newest)}</span>
        </div>
        {shelf && <>
          <span className="tie" aria-hidden="true" />
          <div className="knot ai">
            <span className="by" style={{ color: "var(--sapphire-deep)" }}><Icon name="edit" size={14} />{onMove ? `${labels.arborSuggests} · ${labels.canMove}` : labels.arborSuggests}</span>
            <b dir="auto">{shelf}</b>
          </div>
        </>}
        {areas && <>
          <span className="tie" aria-hidden="true" />
          <div className="knot sets">
            <span className="by" style={{ color: "var(--k-plan)" }}><Icon name="eco" size={14} />{labels.onTheMap}</span>
            <b dir="auto">{areas}</b>
          </div>
        </>}
      </div>
      {status && <p className="line1" role="status">{status === "moved" ? labels.moved : labels.moveFailed}</p>}
      <div className="line newest-actions">
        {newest.domains.length > 0
          ? <button type="button" className="btn sm grow nowrap tint-btn" onClick={() => onMap(newest)}>{labels.seeOnMap}</button>
          : <button type="button" className="btn sm grow nowrap tint-btn" onClick={() => onMore(newest)}>{labels.more}</button>}
        {onMove && (
          <button type="button" className="btn sm ghost nowrap card-btn" aria-expanded={picking} onClick={() => setPicking((p) => !p)}>{labels.moveShelf}</button>
        )}
      </div>
      {onMove && picking && (
        <div className="shelf-pick" role="group" aria-label={labels.moveShelf}>
          {SHELF_IDS.map((id) => (
            <button key={id} type="button" className="kchip" aria-pressed={newest.shelf === id} onClick={() => move(id)}>{labels.shelfName(id)}</button>
          ))}
        </div>
      )}
      {newest.domains.length > 0 && <button type="button" className="ds-link" onClick={() => onMore(newest)}>{labels.more}<Icon name="chevron_right" size={16} className="rtl:-scale-x-100" /></button>}
    </RailTile>
  );
}
