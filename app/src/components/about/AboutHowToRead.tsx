import React from "react";
import { useLanguage } from "../../context/LanguageContext";
import { GlyphChip, Token } from "../../design/primitives";
import { aboutCopy } from "./aboutViewCopy";

/**
 * v10.3 — "How to read this page": the page drawn small, as its three numbered
 * stops (pick an area, answer what waits, edit what you told), then the key
 * of the two marks the page uses. The drawings are decoration; the words carry
 * the meaning.
 */
export default function AboutHowToRead({ compact }: { compact?: boolean }) {
  const { uiLang } = useLanguage();
  const copy = aboutCopy(uiLang);
  const key = (
    <div className="key3">
      <span><Token kind="neutral" className="told" size="sm" label={copy.tokenToldOne} />{copy.tokenToldShort}</span>
      <span><Token kind="neutral" state="ai" size="sm" label={copy.tokenWaitingOne} />{copy.tokenWaitingShort}</span>
    </div>
  );
  const rows: Array<{ label: string; drawing: React.ReactNode }> = [
    { label: copy.readPick, drawing: <>{Array.from({ length: 8 }, (_, i) => <i key={i} className={`c8${i === 3 ? " on" : ""}`} />)}</> },
    { label: copy.readAnswer, drawing: <span className="cd ai"><s /><u><i /><i /></u></span> },
    { label: copy.readEdit, drawing: <span className="cd"><s /><u><i /><i /><i /></u></span> },
  ];
  return (
    <section className="vt about-read" aria-labelledby="about-read-title">
      <div className="vh"><GlyphChip icon="grid_view" /><h3 className="h3" id="about-read-title">{copy.howToRead}</h3></div>
      <div className={`mcg${compact ? " about-read-m" : ""}`}>
        <ol className="about-read-rows">
          {rows.map((row, i) => (
            <li key={row.label} className="mgr">
              <span className="mgn" aria-hidden="true">{i + 1}</span>
              <span className="mgd" aria-hidden="true">{row.drawing}</span>
              <span className="mgl">{row.label}</span>
            </li>
          ))}
        </ol>
        {key}
      </div>
    </section>
  );
}
