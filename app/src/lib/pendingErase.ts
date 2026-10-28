/**
 * B-GA-09 — a child erase that did not reach every place stays pending on
 * this device, for the account that started it, until a retry completes it.
 *
 * The device half of an erase runs even when the server half fails, so the
 * child leaves the switcher at once (wipeClientChildData deletes the profile)
 * and nothing in the app could reach that child again: closing an unfinished
 * receipt used to throw away the only way to finish. The unfinished receipt is
 * kept here so Your data can offer "Finish deleting a child's data" until a
 * retry completes it; it is cleared then.
 *
 * A shared device (rounds 5 and 6):
 *  - each entry carries the uid of the account that started the erase, and
 *    only that account's entries are read back, so the next account never
 *    sees it;
 *  - an entry holds only what the retry needs: the child's id (to erase it
 *    again) and the receipt so far (counts and the per-place ledger, to fold
 *    the retry into one honest receipt). No name: the child's name is data
 *    the parent asked us to erase, so the offer and the receipt it reopens
 *    say "a child" instead;
 *  - sign-out keeps it: the server still holds what the erase missed, and
 *    the same account must find the offer again after signing back in.
 *    Account deletion sends this account's pending child ids with the request
 *    (the server finishes those it may erase), then removes every `arbor*` key
 *    (DeleteAccountModal).
 *
 * Account-level key on purpose: the child's own erase sweeps every key that
 * carries the child id (clearChildLocalState), and a retry runs that sweep, so
 * a child-scoped key would delete itself before the erase finished.
 * Registered in ACCOUNT_DEVICE_KEYS.
 */
import type { DeletionReceipt } from "../types";
import { mergeErasureReceipts, receiptView } from "./childDataSinks";

export const PENDING_ERASE_KEY = "arbor.pendingErase";

export interface PendingErase {
  /** The account that started the erase ("" = the local sandbox). */
  uid: string;
  childId: string;
  /** The receipt so far: ids, dates, counts and the per-place ledger only. */
  receipt: DeletionReceipt;
}

const store = (explicit?: Storage | null): Storage | null => {
  if (explicit !== undefined) return explicit;
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
};

const valid = (v: unknown): v is PendingErase => {
  const p = v as PendingErase;
  return !!p && typeof p.uid === "string" && typeof p.childId === "string" && !!p.childId
    && !!p.receipt && typeof p.receipt === "object" && p.receipt.childId === p.childId && typeof p.receipt.erasedAt === "string";
};

function readAll(storage?: Storage | null): PendingErase[] {
  try {
    const raw = store(storage)?.getItem(PENDING_ERASE_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(valid).map(({ uid, childId, receipt }) => ({ uid, childId, receipt })) : [];
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

/** This account's erases still to finish on this device (never throws). */
export function readPendingErases(uid: string, storage?: Storage | null): PendingErase[] {
  return readAll(storage).filter((p) => p.uid === uid);
}

/** Did this erase reach every registered place? */
export function receiptFinished(r: DeletionReceipt): boolean {
  return receiptView(r.sinks, {
    memoryEvents: r.counts.memoryEvents, shares: r.counts.shares, consents: r.counts.consents ?? 0,
    consultRequests: r.counts.consultRequests ?? 0, storageFiles: r.counts.storageFiles ?? 0, clientDocs: r.counts.clientDocs ?? 0,
  }).finished;
}

/** Record an erase attempt: a finished one is forgotten, an unfinished one kept
 *  (replacing that child's earlier entry). Returns whether it finished. */
export function settlePendingErase(uid: string, receipt: DeletionReceipt, storage?: Storage | null): boolean {
  const done = receiptFinished(receipt);
  const others = readAll(storage).filter((p) => !(p.uid === uid && p.childId === receipt.childId));
  write(done ? others : [...others, { uid, childId: receipt.childId, receipt }], storage);
  return done;
}

/** The app shell, when no child is left to open Your data from: retry each of
 *  this account's unfinished erases once, folding each result into its receipt. */
export async function finishPendingErases(
  uid: string,
  erase: (childId: string) => Promise<DeletionReceipt | null>,
  storage?: Storage | null,
): Promise<void> {
  for (const p of readPendingErases(uid, storage)) {
    try {
      const r = await erase(p.childId);
      if (r) settlePendingErase(uid, mergeErasureReceipts(p.receipt, r), storage);
    } catch {
      /* stays pending; Your data offers it once a child exists again */
    }
  }
}
