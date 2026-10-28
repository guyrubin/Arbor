/**
 * B-VOICE-08 / B-VOICE-02 — one tap into a spoken conversation.
 *
 * A voice door outside the conversation starts the ONE Talk path inside the
 * parent's own tap: the panel opens and the mounted conversation's start runs
 * in the same call stack (the iOS microphone rule). Before the conversation
 * has mounted, the door falls back to the B-VOICE-06 ready-to-talk request.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COMPANION_CONVERSATION_EVENT,
  consumeConversationVoiceRequest,
  conversationVoiceReady,
  conversationVoiceRequestPending,
  registerConversationVoiceStarter,
  startConversationVoice,
  type CompanionConversationRequest,
} from "./companionConversation";

const events: CompanionConversationRequest[] = [];
const listen = (event: Event) => events.push((event as CustomEvent<CompanionConversationRequest>).detail);

afterEach(() => {
  vi.unstubAllGlobals();
  events.length = 0;
  consumeConversationVoiceRequest();
});

const withWindow = () => {
  const target = new EventTarget();
  vi.stubGlobal("window", target);
  target.addEventListener(COMPANION_CONVERSATION_EVENT, listen);
  return target;
};

describe("startConversationVoice", () => {
  it("with the conversation mounted: opens the panel, then starts Talk in the same call", () => {
    withWindow();
    const order: string[] = [];
    window.addEventListener(COMPANION_CONVERSATION_EVENT, () => order.push("open"));
    const start = vi.fn((opening?: string) => { order.push(`start:${opening ?? ""}`); return true; });
    const unregister = registerConversationVoiceStarter(start);
    expect(conversationVoiceReady()).toBe(true);
    expect(startConversationVoice({ source: "now-voice" })).toBe(true);
    expect(order).toEqual(["open", "start:"]);
    // A plain open: no ready-to-talk request is left behind for a later claim.
    expect(events).toEqual([{ source: "now-voice" }]);
    expect(conversationVoiceRequestPending()).toBe(false);
    unregister();
    expect(conversationVoiceReady()).toBe(false);
  });

  it("hands the card's words to the start (spoken first; never part of the request)", () => {
    withWindow();
    const start = vi.fn(() => true);
    const unregister = registerConversationVoiceStarter(start);
    startConversationVoice({ source: "hard-moment", opening: "I'm here. You're safe." });
    expect(start).toHaveBeenCalledExactlyOnceWith("I'm here. You're safe.");
    expect(JSON.stringify(events)).not.toContain("You're safe");
    unregister();
  });

  it("a refused start (a notice to read, a review open) answers false and asks for nothing else", () => {
    withWindow();
    const unregister = registerConversationVoiceStarter(() => false);
    expect(startConversationVoice({ source: "now-voice" })).toBe(false);
    expect(events).toEqual([{ source: "now-voice" }]);
    expect(conversationVoiceRequestPending()).toBe(false);
    unregister();
  });

  it("before the conversation mounts: the B-VOICE-06 ready-to-talk request (Talk focused, the mic waits for its tap)", () => {
    withWindow();
    expect(conversationVoiceReady()).toBe(false);
    expect(startConversationVoice({ source: "now-voice", opening: "words" })).toBe(false);
    expect(events).toEqual([{ source: "now-voice", voice: true }]);
    expect(consumeConversationVoiceRequest()).toBe(true);
  });

  it("a stale unregister never removes a newer conversation's start (a child switch remounts it)", () => {
    withWindow();
    const first = vi.fn(() => true), second = vi.fn(() => true);
    const dropFirst = registerConversationVoiceStarter(first);
    const dropSecond = registerConversationVoiceStarter(second);
    dropFirst();
    expect(startConversationVoice({ source: "now-voice" })).toBe(true);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
    dropSecond();
    expect(conversationVoiceReady()).toBe(false);
  });
});
