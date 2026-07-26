/**
 * VC-4 — client half of the voice crisis-parity fix.
 *
 * 1. handleVoiceDone: the pure done-event contract CoachTab wires into the
 *    voice loop — escalation stops the loop (never re-listen) and puts the
 *    crisis resources (with real numbers — '988') ON SCREEN; outputBlocked
 *    renders the visible blocked state without stopping the loop.
 * 2. streamVoice: the SSE parser no longer discards the done payload — every
 *    event reaches the onEvent callback (pre-VC-4, lib/api.ts handled only
 *    'delta' and 'error', silently dropping the escalation category and the
 *    outputBlocked flag).
 */
import { describe, it, expect, vi } from "vitest";
import { handleVoiceDone } from "./voiceSafetyEvents";
import { streamVoice } from "./api";
import { screenForImmediateEscalation, renderEscalationMarkdown } from "../safety/escalation";
import type { ChildProfile } from "../types";

const selfHarmResources = () => {
  const match = screenForImmediateEscalation({ message: "I am thinking about suicide" });
  if (!match) throw new Error("fixture must trip the self_harm screen");
  return renderEscalationMarkdown(match);
};

describe("handleVoiceDone (VC-4)", () => {
  it("escalation done → stops the loop and renders resources containing '988' on screen", () => {
    const stopLoop = vi.fn();
    const appendMarkdown = vi.fn();
    handleVoiceDone(
      { escalation: "self_harm", resourcesMarkdown: selfHarmResources() },
      { stopLoop, appendMarkdown },
    );
    expect(stopLoop).toHaveBeenCalledTimes(1);
    expect(appendMarkdown).toHaveBeenCalledTimes(1);
    expect(String(appendMarkdown.mock.calls[0][0])).toContain("988");
  });

  it("escalation done WITHOUT resources still stops the loop (fail-closed on legacy payloads)", () => {
    const stopLoop = vi.fn();
    const appendMarkdown = vi.fn();
    handleVoiceDone({ escalation: "caregiver_distress" }, { stopLoop, appendMarkdown });
    expect(stopLoop).toHaveBeenCalledTimes(1);
    expect(appendMarkdown).not.toHaveBeenCalled();
  });

  it("outputBlocked done → renders the visible blocked state but does NOT stop the loop", () => {
    const stopLoop = vi.fn();
    const appendMarkdown = vi.fn();
    handleVoiceDone(
      { outputBlocked: true, blockedMarkdown: "### Let's pause here\n…" },
      { stopLoop, appendMarkdown },
    );
    expect(stopLoop).not.toHaveBeenCalled();
    expect(appendMarkdown).toHaveBeenCalledTimes(1);
    expect(String(appendMarkdown.mock.calls[0][0])).toContain("Let's pause here");
  });

  it("a plain done payload triggers nothing", () => {
    const stopLoop = vi.fn();
    const appendMarkdown = vi.fn();
    handleVoiceDone({}, { stopLoop, appendMarkdown });
    expect(stopLoop).not.toHaveBeenCalled();
    expect(appendMarkdown).not.toHaveBeenCalled();
  });
});

describe("streamVoice onEvent (VC-4)", () => {
  const payload = { message: "hi", childProfile: { name: "Mia" } as ChildProfile };

  const withFetch = async (body: string, run: () => Promise<void>) => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } })) as typeof fetch;
    try {
      await run();
    } finally {
      globalThis.fetch = originalFetch;
    }
  };

  it("delivers EVERY SSE event (delta AND done) to onEvent — the done payload is no longer discarded", async () => {
    const sse =
      'event: delta\ndata: {"text":"Please reach out. "}\n\n' +
      'event: done\ndata: {"escalation":"self_harm","resourcesMarkdown":"### Get help now\\n**988**"}\n\n';
    const deltas: string[] = [];
    const seen: Array<{ event: string; data: Record<string, unknown> }> = [];
    await withFetch(sse, async () => {
      await streamVoice(payload, (t) => deltas.push(t), { onEvent: (event, data) => seen.push({ event, data }) });
    });
    expect(deltas).toEqual(["Please reach out. "]);
    expect(seen.map((e) => e.event)).toEqual(["delta", "done"]);
    const done = seen[1].data;
    expect(done.escalation).toBe("self_harm");
    expect(String(done.resourcesMarkdown)).toContain("988");
  });

  it("stays backward compatible when no options are passed", async () => {
    const sse = 'event: delta\ndata: {"text":"Hello."}\n\nevent: done\ndata: {}\n\n';
    const deltas: string[] = [];
    await withFetch(sse, async () => {
      await streamVoice(payload, (t) => deltas.push(t));
    });
    expect(deltas).toEqual(["Hello."]);
  });

  it("still throws on an error event (onEvent does not swallow failures)", async () => {
    const sse = 'event: error\ndata: {"error":"Voice stream failed"}\n\n';
    const events: string[] = [];
    await withFetch(sse, async () => {
      await expect(
        streamVoice(payload, () => {}, { onEvent: (event) => events.push(event) }),
      ).rejects.toThrow("Voice stream failed");
    });
    expect(events).toEqual(["error"]);
  });
});
