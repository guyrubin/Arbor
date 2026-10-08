import React, { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { api } from "../../lib/api";
import { PROGRAM_DOCUMENT_MAX_BYTES, PROGRAM_IMPORT_VERSION, pastedRecommendations, parseProgramDocument, parseRecommendationDraft, type ProgramImportSource, type RecommendationDraft } from "../../lib/programImport";

const field = { border: "1px solid var(--arbor-rule-strong)", borderRadius: "var(--r)", background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)" };
interface Props { childId: string; remaining: number; readOnly?: boolean; onApply: (texts: string[], source: ProgramImportSource) => void; onReset: () => void }
export default function HomeProgramImport({ childId, remaining, readOnly, onApply, onReset }: Props) {
  const { t, uiLang } = useLanguage();
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
      setError(t("elev.pilot.choose.a.png.jpeg.webp.or.pdf.up.to.4.mb")); return;
    }
    const request = operation.current;
    setBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
      parseProgramDocument(dataUrl);
      if (request !== operation.current) return;
      setDocument({ url: URL.createObjectURL(file), dataUrl, name: file.name.slice(0, 120), kind: file.type === "application/pdf" ? "pdf" : "photo" });
    } catch { if (request === operation.current) setError(t("elev.pilot.this.file.could.not.be.opened.try.another.file.or.paste.text")); }
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
      const status = typeof e === "object" && e != null && "status" in e ? e.status : null;
      if (status === 429) { setError(t("elev.pilot.reading.is.temporarily.at.its.limit.try.later.or.paste.the.text.h")); return; }
      if (status === 401 || status === 403) { setError(t("elev.pilot.please.sign.in.with.access.to.this.child.s.record.then.try.again")); return; }
      if (e instanceof TypeError) { setError(t("elev.pilot.check.your.connection.and.try.again.your.selected.file.is.still.h")); return; }
      const consent = status === 451;
      setError(consent ? t("elev.pilot.document.processing.needs.your.image.processing.consent.in.privac") : t("elev.pilot.we.couldn.t.read.that.reliably.try.a.clearer.file.or.paste.one.re"));
    } finally { if (request === operation.current) setBusy(false); }
  };
  const apply = () => {
    if (!draft || !selected.length || selected.length > remaining || selected.some(i => !edits[i]?.trim())) return;
    onApply(selected.map(i => edits[i].trim()), { kind: document?.kind ?? "text", name: document?.name ?? t("elev.pilot.pasted.recommendations"), sourceText: draft.sourceText, confirmedAt: new Date().toISOString(), extractionVersion: document ? PROGRAM_IMPORT_VERSION : "parent-paste-v1", quotations: selected.map(i => draft.recommendations[i]) });
    setApplied(true);
  };
  return <section data-testid="home-program-import" className="rounded-[var(--r-lg)] border p-4 sm:p-5" style={{ borderColor: "var(--arbor-rule)", background: "var(--arbor-paper)" }}>
    <h3 className="text-xl" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{t("elev.pilot.bring.the.recommendations.home")}</h3>
    <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("elev.pilot.photo.pdf.or.pasted.text.check.each.line.against.the.original.edi")}</p>
    {!locked && <div className="mt-4 space-y-3">
      <label htmlFor="home-source-file" className="block text-sm font-semibold">{t("elev.pilot.choose.a.photo.or.short.pdf.up.to.4.mb")}</label>
      <input id="home-source-file" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" disabled={busy} onChange={e => void fileChosen(e.target.files?.[0])} className="block min-h-11 w-full min-w-0 text-sm file:me-3 file:min-h-11 file:rounded-full file:border-0 file:px-4" />
      <label htmlFor="home-source-paste" className="block text-sm font-semibold">{t("elev.pilot.or.paste.one.recommendation.per.line")}</label>
      <textarea id="home-source-paste" dir="auto" rows={3} maxLength={12000} value={paste} onChange={e => { reset(); setDocument(null); setPaste(e.target.value); }} className="w-full px-3 py-2" style={field} />
      <button type="button" disabled={busy || (!document && !paste.trim())} onClick={() => void extract()} className="min-h-11 rounded-full px-4 font-semibold disabled:opacity-50" style={{ background: "var(--arbor-ink)", color: "var(--arbor-on-accent)" }}>{busy ? t("elev.pilot.reading") : t("elev.pilot.review.the.text")}</button>
    </div>}
    {error && <p role="alert" className="mt-3 text-sm">{error}</p>}
    {(document || draft) && <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
      <div className="min-w-0">
        <h4 className="mb-2 font-semibold">{t("elev.pilot.original")}</h4>
        {document?.kind === "photo" && <img src={document.url} alt={t("elev.pilot.original.uploaded.recommendations")} className="max-h-80 w-full rounded-[var(--r)] border object-contain" style={{ borderColor: "var(--arbor-rule)" }} />}
        {document?.kind === "pdf" && <><iframe src={document.url} title={t("elev.pilot.original.pdf")} className="h-80 w-full rounded-[var(--r)]" /><a href={document.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm underline">{t("elev.pilot.open.original.pdf")}</a></>}
        {!document && <p dir="auto" className="max-h-80 overflow-auto whitespace-pre-wrap rounded-[var(--r)] border p-3 text-sm" style={field}>{draft?.sourceText}</p>}
        {document && draft && <details className="mt-2 text-sm"><summary className="flex min-h-11 cursor-pointer items-center underline">{t("elev.pilot.read.the.extracted.transcription")}</summary><p dir="auto" className="max-h-60 overflow-auto whitespace-pre-wrap">{draft.sourceText}</p></details>}
      </div>
      {draft && <div className="min-w-0">
        <h4 className="font-semibold">{t("elev.pilot.choose.and.edit")}</h4>
        <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("elev.pilot.only.selected.text.is.added.to.your.editable.program.nothing.is.s")}</p>
        {!draft.recommendations.length && <p role="status" className="mt-3 text-sm">{t("elev.pilot.no.clear.recommendations.found.you.can.type.them.in.the.fields.be")}</p>}
        {draft.recommendations.map((quote, i) => <div key={`${i}-${quote}`} className="mt-3">
          <label className="flex min-h-11 items-start gap-3 py-2" htmlFor={`home-import-pick-${i}`}><input id={`home-import-pick-${i}`} type="checkbox" disabled={locked || (!selected.includes(i) && selected.length >= remaining)} checked={selected.includes(i)} onChange={e => setSelected(prev => e.target.checked ? [...prev, i].sort((a, b) => a - b) : prev.filter(n => n !== i))} className="mt-1 size-5 shrink-0" /><span dir="auto" className="break-words text-sm">{quote}</span></label>
          {selected.includes(i) && <><label htmlFor={`home-import-edit-${i}`} className="text-xs">{t("elev.pilot.your.wording")}</label><textarea id={`home-import-edit-${i}`} dir="auto" rows={2} maxLength={200} disabled={locked} value={edits[i]} onChange={e => setEdits(prev => prev.map((v, n) => n === i ? e.target.value : v))} className="mt-1 w-full px-3 py-2 text-sm" style={field} /></>}
        </div>)}
        {!locked && <button type="button" onClick={apply} disabled={!selected.length || selected.length > remaining || selected.some(i => !edits[i]?.trim())} className="mt-4 min-h-11 rounded-full px-4 text-sm font-semibold disabled:opacity-50" style={{ background: "var(--arbor-ink)", color: "var(--arbor-on-accent)" }}>{t("elev.pilot.use.selected.recommendations")}</button>}
        {applied && <><p role="status" className="mt-3 text-sm">{t("elev.pilot.added.below.review.and.save.when.you.re.ready")}</p>{!readOnly && <button type="button" className="mt-2 min-h-11 text-sm underline" onClick={() => { onReset(); reset(); setApplied(false); setDocument(null); setPaste(""); }}>{t("elev.pilot.remove.imported.exercises.and.choose.another.source")}</button>}</>}
      </div>}
    </div>}
    <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("elev.pilot.the.file.is.processed.temporarily.and.is.not.stored.by.arbor.when")}</p>
  </section>;
}
