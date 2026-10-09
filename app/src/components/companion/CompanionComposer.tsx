import { translate as inputText } from "../../lib/i18n";
import React, { useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon";
import { fileToThumbnail } from "../../lib/image";
import { startDictation, speechSupported } from "../../lib/speech";
import { microphoneRecovery } from "../../lib/microphoneRecovery";
import { MAX_COMPANION_ATTACHMENTS, parseCompanionAttachments, prepareCompanionAttachment, type ComposerAttachment } from "../../lib/companionAttachments";
import { screenForImmediateEscalation } from "../../safety/escalation";
import { useCompanionConsent } from "./useCompanionConsent";
import CompanionConsentReview from "./CompanionConsentReview";
import { COMPANION_CONSENT_COPY } from "./companionConsentCopy";
import "./companionComposer.css";

export default function CompanionComposer({ childId, conversationRevision, language, value, onChange, busy, visible, onSend, onVoice, voiceActive, voiceLabel, onKeep }: {
  childId: string; conversationRevision: number; language: "en" | "he"; value: string; onChange: (value: string) => void;
  busy: boolean; visible: boolean; onSend: (prompt?: string, options?: { attachments?: ComposerAttachment[] }) => Promise<boolean | undefined>;
  onVoice: () => void; voiceActive: boolean; voiceLabel: string; onKeep: (text: string, photo?: string) => void;
}) {
  const he = language === "he";
  const consent = useCompanionConsent(childId);
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [sending, setSending] = useState(false);
  const sendLock = useRef(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const documentRef = useRef<HTMLInputElement>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const scope = useRef(0);
  const speechScope = useRef(0);
  const previousConversation = useRef(conversationRevision);
  const accountRef = useRef(consent.accountId);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const textRef = useRef(value);
  textRef.current = value;
  useEffect(() => {
    if (accountRef.current !== consent.accountId) {
      accountRef.current = consent.accountId;
      scope.current++; speechScope.current++; stopRef.current?.(); stopRef.current = null;
      setAttachments([]); setPreparing(false); setError(""); setListening(false); setInterim(""); setSending(false); sendLock.current = false;
    }
  }, [consent.accountId]);
  useEffect(() => {
    if (!visible) { speechScope.current++; stopRef.current?.(); stopRef.current = null; setListening(false); setInterim(""); }
  }, [visible]);
  useEffect(() => {
    if (consent.reviewing) { speechScope.current++; stopRef.current?.(); stopRef.current = null; setListening(false); setInterim(""); }
  }, [consent.reviewing]);
  useEffect(() => {
    // The revision changes on explicit New/history/topic actions, never first persistence.
    const switched = previousConversation.current !== conversationRevision;
    previousConversation.current = conversationRevision;
    if (switched) {
      scope.current++; speechScope.current++; stopRef.current?.(); stopRef.current = null;
      setAttachments([]); setPreparing(false); setError(""); setListening(false); setInterim(""); setSending(false); sendLock.current = false;
    }
  }, [conversationRevision]);
  useEffect(() => () => { scope.current++; speechScope.current++; stopRef.current?.(); stopRef.current = null; }, []);
  const addFiles = async (files: FileList | null, kind: ComposerAttachment["kind"]) => {
    if (!files?.length || preparing) return;
    const turn = scope.current;
    setPreparing(true); setError("");
    try {
      if (files.length + attachments.length > MAX_COMPANION_ATTACHMENTS) throw new Error("count");
      const next: ComposerAttachment[] = [];
      for (const file of Array.from(files)) next.push(await prepareCompanionAttachment(file, childId, kind));
      if (turn === scope.current) setAttachments(parseCompanionAttachments([...attachments, ...next], childId));
    } catch {
      if (turn === scope.current) setError(inputText(language, "companion.input.choose-up-to-3-jpg-png-webp-or-pdf-files-up-to-4-mb-each-and-6-mb"));
    } finally { if (turn === scope.current) setPreparing(false); }
  };
  const dictate = () => {
    if (listening) { stopRef.current?.(); return; }
    if (!speechSupported()) { setError(microphoneRecovery("unsupported", language)); return; }
    const turn = speechScope.current;
    setError(""); setListening(true);
    stopRef.current = startDictation({
      onResult: text => { if (turn === speechScope.current && text.trim()) onChange([textRef.current.trim(), text.trim()].filter(Boolean).join(" ")); },
      onInterim: text => { if (turn === speechScope.current) setInterim(text); },
      onError: reason => { if (turn === speechScope.current) setError(microphoneRecovery(reason, language)); },
      onEnd: () => { if (turn === speechScope.current) { setListening(false); setInterim(""); stopRef.current = null; } },
    }, he ? "he-IL" : "en-US", { continuous: true });
  };
  const send = async () => {
    if (busy || preparing || listening || consent.busy || sendLock.current || (!value.trim() && !attachments.length)) return;
    const turn = scope.current;
    sendLock.current = true; setSending(true);
    try {
      // The server still owns the gate. Immediate-help text must reach its
      // governed response even when file permission is absent (no file analysis).
      if (attachments.length && !screenForImmediateEscalation({ message: value })) {
        if (!await consent.requirePermission() || turn !== scope.current || !visibleRef.current) return;
      }
      if (await onSend(undefined, { attachments }) && turn === scope.current) setAttachments([]);
    } finally { if (turn === scope.current) { sendLock.current = false; setSending(false); } }
  };
  const keep = async () => {
    if (attachments.length > 1 || attachments.some(a => a.mimeType === "application/pdf")) {
      setError(inputText(language, "companion.input.a-moment-can-keep-one-photo-remove-extra-files-or-send-them-in-th")); return;
    }
    const turn = scope.current;
    const photo = attachments[0];
    try {
      let thumbnail: string | undefined;
      if (photo) {
        const bytes = Uint8Array.from(atob(photo.dataUrl.split(",")[1]), c => c.charCodeAt(0));
        thumbnail = await fileToThumbnail(new File([bytes], photo.name, { type: photo.mimeType }));
      }
      if (turn === scope.current) onKeep(textRef.current, thumbnail);
    } catch { if (turn === scope.current) setError(inputText(language, "companion.input.we-couldn-t-prepare-the-photo-your-draft-is-still-here")); }
  };
  const draftPending = !!value.trim() || attachments.length > 0 || listening;
  return <div className="companion-composer" data-testid="companion-composer">
    <CompanionConsentReview consent={consent} language={language} onReturnToDraft={() => { if (visibleRef.current) textareaRef.current?.focus(); }} />
    {!consent.reviewing && <>
    {!!attachments.length && <div className="companion-attachments" aria-label={inputText(language, "companion.input.files-to-send")}>
      {attachments.map(file => <figure key={file.id}>
        {file.mimeType.startsWith("image/") ? <img src={file.dataUrl} alt={file.name} /> : <Icon name="description" size={32} />}
        <figcaption title={file.name}>{file.name}</figcaption>
        <button type="button" disabled={busy || sending} onClick={() => setAttachments(items => items.filter(a => a.id !== file.id))} aria-label={`${inputText(language, "companion.input.remove")}: ${file.name}`}><Icon name="close" size={18} /></button>
      </figure>)}
    </div>}
    {!!attachments.length && <p className="companion-media-note">{inputText(language, "companion.input.files-are-analysed-when-you-send-the-conversation-keeps-the-expla")}</p>}
    <div className="companion-input-well" data-testid="coach-composer-well">
      <textarea ref={textareaRef} className="field-bare" value={value} onChange={event => onChange(event.target.value)} rows={2} disabled={busy || sending || voiceActive}
        onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }}
        placeholder={inputText(language, "companion.input.share-a-moment-a-question-a-thought")}
        aria-label={inputText(language, "companion.input.what-would-you-like-to-share-with-arbor")} />
      <button type="button" data-testid="coach-send" onClick={() => void send()} disabled={busy || sending || !!consent.busy || preparing || listening || voiceActive || (!value.trim() && !attachments.length)} aria-label={inputText(language, "companion.input.send")}><Icon name="arrow_forward" size={23} /></button>
    </div>
    {listening && <p className="companion-recording" role="status"><span aria-hidden />{interim || (inputText(language, "companion.input.listening-your-words-will-appear-in-the-draft"))}</p>}
    {error && <p className="companion-composer-error" role="alert">{error}</p>}
    {preparing && <p role="status">{inputText(language, "companion.input.preparing-your-files")}</p>}
    <div className="companion-composer-tools">
      <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={event => { void addFiles(event.target.files, "photo"); event.target.value = ""; }} />
      <input ref={documentRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple hidden onChange={event => { void addFiles(event.target.files, "document"); event.target.value = ""; }} />
      <button type="button" disabled={busy || sending || preparing || voiceActive} onClick={() => photoRef.current?.click()}><Icon name="photo_camera" size={20} />{inputText(language, "companion.input.photo")}</button>
      <button type="button" disabled={busy || sending || preparing || voiceActive} onClick={() => documentRef.current?.click()}><Icon name="attachment" size={20} />{inputText(language, "companion.input.file")}</button>
      <button type="button" disabled={busy || sending || voiceActive} onClick={dictate} aria-pressed={listening}><Icon name={listening ? "stop_circle" : "mic"} size={20} />{listening ? (inputText(language, "companion.input.done")) : (inputText(language, "companion.input.dictate"))}</button>
      <button type="button" className="companion-live-button" disabled={!voiceActive && (busy || preparing || draftPending)} onClick={onVoice} aria-pressed={voiceActive} aria-label={voiceLabel}><Icon name={voiceActive ? "stop" : "graphic_eq"} size={20} />{voiceActive ? (inputText(language, "companion.input.stop")) : (inputText(language, "companion.input.talk"))}</button>
    </div>
    {draftPending && !voiceActive && <p className="companion-media-note">{inputText(language, "companion.input.send-your-draft-then-continue-the-conversation-by-voice")}</p>}
    <div className="companion-composer-foot"><span>{inputText(language, "companion.input.arbor-is-your-ai-companion")}</span><button type="button" disabled={busy || sending || !!consent.busy || voiceActive} onClick={consent.review}><Icon name="shield" size={15} />{COMPANION_CONSENT_COPY[language].control}</button><button type="button" disabled={busy || sending || preparing || listening || voiceActive} onClick={() => void keep()}>{inputText(language, "companion.input.just-keep-a-moment")}<Icon name="arrow_forward" size={15} className="rtl:-scale-x-100" /></button></div>
    </>}
  </div>;
}
