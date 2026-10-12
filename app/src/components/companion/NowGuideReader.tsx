import React, { useState } from "react";
import { Sheet } from "../ui/Sheet";
import Icon from "../ui/Icon";
import { Receipt } from "../ui/Receipt";
import { NOW_COPY } from "./nowViewCopy";

/**
 * FEAT-02: the guide reader. "See how to begin" on Now's guide card opens this
 * sheet instead of unfolding steps inline: How to begin, the words to try
 * (only when the guide has screened ones) and ONE "We did this" write.
 *
 * Receipt rule (B-STATUS-01): the button shows the pending label and stays
 * disabled while the write runs; the receipt appears only after the caller's
 * promise resolved, and a rejection keeps the button with an error line.
 */
export type GuideSave = "idle" | "saving" | "saved" | "failed";

/** What the reader shows. The card freezes it when the parent opens the
 *  sheet, so a snapshot that re-ranks the card cannot swap the guide mid-read. */
export interface GuideReaderContent {
  title: string;
  /** The guide's own steps, in order. */
  how: readonly string[];
  /** Household items a library activity names, if any. */
  materials?: readonly string[];
  /** Screened words to say, already locale-quoted; empty omits the section. */
  words?: string | null;
  /** A quiet closing line under the steps. */
  note?: string | null;
  /** The past-tense line shown once the write resolved. */
  receipt: string;
}

const MAX_STEPS = 3;
const WORDS_PER_MINUTE = 200;

/** A screened step as at most three readable sentences (the tail stays whole). */
export function guideSteps(text: string): string[] {
  const sentences = text.trim().split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
  if (sentences.length <= MAX_STEPS) return sentences;
  return [...sentences.slice(0, MAX_STEPS - 1), sentences.slice(MAX_STEPS - 1).join(" ")];
}

/** Minutes to read the guide's own words, rounded up, never below one. */
export function guideReadMinutes(texts: readonly (string | null | undefined)[]): number {
  const words = texts.join(" ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

/** The one write: pending first, then saved only after `onDone` resolved, or failed. */
export async function finishGuide(onDone: () => Promise<void>, setSave: (save: GuideSave) => void): Promise<void> {
  setSave("saving");
  try {
    await onDone();
  } catch {
    setSave("failed");
    return;
  }
  setSave("saved");
}

/** The reader's content for a given save state (no state of its own). */
export function GuideReaderBody({ content, lang, save, onDone }: {
  content: GuideReaderContent;
  lang: "en" | "he";
  save: GuideSave;
  onDone: () => void;
}) {
  const copy = NOW_COPY[lang];
  const words = content.words?.trim();
  const saving = save === "saving";
  return <div className="now-guide-reader" data-testid="now-guide-reader">
    <section className="now-guide-section">
      <h3>{copy.readerHow}</h3>
      {!!content.materials?.length && <p className="now-materials"><b>{copy.materials}</b> <span dir="auto">{content.materials.join(" · ")}</span></p>}
      <ol className="now-guide-steps">{content.how.map((step, index) => <li key={index}><span aria-hidden="true">{index + 1}</span><p dir="auto">{step}</p></li>)}</ol>
      {content.note && <p className="companion-caption">{content.note}</p>}
    </section>
    {words && <section className="now-guide-section" data-testid="now-guide-words">
      <h3>{copy.readerWords}</h3>
      <blockquote className="now-guide-words" dir="auto">{words}</blockquote>
    </section>}
    <div className="now-guide-done">
      {save === "saved"
        ? <Receipt testId="now-guide-receipt" icon="check_circle" tone="ink">{content.receipt}</Receipt>
        : <button type="button" className="companion-primary" data-testid="now-guide-done" disabled={saving} aria-busy={saving || undefined} onClick={onDone}><Icon name="check_circle" size={19} />{saving ? copy.saving : copy.readerDone}</button>}
      {save === "failed" && <p className="now-inline-status" role="alert" data-testid="now-guide-error">{copy.saveError}</p>}
    </div>
  </div>;
}

/** Mount only while open: the sheet portals to the document body. */
export default function NowGuideReader({ content, lang, onClose, onDone, returnFocusRef }: {
  content: GuideReaderContent;
  lang: "en" | "he";
  onClose: () => void;
  /** Resolves once the write resolved; rejects when it failed. */
  onDone: () => Promise<void>;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}) {
  const [save, setSave] = useState<GuideSave>("idle");
  const done = () => {
    if (save === "saving" || save === "saved") return;
    void finishGuide(onDone, setSave);
  };
  return <Sheet open onClose={onClose} title={content.title} returnFocusRef={returnFocusRef}>
    <GuideReaderBody content={content} lang={lang} save={save} onDone={done} />
  </Sheet>;
}
