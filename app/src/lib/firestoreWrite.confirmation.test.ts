import { describe, expect, it } from "vitest";
import { snapshotWritesConfirmed } from "./firestoreWrite";

describe("Firestore saved-activity confirmation", () => {
  it("never rewards a locally queued write, even from an online snapshot", () => {
    expect(snapshotWritesConfirmed({ fromCache: false, hasPendingWrites: true })).toBe(false);
    expect(snapshotWritesConfirmed({ fromCache: true, hasPendingWrites: true }, true)).toBe(false);
  });

  it("keeps strict fresh-server confirmation as the default for sensitive receipts", () => {
    expect(snapshotWritesConfirmed({ fromCache: true, hasPendingWrites: false })).toBe(false);
    expect(snapshotWritesConfirmed({ fromCache: false, hasPendingWrites: false })).toBe(true);
  });

  it("allows a previously acknowledged local checkpoint to reopen offline only when opted in", () => {
    expect(snapshotWritesConfirmed({ fromCache: true, hasPendingWrites: false }, true)).toBe(true);
    expect(snapshotWritesConfirmed({ fromCache: false, hasPendingWrites: false }, true)).toBe(true);
  });
});
