/* ════════════════════════════════════════════════════════════════════════════
   captureProvenance — AI-04: where a kept AI row's origin is written down.

   WHAT THE SHARED SEAM ALREADY RECORDS (durable, server-side)
   ──────────────────────────────────────────────────────────
   ArborContext.commitConversationProposal is the ONE durable write for a
   proposal, and it already files two records:
     · behaviorLogs/<id>          → `conversationProposalId` + `sourceExcerpt`
     · conversationChanges/<id>   → the whole ConversationChangeRecord
                                    (summary, sourceExcerpt, sourceLanguage,
                                    confirmedBy: "parent", confirmedAt,
                                    providerCanWrite: false, commitRef)
   `conversationChanges` is registered in CHILD_SUBCOLLECTIONS, so both ride
   the GDPR export (Art. 15/20) and the erase sweep (Art. 17).

   WHAT IT CANNOT RECORD, AND WHY THIS FILE EXISTS
   ───────────────────────────────────────────────
   That shape was written for the live voice loop. It has no field for WHICH
   PROMPT produced the sentence, and no field for whether the turn was typed or
   spoken. A kept row that says "the parent confirmed something Arbor said" but
   cannot say which prompt said it is not explainable a year later — and AI-04
   exists precisely to stop a saved row whose origin is not recorded.

   So this module keeps the missing half beside it: one row per kept log id,
   carrying the prompt key + version, the structured field the line was quoted
   from, the turn kind, and the moment the parent chose to keep it.

   DEVICE-LOCAL, AND SWEPT
   ───────────────────────
   The store is `arbor.captureProvenance.<childId>` — minted through
   `childScopedKey`, so `clearChildLocalState` removes it when that child is
   deleted and childLocalStateSweep.guard.test.ts covers it automatically. It
   is an ANNOTATION over rows whose durable record lives server-side: losing it
   on a device switch degrades the chip on the row, never the record itself.

   Pure helpers + best-effort I/O. Never throws: a private window or a disabled
   store must not break a save the parent asked for.
   ════════════════════════════════════════════════════════════════════════════ */
import { childScopedKey } from "./childLocalState";
import type { KeepableField } from "./captureProposals";

/** The per-child namespace. `arbor.captureProvenance.<childId>`. */
export const CAPTURE_PROVENANCE_NAMESPACE = "captureProvenance";

/** The store key for one child — always through the sweepable convention. */
export const captureProvenanceKey = (childId: string): string =>
  childScopedKey(CAPTURE_PROVENANCE_NAMESPACE, childId);

/** Rows are an annotation, not an archive — the newest N are enough. */
export const MAX_PROVENANCE_ROWS = 200;

/** What was recorded about one kept row. */
export interface KeptProvenance {
  /** The behaviorLogs id the shared seam actually wrote (commitRef.id). */
  logId: string;
  /** The proposal id, which is also on the log as `conversationProposalId`. */
  proposalId: string;
  /** Where the sentence came from. */
  origin: "coach-answer";
  /** Typed Ask turn vs spoken turn — the shared record cannot tell them apart. */
  turnKind: "typed";
  /** Which structured part of the answer was quoted. */
  field: KeepableField;
  /** The prompt behind the answer (PROMPT_VERSIONS.coach_chat). */
  promptKey: string;
  promptVersion: string;
  /** The parent's own question — why this line was in front of them. */
  sourceExcerpt: string;
  /** When the parent chose to keep it. */
  keptAt: string;
}

const isRow = (value: unknown): value is KeptProvenance => {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.logId === "string" && row.logId.length > 0
    && typeof row.proposalId === "string"
    && typeof row.promptKey === "string"
    && typeof row.promptVersion === "string";
};

/** Parse a stored payload defensively — a corrupt store yields no rows. */
export function parseProvenance(raw: string | null | undefined): KeptProvenance[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRow) : [];
  } catch {
    return [];
  }
}

/** Pure upsert: newest first, one row per logId, capped. Input untouched. */
export function upsertProvenance(rows: readonly KeptProvenance[], row: KeptProvenance): KeptProvenance[] {
  return [row, ...rows.filter((r) => r.logId !== row.logId)].slice(0, MAX_PROVENANCE_ROWS);
}

/** The provenance of one kept row, or null when the row was not AI-kept. */
export function findProvenance(
  rows: readonly KeptProvenance[],
  logId: string,
): KeptProvenance | null {
  return rows.find((r) => r.logId === logId) ?? null;
}

/**
 * Journal signal ids are `moment-<logId>` (signalTimeline.buildTimeline), so
 * the feed can look a row up without re-deriving that prefix at every call
 * site. A non-moment signal id resolves to null rather than guessing.
 */
export function provenanceForSignal(
  rows: readonly KeptProvenance[],
  signalId: string,
): KeptProvenance | null {
  if (!signalId.startsWith("moment-")) return null;
  return findProvenance(rows, signalId.slice("moment-".length));
}

const store = (given?: Storage | null): Storage | null => {
  if (given !== undefined) return given;
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

/** Read one child's rows. Never throws. */
export function readCaptureProvenance(childId: string, given?: Storage | null): KeptProvenance[] {
  const s = store(given);
  if (!s || !childId) return [];
  try {
    return parseProvenance(s.getItem(captureProvenanceKey(childId)));
  } catch {
    return [];
  }
}

/** Record one kept row. Returns the new list. Never throws. */
export function recordCaptureProvenance(
  childId: string,
  row: KeptProvenance,
  given?: Storage | null,
): KeptProvenance[] {
  const next = upsertProvenance(readCaptureProvenance(childId, given), row);
  const s = store(given);
  if (s && childId) {
    try {
      s.setItem(captureProvenanceKey(childId), JSON.stringify(next));
    } catch {
      /* quota / private window — the durable record is server-side anyway */
    }
  }
  return next;
}
