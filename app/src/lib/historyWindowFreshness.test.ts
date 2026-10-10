import { describe, expect, it } from "vitest";
import { sameLocalHistoryRows } from "./historyWindow";

describe("local history consistency before egress", () => {
  it("ignores collection/object-key order without mutating the supplied rows", () => {
    const rows = [{ id: "b", nested: { value: "one", at: "2026-10-01" } }, { id: "a", text: "two" }];
    const before = JSON.stringify(rows);
    expect(sameLocalHistoryRows(rows, JSON.stringify([{ text: "two", id: "a" }, { nested: { at: "2026-10-01", value: "one" }, id: "b" }]))).toBe(true);
    expect(JSON.stringify(rows)).toBe(before);
  });
  it("rejects edits, deletions, corrupt storage and changed nested provenance", () => {
    const rows = [{ id: "a", text: "words", provenance: { source: "parent" } }];
    for (const raw of ["[]", "{}", "bad-json", JSON.stringify([{ ...rows[0], text: "changed" }]), JSON.stringify([{ ...rows[0], provenance: { source: "ai" } }])]) expect(sameLocalHistoryRows(rows, raw)).toBe(false);
  });
});
