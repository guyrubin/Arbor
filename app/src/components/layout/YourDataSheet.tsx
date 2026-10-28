import React, { useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon";
import Modal from "../ui/Modal";
import { useArbor } from "../../context/ArborContext";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useProfile } from "../../context/ProfileContext";
import { useToast } from "../../context/ToastContext";
import { downloadDeletionReceipt, downloadJson, exportChildData } from "../../lib/childData";
import { createChildExportRun } from "../../lib/childExportRun";
import { childExportFilename } from "../../lib/childExportFilename";
import { withChildExportSession } from "../../lib/childExportSession";
import { fmtDay } from "../../lib/formatDate";
import { mergeErasureReceipts, RECEIPT_ROWS, receiptTitleKey, receiptView, type ReceiptRowId } from "../../lib/childDataSinks";
import type { DeletionReceipt } from "../../types";

/**
 * B-CAREPRO-35 · Data rights get ONE home: Settings › Your data.
 *
 * There used to be four doors with different rigour: Sharing (export + a
 * typed-name delete with a receipt), the profile drawer (export + a delete
 * with no receipt, English literals, refusing the only child), Settings' data
 * row (which opened #/profile, not the controls) and account deletion in
 * Settings. This sheet is the one place that:
 *   - exports the active child with explicit completeness via `exportChildData`
 *     (profile + every CHILD_SUBCOLLECTIONS sink + the server memory ledger
 *     and share grants), with the parent-facing note as a top-level field;
 *   - deletes the active child — typed child-name confirmation →
 *     ProfileContext.deleteChild → eraseEverything → the DeletionReceipt,
 *     ALWAYS rendered as the done-state;
 *   - opens account deletion (DeleteAccountModal, owned by SettingsModal) when
 *     a real signed-in account exists.
 * Sharing, the profile drawer and The Science link here
 * (`requestOpenSettings({ focus: "data" })` opens this sheet directly).
 */
export default function YourDataSheet({ open, onClose, onDeleteAccount }: {
  open: boolean;
  onClose: () => void;
  /** Present only for a real signed-in account (SettingsModal decides). */
  onDeleteAccount?: () => void;
}) {
  const { childProfile, setActiveTab } = useArbor();
  const { deleteChild } = useProfile();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, uiLang } = useLanguage();
  const first = (childProfile.name || "").split(" ")[0];

  // ── Export ────────────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<"complete" | "incomplete" | null>(null);
  const exportRun = useRef(createChildExportRun());
  const exportButtonRef = useRef<HTMLButtonElement | null>(null);
  const scope = `${open}|${user?.uid ?? ""}|${childProfile.id}`;
  const scopeRef = useRef(scope);
  const lifetimeRef = useRef({ active: true });
  // Invalidate during render, not only effect cleanup: A→B→A cannot revive A.
  if (scopeRef.current !== scope) {
    exportRun.current.cancel();
    scopeRef.current = scope;
    lifetimeRef.current = { active: true };
  }
  const lifetime = lifetimeRef.current;
  useEffect(() => {
    lifetime.active = true;
    setExporting(false);
    setExportResult(null);
    return () => {
      lifetime.active = false;
      if (lifetimeRef.current === lifetime) exportRun.current.cancel();
    };
  }, [lifetime]);
  const exportData = async () => {
    if (!open || !lifetime.active || lifetimeRef.current !== lifetime) return;
    const run = exportRun.current.begin(scope);
    if (!run) return;
    // Disabling a focused native button can send focus to body without a
    // focusin event. Keep it on this stable, non-destructive dialog root before
    // that commit; Close remains keyboard-accessible throughout the request.
    const button = exportButtonRef.current;
    if (button && document.activeElement === button) {
      button.closest<HTMLElement>('[role="dialog"]')?.focus({ preventScroll: true });
    }
    setExporting(true);
    setExportResult(null);
    try {
      await withChildExportSession(user?.uid, run.controller.signal, async (session) => {
        const data = await exportChildData(user?.uid, childProfile, { signal: session.signal });
        session.assertCurrent();
        const assertCurrent = () => {
          session.assertCurrent();
          if (!lifetime.active || lifetimeRef.current !== lifetime || !exportRun.current.current(run, scopeRef.current)) {
            throw new DOMException("The export is no longer active", "AbortError");
          }
        };
        assertCurrent();
        const status = data.exportReceipt.status;
        downloadJson(childExportFilename(childProfile.name || "", status), { ...data, exportNote: t("sec.sharing.data.exportNote") }, assertCurrent);
        setExportResult(status);
      });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError") && exportRun.current.current(run, scopeRef.current)) toast(t("elev.yourData.exportFailed"), "error");
    } finally {
      if (exportRun.current.current(run, scopeRef.current)) setExporting(false);
      exportRun.current.finish(run);
    }
  };

  // ── Delete the child (CARE-1: typed name → real erasure → receipt) ────────
  const [deleting, setDeleting] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [erasing, setErasing] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [receipt, setReceipt] = useState<DeletionReceipt | null>(null);
  const [deletedName, setDeletedName] = useState("");
  const nameMatches = confirmName.trim().toLowerCase() === first.trim().toLowerCase() && first.trim() !== "";

  // A fresh opening starts on the menu, never on a stale confirmation.
  useEffect(() => {
    if (open) { setDeleting(false); setConfirmName(""); setDeleteFailed(false); }
  }, [open]);

  const closeAll = () => {
    if (erasing) return; // never abandon an erasure mid-flight
    lifetime.active = false;
    exportRun.current.cancel();
    setExporting(false);
    const hadReceipt = receipt != null;
    setDeleting(false);
    setConfirmName("");
    setDeleteFailed(false);
    setReceipt(null);
    onClose();
    // The child no longer exists — route away from the deleted child's surfaces.
    if (hadReceipt) setActiveTab("overview");
  };

  // B-BOOK-20 (critic r1): a deletion that did not reach every registered
  // place is NOT "complete". Retry erases the same child again (by id; the
  // child has already left the switcher) and folds the result into the one
  // receipt the parent keeps.
  const retryDelete = async () => {
    if (!receipt || erasing) return;
    setErasing(true);
    try {
      const r = await deleteChild(receipt.childId);
      if (r) setReceipt((prev) => (prev ? mergeErasureReceipts(prev, r) : r));
    } catch {
      /* the receipt still says not finished; the parent can try again */
    } finally {
      setErasing(false);
    }
  };
  const saveReceipt = () => {
    if (receipt) downloadDeletionReceipt(receipt);
  };

  const confirmDelete = async () => {
    if (!nameMatches || erasing) return;
    setErasing(true);
    setDeleteFailed(false);
    const name = first;
    const childId = childProfile.id;
    try {
      const r = await deleteChild(childId);
      setDeletedName(name);
      setReceipt(r ?? { childId, erasedAt: new Date().toISOString(), counts: { memoryEvents: 0, shares: 0 } });
    } catch {
      setDeleteFailed(true);
    } finally {
      setErasing(false);
    }
  };

  const view = receipt ? receiptView(receipt.sinks, {
    memoryEvents: receipt.counts.memoryEvents,
    shares: receipt.counts.shares,
    consents: receipt.counts.consents ?? 0,
    consultRequests: receipt.counts.consultRequests ?? 0,
    storageFiles: receipt.counts.storageFiles ?? 0,
    clientDocs: receipt.counts.clientDocs ?? 0,
  }) : null;
  const title = receipt && view
    ? t(receiptTitleKey(view.finished))
    : deleting
      ? t("sec.sharing.delete.title", { name: first })
      : t("sec.sharing.data.title");

  return (
    <Modal open={open} onClose={closeAll} title={title}>
      {receipt && view ? (
        <div className="space-y-4" data-testid="delete-receipt" data-receipt-state={view.finished ? "complete" : "unfinished"} aria-live="polite">
          <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-ink)" }}>
            {view.finished
              ? t("sec.sharing.receipt.body", { name: deletedName, date: fmtDay(receipt.erasedAt, uiLang) })
              : t("elev.learnCare.receipt.unfinishedBody", { name: deletedName })}
          </p>
          <div className="rounded-2xl p-4 space-y-2" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
            {/* B-BOOK-20: the child's saved records and Storage files are part of the
                proof; LC-18: so is the device the parent is holding. A row the
                erase could not reach says so instead of a silent 0. A row that
                stands for several places says how many, in plain words; the
                per-place ids live only in the saved receipt file. */}
            {RECEIPT_ROWS.map((row) => {
              const { total, unreached } = view.places[row];
              const note = total > 1 || unreached > 0
                ? (unreached > 0 ? t("elev.learnCare.receipt.placesSome", { n: total, m: unreached }) : t("elev.learnCare.receipt.placesAll", { n: total }))
                : undefined;
              return <ReceiptRow key={row} label={t(RECEIPT_LABEL[row])} note={note} value={view.rows[row] === "not-reached" ? t("elev.learnCare.receipt.notReached") : view.rows[row]} />;
            })}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            {!view.finished && (
              <button type="button" data-testid="delete-receipt-retry" onClick={() => void retryDelete()} disabled={erasing} className="w-full sm:w-auto rounded-xl px-4 min-h-11 text-sm font-bold disabled:opacity-60" style={{ background: "var(--arbor-green-ink)", color: "var(--arbor-paper-elevated)" }}>
                {erasing ? t("sec.sharing.delete.working") : t("elev.learnCare.receipt.retry")}
              </button>
            )}
            <button type="button" data-testid="delete-receipt-save" onClick={saveReceipt} className="w-full sm:w-auto rounded-xl px-4 min-h-11 text-sm font-bold" style={{ border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}>
              {t("elev.learnCare.receipt.save")}
            </button>
            <button onClick={closeAll} disabled={erasing} className="w-full sm:w-auto rounded-xl px-4 min-h-11 text-sm font-bold" style={view.finished ? { background: "var(--arbor-green-ink)", color: "var(--arbor-paper-elevated)" } : { border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}>
              {t("sec.sharing.receipt.done")}
            </button>
          </div>
        </div>
      ) : deleting ? (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-ink)" }}>{t("sec.sharing.delete.body", { name: first })}</p>
          <div className="space-y-1.5">
            <label htmlFor="your-data-delete-confirm" className="block text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>
              {t("sec.sharing.delete.typeToConfirm", { name: first })}
            </label>
            <input
              id="your-data-delete-confirm"
              data-testid="delete-confirm-input"
              dir="auto"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              autoComplete="off"
              className="w-full min-h-11 rounded-xl px-3 py-2.5 text-sm"
              style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
            />
          </div>
          {deleteFailed && (
            <p role="alert" className="text-xs font-bold" style={{ color: "var(--arbor-pink-ink)" }}>{t("sec.sharing.delete.error")}</p>
          )}
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <button onClick={() => { if (!erasing) { setDeleting(false); setConfirmName(""); } }} disabled={erasing} className="inline-flex items-center justify-center rounded-xl px-4 min-h-11 text-sm font-bold disabled:opacity-50" style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}>
              {t("sec.sharing.delete.cancel")}
            </button>
            <button
              onClick={confirmDelete}
              disabled={!nameMatches || erasing}
              data-testid="delete-confirm-btn"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-4 min-h-11 text-sm font-bold disabled:opacity-40"
              style={{ background: "var(--arbor-pink-soft)", color: "var(--arbor-pink-ink)" }}
            >
              {erasing
                ? <><Icon name="progress_activity" size={16} className="animate-spin" /> {t("sec.sharing.delete.working")}</>
                : <><Icon name="delete_forever" size={16} /> {t("sec.sharing.delete.confirm")}</>}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3" data-testid="your-data-sheet">
          <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("elev.yourData.sub", { name: first })}</p>
          <button
            ref={exportButtonRef}
            onClick={exportData}
            disabled={exporting}
            data-testid="your-data-export"
            className="w-full inline-flex items-center gap-2 text-sm font-bold rounded-xl px-4 min-h-11 disabled:opacity-60"
            style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}
          >
            <Icon name={exporting ? "progress_activity" : "download"} size={18} className={exporting ? "animate-spin" : undefined} /> {t("elev.yourData.export", { name: first })}
          </button>
          <p className="text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("elev.yourData.exportLimits")}</p>
          {exportResult && <p role="status" data-testid="your-data-export-receipt" className="text-sm leading-relaxed" style={{ color: "var(--arbor-ink)" }}>
            {t(exportResult === "complete" ? "elev.yourData.exportComplete" : "elev.yourData.exportPartial")}
          </p>}
          <button
            onClick={() => setDeleting(true)}
            disabled={exporting}
            data-testid="delete-child-btn"
            className="w-full inline-flex items-center gap-2 text-sm font-bold rounded-xl px-4 min-h-11"
            style={{ background: "var(--arbor-pink-soft)", color: "var(--arbor-pink-ink)" }}
          >
            <Icon name="delete" size={18} /> {t("sec.sharing.delete.btn")}
          </button>
          {onDeleteAccount && (
            <button
              type="button"
              disabled={exporting}
              onClick={() => { onClose(); onDeleteAccount(); }}
              aria-haspopup="dialog"
              data-testid="your-data-delete-account"
              className="w-full inline-flex items-center gap-2 text-sm font-semibold rounded-xl px-4 min-h-11"
              style={{ color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
            >
              <Icon name="person_remove" size={18} /> {t("set.acctDel.open")}
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}

/** The receipt rows, in order: saved records, the server ledger, grants,
 *  consents, consult requests, Storage files, this device. */
const RECEIPT_LABEL: Record<ReceiptRowId, string> = {
  records: "elev.learnCare.receipt.records",
  memoryEvents: "sec.sharing.receipt.memoryEvents",
  shares: "sec.sharing.receipt.shares",
  consents: "sec.sharing.receipt.consents",
  consultRequests: "elev.learnCare.receipt.consultRequests",
  storageFiles: "elev.learnCare.receipt.storageFiles",
  clientDocs: "elev.learnCare.receipt.clientDocs",
};

function ReceiptRow({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="min-w-0" style={{ color: "var(--arbor-muted)" }}>
        {label}
        {note && <span className="block text-xs" data-receipt-places="">{note}</span>}
      </span>
      <span className="shrink-0 whitespace-nowrap font-bold" style={{ color: "var(--arbor-ink)" }}>{value}</span>
    </div>
  );
}
