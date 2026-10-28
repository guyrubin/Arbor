/**
 * B-VOICE-08 / B-VOICE-02 — one tap into a spoken conversation.
 *
 * A voice door outside the conversation starts the ONE Talk path inside the
 * parent's own tap: the panel opens and the mounted conversation's start runs
 * in the same call stack (the iOS microphone rule). Before the conversation
 * can start, the panel opens and the tap is queued until it registers.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COMPANION_CONVERSATION_EVENT,
  CONVERSATION_VOICE_REQUEST_TTL_MS,
  consumeConversationVoiceRequest,
  conversationDoorQueued,
  requestCompanionClose,
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
  requestCompanionClose(); // no queued tap leaks into the next case
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

  it("before the conversation can start, ONE tap is enough: the panel opens and the start runs when the conversation registers", () => {
    withWindow();
    expect(conversationVoiceReady()).toBe(false);
    expect(startConversationVoice({ source: "hard-moment", opening: "I'm here." }, 1_000)).toBe(false);
    // The panel opens now; no B-VOICE-06 "tap again" request is left behind.
    expect(events).toEqual([{ source: "hard-moment" }]);
    expect(conversationVoiceRequestPending()).toBe(false);
    expect(conversationDoorQueued()).toBe(true);
    const start = vi.fn(() => true);
    const unregister = registerConversationVoiceStarter(start, 1_000 + 2_500);
    expect(start).toHaveBeenCalledExactlyOnceWith("I'm here.");
    expect(conversationDoorQueued()).toBe(false);
    // Registering again (a remount) never replays the tap.
    unregister();
    const again = vi.fn(() => true);
    registerConversationVoiceStarter(again, 1_000 + 3_000)();
    expect(again).not.toHaveBeenCalled();
  });

  it("a queued tap is dropped once stale, and when the panel steps aside", () => {
    withWindow();
    startConversationVoice({ source: "now-voice" }, 1_000);
    const late = vi.fn(() => true);
    registerConversationVoiceStarter(late, 1_000 + CONVERSATION_VOICE_REQUEST_TTL_MS + 1)();
    expect(late).not.toHaveBeenCalled();
    startConversationVoice({ source: "now-voice" }, 5_000);
    requestCompanionClose();
    expect(conversationDoorQueued()).toBe(false);
    const after = vi.fn(() => true);
    registerConversationVoiceStarter(after, 5_100)();
    expect(after).not.toHaveBeenCalled();
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
