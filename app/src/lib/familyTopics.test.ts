import { describe, expect, it } from "vitest";
import { activeTopicsFor, makeFamilyTopic } from "./familyTopics";

describe("parent-chosen family questions", () => {
  const base = { id: "question-1", childId: "child-1", title: "Mornings together", now: "2026-10-08T10:00:00Z" };
  it("does not infer a goal or copy source notes", () => {
    expect(makeFamilyTopic(base)).toEqual({ ...base, createdAt: base.now, updatedAt: base.now, now: undefined,
      status: "active", intent: "understand", observationIds: [] });
  });
  it("bounds parent text and source references", () => {
    const topic = makeFamilyTopic({ ...base, title: "  hello\n" + "a".repeat(300), observationIds: ["one", "one", ...Array.from({ length: 20 }, (_, i) => `source:${i}`)] });
    expect(topic.title).toHaveLength(160);
    expect(topic.title).not.toContain("\n");
    expect(topic.observationIds).toHaveLength(12);
  });
  it("rejects empty questions", () => {
    expect(() => makeFamilyTopic({ ...base, title: " \n " })).toThrow();
  });
  it("isolates children and leaves archived questions out of current context", () => {
    const a = makeFamilyTopic(base);
    const b = makeFamilyTopic({ ...base, id: "question-2", childId: "child-2" });
    expect(activeTopicsFor([b, a, { ...a, id: "old", status: "archived" }], "child-1")).toEqual([a]);
  });
});
