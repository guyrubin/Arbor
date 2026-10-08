import React, { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { api } from "../../lib/api";
import { PROGRAM_DOCUMENT_MAX_BYTES, PROGRAM_IMPORT_VERSION, pastedRecommendations, parseProgramDocument, parseRecommendationDraft, type ProgramImportSource, type RecommendationDraft } from "../../lib/programImport";

const field = { border: "1px solid var(--arbor-rule-strong)", borderRadius: "var(--r)", background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)" };
interface Props { childId: string; remaining: number; readOnly?: boolean; onApply: (texts: string[], source: ProgramImportSource) => void }
export default function HomeProgramImport({ childId, remaining, readOnly, onApply }: Props) {
  const { uiLang } = useLanguage();
  const text = (en: string, he: string) => uiLang === "he" ? he : en;
  const [paste, setPaste] = useState("");
  const [document, setDocument] = useState<{ url: string; dataUrl: string; name: string; kind: "photo" | "pdf" } | null>(null);
  const [draft, setDraft] = useState<RecommendationDraft | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [edits, setEdits] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState(false);
  const operation = useRef(0);
  const locked = readOnly || applied;
  useEffect(() => { return () => { operation.current += 1; }; }, []);
  useEffect(() => { return () => { if (document) URL.revokeObjectURL(document.url); }; }, [document]);
  const reset = () => { operation.current += 1; setBusy(false); setDraft(null); setSelected([]); setEdits([]); setError(""); };
  const fileChosen = async (file: File | undefined) => {
    reset(); setDocument(null); setPaste("");
    if (!file) return;
    if (file.size > PROGRAM_DOCUMENT_MAX_BYTES || !["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(file.type)) {
      setError(text("Choose a PNG, JPEG, WebP or PDF up to 4 MB.", "בחרו תמונת PNG, JPEG או WebP, או PDF עד 4 מגה־בייט.")); return;
    }
    const request = operation.current;
    setBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
      parseProgramDocument(dataUrl);
      if (request !== operation.current) return;
      setDocument({ url: URL.createObjectURL(file), dataUrl, name: file.name.slice(0, 120), kind: file.type === "application/pdf" ? "pdf" : "photo" });
    } catch { if (request === operation.current) setError(text("This file could not be opened. Try another file or paste text.", "לא הצלחנו לפתוח את הקובץ. אפשר לבחור קובץ אחר או להדביק טקסט.")); }
    finally { if (request === operation.current) setBusy(false); }
  };
  const extract = async () => {
    const request = ++operation.current;
    setBusy(true); setError(""); setDraft(null); setSelected([]);
    try {
      const result = document ? parseRecommendationDraft(await api.importHomeRecommendations({ childId, image: { dataUrl: document.dataUrl } })) : pastedRecommendations(paste);
      if (request !== operation.current) return;
      setDraft(result); setEdits(result.recommendations);
    } catch (e) {
      if (request !== operation.current) return;
      const consent = typeof e === "object" && e != null && "status" in e && e.status === 451;
      setError(consent ? text("Document processing needs your image-processing consent in Privacy settings. You can also paste text here.", "לקריאת מסמך נדרשת הסכמה לעיבוד תמונות בהגדרות הפרטיות. אפשר גם להדביק כאן טקסט.") : text("We couldn't read that reliably. Try a clearer file, or paste one recommendation per line.", "לא הצלחנו לקרוא את ההמלצות בצורה אמינה. נסו קובץ ברור יותר, או הדביקו המלצה אחת בכל שורה."));
    } finally { if (request === operation.current) setBusy(false); }
  };
  const apply = () => {
    if (!draft || !selected.length || selected.length > remaining || selected.some(i => !edits[i]?.trim())) return;
    onApply(selected.map(i => edits[i].trim()), { kind: document?.kind ?? "text", name: document?.name ?? text("Pasted recommendations", "המלצות שהודבקו"), sourceText: draft.sourceText, confirmedAt: new Date().toISOString(), extractionVersion: document ? PROGRAM_IMPORT_VERSION : "parent-paste-v1", quotations: selected.map(i => draft.recommendations[i]) });
    setApplied(true);
  };
  return <section data-testid="home-program-import" className="rounded-[var(--r-lg)] border p-4 sm:p-5" style={{ borderColor: "var(--arbor-rule)", background: "var(--arbor-paper)" }}>
    <h3 className="text-xl" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{text("Bring the recommendations home", "מביאים את ההמלצות הביתה")}</h3>
    <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{text("Photo, PDF or pasted text. Check each line against the original, edit if needed, and choose what to add. Reading a file uses AI and can make mistakes.", "תמונה, PDF או טקסט. בדקו כל שורה מול המקור, ערכו לפי הצורך ובחרו מה להוסיף. קריאת קובץ נעזרת בבינה מלאכותית ועלולה לטעות.")}</p>
    {!locked && <div className="mt-4 space-y-3">
      <label htmlFor="home-source-file" className="block text-sm font-semibold">{text("Choose a photo or short PDF · up to 4 MB", "בחרו תמונה או PDF קצר · עד 4 מגה־בייט")}</label>
      <input id="home-source-file" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" disabled={busy} onChange={e => void fileChosen(e.target.files?.[0])} className="block min-h-11 w-full min-w-0 text-sm file:me-3 file:min-h-11 file:rounded-full file:border-0 file:px-4" />
      <label htmlFor="home-source-paste" className="block text-sm font-semibold">{text("Or paste one recommendation per line", "או הדביקו המלצה אחת בכל שורה")}</label>
      <textarea id="home-source-paste" dir="auto" rows={3} maxLength={12000} value={paste} onChange={e => { reset(); setDocument(null); setPaste(e.target.value); }} className="w-full px-3 py-2" style={field} />
      <button type="button" disabled={busy || (!document && !paste.trim())} onClick={() => void extract()} className="min-h-11 rounded-full px-4 font-semibold disabled:opacity-50" style={{ background: "var(--arbor-ink)", color: "var(--arbor-on-accent)" }}>{busy ? text("Reading…", "קוראים…") : text("Review the text", "לבדיקת הטקסט")}</button>
    </div>}
    {error && <p role="alert" className="mt-3 text-sm">{error}</p>}
    {(document || draft) && <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
      <div className="min-w-0">
        <h4 className="mb-2 font-semibold">{text("Original", "המקור")}</h4>
        {document?.kind === "photo" && <img src={document.url} alt={text("Original uploaded recommendations", "ההמלצות המקוריות שהעליתם")} className="max-h-80 w-full rounded-[var(--r)] border object-contain" style={{ borderColor: "var(--arbor-rule)" }} />}
        {document?.kind === "pdf" && <><object type="application/pdf" data={document.url} aria-label={text("Original PDF", "קובץ PDF מקורי")} className="h-80 w-full rounded-[var(--r)]"><p>{text("Open the original to compare it.", "פתחו את המקור כדי להשוות.")}</p></object><a href={document.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm underline">{text("Open original PDF", "פתיחת PDF המקורי")}</a></>}
        {!document && <p dir="auto" className="max-h-80 overflow-auto whitespace-pre-wrap rounded-[var(--r)] border p-3 text-sm" style={field}>{draft?.sourceText}</p>}
        {document && draft && <details className="mt-2 text-sm"><summary className="flex min-h-11 cursor-pointer items-center underline">{text("Read the extracted transcription", "קריאת התמלול שחולץ")}</summary><p dir="auto" className="max-h-60 overflow-auto whitespace-pre-wrap">{draft.sourceText}</p></details>}
      </div>
      {draft && <div className="min-w-0">
        <h4 className="font-semibold">{text("Choose and edit", "בוחרים ועורכים")}</h4>
        <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{text("Only selected text is added to your editable program. Nothing is saved until you save the program.", "רק הטקסט שתבחרו יתווסף לתוכנית הניתנת לעריכה. דבר לא נשמר לפני שמירת התוכנית.")}</p>
        {!draft.recommendations.length && <p role="status" className="mt-3 text-sm">{text("No clear recommendations found. You can type them in the fields below.", "לא נמצאו המלצות ברורות. אפשר להקליד אותן בשדות למטה.")}</p>}
        {draft.recommendations.map((quote, i) => <div key={`${i}-${quote}`} className="mt-3">
          <label className="flex min-h-11 items-start gap-3 py-2" htmlFor={`home-import-pick-${i}`}><input id={`home-import-pick-${i}`} type="checkbox" disabled={locked || (!selected.includes(i) && selected.length >= remaining)} checked={selected.includes(i)} onChange={e => setSelected(prev => e.target.checked ? [...prev, i].sort((a, b) => a - b) : prev.filter(n => n !== i))} className="mt-1 size-5 shrink-0" /><span dir="auto" className="break-words text-sm">{quote}</span></label>
          {selected.includes(i) && <><label htmlFor={`home-import-edit-${i}`} className="text-xs">{text("Your wording", "הניסוח שלכם")}</label><textarea id={`home-import-edit-${i}`} dir="auto" rows={2} maxLength={200} disabled={locked} value={edits[i]} onChange={e => setEdits(prev => prev.map((v, n) => n === i ? e.target.value : v))} className="mt-1 w-full px-3 py-2 text-sm" style={field} /></>}
        </div>)}
        {!locked && <button type="button" onClick={apply} disabled={!selected.length || selected.length > remaining || selected.some(i => !edits[i]?.trim())} className="mt-4 min-h-11 rounded-full px-4 text-sm font-semibold disabled:opacity-50" style={{ background: "var(--arbor-ink)", color: "var(--arbor-on-accent)" }}>{text("Use selected recommendations", "הוספת ההמלצות שבחרתם")}</button>}
        {applied && <p role="status" className="mt-3 text-sm">{text("Added below. Review and save when you're ready.", "נוסף למטה. בדקו ושמרו כשתהיו מוכנים.")}</p>}
      </div>}
    </div>}
    <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{text("The file is processed temporarily and is not stored by Arbor. When you save, the transcription and selected original quotes stay with this child's program and are included in export and deletion.", "הקובץ מעובד באופן זמני ואינו נשמר ב־Arbor. בשמירה, התמלול והציטוטים שבחרתם נשמרים עם התוכנית של הילד או הילדה, ונכללים בייצוא ובמחיקה.")}</p>
  </section>;
}
