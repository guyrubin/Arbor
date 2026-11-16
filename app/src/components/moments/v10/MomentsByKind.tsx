import type { Composition } from "../../../design/useComposition";
import { LivingForm, Snap } from "../../../design/primitives";
import { Icon } from "../../ui/Icon";
import { EMPTY_ART } from "../../../lib/parentArt";
import { guideArt, wideCrop } from "./livingFormCrop";

/**
 * Moments · By kind — the rail (desk) or the snap row (phone): one compact
 * object per kind of record, each opening its full page. Hard moments and
 * Things <name> said carry production's own counts (the kind chips' counts,
 * over the same range); a kind production cannot count shows no figure.
 */
export type KindObject = {
  id: "hard" | "said" | "kept" | "time";
  kicker: string;
  /** A count with its unit in words; absent when there is nothing to count. */
  figure?: { n: number; unit: string };
  title?: string;
  sub: string;
  onOpen: () => void;
  testId: string;
};

const ART = {
  hard: { art: guideArt("big-feelings"), crop: (w: number, h: number) => wideCrop(w, h), ratio: 0.668 },
  said: { art: guideArt("new-words"), crop: (w: number, h: number) => wideCrop(w, h), ratio: 0.708 },
  kept: { art: EMPTY_ART.journal, crop: (w: number) => ({ w: w * 1.628, h: w * 1.085, x: -w * 0.332, y: -w * 0.101 }), ratio: 0.851 },
  time: { art: EMPTY_ART.weekly, crop: (w: number) => ({ w: w * 1.276, h: w * 0.851, x: -w * 0.139, y: -w * 0.215 }), ratio: 0.457 },
} as const;

function Art({ id, width }: { id: KindObject["id"]; width: number }) {
  const a = ART[id];
  const height = Math.round(width * a.ratio * 10) / 10;
  return <LivingForm src={a.art.src} srcSet={a.art.srcSet} width={width} height={height} crop={a.crop(width, height)} />;
}

function Body({ k }: { k: KindObject }) {
  return (
    <span style={{ minWidth: 0 }}>
      <span className="k" dir="auto">{k.kicker}</span>
      {k.figure ? (
        <span className="f40"><b className="arbor-num">{k.figure.n}</b><span>{k.figure.unit}</span></span>
      ) : (
        <span className="t" dir="auto">{k.title}</span>
      )}
      <small dir="auto">{k.sub}</small>
    </span>
  );
}

export default function MomentsByKind({ composition, title, items, snapLabel }: { composition: Composition; title: string; items: KindObject[]; snapLabel: string }) {
  if (composition === "phone") {
    return (
      <>
        <div className="snaphd"><h2 className="h3">{title}</h2></div>
        <Snap label={snapLabel}>
          {items.map((k) => (
            <button key={k.id} type="button" className="vt cobjm" data-testid={k.testId} onClick={k.onOpen}>
              <Art id={k.id} width={80} />
              <Body k={k} />
            </button>
          ))}
        </Snap>
      </>
    );
  }
  return (
    <>
      <div className="rhead"><span className="rstop inline" aria-hidden="true">2</span><h2 className="h3">{title}</h2></div>
      {items.map((k) => (
        <button key={k.id} type="button" className="cobj" data-testid={k.testId} onClick={k.onOpen}>
          <Art id={k.id} width={72} />
          <Body k={k} />
          <span className="go" aria-hidden="true"><Icon name="chevron_right" size={18} className="rtl:-scale-x-100" /></span>
        </button>
      ))}
    </>
  );
}
