import React from "react";
import { Token } from "../../design/primitives";
import type { ProgramWeekRow } from "../../lib/programPage";
import type { ForYouCopy } from "./forYouCopy";

/**
 * The program's stepping stones (N-ForYou "OBJECT: stepping stones"): one
 * stone per program week on a gentle arch, the path walked so far darker,
 * this week ringed under a "This week" pin. Weeks are the program's own
 * calendar (an adult's plan), never a measure of the child.
 */
const VB_W = 500;
const VB_H = 96;
const X0 = 25;
const X1 = 475;
const BASE = 63.4;
const RISE = 30.8;

const yAt = (t: number) => BASE - RISE * Math.sin(Math.PI * t);
const pathTo = (tEnd: number) => {
  const steps = Math.max(2, Math.round(100 * tEnd));
  const pts: string[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * tEnd;
    pts.push(`${(X0 + (X1 - X0) * t).toFixed(1)} ${yAt(t).toFixed(1)}`);
  }
  return `M${pts.join(" L")}`;
};

export function ProgramStones({ rows, copy }: { rows: readonly ProgramWeekRow[]; copy: ForYouCopy }) {
  const n = rows.length;
  if (n < 2) return null;
  const current = rows.findIndex((r) => r.state === "current");
  const walked = current > 0 ? current / (n - 1) : 0;
  const total = n;
  const label = current >= 0 ? copy.weekOf(rows[current].n, total) : undefined;
  return (
    <div className="gfx">
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} role="img" aria-label={label}>
        <path className="g-stone" d={pathTo(1)} style={{ strokeWidth: 20 }} />
        {walked > 0 && <path className="g-stone done" d={pathTo(walked)} style={{ strokeWidth: 20 }} />}
        <path className="g-mid" d={pathTo(1)} />
      </svg>
      {rows.map((r, i) => {
        const t = i / (n - 1);
        const left = `${(((X0 + (X1 - X0) * t) / VB_W) * 100).toFixed(2)}%`;
        const topPct = (yAt(t) / VB_H) * 100;
        const state = r.state === "done" ? "solid" : r.state === "current" ? "here" : "open";
        const aria = r.state === "done" ? copy.weekDone(r.n) : r.state === "current" ? copy.weekNow(r.n) : copy.weekAhead(r.n);
        return (
          <React.Fragment key={r.n}>
            <Token kind="plan" state={state} label={aria} className="at" style={{ left, top: `${topPct.toFixed(2)}%` }} />
            {r.state === "current" && (
              <span className="at pin" style={{ left, top: `${(topPct - 39.6).toFixed(2)}%` }} aria-hidden="true">
                <b>{copy.programPin}</b>
                <i />
              </span>
            )}
            <span className="cl c" style={{ left, top: `${(topPct + 20.8).toFixed(2)}%`, color: "var(--muted)" }} aria-hidden="true">
              {r.n}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}
