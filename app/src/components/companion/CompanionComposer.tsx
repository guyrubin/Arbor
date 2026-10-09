import React, { useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon";
import { fileToThumbnail } from "../../lib/image";
import { startDictation, speechSupported } from "../../lib/speech";
import { microphoneRecovery } from "../../lib/microphoneRecovery";
import { MAX_COMPANION_ATTACHMENTS, parseCompanionAttachments, prepareCompanionAttachment, type ComposerAttachment } from "../../lib/companionAttachments";
import "./companionComposer.css";

export default function CompanionComposer({ childId, conversationId, language, value, onChange, busy, visible, onSend, onVoice, voiceActive, voiceLabel, onKeep }: {
  childId: string; conversationId: string | null; language: "en" | "he"; value: string; onChange: (value: string) => void;
  busy: boolean; visible: boolean; onSend: (prompt?: string, options?: { attachments?: ComposerAttachment[] }) => Promise<boolean | undefined>;
  onVoice: () => void; voiceActive: boolean; voiceLabel: string; onKeep: (text: string, photo?: string) => void;
}) {
  const he = language === "he";
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const photoRef = useRef<HTMLInputElement>(null);
  const documentRef = useRef<HTMLInputElement>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const scope = useRef(0);
  const speechScope = useRef(0);
  const previousConversation = useRef(conversationId);
  const textRef = useRef(value);
  textRef.current = value;
  useEffect(() => {
    if (!visible) { speechScope.current++; stopRef.current?.(); stopRef.current = null; setListening(false); setInterim(""); }
  }, [visible]);
  useEffect(() => {
    // Assigning the first saved id is still the same draft and voice session.
    const switched = previousConversation.current !== null && previousConversation.current !== conversationId;
    previousConversation.current = conversationId;
    if (switched) {
      scope.current++; speechScope.current++; stopRef.current?.(); stopRef.current = null;
      setAttachments([]); setPreparing(false); setError(""); setListening(false); setInterim("");
    }
  }, [conversationId]);
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
      if (turn === scope.current) setError(he ? "אפשר לצרף עד 3 קובצי JPG, PNG, WebP או PDF. עד 4MB לקובץ ו־6MB יחד." : "Choose up to 3 JPG, PNG, WebP or PDF files. Up to 4 MB each and 6 MB together.");
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
    if (busy || preparing || listening || (!value.trim() && !attachments.length)) return;
    const turn = scope.current;
    if (await onSend(undefined, { attachments }) && turn === scope.current) setAttachments([]);
  };
  const keep = async () => {
    if (attachments.length > 1 || attachments.some(a => a.mimeType === "application/pdf")) {
      setError(he ? "רגע יכול לכלול תמונה אחת. הסירו קבצים נוספים או שלחו אותם לשיחה." : "A moment can keep one photo. Remove extra files, or send them in the conversation."); return;
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
    } catch { setError(he ? "לא הצלחנו להכין את התמונה. הטיוטה נשמרה כאן." : "We couldn’t prepare the photo. Your draft is still here."); }
  };
  const draftPending = !!value.trim() || attachments.length > 0 || listening;
  return <div className="companion-composer" data-testid="companion-composer">
    {!!attachments.length && <div className="companion-attachments" aria-label={he ? "קבצים לשליחה" : "Files to send"}>
      {attachments.map(file => <figure key={file.id}>
        {file.mimeType.startsWith("image/") ? <img src={file.dataUrl} alt={file.name} /> : <Icon name="description" size={32} />}
        <figcaption title={file.name}>{file.name}</figcaption>
        <button type="button" disabled={busy} onClick={() => setAttachments(items => items.filter(a => a.id !== file.id))} aria-label={`${he ? "הסרה" : "Remove"}: ${file.name}`}><Icon name="close" size={18} /></button>
      </figure>)}
    </div>}
    {!!attachments.length && <p className="companion-media-note">{he ? "הקבצים נשלחים לניתוח רק עם השליחה. בשיחה נשמר ההסבר, לא הקובץ המקורי." : "Files are analysed when you send. The conversation keeps the explanation, not the original files."}</p>}
    <div className="companion-input-well" data-testid="coach-composer-well">
      <textarea value={value} onChange={event => onChange(event.target.value)} rows={2} disabled={busy || voiceActive}
        onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }}
        placeholder={he ? "שתפו רגע, שאלה או מחשבה…" : "Share a moment, a question, a thought…"}
        aria-label={he ? "מה תרצו לשתף עם Arbor?" : "What would you like to share with Arbor?"} />
      <button type="button" data-testid="coach-send" onClick={() => void send()} disabled={busy || preparing || listening || voiceActive || (!value.trim() && !attachments.length)} aria-label={he ? "שליחה" : "Send"}><Icon name="arrow_upward" size={23} /></button>
    </div>
    {listening && <p className="companion-recording" role="status"><span aria-hidden />{interim || (he ? "מקשיבים… המילים יופיעו בטיוטה." : "Listening… your words will appear in the draft.")}</p>}
    {error && <p className="companion-composer-error" role="alert">{error}</p>}
    {preparing && <p role="status">{he ? "מכינים את הקבצים…" : "Preparing your files…"}</p>}
    <div className="companion-composer-tools">
      <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={event => { void addFiles(event.target.files, "photo"); event.target.value = ""; }} />
      <input ref={documentRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple hidden onChange={event => { void addFiles(event.target.files, "document"); event.target.value = ""; }} />
      <button type="button" disabled={busy || preparing || voiceActive} onClick={() => photoRef.current?.click()}><Icon name="photo_camera" size={20} />{he ? "תמונה" : "Photo"}</button>
      <button type="button" disabled={busy || preparing || voiceActive} onClick={() => documentRef.current?.click()}><Icon name="attach_file" size={20} />{he ? "קובץ" : "File"}</button>
      <button type="button" disabled={busy || voiceActive} onClick={dictate} aria-pressed={listening}><Icon name={listening ? "stop_circle" : "mic"} size={20} />{listening ? (he ? "סיום" : "Done") : (he ? "הכתבה" : "Dictate")}</button>
      <button type="button" className="companion-live-button" disabled={!voiceActive && (busy || preparing || draftPending)} onClick={onVoice} aria-pressed={voiceActive} aria-label={voiceLabel}><Icon name={voiceActive ? "stop" : "graphic_eq"} size={20} />{voiceActive ? (he ? "עצירה" : "Stop") : (he ? "לדבר" : "Talk")}</button>
    </div>
    {draftPending && !voiceActive && <p className="companion-media-note">{he ? "שלחו את הטיוטה, ואז אפשר להמשיך עליה בשיחה קולית." : "Send your draft, then continue the conversation by voice."}</p>}
    <div className="companion-composer-foot"><span>{he ? "Arbor הוא מלווה מבוסס AI" : "Arbor is your AI companion"}</span><button type="button" disabled={busy || preparing || listening || voiceActive} onClick={() => void keep()}>{he ? "רק לשמור רגע" : "Just keep a moment"}<Icon name="arrow_forward" size={15} className="rtl:-scale-x-100" /></button></div>
  </div>;
}
