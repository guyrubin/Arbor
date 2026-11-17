import React, { useId } from "react";
import type { Composition } from "../../../design/useComposition";
import { ARC_DESK, ARC_END_HOUR, EVENING_FROM_HOUR, ARC_PHONE, ARC_START_HOUR, arcFraction, arcPath, arcPoint, clock24, quietSegments, type ArcGeometry } from "./dayArcModel";
import type { NowV10Copy } from "./nowV10Copy";

/**
 * The day arc (Objects-Graphic › Day arc) at stage size (desktop) or scene
 * size (phone). Real things only: the clock now (the sun and its label), the
 * evening band (drawn only when the family's moments fall in it) and the quiet
 * hours from Gentle reminders. `children` is laid over the arc's bowl: the
 * lead's face (its tag and title), never invented content.
 */
export default function NowDayArc({ composition, now, quietStart, quietEnd, evening, window: nudgeWindow = null, variant = "now", copy, children }: {
  composition: Composition;
  now: Date;
  quietStart: number;
  quietEnd: number;
  /** Draw the evening band (the parent has moments in it). */
  evening: boolean;
  /** Gentle reminders: the stretch nudges are held for (the parent's calmer-stretches setting over the family's own rhythm), whole hours. */
  window?: { from: number; to: number } | null;
  /** "now": the board's Now arc (hour labels 9/12/15 on desktop, no quiet words). "reminders": 6:00 / 13:30 / 21:00 and the quiet hour named inside the bowl. */
  variant?: "now" | "reminders";
  copy: NowV10Copy;
  children?: React.ReactNode;
}) {
  const gid = useId().replace(/:/g, "");
  const desk = composition === "desk";
  const g: ArcGeometry = desk ? ARC_DESK : ARC_PHONE;
  const minute = now.getHours() * 60 + now.getMinutes();
  const f = arcFraction(minute);
  const sun = arcPoint(g, f);
  const left = arcPoint(g, 0);
  const right = arcPoint(g, 1);
  const rail = arcPath(g, 0, 1);
  const quiet = quietSegments(quietStart, quietEnd);
  const eveningFrom = arcFraction(EVENING_FROM_HOUR * 60);
  const railWidth = desk ? 6 : 5;
  const hourTicks = desk ? Array.from({ length: ARC_END_HOUR - ARC_START_HOUR - 1 }, (_, i) => ARC_START_HOUR + 1 + i) : [];
  const nowLabel = copy.nowAt(clock24(minute));
  const pct = (n: number, of: number) => `${((n / of) * 100).toFixed(2)}%`;
  const labelY = g.cy + (desk ? -8 : 18);
  const quietEndLabel = quiet.find((s) => s.edge === "start");
  // The drawing (svg, sun, clock label) and the face share one grid cell: the cell is as tall as the taller of the two,
  // so whatever follows the arc never rises into the drawing, whatever the face's length or language.
  return <div className="nw-arc">
    <div className="gfx nw-arc-draw">
    <svg viewBox={`0 0 ${g.w} ${g.h}`} role="img" aria-label={copy.arcAria(clock24(ARC_START_HOUR * 60), clock24(ARC_END_HOUR * 60))}>
      <defs><linearGradient id={`sky${gid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="nw-sky-a" /><stop offset="1" className="nw-sky-b" /></linearGradient></defs>
      <path d={`${rail} Z`} fill={`url(#sky${gid})`} />
      <path className="g-tick nw-base" d={`M${left.x - (desk ? 44 : 25)} ${g.cy} H${right.x + (desk ? 44 : 25)}`} />
      <path className="g-rail" d={rail} style={{ strokeWidth: railWidth }} />
      {nudgeWindow && nudgeWindow.to > nudgeWindow.from && <path className="g-win" data-testid="arc-nudge-window" d={arcPath(g, arcFraction(nudgeWindow.from * 60), arcFraction(nudgeWindow.to * 60))} style={{ strokeWidth: desk ? 16 : 10 }} />}
      {evening && <path className="g-win" d={arcPath(g, eveningFrom, 1)} style={{ strokeWidth: desk ? 18 : 11 }} />}
      {f > 0 && <path className="g-past" d={arcPath(g, 0, f)} style={{ strokeWidth: railWidth }} />}
      {quiet.map((s) => <path key={s.edge} className="nw-quiet" d={arcPath(g, s.from, s.to)} style={{ strokeWidth: desk ? 14 : 12 }} />)}
      {hourTicks.map((h) => {
        const fr = arcFraction(h * 60);
        const a = arcPoint({ ...g, rx: g.rx + 2, ry: g.ry + 2 }, fr);
        const b = arcPoint({ ...g, rx: g.rx + (h % 3 === 0 ? 9 : 6), ry: g.ry + (h % 3 === 0 ? 9 : 6) }, fr);
        const l = arcPoint({ ...g, rx: g.rx + 30, ry: g.ry + 20 }, fr);
        return <React.Fragment key={h}>
          <path className="g-tick" d={`M${a.x.toFixed(1)} ${a.y.toFixed(1)} L${b.x.toFixed(1)} ${b.y.toFixed(1)}`} />
          {variant === "now" && h % 3 === 0 && h < EVENING_FROM_HOUR && Math.abs(h * 60 - minute) > 60 && <text className="g-hr" x={l.x.toFixed(1)} y={l.y.toFixed(1)}>{clock24(h * 60)}</text>}
        </React.Fragment>;
      })}
      <text className="g-hr" x={desk ? left.x - 30 : left.x} y={labelY}>{clock24(ARC_START_HOUR * 60)}</text>
      <text className="g-hr" x={desk ? right.x + 32 : right.x} y={labelY}>{clock24(ARC_END_HOUR * 60)}</text>
      {/* The midday mark over the top of the arc: on the phone arc, and on the reminders arc at both sizes; like every hour label, never under the clock now. */}
      {(variant === "reminders" || !desk) && Math.abs(((ARC_START_HOUR + ARC_END_HOUR) / 2) * 60 - minute) > 60 && (() => {
        const top = arcPoint(g, 0.5);
        return <text className="g-hr" x={top.x.toFixed(1)} y={(top.y - (desk ? 14 : 10)).toFixed(1)}>{clock24(((ARC_START_HOUR + ARC_END_HOUR) / 2) * 60)}</text>;
      })()}
      {/* Reminders: where the quiet stretch ends, named inside the bowl beside the segment's end, clear of the dashed band. */}
      {variant === "reminders" && quietEndLabel && quietEnd > ARC_START_HOUR && (() => {
        const p = arcPoint(g, quietEndLabel.to);
        return <text className="g-hr nw-quiet-hour" x={(p.x + (desk ? 14 : 14)).toFixed(1)} y={(p.y + (desk ? 30 : 6)).toFixed(1)}>{desk ? copy.quietUntil(clock24(quietEnd * 60)) : clock24(quietEnd * 60)}</text>;
      })()}
    </svg>
    <span className={desk ? "at sun" : "at sun sm"} style={{ left: pct(sun.x, g.w), top: pct(sun.y, g.h) }} aria-hidden="true" />
    <span className="at nowt" style={{ left: pct(sun.x, g.w), top: pct(Math.max(12, sun.y - (desk ? 44 : 34)), g.h) }}>{nowLabel}</span>
    </div>
    {children && <div className="nw-arc-face">{children}</div>}
  </div>;
}
