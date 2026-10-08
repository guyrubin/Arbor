import { describe, expect, it } from "vitest";
import { threadForTopic } from "./topicConversation";
import { buildChatContext } from "../ai/chatContext";

describe("a parent question owns its conversation history", () => {
  const a = { id: "conversation-a", topicId: "question-a", messages: [{ sender: "user" as const, text: "PRIVATE_TOPIC_A" }] };
  it("continues the same question and its recorded conversation", () => {
    expect(threadForTopic(a, "question-a")).toBe(a);
  });
  it.each(["question-b", undefined])("starts a new thread on %s and excludes old turns from the AI wire", selected => {
    const next = threadForTopic(a, selected);
    expect(next.id).toBeNull();
    expect(next.topicId).toBe(selected);
    const wire = buildChatContext({ thread: next.messages, weeklyContextEnabled: false, behaviorLogs: [], milestones: [], actionLoop: [] });
    expect(JSON.stringify(wire)).not.toContain("PRIVATE_TOPIC_A");
    expect(wire.recentTurns).toBeUndefined();
    expect(a.messages).toHaveLength(1); // Historical source stays intact.
  });
  it("does not borrow an unlinked thread when a question is first chosen", () => {
    expect(threadForTopic({ ...a, topicId: undefined }, "question-b").messages).toEqual([]);
  });
});
