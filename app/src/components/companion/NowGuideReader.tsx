import React, { useId } from "react";
import { Sheet } from "../ui/Sheet";
import Icon from "../ui/Icon";
import { useSheetHistory } from "../../hooks/useSheetHistory";
import { SheetBreadcrumb } from "../layout/Breadcrumb";
import { NOW_COPY } from "./nowViewCopy";

export interface NowGuideReaderProps {
  open: boolean;
  onClose: () => void;
  lang: "en" | "he";
  /** The guide's own headline: the sheet's title. */
  title: string;
  /** Where the reader sits, for its crumb. */
  crumb: string;
  /** What the step answers, when the guide says so. */
  intro?: string | null;
  how: readonly string[];
  materials?: readonly string[];
  /** The words to try, already in the locale's quote pair. */
  words?: string | null;
  note?: string | null;
  /** The screened AI step only: make it the parent's next step. A library guide is read, never written. */
  onChoose?: () => void;
  saving?: boolean;
  error?: boolean;
  onAdapt?: () => void;
}

/**
 * v3 F-NOW-1: the short reader behind the plan card's Begin — How to begin,
 * Words you could try, and (for the screened AI step only) Make this my next
 * step. It never claims a save: while the write runs the button says so, a
 * failure shows the error, and a success hands Now's lead to the chosen step
 * (which closes this sheet). It carries no primary-move stamp: Now's one
 * move is the card's Begin.
 */
export default function NowGuideReader({ open, onClose, lang, title, crumb, intro, how, materials = [], words, note, onChoose, saving = false, error = false, onAdapt }: NowGuideReaderProps) {
  const close = useSheetHistory(open, onClose);
  const id = useId();
  if (!open) return null;
  const copy = NOW_COPY[lang];
  return <Sheet open onClose={() => close()} title={title}>
    <SheetBreadcrumb label={crumb} close={close} />
    <div className="now-reader" dir={lang === "he" ? "rtl" : "ltr"} data-testid="now-guide-reader">
      {intro && <p className="now-reader-intro" dir="auto">{intro}</p>}
      {how.length > 0 && <section className="now-reader-section" aria-labelledby={`${id}-how`}>
        <h3 id={`${id}-how`}>{copy.steps}</h3>
        <ol className="now-reader-steps">{how.map((line, index) => <li key={index}><span aria-hidden="true">{index + 1}</span><p dir="auto">{line}</p></li>)}</ol>
        {materials.length > 0 && <p className="now-reader-materials"><b>{copy.materials}</b> <span dir="auto">{materials.join(" · ")}</span></p>}
      </section>}
      {words && <section className="now-reader-section" aria-labelledby={`${id}-words`}>
        <h3 id={`${id}-words`}>{copy.say}</h3>
        <blockquote className="now-reader-words" dir="auto">{words}</blockquote>
      </section>}
      {note && <p className="now-reader-note">{note}</p>}
      <div className="now-reader-actions">
        {onChoose
          ? <button type="button" className="companion-primary" disabled={saving} aria-busy={saving} onClick={onChoose}><Icon name="bookmark_add" size={19} />{saving ? copy.saving : copy.choose}</button>
          : <button type="button" className="companion-primary" onClick={() => close()}>{copy.close}</button>}
        {onAdapt && <button type="button" className="companion-text-button" onClick={() => close(onAdapt)}>{copy.adapt}<Icon name="chat_bubble" size={17} /></button>}
      </div>
      {error && <p className="now-inline-status" role="alert">{copy.saveError}</p>}
    </div>
  </Sheet>;
}
