import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import VoiceCloseCard, { voiceReadback } from "./VoiceCloseCard";
import type { ConversationProposal } from "../../lib/conversationProposals";

const draft = (target: ConversationProposal["target"]): ConversationProposal => ({
  id: target, sessionId: "session", turnId: "turn", childId: "child", target,
  summary: "We played with blocks", sourceExcerpt: "We played with blocks", confidence: .9,
  status: "draft", sourceLanguage: "en", createdAt: "2026-10-15T12:00:00Z",
});
describe("closing voice readback", () => {
  it.each(["en", "he"] as const)("renders %s review with explicit history/record distinction and no save on render", language => {
    const onClose = vi.fn();
    const html = renderToStaticMarkup(<VoiceCloseCard sessionId="s" language={language} proposals={[draft("journal")]}
      pending={false} failed={false} busy={false} onClose={onClose}><p>draft editor</p></VoiceCloseCard>);
    expect(html).toContain('role="dialog"');
    expect(html).toContain(`dir="${language === "he" ? "rtl" : "ltr"}"`);
    expect(html).toContain(language === "he" ? "היסטוריה" : "History");
    expect(html).toContain("draft editor");
    expect(onClose).not.toHaveBeenCalled();
  });
  it("names the destinations actually written, without promising report or plan updates", () => {
    const text = voiceReadback([draft("report_fact"), draft("observation"), draft("journal"), draft("milestone")], "en");
    expect(text.match(/Journal:/g)).toHaveLength(3);
    expect(text).toContain("Milestones:");
    expect(text).not.toMatch(/Report:|Plan:/);
  });
  it("keeps empty, pending and failed states distinct, and prevents closing during a write", () => {
    const render = (pending: boolean, failed: boolean, busy = false) => renderToStaticMarkup(
      <VoiceCloseCard sessionId="s" proposals={[]} language="en" pending={pending} failed={failed} busy={busy} onClose={() => {}}>{null}</VoiceCloseCard>);
    expect(render(true, false)).toContain("Preparing your drafts");
    expect(render(false, true)).toContain("Some drafts could not be prepared");
    expect(render(false, false)).toContain("There are no new drafts to keep");
    expect(render(false, false, true)).toContain('disabled=""');
  });
});
