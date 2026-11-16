/**
 * Design system v10.3 — the hour dial (N-Hard): a 24-hour clock; each mark
 * sits at the hour a hard moment the parent logged happened. The selected
 * one is ringed. Plain placement of what was recorded — no colour by value,
 * no score, no band of "bad" hours. Positions are computed in SVG user units,
 * so the drawing reads the same in both directions (a clock is not text).
 */
export type DialMark = { id: string; hour: number; minute: number };

const R = 92;
const C = 130;

function at(hour: number, minute: number, radius: number) {
  const turn = ((hour + minute / 60) / 24) * Math.PI * 2;
  return { x: C + radius * Math.sin(turn), y: C - radius * Math.cos(turn) };
}

export default function HourDial({ marks, selected, label, center, size = 260 }: {
  marks: DialMark[];
  selected?: string | null;
  /** The drawing's accessible name (the hours, in words). */
  label: string;
  /** The words at the centre ("hour of the day"). */
  center: string;
  size?: number;
}) {
  const ticks = Array.from({ length: 24 }, (_, h) => h);
  return (
    <svg className="hdial" viewBox="0 0 260 260" width={size} height={size} role="img" aria-label={label}>
      <circle cx={C} cy={C} r={R} fill="var(--card)" stroke="var(--rule-strong)" strokeWidth="6" />
      {ticks.map((h) => {
        const a = at(h, 0, R - 12);
        const b = at(h, 0, R - (h % 6 === 0 ? 22 : 17));
        return <line key={h} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--ink-soft)" strokeWidth={h % 6 === 0 ? 2 : 1} strokeLinecap="round" />;
      })}
      {[0, 6, 12, 18].map((h) => {
        const p = at(h, 0, R - 36);
        return <text key={h} x={p.x} y={p.y + 4} textAnchor="middle" className="hdial-n">{h}</text>;
      })}
      <text x={C} y={C + 4} textAnchor="middle" className="hdial-c">
        {center.split(" ").reduce<string[]>((lines, word) => {
          const last = lines[lines.length - 1];
          if (last && (last + " " + word).length <= 8) lines[lines.length - 1] = `${last} ${word}`; else lines.push(word);
          return lines;
        }, []).map((line, i, all) => <tspan key={i} x={C} dy={i === 0 ? `${-(all.length - 1) * 0.6}em` : "1.2em"}>{line}</tspan>)}
      </text>
      {marks.map((m) => {
        const p = at(m.hour, m.minute, R + 2);
        const on = m.id === selected;
        return (
          <g key={m.id} transform={`translate(${p.x} ${p.y})`}>
            {on && <circle r="17" fill="none" stroke="var(--sapphire-deep)" strokeWidth="2.5" />}
            <circle r="12" fill="var(--k-hard, var(--arbor-clay))" stroke="var(--card)" strokeWidth="2" />
            <path d="M0 5.2c-.4 0-4.6-2.8-4.6-5.6 0-1.6 1.2-2.6 2.4-2.6.9 0 1.7.5 2.2 1.2.5-.7 1.3-1.2 2.2-1.2 1.2 0 2.4 1 2.4 2.6 0 2.8-4.2 5.6-4.6 5.6z" fill="var(--card)" />
          </g>
        );
      })}
    </svg>
  );
}
