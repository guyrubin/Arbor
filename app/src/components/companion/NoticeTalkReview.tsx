import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNoticeSource } from "../../hooks/useNoticeSource";
import { clearNoticeTalk, readNoticeTalk, type NoticeTalkRequest } from "../../lib/noticeHandoff";
import { reviewedPortraitDraft } from "./portraitEvidence";
import { NOTICE_HANDOFF_COPY } from "./noticeHandoffCopy";
import { FreeText } from "../ui/FreeText";
import Icon from "../ui/Icon";

export interface NoticeTalkController {
  request: NoticeTalkRequest;
  prepare: (question: string) => { message: string; isCurrent: () => boolean } | null;
  revoke: () => void;
}

/** Source IDs stay selected only for this confirmed version. The quoted draft
 * is built by the existing reviewedPortraitDraft, and rebuilt at Send. */
export default function NoticeTalkReview({ request, question, he, controller }: {
  request: NoticeTalkRequest; question: string; he: boolean;
  controller: React.MutableRefObject<NoticeTalkController | null>;
}) {
  const { user } = useAuth();
  const source = useNoticeSource(request, he);
  const c = NOTICE_HANDOFF_COPY[he ? "he" : "en"];
  const [selection, setSelection] = useState<{ version: object; ids: string[] }>({ version: source.version, ids: [] });
  const ids = selection.version === source.version ? selection.ids : [];
  const selected = source.sources.filter(item => ids.includes(item.id));
  const draft = selected.length ? reviewedPortraitDraft(question, request.childId, selected, he) : "";
  const receipt = JSON.stringify([ids, question, he]);
  const approval = useRef<{ version: object; receipt: string } | null>(null);
  const latest = useRef({ version: source.version, receipt });
  latest.current = { version: source.version, receipt };
  const [, renderApproval] = useState(0);
  const [notice, setNotice] = useState("");
  const inScope = request === readNoticeTalk() && request.ownerId === user?.uid;
  const ready = inScope && source.state === "ready";
  const approved = ready && !!selected.length && !!question.trim() && approval.current?.version === source.version && approval.current.receipt === receipt;
  if (!approved) approval.current = null;
  const revoke = () => { approval.current = null; renderApproval(value => value + 1); };
  const api: NoticeTalkController = {
    request,
    revoke,
    prepare: (outgoingQuestion) => {
      const isCurrent = () => request === readNoticeTalk() && inScope && latest.current.version === source.version && latest.current.receipt === receipt
        && approval.current?.version === source.version && approval.current.receipt === receipt && source.isCurrent();
      if (!approved || !isCurrent() || outgoingQuestion !== question && outgoingQuestion !== draft) {
        approval.current = null;
        setNotice(c.reviewNeeded);
        source.reload();
        return null;
      }
      // Resolve the current selected records again; never return an old copied note.
      return { message: reviewedPortraitDraft(question, request.childId, source.sources.filter(item => ids.includes(item.id)), he), isCurrent };
    },
  };
  controller.current = api;
  useEffect(() => () => { approval.current = null; if (controller.current?.request === request) controller.current = null; }, [controller, request]);
  const toggle = (id: string) => {
    approval.current = null;
    setNotice("");
    setSelection({ version: source.version, ids: ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id] });
  };
  const review = () => {
    if (!ready || !selected.length || !question.trim() || !source.isCurrent()) {
      approval.current = null; setNotice(c.reviewNeeded); source.reload(); return;
    }
    approval.current = approved ? null : { version: source.version, receipt };
    setNotice(""); renderApproval(value => value + 1);
  };
  return <section data-testid="notice-talk-review" aria-label={c.talkTitle} className="mb-3 max-h-[min(48dvh,28rem)] overflow-y-auto overscroll-contain rounded-2xl border p-4 text-sm" style={{ background: "var(--arbor-paper-deep)", borderColor: "var(--arbor-rule)", color: "var(--arbor-ink)" }}>
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0"><h2 className="text-base font-bold">{c.talkTitle}</h2>{ready && <p className="mt-1 font-semibold"><FreeText text={source.title} /></p>}</div>
      <button type="button" onClick={() => clearNoticeTalk(request)} aria-label={c.remove} className="min-h-11 min-w-11 rounded-xl"><Icon name="close" size={18} /></button>
    </div>
    {!ready ? <div role="status"><p className="leading-relaxed">{c[inScope ? source.state === "loading" ? "loading" : source.state === "unanswered" ? "unanswered" : "unavailable" : "unavailable"]}</p>
      <button type="button" className="min-h-11 underline underline-offset-2" onClick={source.reload}>{c.retry}</button></div> : <>
      <p className="mt-2 text-sm leading-relaxed">{c.choose}</p>
      <div className="mt-2 space-y-2" role="group" aria-label={c.choose}>
        {source.sources.map(item => <button key={item.id} type="button" role="checkbox" aria-checked={ids.includes(item.id)} data-testid={`notice-talk-source-${item.kind}`}
          onClick={() => toggle(item.id)} className="flex w-full min-h-11 items-start gap-3 rounded-xl border p-3 text-start" style={{ borderColor: "var(--arbor-rule)", background: "var(--arbor-paper-elevated)" }}>
          <span aria-hidden="true" className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border" style={{ borderColor: "var(--arbor-rule-strong)" }}>{ids.includes(item.id) && <Icon name="check" size={16} />}</span>
          <span className="min-w-0"><span className="block font-semibold">{item.label}</span><span className="block text-sm leading-relaxed"><FreeText text={item.text} /></span>
            <span className="mt-1 block text-xs" style={{ color: "var(--arbor-muted)" }}>{item.source} · <bdi>{item.at}</bdi></span></span>
        </button>)}
      </div>
      {draft && <details className="mt-3" open><summary className="min-h-11 content-center font-semibold">{c.preview}</summary><pre data-testid="notice-talk-preview" dir={he ? "rtl" : "ltr"} className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl p-3 text-sm font-sans" style={{ background: "var(--arbor-paper-elevated)" }}>{draft}</pre></details>}
      {!selected.length ? <p className="mt-2 text-sm">{c.selectFirst}</p> : !question.trim() ? <p className="mt-2 text-sm">{c.questionFirst}</p> : null}
      <button type="button" role="checkbox" aria-checked={approved} disabled={!selected.length || !question.trim()} data-testid="notice-talk-approved" onClick={review}
        className="mt-2 flex min-h-11 items-center gap-2 rounded-xl px-2 text-start font-semibold disabled:opacity-50"><span aria-hidden="true" className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border" style={{ borderColor: "var(--arbor-rule-strong)" }}>{approved && <Icon name="check" size={16} />}</span>{c.review}</button>
      <p className="text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{c.oneSend}</p>
    </>}
    {notice && <p role="status" className="mt-2 text-sm">{notice}</p>}
  </section>;
}
