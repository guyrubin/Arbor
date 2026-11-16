import React, { useRef, useState } from "react";
import type { Composition } from "../../../design/useComposition";
import { DrawDay, DrawHelped, DrawNext, DrawWeek } from "./weekReadDrawings";
import type { WeeklyCopy } from "./weeklyCopy";

/**
 * "How to read this week" (canvas V77, N-Week-D/M; the same guide pattern as
 * Together's "How to read this page" and Talk's "How to read this answer"):
 * the page's four stops as small drawings, each with one line on how to read
 * it. Desktop: a rail beside the week. Phone: a sideways row of four cards
 * with a live "1 of 4". The drawings are decor; the captions are the text.
 * It shows no record and makes no claim about the child.
 */
export default function WeekReadGuide({ composition, copy }: { composition: Composition; copy: WeeklyCopy }) {
  const items = [
    { title: copy.stopWeek, caption: copy.readWeek, draw: <DrawWeek /> },
    { title: copy.stopHelped, caption: copy.readHelped, draw: <DrawHelped /> },
    { title: copy.stopNext, caption: copy.readNext, draw: <DrawNext /> },
    { title: copy.stopDay, caption: copy.readDay, draw: <DrawDay /> },
  ];
  const [at, setAt] = useState(0);
  const row = useRef<HTMLDivElement>(null);
  const onScroll = () => {
    const el = row.current;
    const card = el?.firstElementChild as HTMLElement | null;
    if (!el || !card) return;
    const step = card.offsetWidth + 10;
    setAt(Math.min(items.length - 1, Math.max(0, Math.round(Math.abs(el.scrollLeft) / step))));
  };

  if (composition === "phone") {
    return (
      <section className="wk10-read m" aria-labelledby="wk-read-title" data-testid="weekly-read-guide">
        <div className="rhead wk10-read-head">
          <h2 className="h3" id="wk-read-title">{copy.readTitle}</h2>
          <span className="sdots" aria-hidden="true">
            {items.map((_, i) => (
              <i key={i} className={i === at ? "on" : undefined} />
            ))}
          </span>
          <span className="small" aria-live="polite">{copy.readOf(at + 1, items.length)}</span>
        </div>
        <div className="snap ds-snap-scroll wk10-read-row" role="group" aria-label={copy.readTitle} ref={row} onScroll={onScroll}>
          {items.map((it, i) => (
            <article key={i} className="wk-gc">
              <div className="wk-gt wk10-read-draw">
                <span className="wk-gn" aria-hidden="true">{i + 1}</span>
                {it.draw}
              </div>
              <h3>{it.title}</h3>
              <p>{it.caption}</p>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <aside className="wk-gd wk10-read d" aria-labelledby="wk-read-title" data-testid="weekly-read-guide">
      <h2 className="wk10-read-title" id="wk-read-title">{copy.readTitle}</h2>
      <ol className="wk10-read-list">
        {items.map((it, i) => (
          <li key={i} className={`wk-gr${i === 0 ? " on" : ""}`}>
            <div className="wk-gt">
              <span className="wk-gn" aria-hidden="true">{i + 1}</span>
              {it.draw}
            </div>
            <div>
              <h3>{it.title}</h3>
              <p>{it.caption}</p>
            </div>
          </li>
        ))}
      </ol>
    </aside>
  );
}
