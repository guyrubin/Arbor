import { describe, expect, it, vi } from "vitest";
import { activeTopicsFor, chooseFamilyTopic, makeFamilyTopic } from "./familyTopics";

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

// v3 IA-05r: the one choose path the question sheet and search share.
describe("choosing a saved question", () => {
  const order: string[] = [];
  const store = (fail = false) => ({
    updateFamilyTopic: vi.fn(async (id: string, patch: { aside: boolean }) => {
      await Promise.resolve();
      if (fail) throw new Error("invented write failure");
      order.push(`update:${id}:${patch.aside}`);
    }),
    selectFamilyTopic: vi.fn((id: string) => { order.push(`select:${id}`); }),
  });

  it("brings a set-aside question back before it becomes the active one", async () => {
    order.length = 0;
    const s = store();
    const pending = chooseFamilyTopic({ id: "question-1", asideAt: "2026-10-08T10:00:00Z" }, s);
    expect(s.selectFamilyTopic).not.toHaveBeenCalled();
    await pending;
    expect(order).toEqual(["update:question-1:false", "select:question-1"]);
  });

  it("chooses any other question at once, with no write", () => {
    order.length = 0;
    const s = store();
    void chooseFamilyTopic({ id: "question-2" }, s);
    expect(s.updateFamilyTopic).not.toHaveBeenCalled();
    expect(order).toEqual(["select:question-2"]);
  });

  it("chooses nothing when bringing it back fails", async () => {
    order.length = 0;
    const s = store(true);
    await expect(chooseFamilyTopic({ id: "question-3", asideAt: "2026-10-08T10:00:00Z" }, s)).rejects.toThrow();
    expect(s.selectFamilyTopic).not.toHaveBeenCalled();
    expect(order).toEqual([]);
  });
});
