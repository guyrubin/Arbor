import { translate as inputText } from "../../lib/i18n";
import React, { useEffect, useId, useRef, useState } from "react";
import Icon from "../ui/Icon";
import RecordingIndicator from "../ui/RecordingIndicator";
import { fileToThumbnail } from "../../lib/image";
import { startDictation, speechSupported } from "../../lib/speech";
import { microphoneRecovery } from "../../lib/microphoneRecovery";
import { MAX_COMPANION_ATTACHMENTS, parseCompanionAttachments, prepareCompanionAttachment, type ComposerAttachment } from "../../lib/companionAttachments";
import { screenForImmediateEscalation } from "../../safety/escalation";
import { composerCaptureKeep, freshCaptureKeep } from "../../lib/kept/captureKeep";
import { useCompanionConsent } from "./useCompanionConsent";
import CompanionConsentReview from "./CompanionConsentReview";
import { COMPANION_CONSENT_COPY } from "./companionConsentCopy";
import "./companionComposer.css";

export default function CompanionComposer({ childId, conversationRevision, language, value, onChange: setDraft, busy, visible, onSend, onVoice, voiceActive, voiceLabel, onKeep, onAttachmentsChange, onHardMoment, footAction, voiceResting = false }: {
  childId: string; conversationRevision: number; language: "en" | "he"; value: string; onChange: (value: string) => void;
  busy: boolean; visible: boolean; onSend: (prompt?: string, options?: { attachments?: ComposerAttachment[] }) => Promise<boolean | undefined>;
  onVoice: () => void; voiceActive: boolean; voiceLabel: string;
  /** B-ASKJB-43: `parentWritten` is true only when the parent typed or dictated these words from an empty field. */
  onKeep: (text: string, photo?: string, parentWritten?: boolean) => void;
  /** How many files the input holds (a count, never the files). */
  onAttachmentsChange?: (count: number) => void;
  /** F-TALK-1: the hard-moment door rides in the tray. The host passes it only
   *  while a pilot guide is available (availableHardMomentCards); absent, no button. */
  onHardMoment?: () => void;
  /** F-TALK-1: one quiet control beside the honesty line (the tone chip). */
  footAction?: React.ReactNode;
  /** B-AIOPS-02: the family's voice time for today is spent — no hint
   *  inviting the parent to continue by voice. */
  voiceResting?: boolean;
}) {
  const he = language === "he";
  const consent = useCompanionConsent(childId);
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  // The host keeps commercial previews out of a composition in progress.
  useEffect(() => { onAttachmentsChange?.(attachments.length); }, [attachments.length, onAttachmentsChange]);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [sending, setSending] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsId = useId();
  // F-TALK-2: the Hard tile's name is its visible text (label-in-name); the
  // longer line ("words and one step for right now") is its description.
  const hardHintId = useId();
  const toolsToggleRef = useRef<HTMLButtonElement>(null);
  // F-TALK-2: the tray reads above the row, so opening it moves focus to its
  // first tile (Escape returns focus to +).
  const firstToolRef = useRef<HTMLButtonElement>(null);
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
  // B-ASKJB-43: who wrote the draft, by the capture sheet's own chain
  // (lib/kept/captureKeep). The parent's typing and dictation go through
  // onChange here; a seed or any other change from outside is not theirs
  // until they clear the field. Read only when the words are kept.
  const authorRef = useRef(freshCaptureKeep(value));
  const onChange = (next: string) => {
    authorRef.current = composerCaptureKeep(authorRef.current, textRef.current, next);
    setDraft(next);
  };
  useEffect(() => {
    if (accountRef.current !== consent.accountId) {
      accountRef.current = consent.accountId;
      scope.current++; speechScope.current++; stopRef.current?.(); stopRef.current = null;
      setAttachments([]); setPreparing(false); setError(""); setListening(false); setInterim(""); setSending(false); setToolsOpen(false); sendLock.current = false;
    }
  }, [consent.accountId]);
  useEffect(() => {
    if (!visible) { speechScope.current++; stopRef.current?.(); stopRef.current = null; setListening(false); setInterim(""); setToolsOpen(false); }
  }, [visible]);
  useEffect(() => {
    if (consent.reviewing) { speechScope.current++; stopRef.current?.(); stopRef.current = null; setListening(false); setInterim(""); setToolsOpen(false); }
  }, [consent.reviewing]);
  useEffect(() => {
    // The revision changes on explicit New/history/topic actions, never first persistence.
    const switched = previousConversation.current !== conversationRevision;
    previousConversation.current = conversationRevision;
    if (switched) {
      scope.current++; speechScope.current++; stopRef.current?.(); stopRef.current = null;
      setAttachments([]); setPreparing(false); setError(""); setListening(false); setInterim(""); setSending(false); setToolsOpen(false); sendLock.current = false;
    }
  }, [conversationRevision]);
  useEffect(() => () => { scope.current++; speechScope.current++; stopRef.current?.(); stopRef.current = null; }, []);
  useEffect(() => { if (toolsOpen) firstToolRef.current?.focus(); }, [toolsOpen]);
  // F-TALK-2: the field grows with its text. CSS field-sizing:content does it
  // where supported; elsewhere (Safari) size it from scrollHeight up to the
  // stylesheet's max-block-size, after which it scrolls.
  useEffect(() => {
    const field = textareaRef.current;
    if (!field || (typeof CSS !== "undefined" && CSS.supports("field-sizing", "content"))) return;
    const cap = parseFloat(getComputedStyle(field).maxHeight) || 180;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, cap)}px`;
    field.style.overflowY = field.scrollHeight > cap ? "auto" : "hidden";
  }, [value]);
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
      if (turn === scope.current) onKeep(textRef.current, thumbnail, authorRef.current.parentWritten && authorRef.current.text === textRef.current);
    } catch { if (turn === scope.current) setError(inputText(language, "companion.input.we-couldn-t-prepare-the-photo-your-draft-is-still-here")); }
  };
  const closeTools = () => { setToolsOpen(false); toolsToggleRef.current?.focus(); };
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
    {/* B-STATUS-02: dictation into the draft shows the ONE REC-01 indicator
        (dot, "Recording", m:ss, a 44 px Stop, the parent's own words live).
        F-TALK-2: it reads above the row, like the attachment strip (mock L420-421). */}
    {listening && <RecordingIndicator interim={interim} hint={inputText(language, "companion.input.listening-your-words-will-appear-in-the-draft")}
      label={inputText(language, "elev.rec.on")} stopLabel={inputText(language, "companion.input.done")} stopAria={inputText(language, "elev.rec.stopAria")}
      onStop={() => stopRef.current?.()} testId="composer-listening" captionTestId="composer-listening-caption" />}
    {error && <p className="companion-composer-error" role="alert">{error}</p>}
    {preparing && <p role="status">{inputText(language, "companion.input.preparing-your-files")}</p>}
    {/* F-TALK-2: one row (mock L424-433): +, the field, voice, send. + opens
        the tray of tiles above the row; Escape anywhere in here closes it. */}
    <div className="companion-composer-tools" onKeyDown={event => { if (toolsOpen && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeTools(); } }}>
      <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={event => { void addFiles(event.target.files, "photo"); event.target.value = ""; }} />
      <input ref={documentRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple hidden onChange={event => { void addFiles(event.target.files, "document"); event.target.value = ""; }} />
      <div id={toolsId} hidden={!toolsOpen} className="companion-secondary-tools" role="group" aria-label={inputText(language, "companion.input.sharing-options")}>
        <div className="companion-tray-tiles">
          <button ref={firstToolRef} type="button" disabled={busy || sending || preparing || voiceActive} onClick={() => { closeTools(); photoRef.current?.click(); }}><span className="companion-tray-icon"><Icon name="photo_camera" size={19} /></span>{inputText(language, "companion.input.photo")}</button>
          <button type="button" disabled={busy || sending || preparing || voiceActive} onClick={() => { closeTools(); documentRef.current?.click(); }}><span className="companion-tray-icon"><Icon name="attachment" size={19} /></span>{inputText(language, "companion.input.file")}</button>
          <button type="button" disabled={busy || sending || voiceActive} onClick={() => { closeTools(); dictate(); }} aria-pressed={listening}><span className="companion-tray-icon"><Icon name={listening ? "stop_circle" : "mic"} size={19} /></span>{listening ? (inputText(language, "companion.input.done")) : (inputText(language, "companion.input.dictate"))}</button>
          <button type="button" className="companion-tray-keep" disabled={busy || sending || preparing || listening || voiceActive} onClick={() => { closeTools(); void keep(); }}><span className="companion-tray-icon"><Icon name="edit_note" size={19} /></span>{inputText(language, "companion.tray.keep")}</button>
          {onHardMoment && <button type="button" className="companion-tray-hard" data-testid="coach-hard-moment-now" onClick={() => { closeTools(); onHardMoment(); }} aria-describedby={hardHintId}><span className="companion-tray-icon"><Icon name="volunteer_activism" size={19} /></span>{inputText(language, "companion.tray.hard")}</button>}
          {onHardMoment && <span id={hardHintId} hidden>{inputText(language, "companion.tray.hard-hint")}</span>}
        </div>
        <div className="companion-tray-quiet">
          <button type="button" disabled={busy || sending || !!consent.busy || voiceActive} onClick={() => { closeTools(); consent.review(); }}><Icon name="shield" size={15} />{COMPANION_CONSENT_COPY[language].control}</button>
        </div>
      </div>
      <div className="companion-input-well" data-testid="coach-composer-well">
        <button ref={toolsToggleRef} type="button" className="companion-tools-toggle" aria-expanded={toolsOpen} aria-controls={toolsId}
          aria-label={inputText(language, "companion.input.add-or-save")} onClick={() => setToolsOpen(open => !open)}>
          <Icon name="add" size={22} />
        </button>
        <textarea ref={textareaRef} className="field-bare" value={value} onChange={event => onChange(event.target.value)} rows={1} disabled={busy || sending || voiceActive}
          onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }}
          placeholder={inputText(language, "companion.input.share-a-moment-a-question-a-thought")}
          aria-label={inputText(language, "companion.input.what-would-you-like-to-share-with-arbor")} />
        {/* The voice door: an icon at rest (its name is the live label, its
            tooltip "Talk it through"); while live it reads "Stop". */}
        <button type="button" className="companion-live-button" disabled={!voiceActive && (busy || preparing || draftPending)} onClick={onVoice} aria-pressed={voiceActive} aria-label={voiceLabel}
          title={voiceActive ? undefined : inputText(language, "companion.input.talk")}><Icon name={voiceActive ? "stop" : "graphic_eq"} size={22} />{voiceActive ? (inputText(language, "companion.input.stop")) : null}</button>
        <button type="button" className="companion-send" data-testid="coach-send" onClick={() => void send()} disabled={busy || sending || !!consent.busy || preparing || listening || voiceActive || (!value.trim() && !attachments.length)} aria-label={inputText(language, "companion.input.send")}><Icon name="arrow_forward" size={23} className="rtl:-scale-x-100" /></button>
      </div>
    </div>
    {draftPending && !voiceActive && !voiceResting && <p className="companion-media-note">{inputText(language, "companion.input.send-your-draft-then-continue-the-conversation-by-voice")}</p>}
    </>}
    {/* F-TALK-1: the honesty line (what Arbor is; files only on send) and the tone chip share the foot. */}
    <div className="companion-composer-foot-row"><p className="companion-composer-foot">{inputText(language, "companion.input.foot")}</p>{footAction}</div>
  </div>;
}
