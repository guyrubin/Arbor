import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ConversationProposalTray from "./ConversationProposalTray";
import type { ConversationProposal } from "../../lib/conversationProposals";

const proposal: ConversationProposal = {
  id: "p1", sessionId: "s1", turnId: "t1", childId: "c1", target: "milestone",
  summary: "Climbed the stairs independently", sourceExcerpt: "she did the stairs alone",
  sourceLanguage: "en", confidence: 0.91, milestoneId: "m1", milestoneStatus: "yes",
  status: "draft", createdAt: "2026-07-27T12:00:00.000Z",
};
const noop = () => {};

describe("ConversationProposalTray", () => {
  it("states that nothing is saved and shows provenance before confirm", () => {
    const html = renderToStaticMarkup(<ConversationProposalTray proposals={[proposal]} language="en" onEdit={noop} onConfirm={noop} onDiscard={noop} />);
    expect(html).toContain("Nothing has been saved yet");
    expect(html).toContain("she did the stairs alone");
    expect(html).toContain("Review before saving");
    expect(html).toContain(">Save<");
  });

  it("renders native Hebrew review chrome with RTL direction", () => {
    const html = renderToStaticMarkup(<ConversationProposalTray proposals={[{ ...proposal, sourceLanguage: "he" }]} language="he" onEdit={noop} onConfirm={noop} onDiscard={noop} />);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("עדיין לא נשמר דבר");
  });

  it("prevents confirmation when the canonical milestone is missing", () => {
    const html = renderToStaticMarkup(<ConversationProposalTray proposals={[{ ...proposal, conflict: { code: "missing_milestone", existing: "missing" } }]} language="en" onEdit={noop} onConfirm={noop} onDiscard={noop} />);
    expect(html).toContain("This may change or repeat an existing record");
    expect(html).toMatch(/disabled=""[^>]*>Save</);
  });
});
