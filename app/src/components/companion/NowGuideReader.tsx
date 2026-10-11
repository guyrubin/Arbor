import React, { createContext, useContext, useMemo, useState, useSyncExternalStore } from "react";
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
 *
 * The reader's state lives in a guide store owned ABOVE Now's lead switch
 * (NowGuideHost in NowView): once an AI guide becomes the chosen step, the step
 * lead replaces the card that opened the reader, and the sheet, its saving
 * state, its receipt and its error stay put.
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

/** One opened guide: what it shows and the ONE write "We did this" makes. */
export interface GuideRequest {
  content: GuideReaderContent;
  /** Resolves once the write is kept; rejects when it failed. */
  write: () => Promise<unknown>;
  /** The control that opened the reader, for focus on close while it is still on the page. */
  opener?: () => HTMLElement | null;
}

export interface GuideSnapshot {
  request: GuideRequest | null;
  save: GuideSave;
  /** Bumps on every open, so a late result never lands on a newer guide. */
  openId: number;
}

export interface GuideStore {
  getSnapshot: () => GuideSnapshot;
  subscribe: (listener: () => void) => () => void;
  open: (request: GuideRequest) => void;
  close: () => void;
  /** Runs the open guide's write once (no-op while saving or after it saved). */
  done: () => Promise<void>;
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

/** The open guide and its save state, outside any card's lifetime. */
export function createGuideStore(): GuideStore {
  let snapshot: GuideSnapshot = { request: null, save: "idle", openId: 0 };
  const listeners = new Set<() => void>();
  const publish = (next: GuideSnapshot) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    open: (request) => publish({ request, save: "idle", openId: snapshot.openId + 1 }),
    close: () => { if (snapshot.request) publish({ request: null, save: "idle", openId: snapshot.openId }); },
    done: () => {
      const { request, save, openId } = snapshot;
      if (!request || save === "saving" || save === "saved") return Promise.resolve();
      return finishGuide(async () => { await request.write(); }, (next) => {
        // A guide closed or replaced meanwhile keeps its own state.
        if (snapshot.openId === openId && snapshot.request === request) publish({ ...snapshot, save: next });
      });
    },
  };
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
      <h3>{copy.steps}</h3>
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

/** The sheet itself; mount only while open (it portals to the document body). */
export default function NowGuideReader({ content, lang, save, onClose, onDone, returnFocusRef }: {
  content: GuideReaderContent;
  lang: "en" | "he";
  save: GuideSave;
  onClose: () => void;
  onDone: () => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}) {
  return <Sheet open onClose={onClose} title={content.title} returnFocusRef={returnFocusRef}>
    <GuideReaderBody content={content} lang={lang} save={save} onDone={onDone} />
  </Sheet>;
}

/** Shows a store's open guide. Focus returns to the opener while it is on the
 *  page; when the lead changed under the sheet, to Now's one primary move. */
export function NowGuideSheet({ store, lang }: { store: GuideStore; lang: "en" | "he" }) {
  const { request, save, openId } = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const returnFocusRef = useMemo<React.RefObject<HTMLElement | null>>(() => ({
    get current() {
      const opener = request?.opener?.() ?? null;
      if (opener?.isConnected) return opener;
      return typeof document === "undefined" ? null : document.querySelector<HTMLElement>(".now-page [data-primary-move]");
    },
  }), [request]);
  if (!request) return null;
  return <NowGuideReader key={openId} content={request.content} lang={lang} save={save} onClose={store.close} onDone={() => void store.done()} returnFocusRef={returnFocusRef} />;
}

const GuideHostContext = createContext<GuideStore | null>(null);

/** Owns Now's guide reader above the lead switch (NowView wraps its page). */
export function NowGuideHost({ lang, children }: { lang: "en" | "he"; children: React.ReactNode }) {
  const [store] = useState(createGuideStore);
  return <GuideHostContext.Provider value={store}>
    {children}
    <NowGuideSheet store={store} lang={lang} />
  </GuideHostContext.Provider>;
}

/** The host's guide store, or null outside NowGuideHost. */
export function useNowGuideHost(): GuideStore | null {
  return useContext(GuideHostContext);
}
