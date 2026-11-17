import React from "react";
import { useLanguage } from "../../context/LanguageContext";
import { Token } from "../../design/primitives";
import { Icon } from "../ui/Icon";
import { NOTICE_ANSWER_KEYS } from "../loop/NoticeCard";
import { milestonesV10Copy } from "./milestonesV10Copy";

/**
 * v10.1 — "How to read this page" on My child › Milestones: the page's three
 * steps as small drawings (the index with one area lit, a dated line, two
 * cards to mark) and the three marks the page uses (Seen it, Arbor suggests,
 * today). Drawings are decor (aria-hidden); the step names are the text. It
 * shows no record and counts nothing.
 */
export default function MilestonesReadGuide({ steps = "map", suggests = true }: { steps?: "map" | "list"; suggests?: boolean }) {
  const { t, uiLang } = useLanguage();
  const copy = milestonesV10Copy(uiLang);
  const seenIt = t(NOTICE_ANSWER_KEYS.yes);
  const cells = <span className="gd8" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <i key={i} className={i === 0 ? "on" : undefined} />)}</span>;
  const axis = <span className="gdx" aria-hidden="true">{Array.from({ length: 4 }, (_, i) => <i key={i} />)}</span>;
  const cards = <span className="gdc" aria-hidden="true"><i /><i /></span>;
  const rows = steps === "map"
    ? [{ draw: cells, label: copy.readPick }, { draw: axis, label: copy.readDates }, { draw: cards, label: copy.readMark }]
    : [{ draw: cells, label: copy.readPick }, { draw: cards, label: copy.readMarkEach }, { draw: <span className="gd8 gdw" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <i key={i} />)}</span>, label: copy.readCheckWhole }];
  return (
    <section className="mcc mcg" aria-labelledby="ms-read-title" data-testid="ms-read-guide">
      <div className="ch">
        <span className="tg" aria-hidden="true"><Icon name="grid_view" size={15} /></span>
        <h2 className="mcg-t" id="ms-read-title">{copy.readTitle}</h2>
      </div>
      <ol className="mgl-list">
        {rows.map((row, i) => (
          <li key={i} className="mgr">
            <span className="mgn" aria-hidden="true">{i + 1}</span>
            {row.draw}
            <span className="mgl">{row.label}</span>
          </li>
        ))}
      </ol>
      <p className="key3">
        <span><span aria-hidden="true"><Token kind="moment" size="sm" label={seenIt} /></span>{seenIt}</span>
        {steps === "list" && <span data-testid="ms-read-key-next"><span aria-hidden="true"><Token kind="moment" state="ai" size="sm" label={copy.nextToNotice} /></span>{copy.nextToNotice}</span>}
        {suggests && steps === "map" && <span data-testid="ms-read-key-suggests"><span aria-hidden="true"><Token kind="moment" state="ai" size="sm" label={copy.arborSuggests} /></span>{copy.arborSuggests}</span>}
        {steps === "map" && <span><i className="ms-key-today" aria-hidden="true" />{copy.today}</span>}
      </p>
    </section>
  );
}
