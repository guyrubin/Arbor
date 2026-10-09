import { describe, expect, it } from "vitest";
import { councilConversation } from "./councilConversation";
import type { ThreadTurnLike } from "../ai/chatContext";

const thread: ThreadTurnLike[] = [
  { sender: "user", text: "What might help at bedtime?" },
  { sender: "ai", text: "Keep the familiar book and a predictable goodbye." },
  { sender: "user", text: "What about sharing at school?" },
  { sender: "ai", text: "Try taking turns in a short game." },
];
describe("council continues the selected report", () => {
  it("uses the earlier question and excludes later unrelated turns and the current draft", () => {
    const result = councilConversation({ thread, childId: "a", draft: "New unfinished thought", answerIndex: 1 });
    expect(result?.message).toBe(thread[0].text);
    expect(result?.recentTurns?.map(t => t.text)).toEqual(thread.slice(0, 2).map(t => t.text));
    expect(result?.consumesDraft).toBe(false);
    expect(result?.contextChildId).toBe("a");
  });
  it("uses an explicit composer question and bounds the same-thread transcript", () => {
    const result = councilConversation({ thread: [...thread, ...thread, ...thread], childId: "a", draft: "One more question" });
    expect(result?.message).toBe("One more question");
    expect(result?.consumesDraft).toBe(true);
    expect(result?.recentTurns?.length).toBeLessThanOrEqual(6);
  });
  it("falls back to the last parent turn without consuming an empty draft", () => {
    const result = councilConversation({ thread, childId: "a", draft: "" });
    expect(result?.message).toBe(thread[2].text);
    expect(result?.consumesDraft).toBe(false);
  });
  it("does not redirect invalid or still-streaming report anchors to a different question", () => {
    for (const answerIndex of [-1, 0, 8, 1.5]) expect(councilConversation({ thread, childId: "a", draft: "x", answerIndex })).toBeNull();
    expect(councilConversation({ thread: [{ sender: "ai", text: "draft", chatLive: true }], childId: "a", draft: "x", answerIndex: 0 })).toBeNull();
    expect(councilConversation({ thread: [], childId: "b", draft: "", answerIndex: 1 })).toBeNull();
  });
  it("marks prior files unavailable and model interpretations unconfirmed", () => {
    const attached: ThreadTurnLike[] = [
      { sender: "user", text: "Read this note", attachments: [{ id: "f", kind: "document", name: "note.pdf", mimeType: "application/pdf", originalAvailable: false }] },
      { sender: "ai", text: "The note seems to describe a busy morning.", attachmentContext: { kind: "model-interpretation", attachmentIds: ["f"], originalsAvailable: false } },
    ];
    const result = councilConversation({ thread: attached, childId: "a", draft: "", answerIndex: 1 });
    expect(result?.recentTurns?.[0].text).toContain("original files are unavailable");
    expect(result?.recentTurns?.[1].text).toContain("not a parent-confirmed fact");
  });
});
