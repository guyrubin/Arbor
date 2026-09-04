import React, { useCallback, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Modal } from "../ui/Modal";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { api, type AccountDeletionReceipt } from "../../lib/api";
import { accountDeletionLeases } from "../../lib/accountDeletionLease";
import { purgeAllComicPages } from "../../lib/comicPageStore";
import { commerceAllowed } from "../kidmode/parentGate";

/**
 * STORE-4 — full account deletion. Only a complete server receipt wipes the
 * device-local stores and signs out; a partial receipt retains the session
 * for retry. Opening the confirmation never reuses a previous authorization.
 */
export default function DeleteAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const { user, firebaseEnabled, signOut } = useAuth();
  const { toast } = useToast();
  const [confirmText, setConfirmText] = useState("");
  const [partial, setPartial] = useState<AccountDeletionReceipt | null>(null);
  const [error, setError] = useState<"network" | "parental-gate" | null>(null);
  const inputId = useId();
  const statusId = useId();
  const errorId = useId();
  const revision = useRef(0);
  const active = useRef(false);

  const uid = user?.uid;
  const busy = useSyncExternalStore(
    useCallback((listener: () => void) => uid ? accountDeletionLeases.subscribe(uid, listener) : () => {}, [uid]),
    () => uid ? accountDeletionLeases.isPending(uid) : false,
    () => false,
  );

  const confirmWord = t("set.acctDel.confirmWord");
  const armed = confirmText.trim().toUpperCase() === confirmWord.toUpperCase();
  const retryable = partial !== null || error === "network";
  const latest = useRef({ open, uid: user?.uid, firebaseEnabled, authorized: armed || retryable });
  latest.current = { open, uid: user?.uid, firebaseEnabled, authorized: armed || retryable };

  // Reset before paint, including identity changes. Do not unlock an outstanding
  // request here: a forced close/reopen must not permit a duplicate deletion.
  useLayoutEffect(() => {
    active.current = true;
    revision.current += 1;
    if (open) {
      setConfirmText("");
      setPartial(null);
      setError(null);
    }
    return () => { active.current = false; revision.current += 1; };
  }, [open, user?.uid]);

  const requestClose = useCallback(() => {
    const uid = latest.current.uid;
    if (!uid || !accountDeletionLeases.isPending(uid)) onClose();
  }, [onClose]);

  const wipeDeviceData = async (ownsAccount: () => boolean) => {
    // Device-local stores: IndexedDB comic pages (all children) + every
    // arbor-prefixed localStorage key (child collections, attribution, prefs).
    if (!ownsAccount()) return;
    try {
      await purgeAllComicPages();
    } catch {
      /* best effort */
    }
    // The purge can outlive this dialog or account. Never remove a later
    // session's keys after that await (also recheck before every removal).
    if (!ownsAccount()) return;
    try {
      for (const key of Object.keys(localStorage)) {
        if (!ownsAccount()) return;
        if (key.startsWith("arbor")) localStorage.removeItem(key);
      }
    } catch {
      /* best effort */
    }
  };

  const runDeletion = async () => {
    const current = latest.current;
    if (!active.current || !current.open || !current.firebaseEnabled || !current.uid || !current.authorized) return;
    if (accountDeletionLeases.isPending(current.uid)) return;
    // STORE-3: a math-exit browsing session cannot authorize account deletion.
    if (!commerceAllowed()) {
      setError("parental-gate");
      toast(t("elev.gate.blocked"), "info");
      return;
    }
    // Acquisition is synchronous and shared with every instance for this UID.
    const lease = accountDeletionLeases.acquire(current.uid);
    if (!lease) return;
    setError(null);
    const requestRevision = revision.current;
    const requestUid = current.uid;
    const ownsAccount = () => active.current && latest.current.firebaseEnabled && latest.current.uid === requestUid;
    const isCurrent = () => ownsAccount() && revision.current === requestRevision && latest.current.open;
    try {
      const receipt = await api.accountDelete();
      if (!ownsAccount()) return;
      // A forced view close cannot cancel a server deletion. Complete results
      // still clean the same account; only retry feedback belongs to the view.
      if (receipt.complete) {
        await wipeDeviceData(ownsAccount);
        if (!ownsAccount()) return;
        toast(t("set.acctDel.done"), "success");
        onClose();
        await signOut();
      } else if (isCurrent()) {
        setPartial(receipt);
      }
    } catch {
      // No server receipt means an unknown result, not invented partial counts.
      if (isCurrent()) setError("network");
    } finally {
      lease.release();
    }
  };

  const totalDeleted = (r: AccountDeletionReceipt) => r.classes.reduce((n, c) => n + c.deleted, 0);
  const failedClasses = (r: AccountDeletionReceipt) => r.classes.filter((c) => c.failed > 0).map((c) => c.class);

  return (
    <Modal open={open} onClose={requestClose} title={t("set.acctDel.title")}>
      <div className="space-y-4 text-sm" dir="auto">
        <div className="space-y-4" aria-busy={busy}>
          {!retryable && (
            <>
              <p className="leading-relaxed" style={{ color: "var(--arbor-ink)" }}>{t("set.acctDel.body")}</p>
              <div>
                <label htmlFor={inputId} className="text-xs font-semibold block mb-1.5" style={{ color: "var(--arbor-muted)" }}>
                  {t("set.acctDel.typeToConfirm", { word: confirmWord })}
                </label>
                <input
                  id={inputId}
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  disabled={busy}
                  aria-describedby={error ? errorId : undefined}
                  className="w-full rounded-xl px-3 py-2 text-sm min-h-[44px]"
                  style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}
                  autoComplete="off"
                />
              </div>
              <button
                type="button"
                onClick={() => void runDeletion()}
                disabled={!armed || busy}
                aria-describedby={busy ? statusId : undefined}
                className="inline-flex items-center gap-1.5 text-sm font-bold rounded-xl px-4 py-2.5 min-h-[44px] disabled:opacity-40"
                style={{ background: "var(--arbor-pink-soft)", color: "var(--arbor-pink-ink)" }}
              >
                {t("set.acctDel.confirm")}
              </button>
            </>
          )}

          {partial && (
            <>
              <p role="alert" className="font-bold" style={{ color: "var(--arbor-ink)" }}>{t("set.acctDel.partialTitle")}</p>
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
            </>
          )}
          {retryable && (
            <button
              type="button"
              onClick={() => void runDeletion()}
              disabled={busy}
              aria-describedby={error ? errorId : busy ? statusId : undefined}
              className="inline-flex items-center gap-1.5 text-sm font-bold rounded-xl px-4 py-2.5 min-h-[44px] disabled:opacity-50"
              style={{ background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" }}
            >
              {t("set.acctDel.retry")}
            </button>
          )}
        </div>
        {error && (
          <p id={errorId} role="alert" className="text-xs leading-relaxed" style={{ color: "var(--arbor-ink)" }}>
            {t(error === "parental-gate" ? "elev.gate.blocked" : "elev.accountSettings.network")}
          </p>
        )}
        <p id={statusId} role="status" aria-live="polite" className="text-xs" style={{ color: "var(--arbor-muted)" }}>
          {busy ? t("elev.accountSettings.deleting") : ""}
        </p>
      </div>
    </Modal>
  );
}
