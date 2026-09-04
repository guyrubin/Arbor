import { describe, expect, it } from "vitest";
import {
  CAPTURE_PROVENANCE_NAMESPACE,
  MAX_PROVENANCE_ROWS,
  captureProvenanceKey,
  findProvenance,
  parseProvenance,
  provenanceForSignal,
  readCaptureProvenance,
  recordCaptureProvenance,
  upsertProvenance,
  type KeptProvenance,
} from "./captureProvenance";
import { isChildScopedKey, clearChildLocalState } from "./childLocalState";

/**
 * AI-04 — the origin ledger for rows kept from an Arbor answer.
 *
 * Two things must hold or the feature is worse than not shipping it:
 *  (1) the store is swept when the child is deleted — a per-child row that
 *      survives an erase is a GDPR defect, and four keys have already leaked
 *      past `isChildScopedKey` by inventing their own key shape;
 *  (2) a kept row can always name its origin — the prompt, the field, the
 *      question, and the fact that the parent chose to keep it.
 */

const KID = "kid-provenance-1";

const row = (over: Partial<KeptProvenance> = {}): KeptProvenance => ({
  logId: "voice-typed-abc12345-0",
  proposalId: "typed-abc12345-0",
  origin: "coach-answer",
  turnKind: "typed",
  field: "todayPlan",
  promptKey: "coach_chat",
  promptVersion: "1.2.0",
  sourceExcerpt: "Bedtime is a battle every night.",
  keptAt: "2026-09-04T10:00:00.000Z",
  ...over,
});

/** A minimal in-memory Storage so the node suite needs no DOM. */
function memoryStore(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => map.clear(),
  } as Storage;
}

describe("the store is swept when the child is deleted", () => {
  it("mints the sweepable convention: arbor.<namespace>.<childId>", () => {
    const key = captureProvenanceKey(KID);
    expect(key).toBe(`arbor.${CAPTURE_PROVENANCE_NAMESPACE}.${KID}`);
    expect(isChildScopedKey(key, KID)).toBe(true);
  });

  it("clearChildLocalState really removes it", () => {
    const local = memoryStore();
    recordCaptureProvenance(KID, row(), local);
    expect(local.getItem(captureProvenanceKey(KID))).toBeTruthy();
    clearChildLocalState(KID, { local, session: null });
    expect(local.getItem(captureProvenanceKey(KID))).toBeNull();
  });

  it("a SIBLING's rows are never swept by this child's deletion", () => {
    const local = memoryStore();
    recordCaptureProvenance(KID, row(), local);
    recordCaptureProvenance(`${KID}-2`, row({ logId: "other" }), local);
    clearChildLocalState(KID, { local, session: null });
    expect(local.getItem(captureProvenanceKey(`${KID}-2`))).toBeTruthy();
  });

  it("NEGATIVE CONTROL: the un-sweepable shapes this convention avoids", () => {
    // The exact shapes that leaked past the sweep before. If any of these ever
    // returns true, the widening in childLocalState has changed and the
    // assertions above stop proving anything.
    expect(isChildScopedKey(`arbor.captureProvenance${KID}`, KID)).toBe(false);
    expect(isChildScopedKey(`captureProvenance.${KID}`, KID)).toBe(false);
    expect(isChildScopedKey(`arbor.captureProvenance.${KID}-2`, KID)).toBe(false);
  });
});

describe("a kept row can always name its origin", () => {
  it("round-trips every provenance field", () => {
    const local = memoryStore();
    recordCaptureProvenance(KID, row(), local);
    const [read] = readCaptureProvenance(KID, local);
    expect(read).toEqual(row());
    expect(read.promptKey).toBe("coach_chat");
    expect(read.promptVersion).toBe("1.2.0");
    expect(read.turnKind).toBe("typed");
    expect(read.origin).toBe("coach-answer");
  });

  it("resolves from a Journal signal id (moment-<logId>)", () => {
    const rows = [row()];
    expect(provenanceForSignal(rows, `moment-${row().logId}`)?.proposalId).toBe(row().proposalId);
    // NEGATIVE CONTROL: a row the parent wrote themselves must resolve to null
    // — a chip on a hand-written moment would be a false origin claim.
    expect(provenanceForSignal(rows, "moment-hand-written-log")).toBeNull();
    expect(provenanceForSignal(rows, `milestone-${row().logId}`)).toBeNull();
    expect(findProvenance(rows, "nope")).toBeNull();
  });

  it("one row per log id, newest first, capped", () => {
    const first = upsertProvenance([], row({ field: "observe" }));
    const second = upsertProvenance(first, row({ field: "parentScript" }));
    expect(second).toHaveLength(1);
    expect(second[0].field).toBe("parentScript");

    let many: KeptProvenance[] = [];
    for (let i = 0; i < MAX_PROVENANCE_ROWS + 20; i++) many = upsertProvenance(many, row({ logId: `log-${i}` }));
    expect(many).toHaveLength(MAX_PROVENANCE_ROWS);
    expect(many[0].logId).toBe(`log-${MAX_PROVENANCE_ROWS + 19}`);
  });

  it("survives a corrupt or absent store without throwing", () => {
    expect(parseProvenance(null)).toEqual([]);
    expect(parseProvenance("{not json")).toEqual([]);
    expect(parseProvenance('{"logId":"x"}')).toEqual([]);
    // Rows missing the load-bearing fields are dropped, not half-rendered.
    expect(parseProvenance('[{"logId":"x"}]')).toEqual([]);
    expect(readCaptureProvenance(KID, null)).toEqual([]);
    expect(readCaptureProvenance("", memoryStore())).toEqual([]);
  });

  it("a write into a refusing store never throws (private window)", () => {
    const hostile = {
      length: 0,
      key: () => null,
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => {},
      clear: () => {},
    } as unknown as Storage;
    expect(() => recordCaptureProvenance(KID, row(), hostile)).not.toThrow();
  });
});
