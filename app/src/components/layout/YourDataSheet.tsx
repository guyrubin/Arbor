import React, { useEffect, useState } from "react";
import Icon from "../ui/Icon";
import Modal from "../ui/Modal";
import { useArbor } from "../../context/ArborContext";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useProfile } from "../../context/ProfileContext";
import { useToast } from "../../context/ToastContext";
import { downloadJson, exportChildData } from "../../lib/childData";
import { fmtDay } from "../../lib/formatDate";
import type { DeletionReceipt } from "../../types";

/**
 * B-CAREPRO-35 · Data rights get ONE home: Settings › Your data.
 *
 * There used to be four doors with different rigour: Sharing (export + a
 * typed-name delete with a receipt), the profile drawer (export + a delete
 * with no receipt, English literals, refusing the only child), Settings' data
 * row (which opened #/profile, not the controls) and account deletion in
 * Settings. This sheet is the one place that:
 *   - exports the active child — the COMPLETE record via `exportChildData`
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
  const exportData = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const data = await exportChildData(user?.uid, childProfile);
      downloadJson(`arbor-${first.toLowerCase() || "child"}-data.json`, { ...data, exportNote: t("sec.sharing.data.exportNote") });
      toast(t("sec.sharing.audit.exported", { name: first }), "success");
    } catch {
      toast(t("elev.yourData.exportFailed"), "error");
    } finally {
      setExporting(false);
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
    const hadReceipt = receipt != null;
    setDeleting(false);
    setConfirmName("");
    setDeleteFailed(false);
    setReceipt(null);
    onClose();
    // The child no longer exists — route away from the deleted child's surfaces.
    if (hadReceipt) setActiveTab("overview");
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

  const title = receipt
    ? t("sec.sharing.receipt.title")
    : deleting
      ? t("sec.sharing.delete.title", { name: first })
      : t("sec.sharing.data.title");

  return (
    <Modal open={open} onClose={closeAll} title={title}>
      {receipt ? (
        <div className="space-y-4" data-testid="delete-receipt" aria-live="polite">
          <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-ink)" }}>
            {t("sec.sharing.receipt.body", { name: deletedName, date: fmtDay(receipt.erasedAt, uiLang) })}
          </p>
          <div className="rounded-2xl p-4 space-y-2" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
            <ReceiptRow label={t("sec.sharing.receipt.memoryEvents")} value={receipt.counts.memoryEvents} />
            <ReceiptRow label={t("sec.sharing.receipt.shares")} value={receipt.counts.shares} />
            <ReceiptRow label={t("sec.sharing.receipt.consents")} value={receipt.counts.consents ?? 0} />
            {/* LC-18: the device the parent is holding is part of the proof. */}
            <ReceiptRow label={t("elev.learnCare.receipt.clientDocs")} value={receipt.counts.clientDocs ?? 0} />
          </div>
          <div className="flex sm:justify-end">
            <button onClick={closeAll} className="w-full sm:w-auto rounded-xl px-4 min-h-11 text-sm font-bold" style={{ background: "var(--arbor-green-ink)", color: "var(--arbor-paper-elevated)" }}>
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
            onClick={exportData}
            disabled={exporting}
            data-testid="your-data-export"
            className="w-full inline-flex items-center gap-2 text-sm font-bold rounded-xl px-4 min-h-11 disabled:opacity-60"
            style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}
          >
            <Icon name={exporting ? "progress_activity" : "download"} size={18} className={exporting ? "animate-spin" : undefined} /> {t("elev.yourData.export", { name: first })}
          </button>
          <button
            onClick={() => setDeleting(true)}
            data-testid="delete-child-btn"
            className="w-full inline-flex items-center gap-2 text-sm font-bold rounded-xl px-4 min-h-11"
            style={{ background: "var(--arbor-pink-soft)", color: "var(--arbor-pink-ink)" }}
          >
            <Icon name="delete" size={18} /> {t("sec.sharing.delete.btn")}
          </button>
          {onDeleteAccount && (
            <button
              type="button"
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

function ReceiptRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span style={{ color: "var(--arbor-muted)" }}>{label}</span>
      <span className="font-bold" style={{ color: "var(--arbor-ink)" }}>{value}</span>
    </div>
  );
}
