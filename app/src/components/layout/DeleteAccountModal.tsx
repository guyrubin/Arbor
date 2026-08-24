import React, { useState } from "react";
import { Modal } from "../ui/Modal";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { api, type AccountDeletionReceipt } from "../../lib/api";
import { purgeAllComicPages } from "../../lib/comicPageStore";
import { commerceAllowed } from "../kidmode/parentGate";

/**
 * STORE-4 — full account deletion (Apple 5.1.1(v) / Play account-deletion /
 * GDPR Art. 17). Type-to-confirm, then the server runs the complete per-class
 * sweep and returns an HONEST receipt: real counts, real failures. Only a
 * complete receipt wipes the device-local stores and signs out; a partial one
 * keeps the account signed in and offers retry — never a fake success.
 */
export default function DeleteAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const { signOut } = useAuth();
  const { toast } = useToast();
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [partial, setPartial] = useState<AccountDeletionReceipt | null>(null);

  const confirmWord = t("set.acctDel.confirmWord");
  const armed = confirmText.trim().toUpperCase() === confirmWord.toUpperCase();

  const wipeDeviceData = async () => {
    // Device-local stores: IndexedDB comic pages (all children) + every
    // arbor-prefixed localStorage key (child collections, attribution, prefs).
    try {
      await purgeAllComicPages();
    } catch {
      /* best effort */
    }
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("arbor")) localStorage.removeItem(key);
      }
    } catch {
      /* best effort */
    }
  };

  const runDeletion = async () => {
    if (busy) return;
    // STORE-3: account deletion is destructive — a session whose parent area
    // was reached via the kid-exit math question cannot trigger it.
    if (!commerceAllowed()) {
      toast(t("elev.gate.blocked"), "info");
      return;
    }
    setBusy(true);
    try {
      const receipt = await api.accountDelete();
      if (receipt.complete) {
        await wipeDeviceData();
        toast(t("set.acctDel.done"), "success");
        onClose();
        await signOut();
      } else {
        setPartial(receipt);
      }
    } catch {
      // Neutral failure state: the server never confirmed anything — keep the
      // account and let the parent retry.
      setPartial({ uid: "", complete: false, authDeleted: false, receiptAt: "", classes: [] });
    } finally {
      setBusy(false);
    }
  };

  const totalDeleted = (r: AccountDeletionReceipt) => r.classes.reduce((n, c) => n + c.deleted, 0);
  const failedClasses = (r: AccountDeletionReceipt) => r.classes.filter((c) => c.failed > 0).map((c) => c.class);

  return (
    <Modal open={open} onClose={onClose} title={t("set.acctDel.title")}>
      <div className="space-y-4 text-sm" dir="auto">
        {!partial && (
          <>
            <p className="leading-relaxed" style={{ color: "var(--arbor-ink)" }}>{t("set.acctDel.body")}</p>
            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--arbor-muted)" }}>
                {t("set.acctDel.typeToConfirm", { word: confirmWord })}
              </label>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-sm"
                style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}
                autoComplete="off"
              />
            </div>
            <button
              onClick={() => void runDeletion()}
              disabled={!armed || busy}
              className="inline-flex items-center gap-1.5 text-sm font-bold rounded-xl px-4 py-2.5 disabled:opacity-40"
              style={{ background: "var(--arbor-pink-soft)", color: "var(--arbor-pink-ink)" }}
            >
              {t("set.acctDel.confirm")}
            </button>
          </>
        )}

        {partial && (
          <>
            <p className="font-bold" style={{ color: "var(--arbor-ink)" }}>{t("set.acctDel.partialTitle")}</p>
            <p className="leading-relaxed text-xs" style={{ color: "var(--arbor-muted)" }}>{t("set.acctDel.partialBody")}</p>
            {partial.classes.length > 0 && (
              <div className="rounded-xl p-3 space-y-1 text-xs" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
                <p style={{ color: "var(--arbor-ink)" }}>
                  {t("set.acctDel.receipt", { deleted: String(totalDeleted(partial)), classes: String(partial.classes.length) })}
                </p>
                {failedClasses(partial).length > 0 && (
                  <p style={{ color: "var(--arbor-muted)" }}>
                    {t("set.acctDel.failedList", { classes: failedClasses(partial).join(", ") })}
                  </p>
                )}
              </div>
            )}
            <button
              onClick={() => void runDeletion()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-sm font-bold rounded-xl px-4 py-2.5 disabled:opacity-50"
              style={{ background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" }}
            >
              {t("set.acctDel.retry")}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
