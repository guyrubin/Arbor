import { describe, expect, it } from "vitest";
import { parseCompanionAttachments, attachmentMetadata, prepareCompanionAttachment } from "./companionAttachments";
import { buildChatContext, buildVoiceContext } from "../ai/chatContext";

const attachment = { id: "photo-1", childId: "synthetic-a", kind: "photo" as const, name: "blocks.png", mimeType: "image/png", dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==" };

describe("explicit transient companion attachments", () => {
  it("binds every media part to the active child and validates file signatures", () => {
    expect(parseCompanionAttachments([attachment], "synthetic-a")[0].mimeType).toBe("image/png");
    expect(() => parseCompanionAttachments([attachment], "synthetic-b")).toThrow();
    expect(() => parseCompanionAttachments([{ ...attachment, dataUrl: "data:image/png;base64,PGh0bWw+" }], "synthetic-a")).toThrow();
  });
  it("caps counts, total bytes and duplicate ids before upload", () => {
    expect(() => parseCompanionAttachments([attachment, attachment], "synthetic-a")).toThrow();
    expect(() => parseCompanionAttachments(Array.from({ length: 4 }, (_, i) => ({ ...attachment, id: `p-${i}` })), "synthetic-a")).toThrow();
    const largeData = "iVBORw0KGgo" + "A".repeat(4 * 1024 * 1024 - 11);
    expect(() => parseCompanionAttachments([attachment, { ...attachment, id: "p2", dataUrl: `data:image/png;base64,${largeData}` }, { ...attachment, id: "p3", dataUrl: `data:image/png;base64,${largeData}` }], "synthetic-a")).toThrow();
  });
  it("only persists an allow-listed file receipt, never bytes or arbitrary fields", () => {
    const receipt = attachmentMetadata([{ ...attachment, secret: "do not persist" }]);
    expect(receipt).toEqual([{ id: "photo-1", kind: "photo", name: "blocks.png", mimeType: "image/png", originalAvailable: false }]);
    expect(JSON.stringify(receipt)).not.toContain("base64");
    expect(JSON.stringify(receipt)).not.toContain("secret");
  });
  it("prepares a real File for the same authenticated parent turn", async () => {
    const bytes = Uint8Array.from(atob(attachment.dataUrl.split(",")[1]), (c) => c.charCodeAt(0));
    const file = new File([bytes], "blocks.png", { type: "image/png" });
    const prepared = await prepareCompanionAttachment(file, "synthetic-a", "photo");
    expect(prepared.dataUrl).toBe(attachment.dataUrl);
    expect(prepared.childId).toBe("synthetic-a");
  });
  it("typed and voice continuity label the interpretation and unavailable originals", () => {
    const thread = [
      { sender: "user" as const, text: "Look at this", attachments: attachmentMetadata([attachment]) },
      { sender: "ai" as const, text: "A bridge made of blocks is visible.", attachmentContext: { kind: "model-interpretation" as const, attachmentIds: ["photo-1"], originalsAvailable: false as const } },
    ];
    const voice = buildVoiceContext(thread, "synthetic-a");
    const typed = buildChatContext({ thread, behaviorLogs: [], milestones: [], actionLoop: [], weeklyContextEnabled: false });
    expect(typed.recentTurns).toEqual(voice.recentTurns);
    expect(voice.recentTurns?.[0].text).toContain("original");
    expect(voice.recentTurns?.[1].text).toContain("Model interpretation");
    expect(voice.recentTurns?.[1].text).toContain("not a parent-confirmed fact");
    expect(JSON.stringify(voice)).not.toContain("base64");
  });
});
