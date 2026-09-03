import React, { useEffect, useState } from "react";
import { Modal } from "../ui/Modal";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import type { TimelineSignal } from "../../lib/signalTimeline";
import type { BehaviorLog } from "../../types";

/**
 * JournalEntrySheet — TJB-13: journal rows open, re-read in full, and can be
 * corrected. The row tap opens this sheet with the full text, the full-size
 * photo and the time; a parent-written moment (kind "moment") can be edited
 * in place (the parent's own words — `trigger`) and deleted with Undo through
 * the toast's action slot (CR-09). Every write goes through the existing
 * behaviorLogs sink (patchLog / deleteLog / restoreLog) — no new write path.
 *
 * Delete is reversible by design, so there is deliberately NO confirm
 * dialog: the Undo toast is the safety valve (the Behaviors accordion still
 * uses window.confirm; this sheet is the pattern going forward).
 */
export default function JournalEntrySheet({
  signal,
  log,
  title,
  detail,
  when,
  onClose,
}: {
  signal: TimelineSignal | null;
  /** The underlying behavior log when the row is a parent-written moment. */
  log?: BehaviorLog;
  title: string;
  detail: string;
  when: string;
  onClose: () => void;
}) {
  const { patchLog, deleteLog, restoreLog } = useArbor();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(log?.trigger ?? "");

  useEffect(() => {
    setEditing(false);
    setText(log?.trigger ?? "");
  }, [log?.id, log?.trigger, signal?.id]);

  const open = !!signal;
  const editable = !!log && signal?.kind === "moment";

  const save = () => {
    if (!log) return;
    const next = text.trim();
    if (!next) return;
    patchLog(log.id, { trigger: next });
    setEditing(false);
    toast(t("journal.sheet.saved"), "success");
  };

  const remove = () => {
    if (!log) return;
    const snapshot: BehaviorLog = { ...log };
    deleteLog(log.id);
    onClose();
    toast(t("journal.sheet.deleted"), "info", {
      action: { label: t("journal.sheet.undo"), onClick: () => restoreLog(snapshot) },
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={t("journal.sheet.title")}>
      {signal && (
        <div className="space-y-4 text-sm" data-testid="journal-entry-sheet" dir="auto">
          {when && (
            <p className="text-[11px] font-bold" style={{ color: "var(--arbor-muted)" }}>{when}</p>
          )}
          {editing && log ? (
            <div className="space-y-2">
              <label htmlFor="journal-sheet-text" className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("journal.sheet.editLabel")}</label>
              <textarea
                id="journal-sheet-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                autoFocus
                className="w-full rounded-xl p-3 text-sm"
                style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
              />
              <div className="flex gap-2">
                <button type="button" onClick={save} className="min-h-[44px] flex-1 rounded-xl px-3 text-xs font-extrabold text-white" style={{ background: "var(--arbor-gradient-primary)" }}>
                  {t("journal.sheet.save")}
                </button>
                <button type="button" onClick={() => { setEditing(false); setText(log.trigger); }} className="min-h-[44px] rounded-xl px-3 text-xs font-bold" style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)" }}>
                  {t("beh.cancel")}
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-[15px] font-semibold leading-relaxed" style={{ color: "var(--arbor-ink)" }}>{title}</p>
              {detail && (
                <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }}>{detail}</p>
              )}
              {log?.notes && (
                <p className="text-[12.5px] leading-relaxed italic" style={{ color: "var(--arbor-muted)" }}>{log.notes}</p>
              )}
            </>
          )}
          {signal.photo && (
            <img src={signal.photo} alt="" className="w-full max-h-[320px] rounded-2xl object-cover" style={{ border: "1px solid var(--arbor-rule)" }} />
          )}
          {editable && !editing && (
            <div className="flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: "var(--arbor-rule)" }}>
              <button
                type="button"
                onClick={() => setEditing(true)}
                data-testid="journal-sheet-edit"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-xs font-extrabold"
                style={{ border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-green-ink)" }}
              >
                <Icon name="edit" size={15} /> {t("journal.sheet.edit")}
              </button>
              <button
                type="button"
                onClick={remove}
                data-testid="journal-sheet-delete"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-xs font-bold"
                style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)" }}
              >
                <Icon name="delete" size={15} /> {t("journal.sheet.delete")}
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
