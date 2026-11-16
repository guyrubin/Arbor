import React from "react";
import { Icon } from "../components/ui/Icon";
import type { Composition } from "./useComposition";

/**
 * Design system v10.1 primitives. Each renders the canvas class it is named
 * after (src/design/ds.css), so a screen reads like its board: one shape means
 * one thing on every screen and a parent learns it once.
 *
 * Firewall (DESIGN.md "Counts, never verdicts"): these draw counts of what a
 * parent recorded or what an adult planned. None takes a score, a level or a
 * percentage about a child, and none colours a record good or bad.
 */

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

/* ── the root ──────────────────────────────────────────────────────────────── */

/** The `.ds` scope: v10 classes only apply inside it. `composition` adds the
 *  board root class (`ds-desk` / `ds-phone`) a screen's own stylesheet keys on. */
export function DsRoot({ composition, className, children, ...rest }: React.HTMLAttributes<HTMLDivElement> & { composition?: Composition }) {
  return (
    <div {...rest} className={cx("ds", composition && `ds-${composition}`, className)} data-composition={composition}>
      {children}
    </div>
  );
}

/* ── tokens, piles, figures ────────────────────────────────────────────────── */

/** One record is one token; its shape and colour say what kind. */
export type TokenKind = "moment" | "hard" | "stp" | "plan" | "kid" | "date" | "neutral";
/** solid = recorded or done · open = an adult thing not yet done · none = nobody
 *  has it yet · here = today, where you are · ai = Arbor suggests (pencil). */
export type TokenState = "solid" | "open" | "none" | "here" | "ai";
export type TokenSize = "sm" | "md" | "base" | "lg" | "xl";

export function Token({
  kind = "moment",
  state = "solid",
  size = "base",
  isNew = false,
  label,
  children,
  className,
  style,
}: {
  kind?: TokenKind;
  state?: TokenState;
  size?: TokenSize;
  /** The latest one, ringed. */
  isNew?: boolean;
  /** Read by assistive tech: what this one record is ("moment you kept"). */
  label: string;
  /** A date token's day number. */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <i
      role="img"
      aria-label={label}
      className={cx(
        "tok",
        kind !== "neutral" && kind,
        state !== "solid" && state,
        size !== "base" && size,
        isNew && "new",
        className,
      )}
      style={style}
    >
      {children}
    </i>
  );
}

/** Tokens stack up from a baseline, so an amount is a shape before it is a number. */
export function Pile({ layout = "column", children, className }: { layout?: "column" | "rows" | "line"; children: React.ReactNode; className?: string }) {
  return <span className={cx("pile", layout !== "column" && layout, className)}>{children}</span>;
}

/** A numeral big enough to be a graphic, always with its unit in words. */
export function Fig({
  n,
  unit,
  sub,
  size = "base",
  className,
  style,
}: {
  n: number | string;
  unit: React.ReactNode;
  sub?: React.ReactNode;
  size?: "sm" | "md" | "base" | "xl";
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={cx("fig", size !== "base" && size, className)} style={style}>
      <b>{n}</b>
      <span>
        {unit}
        {sub != null && sub !== "" && <small>{sub}</small>}
      </span>
    </div>
  );
}

/** The legend line under any drawing of a child's record. */
export function TokenLegend({ items, className }: { items: Array<{ token: React.ReactNode; label: React.ReactNode }>; className?: string }) {
  return (
    <div className={cx("tleg", className)}>
      {items.map((it, i) => (
        <span key={i}>
          {it.token}
          {it.label}
        </span>
      ))}
    </div>
  );
}

/* ── the guide and the route ───────────────────────────────────────────────── */

export type GuideStop = { id: string; title: React.ReactNode; sub?: React.ReactNode };

/** Scroll a numbered section into view inside the app's scrolling <main>. */
export function scrollToSection(id: string) {
  const el = typeof document !== "undefined" ? document.getElementById(id) : null;
  el?.scrollIntoView?.({ behavior: "smooth", block: "start" });
}

/**
 * The guide: numbered stops that match the numbered sections below, top to
 * bottom. `mini` is the phone strip (scrolls sideways, the same names).
 */
export function Guide({
  stops,
  current = 0,
  mini = false,
  label,
  className,
}: {
  stops: GuideStop[];
  current?: number;
  mini?: boolean;
  /** "On this page", in the reader's language. */
  label: string;
  className?: string;
}) {
  return (
    <nav className={cx("guide", mini && "mini ds-guide-scroll", className)} aria-label={label}>
      {stops.map((s, i) => (
        <React.Fragment key={s.id}>
          {i > 0 && <span className="gline" aria-hidden="true" />}
          <a
            className={cx("gstop", i === current && "on")}
            href={`#${s.id}`}
            aria-current={i === current ? "step" : undefined}
            onClick={(e) => {
              e.preventDefault();
              scrollToSection(s.id);
            }}
          >
            <span className={cx("gnum", i !== current && "soft")}>{i + 1}</span>
            <span>
              {s.title}
              {!mini && s.sub != null && (
                <span className="small" style={{ display: "block" }}>
                  {s.sub}
                </span>
              )}
            </span>
          </a>
        </React.Fragment>
      ))}
    </nav>
  );
}

/** The guide's numbers again, as stops on a dotted line down the gutter. */
export function Route({ composition, tight, children, className }: { composition: Composition; tight?: boolean; children: React.ReactNode; className?: string }) {
  return <div className={cx("route", composition === "desk" ? "gut" : "m", tight && "tight", className)}>{children}</div>;
}

export function RouteSection({
  id,
  n,
  on = false,
  stop = true,
  stopTop = 14,
  children,
  className,
  "aria-labelledby": labelledBy,
}: {
  id: string;
  n: number;
  on?: boolean;
  /** false when the stop sits inline in a heading instead (the rail). */
  stop?: boolean;
  stopTop?: number;
  children: React.ReactNode;
  className?: string;
  "aria-labelledby"?: string;
}) {
  return (
    <section className={cx("rsec", className)} id={id} aria-labelledby={labelledBy}>
      {stop && (
        <span className={cx("rstop", on && "on")} style={{ top: stopTop }} aria-hidden="true">
          {n}
        </span>
      )}
      {children}
    </section>
  );
}

/** A numbered section heading: the stop, a display title, a count, a link. */
export function RouteHead({ id, title, sub, link }: { id?: string; title: React.ReactNode; sub?: React.ReactNode; link?: React.ReactNode }) {
  return (
    <div className="rhead">
      <h2 className="h3" id={id}>
        {title}
      </h2>
      {sub != null && <span className="small">{sub}</span>}
      {link}
    </div>
  );
}

/** The 12-column row of the desktop composition (20 px gap). */
export function Row12({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={cx("g12", className)} style={style}>
      {children}
    </div>
  );
}

/* ── scene, tiles, rail, snap, note ────────────────────────────────────────── */

/** The five scene fields: one light ground per place, two soft orbs. Page content only, never the shell. */
export type SceneField = "now" | "child" | "together" | "care" | "plan";

export type Orb = { size: number; left?: number; right?: number; top?: number; bottom?: number; opacity?: number; b?: boolean };

export function Scene({
  field,
  orbs = [],
  children,
  className,
  style,
  as: Tag = "div",
  ...rest
}: {
  field: SceneField;
  orbs?: Orb[];
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  as?: "div" | "section";
} & Omit<React.HTMLAttributes<HTMLElement>, "className" | "style" | "children">) {
  return (
    <Tag {...rest} className={cx("scene", field, className)} style={style}>
      {orbs.map((o, i) => (
        <i
          key={i}
          aria-hidden="true"
          className={cx("orb", o.b && "b")}
          style={{ width: o.size, height: o.size, left: o.left, right: o.right, top: o.top, bottom: o.bottom, opacity: o.opacity }}
        />
      ))}
      {children}
    </Tag>
  );
}

/** A tile's glyph chip, coloured by kind. */
export function GlyphChip({ icon, kind }: { icon: string; kind?: "plan" | "hard" | "step" | "kid" | "date" }) {
  return (
    <span className={cx("gi", kind)} aria-hidden="true">
      <Icon name={icon} size={16} />
    </span>
  );
}

/** A small text link with a trailing chevron (mirrors in RTL). */
export function MoreLink({ children, onClick, href, className, style, "aria-label": ariaLabel }: { children: React.ReactNode; onClick?: () => void; href?: string; className?: string; style?: React.CSSProperties; "aria-label"?: string }) {
  const body = (
    <>
      {children}
      <Icon name="chevron_right" size={16} className="rtl:-scale-x-100" />
    </>
  );
  return onClick ? (
    <button type="button" className={cx("ds-link", className)} onClick={onClick} style={style} aria-label={ariaLabel}>
      {body}
    </button>
  ) : (
    <a className={cx("ds-link", className)} href={href} style={style} aria-label={ariaLabel}>
      {body}
    </a>
  );
}

/** The v10 tile: head (glyph, name, one link), figure, picture, one sentence. */
export function Tile({
  icon,
  kind,
  title,
  sub,
  link,
  children,
  className,
  tint,
  style,
  titleId,
  as: Tag = "section",
}: {
  icon?: string;
  kind?: "plan" | "hard" | "step" | "kid" | "date";
  title: React.ReactNode;
  sub?: React.ReactNode;
  link?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  tint?: boolean;
  style?: React.CSSProperties;
  titleId?: string;
  as?: "section" | "div";
}) {
  return (
    <Tag className={cx("vt", tint && "tint", className)} style={style} aria-labelledby={titleId}>
      <div className="vh">
        {icon && <GlyphChip icon={icon} kind={kind} />}
        <h3 className="h3" id={titleId}>
          {title}
        </h3>
        {sub != null && <span className="small">{sub}</span>}
        {link}
      </div>
      {children}
    </Tag>
  );
}

/** The rail: the screen's second question as compact objects, as tall as the stage. */
export function SideRail({ id, n, title, sub, children, className, titleId }: { id?: string; n?: number; title: React.ReactNode; sub?: React.ReactNode; children: React.ReactNode; className?: string; titleId?: string }) {
  return (
    <aside className={cx("siderail cards", className)} id={id} aria-labelledby={titleId}>
      <div className="rh">
        {n != null && (
          <span className="rstop inline" aria-hidden="true">
            {n}
          </span>
        )}
        <h2 className="h3" id={titleId}>
          {title}
        </h2>
        {sub != null && <span className="small">{sub}</span>}
      </div>
      {children}
    </aside>
  );
}

/** The phone's snap row: cards 286 px wide, the next one peeking. Scrolls sideways. */
export function Snap({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cx("snap ds-snap-scroll", className)} role="group" aria-label={label}>
      {children}
    </div>
  );
}

export function SnapDots({ count, on = 0, caption }: { count: number; on?: number; caption?: React.ReactNode }) {
  return (
    <div className="sdots" aria-hidden={caption == null ? true : undefined}>
      {Array.from({ length: count }, (_, i) => (
        <i key={i} className={i === on ? "on" : undefined} />
      ))}
      {caption != null && <span>{caption}</span>}
    </div>
  );
}

/** "Worth knowing": the warm note. One per screen, from a reviewed source. */
export function Know({ kicker, children, link, art, className, style }: { kicker: React.ReactNode; children: React.ReactNode; link?: React.ReactNode; art?: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={cx("know", className)} style={style}>
      {art}
      <span className="kicker">{kicker}</span>
      <p className="lead">{children}</p>
      {link}
    </div>
  );
}

/**
 * Production's Living Forms art, cropped (identity, never data: "Decorative
 * only: never evidence about a child. Family photos take priority.").
 * The crop prop places the source image inside the frame, as the boards do.
 */
export function LivingForm({
  src,
  srcSet,
  width,
  height,
  crop,
  className,
  style,
}: {
  src: string;
  srcSet?: string;
  width: number;
  height: number;
  crop?: { w: number; h: number; x: number; y: number };
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span className={cx("lform", className)} style={{ width, height, ...style }} aria-hidden="true">
      <img
        src={src}
        srcSet={srcSet}
        alt=""
        loading="lazy"
        decoding="async"
        style={crop ? { width: crop.w, height: crop.h, margin: `${crop.y}px 0 0 ${crop.x}px` } : { width: "100%", height: "100%", objectFit: "cover" }}
      />
    </span>
  );
}

/** The dashed "New" tag: the only status a parent sees in the product. */
export function NewTag({ children }: { children: React.ReactNode }) {
  return <span className="st new ds-newtag">{children}</span>;
}

/** "Start here" beside stop 1. */
export function StartHere({ children }: { children: React.ReactNode }) {
  return <span className="next1">{children}</span>;
}

/* ── Arbor's pencil ────────────────────────────────────────────────────────── */

/** Arbor suggests: dashed sapphire, pencil glyph, until a parent keeps it. */
export function PencilChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="ds-pencil">
      <Icon name="edit" size={14} />
      {children}
    </span>
  );
}

/** You wrote this: solid ink, the parent's initial. */
export function InkChip({ initial, children }: { initial?: string; children: React.ReactNode }) {
  return (
    <span className="ds-ink">
      {initial && <span className="av sm ds-ink-av">{initial}</span>}
      {children}
    </span>
  );
}
