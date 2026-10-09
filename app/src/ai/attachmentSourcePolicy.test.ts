import { describe, expect, it } from "vitest";
import { attachmentSourcePolicy } from "./attachmentSourcePolicy.js";
import { renderSpokenContext } from "./spokenContext.js";
import type { RecentTurn } from "./chatContext.js";

describe("attachment evidence on a later turn", () => {
  it("leaves ordinary conversation continuity unchanged", () => {
    expect(attachmentSourcePolicy()).toBe("");
    expect(attachmentSourcePolicy([{ role: "coach", text: "Try choosing two books together." }])).toBe("");
  });

  it.each([
    "[Parent supplied files; original files are unavailable in this turn.]",
    "[Model interpretation of earlier attachments, not a parent-confirmed fact. Original files are not available.]",
    "[A document was attached for that turn only; its original is not available now.]",
  ])("requires the original again when the bounded transcript says %s", (marker) => {
    const turns: RecentTurn[] = [{ role: "coach", text: `${marker} The note seemed to suggest choosing books.` }];
    const policy = attachmentSourcePolicy(turns);
    expect(policy).toContain("MUST NOT quote, read, verify, count lines");
    expect(policy).toContain("reattach the file or paste");
    expect(policy).toContain("Newly attached files in the CURRENT request");
    const spoken = renderSpokenContext({ profile: { age: 4 }, approvedMemory: "", approvedMemoryFactsUsed: 0, recentTurns: turns });
    expect(spoken.indexOf("FILE AVAILABILITY RULE")).toBeLessThan(spoken.indexOf(JSON.stringify({ profile: { age: 4 }, approvedMemory: "", recentTurns: turns })));
    expect(spoken).toContain("CONVERSATION CONTINUITY IS AVAILABLE");
  });
});
