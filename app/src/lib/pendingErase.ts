/**
 * B-GA-09 round 4 — a child erase that did not reach every place stays
 * pending on this device until a retry completes it.
 *
 * The device half of an erase runs even when the server half fails, so the
 * child leaves the switcher at once (wipeClientChildData deletes the profile)
 * and nothing in the app could reach that child again: closing an unfinished
 * receipt used to throw away the only way to finish. The unfinished receipt is
 * kept here, under ONE account-level key, so Your data can offer "Finish
 * deleting {name}" until a retry completes; it is cleared then.
 *
 * Account-level on purpose: the child's own erase sweeps every key that
 * carries the child id (clearChildLocalState), and a retry runs that sweep, so
 * a child-scoped key would delete itself before the erase finished. What it
 * holds: the child's id, first name and the receipt (counts and the per-place
 * ledger), nothing else. Registered in ACCOUNT_DEVICE_KEYS; account deletion
 * removes every `arbor*` key.
 *
 * A new module because nothing existing fits: the Firestore write queue
 * (lib/firestoreWrite.settleOrQueue) holds document writes the SDK replays,
 * while this is a server erase the parent must see and finish.
 */
import type { DeletionReceipt } from "../types";

export const PENDING_ERASE_KEY = "arbor.pendingErase";

export interface PendingErase {
  childId: string;
  /** The child's first name, for "Finish deleting {name}". */
  name: string;
  receipt: DeletionReceipt;
}

const store = (explicit?: Storage | null): Storage | null => {
  if (explicit !== undefined) return explicit;
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
};

const valid = (v: unknown): v is PendingErase => {
  const p = v as PendingErase;
  return !!p && typeof p.childId === "string" && !!p.childId && typeof p.name === "string"
    && !!p.receipt && typeof p.receipt === "object" && p.receipt.childId === p.childId && typeof p.receipt.erasedAt === "string";
};

/** Every erase still to finish on this device (never throws). */
export function readPendingErases(storage?: Storage | null): PendingErase[] {
  try {
    const raw = store(storage)?.getItem(PENDING_ERASE_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(valid) : [];
  } catch {
    return [];
  }
}

function write(list: PendingErase[], storage?: Storage | null): void {
  try {
    const s = store(storage);
    if (!s) return;
    if (list.length) s.setItem(PENDING_ERASE_KEY, JSON.stringify(list));
    else s.removeItem(PENDING_ERASE_KEY);
  } catch {
    /* storage unavailable: the receipt on screen still says not finished */
  }
}

/** Keep (or replace) the unfinished erase of one child. */
export function rememberPendingErase(entry: PendingErase, storage?: Storage | null): void {
  write([...readPendingErases(storage).filter((p) => p.childId !== entry.childId), entry], storage);
}

/** The erase of this child is finished: forget it. */
export function clearPendingErase(childId: string, storage?: Storage | null): void {
  write(readPendingErases(storage).filter((p) => p.childId !== childId), storage);
}
