import { describe, expect, it } from "vitest";
import type { ChatMessage } from "../context/ArborContext";
import { appendVoiceUser, applyVoiceDelta, settleVoiceTurn } from "./voiceTranscript";

/**
 * COACH-2 — the browser voice loop persists both turns through the same
 * chat-message array as typed chat. These reducers are the pure core of that
 * seam: dictated user turn appended, streamed deltas accumulated into ONE live
 * AI bubble, partial text KEPT on abort, empty bubbles dropped.
 */

const WELCOME: ChatMessage = { sender: "ai", text: "welcome" };

describe("appendVoiceUser", () => {
  it("appends the dictated turn with the active lens", () => {
    const next = appendVoiceUser([WELCOME], "Bedtime is a battle", "Integrated Balanced");
    expect(next).toHaveLength(2);
    expect(next[1]).toEqual({ sender: "user", text: "Bedtime is a battle", lens: "Integrated Balanced" });
  });

  it("ignores blank dictation", () => {
    const prev = [WELCOME];
    expect(appendVoiceUser(prev, "   ")).toBe(prev);
  });
});

describe("applyVoiceDelta", () => {
  it("creates the live AI bubble on the first delta and accumulates subsequent deltas into it", () => {
    let msgs = appendVoiceUser([WELCOME], "Bedtime is a battle");
    msgs = applyVoiceDelta(msgs, "Try a two-minute ");
    msgs = applyVoiceDelta(msgs, "warning before lights out.");
    expect(msgs).toHaveLength(3);
    expect(msgs[2]).toMatchObject({
      sender: "ai",
      voiceLive: true,
      text: "Try a two-minute warning before lights out.",
    });
  });

  it("never merges into a settled (non-live) AI message", () => {
    const msgs = applyVoiceDelta([WELCOME], "New turn.");
    expect(msgs).toHaveLength(2);
    expect(msgs[1]).toMatchObject({ sender: "ai", voiceLive: true, text: "New turn." });
    expect(msgs[0].text).toBe("welcome");
  });

  it("ignores empty deltas", () => {
    const prev = [WELCOME];
    expect(applyVoiceDelta(prev, "")).toBe(prev);
  });
});

describe("settleVoiceTurn", () => {
  it("strips the voiceLive flag so the turn persists as a normal message (both turns survive)", () => {
    let msgs = appendVoiceUser([WELCOME], "Bedtime is a battle");
    msgs = applyVoiceDelta(msgs, "Try a calm wind-down.");
    msgs = settleVoiceTurn(msgs);
    expect(msgs).toHaveLength(3);
    expect(msgs[1].sender).toBe("user");
    expect(msgs[2]).toEqual({ sender: "ai", text: "Try a calm wind-down.", lens: undefined });
    expect(msgs[2].voiceLive).toBeUndefined();
  });

  it("KEEPS partial text when the stream is aborted mid-answer", () => {
    let msgs = applyVoiceDelta([WELCOME], "Try naming the feel");
    msgs = settleVoiceTurn(msgs); // abort path calls settle with whatever arrived
    expect(msgs[msgs.length - 1].text).toBe("Try naming the feel");
    expect(msgs[msgs.length - 1].voiceLive).toBeUndefined();
  });

  it("drops an empty live bubble instead of persisting a blank turn", () => {
    const msgs = settleVoiceTurn([WELCOME, { sender: "ai", text: "   ", voiceLive: true }]);
    expect(msgs).toEqual([WELCOME]);
  });

  it("is a no-op when nothing is live (idempotent — safe to call from stop + drain)", () => {
    const settled: ChatMessage[] = [WELCOME, { sender: "ai", text: "done" }];
    expect(settleVoiceTurn(settled)).toBe(settled);
    expect(settleVoiceTurn([])).toEqual([]);
  });
});
