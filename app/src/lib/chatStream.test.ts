/**
 * ask-cadence (ASK-1 + AIR-1) — unit tests for the Ask streaming bubble state
 * machine. The firewall-carded behavior lives here: on a done-time classifier
 * flag the client RETRACTS the streamed bubble and replaces it with the
 * blocked markdown (streamed text is retractable — ASK-1 CONDITION 2).
 */
import { describe, it, expect } from "vitest";
import { appendChatAck, applyChatDelta, settleChatTurn, abortChatStream } from "./chatStream.js";
import type { ChatMessage, ChatResponsePayload } from "../context/ArborContext";

const user: ChatMessage = { sender: "user", text: "Mornings are a battle." };
const ACK = "On it — reading what you shared.";

describe("chatStream reducers", () => {
  it("appendChatAck renders an immediate local acknowledgment bubble", () => {
    const next = appendChatAck([user], ACK, "Integrated Balanced");
    expect(next).toHaveLength(2);
    expect(next[1]).toMatchObject({ sender: "ai", text: ACK, chatLive: true, chatAck: true });
  });

  it("the first delta REPLACES the ack copy; later deltas append", () => {
    let msgs = appendChatAck([user], ACK);
    msgs = applyChatDelta(msgs, "You're not alone in this. ");
    expect(msgs[1].text).toBe("You're not alone in this. ");
    expect(msgs[1].chatAck).toBeUndefined();
    msgs = applyChatDelta(msgs, "Try one small choice at the door. ");
    expect(msgs[1].text).toBe("You're not alone in this. Try one small choice at the door. ");
    expect(msgs).toHaveLength(2);
    expect(msgs[1].chatLive).toBe(true);
  });

  it("applyChatDelta creates the live bubble when no ack exists", () => {
    const msgs = applyChatDelta([user], "First words. ");
    expect(msgs).toHaveLength(2);
    expect(msgs[1]).toMatchObject({ sender: "ai", chatLive: true, text: "First words. " });
  });

  it("settleChatTurn replaces the live bubble with the final contract answer", () => {
    let msgs = appendChatAck([user], ACK);
    msgs = applyChatDelta(msgs, "You're not alone. ");
    const payload = {
      text: "You're not alone.\n\n### 1. What May Be Happening\n- ...",
      contract: { riskLevel: "Low" } as ChatResponsePayload["contract"],
    } as ChatResponsePayload;
    const settled = settleChatTurn(msgs, payload, "Integrated Balanced");
    expect(settled).toHaveLength(2);
    expect(settled[1].chatLive).toBeUndefined();
    expect(settled[1].contract).toEqual(payload.contract);
    expect(settled[1].text).toBe(payload.text);
  });

  it("RETRACT-AND-REPLACE: done-time outputBlocked discards streamed prose entirely", () => {
    let msgs = appendChatAck([user], ACK);
    msgs = applyChatDelta(msgs, "A clean streamed sentence the classifier later judged unsafe. ");
    const blocked = {
      text: "### Let's pause here\nPart of the answer stepped outside...",
      outputBlocked: true,
      blockedCategory: "semantic_unsafe",
    } as unknown as ChatResponsePayload;
    const settled = settleChatTurn(msgs, blocked);
    expect(settled).toHaveLength(2);
    expect(settled[1].text).toBe(blocked.text);
    // The streamed words are GONE — no merge, no contract, no live flag.
    expect(settled[1].text).not.toContain("clean streamed sentence");
    expect(settled[1].contract).toBeUndefined();
    expect(settled[1].chatLive).toBeUndefined();
  });

  it("settleChatTurn appends when no live bubble exists (non-SSE fallback path)", () => {
    const settled = settleChatTurn([user], { text: "Full answer." } as ChatResponsePayload);
    expect(settled).toHaveLength(2);
    expect(settled[1].text).toBe("Full answer.");
  });

  it("abortChatStream drops an ack-only bubble (no placeholder persists)", () => {
    const msgs = appendChatAck([user], ACK);
    expect(abortChatStream(msgs)).toEqual([user]);
  });

  it("abortChatStream keeps screened partial prose as a settled turn", () => {
    let msgs = appendChatAck([user], ACK);
    msgs = applyChatDelta(msgs, "Partial but screened words. ");
    const aborted = abortChatStream(msgs);
    expect(aborted).toHaveLength(2);
    expect(aborted[1].text).toBe("Partial but screened words. ");
    expect(aborted[1].chatLive).toBeUndefined();
    expect(aborted[1].chatAck).toBeUndefined();
  });

  it("abortChatStream is a no-op when nothing is live", () => {
    const settled: ChatMessage[] = [user, { sender: "ai", text: "Done answer." }];
    expect(abortChatStream(settled)).toBe(settled);
  });
});
