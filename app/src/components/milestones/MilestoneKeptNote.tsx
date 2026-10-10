import React from "react";
import { useLanguage } from "../../context/LanguageContext";
import type { MilestoneKeptHistory } from "../../hooks/useMilestoneKeptNotes";
import type { FirstKeepsake } from "../../lib/firstsKeepsake";
import type { KeptThing } from "../../lib/kept/keptThings";
import { fmtDay } from "../../lib/formatDate";
import KeptItem from "../kept/KeptItem";

/** A saved note remains readable/editable even when it cannot be verified as
 * a parent-seen first. Only the shared selector's exact eligible source pair
 * gets the shared attribution and freshness-checked text Send. */
export default function MilestoneKeptNote({ note, item, childName, scope, disabled, beforeExport, onEdit }: {
  note: FirstKeepsake; item?: KeptThing; childName: string; scope: string;
  disabled: boolean; beforeExport: () => boolean; onEdit: () => void;
}) {
  const { t, uiLang } = useLanguage();
  return <div data-testid="ms-keepsake" className="kept-reader min-w-0">
    {item ? <KeptItem key={`${scope}:${JSON.stringify([childName, item])}`} item={item} childName={childName} disabled={disabled} beforeExport={beforeExport} />
      : <div data-testid="ms-keepsake-unverified">
        <p className="kept-words"><bdi dir="auto">{note.note}</bdi></p>
        <p className="t-xs" style={{ color: "var(--arbor-ink-soft)" }}>{t("elev.waveR.keepsake.on", { date: fmtDay(note.noticedOn, uiLang) })}</p>
      </div>}
    {note.photoUrl && <img src={note.photoUrl} alt="" className="mt-2 w-full rounded-lg object-cover" style={{ maxHeight: 160 }} />}
    <button type="button" className="kept-text-button" data-testid="ms-keepsake-edit" onClick={onEdit}>{t("elev.waveR.keepsake.edit")}</button>
  </div>;
}

/** One truthful status/paging control for both source histories. Missing
 * history is never presented as an empty record or silently truncated. */
export function MilestoneKeptStatus({ history }: { history: MilestoneKeptHistory }) {
  const { t } = useLanguage();
  return <div data-testid="ms-kept-status" className="kept-reader">
    {history.changed && <p className="kept-reader-status" role="status">{t("kept.changed")}</p>}
    {history.error ? <p className="kept-reader-status" role="status">{t("kept.error")} <button type="button" className="kept-text-button" onClick={history.reload}>{t("kept.retry")}</button></p>
      : history.loading ? <p className="kept-reader-status" role="status">{t("kept.loading")}</p>
      : !history.confirmed ? <p className="kept-reader-status" role="status">{t("kept.offline")}</p> : null}
    {history.more && <div className="kept-reader-status">
      <p>{t("kept.notesPending")}</p>
      <button type="button" className="kept-text-button" disabled={history.loading || history.error} onClick={history.loadMore}>{t("kept.loadMore")}</button>
    </div>}
  </div>;
}
