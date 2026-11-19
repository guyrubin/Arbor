import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * B-STATUS-01: "your account and data were deleted." Sign-out unmounts the
 * shell, so the line is said where the parent lands — the sign-in screen —
 * the same way a new account's confirmation link is said on the first step
 * (lib/signupNotice). This tab only, no id.
 */
const KEY = "arbor.auth.accountDeleted";
const listeners = new Set<() => void>();
let memory = false;

function emit() { listeners.forEach((listener) => listener()); }

export function markAccountDeleted(): void {
  memory = true;
  try { sessionStorage.setItem(KEY, "1"); } catch { /* memory still carries it in this tab */ }
  emit();
}

export function accountDeletedPending(): boolean {
  if (memory) return true;
  try { return sessionStorage.getItem(KEY) === "1"; } catch { return false; }
}

export function clearAccountDeleted(): void {
  const was = accountDeletedPending();
  memory = false;
  try { sessionStorage.removeItem(KEY); } catch { /* nothing kept */ }
  if (was) emit();
}

export function subscribeAccountDeleted(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** True for the sign-in screen that should say the line, including after the
 *  flag is cleared so a later visit to the same screen does not repeat it. */
export function useAccountDeletedReceipt(): boolean {
  const pending = useSyncExternalStore(subscribeAccountDeleted, accountDeletedPending, () => false);
  const [shown, setShown] = useState(pending);
  useEffect(() => {
    if (!pending) return;
    setShown(true);
    clearAccountDeleted();
  }, [pending]);
  return shown || pending;
}
