import type { ReactNode } from "react";
import { Icon } from "../../ui/Icon";

/**
 * Design system v10.3 — the My child frame (Moments, Hard moments, Things
 * <name> said): one header band, one index row, one stage and a rail, one
 * drawn guide. Calm: one accent (sapphire), neutral tiles, no area or kind
 * colour washes. Ported from the N-Moments / N-Hard / N-Said boards
 * (classes .mch .mci .mcap .mcst .mcg .mcc, scoped in mychild.css).
 */

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

/** The band's head: kicker (with Start here), the page's one h1, one line,
 *  and on the other side the switch, one action and one figure. */
export function FrameHead({ phone, kicker, startHere, title, sub, switcher, action, figure }: {
  phone: boolean;
  kicker: ReactNode;
  startHere: string;
  title: ReactNode;
  sub?: ReactNode;
  switcher?: ReactNode;
  action?: ReactNode;
  figure?: ReactNode;
}) {
  if (phone) {
    return (
      <div className="mch m">
        <div className="line between" style={{ alignItems: "center", gap: 8 }}>
          <span className="kicker">{kicker}</span>
          <span className="next1">{startHere}</span>
        </div>
        <div className="mcl">
          <h1 className="hero">{title}</h1>
          {sub && <p dir="auto">{sub}</p>}
        </div>
        {(figure || action) && <div className="mcf">{figure}{action}</div>}
        {switcher && <div className="mscroll">{switcher}</div>}
      </div>
    );
  }
  return (
    <div className="mch">
      <div className="mcl">
        <span className="gsec"><span className="kicker">{kicker}</span><span className="next1">{startHere}</span></span>
        <h1 className="hero">{title}</h1>
        {sub && <p dir="auto">{sub}</p>}
      </div>
      {(switcher || action || figure) && (
        <div className="mcr">
          {switcher}
          {(action || figure) && <div className="mcf">{action}{figure}</div>}
        </div>
      )}
    </div>
  );
}

/** A figure with its unit in words (never a score). */
export function FrameFigure({ n, unit, sub }: { n: number; unit: ReactNode; sub?: ReactNode }) {
  return (
    <div className="fig md">
      <b className="arbor-num">{n}</b>
      <span>{unit}{sub != null && sub !== "" && <small>{sub}</small>}</span>
    </div>
  );
}

export type IndexItem = {
  id: string;
  icon: string;
  name: ReactNode;
  meta?: ReactNode;
  /** A count (or a clock time) at the tile's corner; absent when there is none. */
  figure?: ReactNode;
  on?: boolean;
  quiet?: boolean;
  onOpen: () => void;
  testId?: string;
  attrs?: Record<string, string>;
};

/** The index row: one equal segment per entry; the selected one drives the stage. */
export function IndexRow({ phone, label, items, figureClass }: { phone: boolean; label: string; items: IndexItem[]; figureClass?: string }) {
  return (
    <div className="mkw">
      <div className={cx("mci", phone && "m")} style={{ ["--n" as string]: String(items.length) }} role="group" aria-label={label}>
        {items.map((it) => (
          <button key={it.id} type="button" {...it.attrs} data-testid={it.testId} className={cx("mcs", it.on && "on", it.quiet && "quiet")} aria-pressed={!!it.on} onClick={it.onOpen}>
            <span className="mct">
              <i className="tg" aria-hidden="true"><Icon name={it.icon} size={16} /></i>
              {it.figure != null && <b className={cx("arbor-num", figureClass)}>{it.figure}</b>}
            </span>
            <span className="mcn" dir="auto">{it.name}</span>
            {it.meta && <span className="mcm" dir="auto">{it.meta}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The stage card: a sapphire glyph, a display title and one control on the end. */
export function StageCard({ icon, title, end, children, className, id }: { icon: string; title: ReactNode; end?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={cx("mcst", className)} id={id}>
      <div className="mcsh">
        <i className="tg" aria-hidden="true"><Icon name={icon} size={20} /></i>
        <h2 className="tt">{title}</h2>
        {end && <span className="mr">{end}</span>}
      </div>
      {children}
    </section>
  );
}

/** A rail tile: glyph, a heading, an optional link at the end. */
export function RailTile({ icon, title, link, children, className, style }: { icon: string; title: ReactNode; link?: ReactNode; children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <section className={cx("vt", className)} style={style}>
      <div className="vh">
        <span className="gi" aria-hidden="true"><Icon name={icon} size={16} /></span>
        <h3 className="h3">{title}</h3>
        {link}
      </div>
      {children}
    </section>
  );
}

/** One row of the rail's link list (a real button, chevron mirrored in RTL). */
export function RowLink({ icon, label, onOpen, testId }: { icon: string; label: ReactNode; onOpen: () => void; testId?: string }) {
  return (
    <button type="button" className="rowlink" data-testid={testId} onClick={onOpen}>
      <span className="gi" aria-hidden="true"><Icon name={icon} size={16} /></span>
      <span><b>{label}</b></span>
      <Icon name="chevron_right" size={18} className="rtl:-scale-x-100" />
    </button>
  );
}

/** The drawn guide's three stops; each picture is a tiny drawing of that part of the page. */
export type GuideStep = { drawing: ReactNode; label: ReactNode };

export function ReadGuide({ phone, steps, keyItems }: { phone: boolean; steps: GuideStep[]; keyItems: { mark: ReactNode; label: ReactNode }[] }) {
  return (
    <div className="mcg">
      {phone ? (
        <div className="mgc">
          {steps.map((s, i) => (
            <div key={i}>
              <span className="mgd gd" aria-hidden="true">{s.drawing}</span>
              <span className="mgl"><span className="mgn" aria-hidden="true">{i + 1}</span>{s.label}</span>
            </div>
          ))}
        </div>
      ) : steps.map((s, i) => (
        <div key={i} className="mgr">
          <span className="mgn" aria-hidden="true">{i + 1}</span>
          <span className="mgd" aria-hidden="true">{s.drawing}</span>
          <span className="mgl">{s.label}</span>
        </div>
      ))}
      <div className="key3">
        {keyItems.map((k, i) => <span key={i}>{k.mark}{k.label}</span>)}
      </div>
    </div>
  );
}

/** Drawings for the guide (decor only; aria-hidden by ReadGuide). */
export const Draw = {
  /** A row of segments with the first one picked. */
  pick: (n = 4) => <>{Array.from({ length: n }, (_, i) => <i key={i} className={cx("c8", i === 0 && "on")} />)}</>,
  /** A small grid with a few marked cells. */
  grid: (mark: ReactNode) => (
    <span className="dgrid">
      {[0, 1, 1, 0, 0, 1].map((m, i) => <span key={i} className={m ? "dg on" : "dg"}>{m ? mark : null}</span>)}
    </span>
  ),
  /** Two cards with lines (the rail's objects). */
  cards: () => <>{[0, 1].map((i) => <span key={i} className="cd"><s /><u><i /><i /><i /></u></span>)}</>,
  /** Lines with dots (a list). */
  list: () => <span className="dlist">{[0, 1, 2].map((i) => <span key={i}><i /><s /></span>)}</span>,
};
