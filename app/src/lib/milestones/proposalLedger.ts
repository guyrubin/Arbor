/**
 * B-LOOP-06 — the "Not this" ledger for milestone proposals on saved moments
 * (kept beside, not inside, lib/captureUndo.ts: that module is handed no
 * write-or-erase seam by design, and this ledger writes device storage).
 */
import { childScopedKey } from "../childLocalState";

/* ── B-LOOP-06 · the "Not this" ledger ──────────────────────────────────────
 * A milestone proposal on a saved moment ("Sounds like … — add it as seen?")
 * that the parent turns down is recorded here, per child, by behaviour-log
 * id, so the SAME log is never proposed again. Device-local and child-scoped
 * (`childScopedKey`, swept with the child). Best-effort: a blocked storage
 * means the parent may see the proposal again, never a write. */

/** The storage the ledger reads and writes (window.localStorage by default). */
export type LedgerStorage = Pick<Storage, "getItem" | "setItem">;

export const MILESTONE_PROPOSAL_DECLINED_NAMESPACE = "milestoneProposal.declined";
const MAX_DECLINED = 200;

const ledgerStore = (storage?: LedgerStorage | null): LedgerStorage | null => {
  if (storage) return storage;
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

const readDeclined = (key: string, storage: LedgerStorage | null): string[] => {
  if (!storage) return [];
  try {
    const raw = JSON.parse(storage.getItem(key) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

/** "Not this": the log id joins the child's declined ledger. */
export function declineMilestoneProposal(childId: string, logId: string, storage?: LedgerStorage | null): void {
  const store = ledgerStore(storage);
  if (!store || !childId || !logId) return;
  const key = childScopedKey(MILESTONE_PROPOSAL_DECLINED_NAMESPACE, childId);
  const next = [logId, ...readDeclined(key, store).filter((id) => id !== logId)].slice(0, MAX_DECLINED);
  try {
    store.setItem(key, JSON.stringify(next));
  } catch {
    /* best-effort */
  }
}

/** True when the parent already said "Not this" to this log's proposal. */
export function isMilestoneProposalDeclined(childId: string, logId: string, storage?: LedgerStorage | null): boolean {
  if (!childId || !logId) return false;
  return readDeclined(childScopedKey(MILESTONE_PROPOSAL_DECLINED_NAMESPACE, childId), ledgerStore(storage)).includes(logId);
}
