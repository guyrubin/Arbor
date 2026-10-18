import React, { useMemo, useRef } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useNoticeSource } from "../../hooks/useNoticeSource";
import { openNoticeDetail, readNoticeTarget } from "../../lib/noticeNavigation";
import { noticeCarePacket } from "../../lib/noticeSources";
import AskSpecialist from "../sections/AskSpecialist";
import { FreeText } from "../ui/FreeText";
import { NOTICE_HANDOFF_COPY } from "./noticeHandoffCopy";

/** A selected observation enters the established packet review/export path. */
export default function NoticeCareTarget({ query }: { query: URLSearchParams }) {
  const { childProfile } = useArbor();
  const { uiLang } = useLanguage();
  const he = uiLang === "he";
  const c = NOTICE_HANDOFF_COPY[he ? "he" : "en"];
  const target = readNoticeTarget(query, childProfile.id);
  const source = useNoticeSource(target, he);
  const packet = useMemo(() => noticeCarePacket(source.sources, childProfile.name, new Date().toISOString(), he, childProfile.demo),
    [source.version, childProfile.name, childProfile.demo, he]);
  const lastConfirmedPacket = useRef<typeof packet | null>(null);
  if (source.state === "ready") lastConfirmedPacket.current = packet;
  const blocked = source.state !== "ready";
  const guard = useMemo(() => ({ isCurrent: source.isCurrent }), [source.isCurrent]);
  return <div data-testid="notice-care-target" className="mx-auto w-full max-w-[1180px] space-y-5">
    <header className="border-b pb-5" style={{ borderColor: "var(--arbor-rule)" }}>
      <h1 className="text-2xl font-bold" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)" }}>{c.careTitle}</h1>
      {source.state === "ready" && <p className="mt-2 text-base font-semibold"><FreeText text={source.title} /></p>}
      <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{c.careIntro}</p>
      {target && <button type="button" onClick={() => openNoticeDetail(target.childId, target.milestoneId)} className="mt-2 min-h-11 rounded-xl px-2 text-sm font-semibold underline underline-offset-2">{c.back}</button>}
    </header>
    {blocked && <div role="status" className="rounded-2xl border p-4 text-sm leading-relaxed" style={{ borderColor: "var(--arbor-rule)" }}>
      <p>{c[source.state === "loading" ? "loading" : source.state === "unanswered" ? "unanswered" : "unavailable"]}</p>
      <button type="button" onClick={source.reload} className="mt-2 min-h-11 rounded-xl px-2 font-semibold underline underline-offset-2">{c.retry}</button>
    </div>}
    {/* Keep the parent's unsaved purpose/note through source recovery. The
        hidden editor and every captured export callback remain blocked. */}
    <div hidden={blocked} inert={blocked}>
      {lastConfirmedPacket.current && <AskSpecialist primaryMoveStamp={{ "data-primary-move": "build-share-packet" }} excludeTeacher noticePacket={lastConfirmedPacket.current} noticeRevision={source.version} egressGuard={guard} />}
    </div>
  </div>;
}
