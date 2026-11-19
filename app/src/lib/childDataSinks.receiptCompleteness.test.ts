import { describe, expect, it } from "vitest";
import { childSinkIds, erasedRecordCount, receiptView, validEraseCount, type SinkErasure } from "./childDataSinks";

/** B-BOOK-20: synthetic source-ledger regression; no real child data. */
const ids = childSinkIds(["bookReads", "kidSouvenirs"]);
const counts = {
  memoryEvents: 0, shares: 0, consents: 0, consultRequests: 0,
  storageFiles: 0, clientDocs: 0,
};
const complete = (): Record<string, SinkErasure> =>
  Object.fromEntries(ids.map((id) => [id, id === "profile" ? 1 : 0]));

describe("B-BOOK-20: complete, truthful child deletion receipts", () => {
  it("accepts a complete registered zero/one-count ledger", () => {
    const view = receiptView(complete(), counts, ids);
    expect(view.finished).toBe(true);
    expect(view.rows.records).toBe(1);
    expect(Object.values(view.places).every((p) => p.unreached === 0)).toBe(true);
  });

  it("does not mistake an omitted child subcollection for a completed erase", () => {
    const sinks = complete();
    delete sinks["firestore:kidSouvenirs"];
    const view = receiptView(sinks, counts, ids);
    expect(view.finished).toBe(false);
    expect(view.rows.records).toBe("not-reached");
    expect(view.places.records.unreached).toBe(1);
  });

  it("does not mistake an omitted server or device sink for completion", () => {
    for (const absent of ["server:shares", "storage:books", "device:bookAssets"]) {
      const sinks = complete();
      delete sinks[absent];
      const view = receiptView(sinks, counts, ids);
      expect(view.finished).toBe(false);
      expect(view.rows[absent === "server:shares" ? "shares" : absent.startsWith("storage:") ? "storageFiles" : "clientDocs"])
        .toBe("not-reached");
    }
  });

  it("treats a missing ledger as unfinished regardless of success-looking summary counts", () => {
    const view = receiptView(undefined, counts, ids);
    expect(view.finished).toBe(false);
    expect(view.rows.records).toBe("not-reached");
    expect(view.rows.storageFiles).toBe("not-reached");
  });

  it("marks malformed numeric sink counts unverified, rather than showing a false completion", () => {
    for (const invalid of [-1, Number.NaN, Infinity, 1.5]) {
      const sinks = complete();
      sinks["firestore:bookReads"] = invalid;
      const view = receiptView(sinks, counts, ids);
      expect(view.finished).toBe(false);
      expect(view.rows.records).toBe("not-reached");
    }
    expect(erasedRecordCount({ profile: 1, "firestore:bookReads": -4, "firestore:kidSouvenirs": 2 }))
      .toBe(3);
    expect(validEraseCount(0)).toBe(true);
    expect(validEraseCount(-1)).toBe(false);
    expect(validEraseCount(Number.NaN)).toBe(false);
    expect(validEraseCount(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
  });

  it("rejects invalid server summary counts even when every sink looks cleared", () => {
    const view = receiptView(complete(), { ...counts, shares: -2 }, ids);
    expect(view.finished).toBe(false);
    expect(view.rows.shares).toBe("not-reached");
  });

  it("does not hide an unexpected failed sink outside the registered list", () => {
    const view = receiptView({ ...complete(), "device:unexpected": "not-reached" }, counts, ids);
    expect(view.finished).toBe(false);
    expect(view.rows.clientDocs).toBe("not-reached");
  });
});
