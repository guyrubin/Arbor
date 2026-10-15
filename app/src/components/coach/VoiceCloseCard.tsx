import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDialog } from "../../hooks/useDialog";
import { isActive, speakText, stopVoice, subscribeVoice } from "../../lib/voice";
import type { ConversationProposal } from "../../lib/conversationProposals";

export const VOICE_CLOSE_COPY = {
  en: {
    title: "Before we finish", pending: "Preparing your drafts…", failed: "Some drafts could not be prepared. You can still review the ones below.",
    note: "Only the lines you confirm are added to your child’s record. Your conversation stays in History.",
    empty: "There are no new drafts to keep.", discard: "Don’t keep these drafts", done: "Done",
    journal: "Journal", milestone: "Milestones", intro: "Review before keeping:",
    stop: "Stop readback", audioFailed: "Readback could not play. You can read the drafts below or try Read aloud.",
  },
  he: {
    title: "לפני שמסיימים", pending: "מכינים את הטיוטות…", failed: "לא הצלחנו להכין חלק מהטיוטות. עדיין אפשר לבדוק את הטיוטות שמופיעות כאן.",
    note: "רק שורות שאישרתם יתווספו לרשומות של הילד. השיחה נשארת בהיסטוריה.",
    empty: "אין טיוטות חדשות לשמירה.", discard: "לא לשמור את הטיוטות האלה", done: "סיום",
    journal: "יומן", milestone: "אבני דרך", intro: "לבדיקה לפני השמירה:",
    stop: "עצירת ההקראה", audioFailed: "לא הצלחנו להשמיע את ההקראה. אפשר לקרוא את הטיוטות למטה או לנסות שוב את כפתור ההקראה.",
  },
} as const;

/** These destinations mirror commitConversationProposal: every non-milestone
 * proposal is a Journal row. Do not advertise a packet or plan write. */
export function voiceReadback(proposals: ConversationProposal[], language: "en" | "he") {
  const copy = VOICE_CLOSE_COPY[language];
  return proposals.length ? `${copy.intro} ${proposals.map(p => `${p.target === "milestone" ? copy.milestone : copy.journal}: ${p.summary}`).join("\n")}` : copy.empty;
}

/** Review uses the existing screened drafts and explicit commit controls. It
 * performs no generation, extraction, storage, or automatic confirmation. */
export default function VoiceCloseCard({ sessionId, proposals, language, pending, failed, busy, onClose, children }: {
  sessionId: string; proposals: ConversationProposal[]; language: "en" | "he";
  pending: boolean; failed: boolean; busy: boolean; onClose: () => void; children: React.ReactNode;
}) {
  const copy = VOICE_CLOSE_COPY[language];
  const { ref: dialogRef, requestClose, onBackdropClick } = useDialog<HTMLElement>({ open: true, onClose: () => { if (!busy) onClose(); } });
  const spoken = useRef<string | null>(null);
  const utterance = useRef<number | null>(null);
  const cancelReadback = useRef<() => void>(() => {});
  const [reading, setReading] = useState(false);
  const [audioFailed, setAudioFailed] = useState(false);
  const readback = voiceReadback(proposals, language);
  useEffect(() => {
    if (pending || spoken.current === sessionId) return;
    let cancelled = false;
    const chunks = proposals.length
      ? proposals.map(p => ({ text: voiceReadback([p], p.sourceLanguage), language: p.sourceLanguage }))
      : [{ text: readback, language }];
    let index = 0;
    const next = () => {
      if (cancelled) return;
      if (index >= chunks.length) { setReading(false); return; }
      const chunk = chunks[index++];
      utterance.current = speakText(chunk.text, {
        onEnd: next,
        onError: () => { if (!cancelled) { setReading(false); setAudioFailed(true); } },
      }, chunk.language);
      setReading(!!utterance.current && isActive(utterance.current));
    };
    // The parent started this spoken session. Continue its readback once;
    // later edits are only spoken on the explicit Read aloud control.
    // Defer only the automatic continuation so StrictMode's setup/cleanup
    // probe cannot consume the once-per-session readback. Manual Read aloud
    // remains synchronous in the parent's gesture via SpeakButton.
    const timer = setTimeout(() => {
      spoken.current = sessionId;
      setAudioFailed(false);
      next();
    }, 0);
    cancelReadback.current = () => {
      cancelled = true;
      clearTimeout(timer);
      if (utterance.current !== null && isActive(utterance.current)) stopVoice();
      setReading(false);
    };
    return () => {
      cancelReadback.current();
    };
  }, [pending, sessionId, readback, language]);
  useEffect(() => subscribeVoice(() => {
    // A per-draft Read aloud or another surface can supersede this queue.
    // Completion invokes next() after the state emit, so it sets the next
    // chunk's indicator again; interrupted speech never invokes onEnd.
    if (utterance.current !== null && !isActive(utterance.current)) setReading(false);
  }), []);
  const review = <div data-arbor-dialog-layer onClick={onBackdropClick} className="arbor-app fixed inset-0 z-[60] flex items-end justify-center px-3 pb-6"
    style={{ background: "color-mix(in srgb, var(--arbor-ink) 28%, transparent)" }}>
  <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={copy.title} dir={language === "he" ? "rtl" : "ltr"}
    onClick={event => event.stopPropagation()} className="flex w-full max-h-[85dvh] max-w-[620px] flex-col rounded-[22px] p-4"
    style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule-strong)", boxShadow: "var(--shadow-lg)" }}>
    <div className="shrink-0">
    <h2 className="text-base font-bold">{copy.title}</h2>
    <p className="my-2 text-sm">{copy.note}</p>
    <p role="status" className="my-2 text-sm">{pending ? copy.pending : failed ? copy.failed : !proposals.length ? copy.empty : ""}</p>
    {audioFailed && <p role="status" className="my-2 text-sm">{copy.audioFailed}</p>}
    {reading && <button type="button" onClick={() => cancelReadback.current()} className="min-h-11 rounded-xl px-4 text-sm font-bold"
      style={{ color: "var(--arbor-green-ink)", background: "var(--arbor-green-soft)" }}>{copy.stop}</button>}
    </div>
    <div className="min-h-0 overflow-y-auto">{children}</div>
    <button type="button" disabled={busy} onClick={requestClose} className="mt-3 min-h-11 shrink-0 rounded-xl px-4 text-sm font-bold disabled:opacity-50"
      style={{ color: "var(--arbor-green-ink)", background: "var(--arbor-green-soft)" }}>
      {proposals.length || pending ? copy.discard : copy.done}
    </button>
  </section></div>;
  return typeof document === "undefined" ? review : createPortal(review, document.body);
}
