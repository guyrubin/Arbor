import type { Composition } from "../../../design/useComposition";
import { Fig, LivingForm, MoreLink, Pile, Tile, Token } from "../../../design/primitives";
import { Icon } from "../../ui/Icon";
import { DOMAIN_ART, MOMENT_ART } from "../../../lib/parentArt";
import type { Observation } from "../../../lib/observations";
import { squareCrop } from "./livingFormCrop";

/**
 * Moments · The newest moment — where the parent's latest kept moment went
 * (their words in ink; the shelf Arbor filed it on in pencil; the areas it
 * shows under on the milestone map), the places the parent recorded (desk),
 * and the latest three by date (desk). Every figure is a plain count of what
 * the parent recorded; a place is shown only when the parent recorded it.
 */
export type PlacePile = { id: string; label: string; observations: Observation[] };

export type NewestLabels = {
  went: string;
  /** "You wrote · <when>" for the parent's own words, else the source and date. */
  by: (o: Observation) => string;
  asTyped: (o: Observation) => string | null;
  title: (o: Observation) => string;
  shelf: (o: Observation) => string | null;
  arborSuggests: string;
  onTheMap: string;
  areas: (o: Observation) => string;
  seeOnMap: string;
  more: string;
  byPlace: string;
  open: string;
  placeNote: string;
  latest: string;
  everything: string;
  day: (o: Observation) => { wd: string; d: string };
  meta: (o: Observation) => string;
  tokenLabel: (o: Observation) => string;
  isHard: (o: Observation) => boolean;
  nothing: string;
};

function Thread({ o, labels, initial }: { o: Observation; labels: NewestLabels; initial: string }) {
  const shelf = labels.shelf(o);
  const areas = labels.areas(o);
  const typed = labels.asTyped(o);
  return (
    <div className="thread" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
      <div className="knot you">
        <span className="by"><span className="av sm ds-ink-av" aria-hidden="true">{initial}</span>{labels.by(o)}</span>
        <span className="q" dir="auto">“{labels.title(o)}”</span>
        {typed && <span className="small" style={{ color: "var(--ink-soft)" }}>{typed}</span>}
      </div>
      {shelf && <>
        <span className="tie" aria-hidden="true" />
        <div className="knot ai">
          <span className="by" style={{ color: "var(--sapphire-deep)" }}><Icon name="edit" size={14} />{labels.arborSuggests}</span>
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
  );
}

export default function MomentsNewest({ composition, newest, latest, places, labels, initial, onOpen, onMap, onPlaces, onEverything, onOpenLatest }: {
  composition: Composition;
  newest: Observation | null;
  /** Newest first, at most three. */
  latest: Observation[];
  places: PlacePile[];
  labels: NewestLabels;
  initial: string;
  onOpen: (o: Observation) => void;
  onMap: (o: Observation) => void;
  onPlaces: () => void;
  onEverything: () => void;
  onOpenLatest: (o: Observation) => void;
}) {
  const art = newest?.domains[0] ? DOMAIN_ART[newest.domains[0]] : MOMENT_ART;
  const actions = newest && (
    <div className="line" style={{ gap: 8, marginTop: "auto", flexWrap: "wrap" }}>
      {newest.domains.length > 0 && <button type="button" className="btn sm grow nowrap tint-btn" onClick={() => onMap(newest)}>{labels.seeOnMap}</button>}
      <button type="button" className="btn sm ghost nowrap card-btn" onClick={() => onOpen(newest)}>{labels.more}</button>
    </div>
  );

  if (composition === "phone") {
    return (
      <section className="vt newest-m">
        {newest ? <>
          <div className="line" style={{ gap: 12, alignItems: "center" }}>
            <LivingForm src={art.src} srcSet={art.srcSet} width={72} height={50} crop={squareCrop(72, 50)} />
            <span style={{ minWidth: 0 }}>
              <span className="nby">{labels.by(newest)}</span>
              <span className="nq" dir="auto">“{labels.title(newest)}”</span>
            </span>
          </div>
          {labels.shelf(newest) && (
            <div className="knot ai" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="by" style={{ color: "var(--sapphire-deep)" }}><Icon name="edit" size={14} />{labels.arborSuggests}</span>
                <b style={{ display: "block" }} dir="auto">{labels.shelf(newest)}</b>
              </span>
            </div>
          )}
          {actions}
        </> : <p className="line1">{labels.nothing}</p>}
      </section>
    );
  }

  const top = places.reduce<PlacePile | null>((best, p) => (!best || p.observations.length > best.observations.length ? p : best), null);
  return (
    <div className="mbento">
      <Tile icon="edit" title={labels.went} style={{ gridColumn: "span 4" }}>
        {newest ? <>{<Thread o={newest} labels={labels} initial={initial} />}{actions}</> : <p className="line1">{labels.nothing}</p>}
      </Tile>
      <Tile icon="place" title={labels.byPlace} style={{ gridColumn: "span 4" }} link={<MoreLink onClick={onPlaces}>{labels.open}</MoreLink>}>
        {top && <Fig size="md" n={top.observations.length} unit={top.label} />}
        {places.length > 0 && (
          <div className="ppiles">
            {places.slice(0, 3).map((p) => (
              <div key={p.id} className="ppile">
                <Pile layout="rows">
                  {p.observations.slice(0, 12).map((o) => <Token key={o.id} kind={labels.isHard(o) ? "hard" : "moment"} size="sm" label={labels.tokenLabel(o)} />)}
                </Pile>
                <span className="pname">{p.label} <b className="arbor-num">{p.observations.length}</b></span>
              </div>
            ))}
          </div>
        )}
        <p className="line1">{labels.placeNote}</p>
      </Tile>
      <Tile icon="calendar_month" title={labels.latest} style={{ gridColumn: "span 4", gap: 6 }} link={<MoreLink onClick={onEverything}>{labels.everything}</MoreLink>}>
        <div>
          {latest.map((o) => {
            const d = labels.day(o);
            return (
              <button key={o.id} type="button" className="rowlink" onClick={() => onOpenLatest(o)}>
                <span className="dd" aria-hidden="true">{d.wd}<b className="arbor-num">{d.d}</b></span>
                <Token kind={labels.isHard(o) ? "hard" : "moment"} size="md" label={labels.tokenLabel(o)} />
                <span style={{ minWidth: 0 }}>
                  <b dir="auto">{labels.title(o)}</b>
                  <span className="rmeta" dir="auto">{labels.meta(o)}</span>
                </span>
                <Icon name="chevron_right" size={16} className="rtl:-scale-x-100" />
              </button>
            );
          })}
          {latest.length === 0 && <p className="line1">{labels.nothing}</p>}
        </div>
      </Tile>
    </div>
  );
}
