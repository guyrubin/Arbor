import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import VoiceCloseCard, { VOICE_CLOSE_COPY, voiceNextStepLine, voiceReadback } from "./VoiceCloseCard";
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

describe("B-VOICE-04 · the session's one next step rides the closing review", () => {
  it.each(["en", "he"] as const)("%s: shows the step with one keep button; nothing is kept on render", language => {
    const onKeep = vi.fn();
    const html = renderToStaticMarkup(<VoiceCloseCard sessionId="s" language={language} proposals={[]} pending={false} failed={false} busy={false}
      onClose={() => {}} nextStep={{ text: "Give a two-minute warning before the bath.", language: "en" }} onKeepNextStep={onKeep}>{null}</VoiceCloseCard>);
    expect(html).toContain('data-testid="voice-next-step"');
    expect(html).toContain(VOICE_CLOSE_COPY[language].next);
    expect(html).toContain("Give a two-minute warning before the bath.");
    expect(html).toContain(VOICE_CLOSE_COPY[language].keepNext);
    expect(html).toMatch(/data-testid="voice-next-step-keep"[^>]*class="min-h-11/);
    expect(onKeep).not.toHaveBeenCalled();
  });
  it("kept → a status line instead of the button; failed → says so and keeps the button", () => {
    const render = (over: object) => renderToStaticMarkup(<VoiceCloseCard sessionId="s" language="en" proposals={[]} pending={false} failed={false} busy={false}
      onClose={() => {}} nextStep={{ text: "Sing the song again tonight.", language: "en" }} onKeepNextStep={() => {}} {...over}>{null}</VoiceCloseCard>);
    const kept = render({ nextStepKept: true });
    expect(kept).toContain(VOICE_CLOSE_COPY.en.nextKept);
    expect(kept).not.toContain('data-testid="voice-next-step-keep"');
    const failed = render({ nextStepFailed: true });
    expect(failed).toContain(VOICE_CLOSE_COPY.en.nextFailed);
    expect(failed).toContain('data-testid="voice-next-step-keep"');
  });
  it("no step → no block (the review never guesses one)", () => {
    const html = renderToStaticMarkup(<VoiceCloseCard sessionId="s" language="en" proposals={[]} pending={false} failed={false} busy={false} onClose={() => {}}>{null}</VoiceCloseCard>);
    expect(html).not.toContain("voice-next-step");
  });
  it("the spoken line names it in the language Arbor said it", () => {
    expect(voiceNextStepLine({ text: "Sing it again.", language: "en" })).toBe("One thing to try: Sing it again.");
    expect(voiceNextStepLine({ text: "לשיר שוב הערב.", language: "he" })).toBe("דבר אחד לנסות: לשיר שוב הערב.");
  });
});
