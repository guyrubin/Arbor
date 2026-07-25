/**
 * liveTurnGuard (VC-1/VC-2/VC-3/VC-5) — the fail-closed Live safety spine.
 *
 * Pins, per the firewall CONDITIONS:
 *  - buffered audio releases ONLY after lexical pass AND a server "continue"
 *    (never optimistically), in order;
 *  - the existing outputScreen fixtures ("Noah is autistic and needs
 *    therapy.", "3 mg of melatonin") emit ZERO audio as a turn transcript;
 *  - a self_harm user transcript verdict halts the session BEFORE onCrisis
 *    renders;
 *  - screen unavailability (rejection, non-200 → rejection, timeout) drops the
 *    turn and fails closed — and there is structurally NO catch-and-continue;
 *  - transcription absence (turn end with audio but no transcript, or the
 *    mid-turn watchdog) closes the session;
 *  - released turns land in chatMessages via the COACH-2 reducers and survive
 *    settle (no new capture path).
 */
import { describe, it, expect, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { createLiveTurnGuard, type LiveTurnGuardDeps, type LiveTurnVerdict } from "./liveTurnGuard";
import { screenModelOutputLexical } from "../safety/outputScreenLexical";
import { screenModelOutputLexical as serverPathLexical } from "../safety/outputScreen";
import { appendVoiceUser, applyVoiceDelta, settleVoiceTurn } from "./voiceTranscript";
import type { ChatMessage } from "../context/ArborContext";

const CONTINUE: LiveTurnVerdict = { action: "continue" };

type Harness = {
  guard: ReturnType<typeof createLiveTurnGuard>;
  calls: string[];
  played: string[];
  deps: LiveTurnGuardDeps;
};

function makeHarness(overrides: Partial<LiveTurnGuardDeps> = {}): Harness {
  const calls: string[] = [];
  const played: string[] = [];
  const deps: LiveTurnGuardDeps = {
    screenTurn: vi.fn(async () => CONTINUE),
    screenLexical: screenModelOutputLexical,
    sink: (b64) => { calls.push(`sink:${b64}`); played.push(b64); },
    halt: () => calls.push("halt"),
    onUserTurn: (text) => calls.push(`user:${text}`),
    onModelTurn: (text) => calls.push(`model:${text}`),
    onCrisis: (v) => calls.push(`crisis:${v.category}`),
    onBlocked: (v) => calls.push(`blocked:${v.category}`),
    onFailClosed: (reason) => calls.push(`failClosed:${reason}`),
    timeoutMs: 200,
    transcriptionSilenceMs: 10_000,
    ...overrides,
  };
  return { guard: createLiveTurnGuard(deps), calls, played, deps };
}

describe("liveTurnGuard — clean turns release in order (VC-1)", () => {
  it("buffers audio and releases it in order only after lexical + server pass", async () => {
    const h = makeHarness();
    h.guard.pushAudio("a1");
    h.guard.pushAudio("a2");
    h.guard.pushOutputTranscription("Try naming the feeling ");
    h.guard.pushAudio("a3");
    h.guard.pushOutputTranscription("and keeping the goodbye short.");
    expect(h.played).toEqual([]); // nothing plays before the turn settles
    await h.guard.endModelTurn();
    expect(h.played).toEqual(["a1", "a2", "a3"]);
    expect(h.deps.screenTurn).toHaveBeenCalledWith(
      "model",
      "Try naming the feeling and keeping the goodbye short.",
    );
    expect(h.calls).toContain("model:Try naming the feeling and keeping the goodbye short.");
    expect(h.guard.halted).toBe(false);
  });

  it("a released turn lands in chatMessages via the COACH-2 reducers and survives settle", async () => {
    let messages: ChatMessage[] = [];
    const h = makeHarness({
      onUserTurn: (text) => { messages = appendVoiceUser(messages, text); },
      onModelTurn: (text) => { messages = settleVoiceTurn(applyVoiceDelta(messages, text)); },
    });
    h.guard.pushInputTranscription("Bedtime takes an hour with lots of resistance");
    h.guard.pushAudio("a1");
    h.guard.pushOutputTranscription("Try a shorter wind-down tonight.");
    await h.guard.endModelTurn();
    expect(messages).toEqual([
      { sender: "user", text: "Bedtime takes an hour with lots of resistance" },
      { sender: "ai", text: "Try a shorter wind-down tonight." },
    ]);
    // Settled: no voiceLive flag survives → the normal conversationsCol upsert
    // persists these exactly like typed chat (no new capture path).
    expect((messages[1] as { voiceLive?: boolean }).voiceLive).toBeUndefined();
  });
});

describe("liveTurnGuard — lexical floor blocks before a single sample (VC-1)", () => {
  it.each([
    ["Noah is autistic and needs therapy.", "diagnosis"],
    ["3 mg of melatonin", "medication"],
  ])("fixture %s emits ZERO audio and yields the blocked fallback", async (fixture, category) => {
    const h = makeHarness();
    h.guard.pushAudio("a1");
    h.guard.pushAudio("a2");
    h.guard.pushOutputTranscription(fixture);
    await h.guard.endModelTurn();
    expect(h.played).toEqual([]);
    expect(h.calls).toContain(`blocked:${category}`);
    // halt (session close) strictly precedes the blocked render.
    expect(h.calls.indexOf("halt")).toBeLessThan(h.calls.indexOf(`blocked:${category}`));
    expect(h.guard.halted).toBe(true);
    // The flagged turn is still sent for the server-side audit log (VC-3).
    expect(h.deps.screenTurn).toHaveBeenCalledWith("model", fixture);
  });

  it("the guard's lexical import is the same function the server path re-exports", () => {
    expect(serverPathLexical).toBe(screenModelOutputLexical);
  });

  it("a server stop_blocked verdict also drops the audio (server is authoritative)", async () => {
    const h = makeHarness({
      screenTurn: async () => ({ action: "stop_blocked", category: "semantic_unsafe", blockedMarkdown: "### Let's pause here" }),
    });
    h.guard.pushAudio("a1");
    h.guard.pushOutputTranscription("A perfectly lexically-clean sentence.");
    await h.guard.endModelTurn();
    expect(h.played).toEqual([]);
    expect(h.calls).toContain("blocked:semantic_unsafe");
    expect(h.guard.halted).toBe(true);
  });
});

describe("liveTurnGuard — user crisis turns (VC-2)", () => {
  it("a self_harm verdict halts the session BEFORE onCrisis renders, zero audio", async () => {
    const h = makeHarness({
      screenTurn: async (role) =>
        role === "user"
          ? { action: "stop_crisis", category: "self_harm", resourcesMarkdown: "### Get help now\n**988**", spokenText: "redirect" }
          : CONTINUE,
    });
    h.guard.pushInputTranscription("I want to die");
    h.guard.pushAudio("a1"); // model starts answering — flushes the user turn
    h.guard.pushOutputTranscription("clean words");
    await h.guard.endModelTurn();
    expect(h.played).toEqual([]); // the model's answer to a crisis never plays
    expect(h.calls).toContain("crisis:self_harm");
    expect(h.calls.indexOf("halt")).toBeLessThan(h.calls.indexOf("crisis:self_harm"));
    // The parent's words were persisted (same ordering as the browser loop).
    expect(h.calls).toContain("user:I want to die");
    expect(h.guard.halted).toBe(true);
  });
});

describe("liveTurnGuard — fail-closed contract (VC-5)", () => {
  it("a rejected /live/turn (500) drops the turn, halts, degrades — zero further audio", async () => {
    const h = makeHarness({ screenTurn: vi.fn(async () => { throw new Error("500"); }) });
    h.guard.pushAudio("a1");
    h.guard.pushOutputTranscription("Some clean sentence.");
    await h.guard.endModelTurn();
    expect(h.played).toEqual([]);
    expect(h.calls).toContain("failClosed:screen-unavailable");
    expect(h.calls.indexOf("halt")).toBeLessThan(h.calls.indexOf("failClosed:screen-unavailable"));
    // No code path resumes: subsequent chunks are dropped silently.
    h.guard.pushAudio("a2");
    h.guard.pushOutputTranscription("More text.");
    await h.guard.endModelTurn();
    expect(h.played).toEqual([]);
    expect(h.guard.halted).toBe(true);
  });

  it("a hung /live/turn times out (~3s contract; test-scaled) and fails closed", async () => {
    const h = makeHarness({
      screenTurn: () => new Promise(() => { /* never resolves */ }),
      timeoutMs: 20,
    });
    h.guard.pushAudio("a1");
    h.guard.pushOutputTranscription("Some clean sentence.");
    await h.guard.endModelTurn();
    expect(h.played).toEqual([]);
    expect(h.calls).toContain("failClosed:screen-unavailable");
  });

  it("turn completes with audio but NO transcription → flagged by construction (VC-1 cond 1)", async () => {
    const h = makeHarness();
    h.guard.pushAudio("a1");
    h.guard.pushAudio("a2");
    await h.guard.endModelTurn();
    expect(h.played).toEqual([]);
    expect(h.calls).toContain("failClosed:transcription-missing");
    expect(h.deps.screenTurn).not.toHaveBeenCalled(); // nothing to screen — never release
  });

  it("transcription ceasing to arrive MID-session trips the watchdog and closes", async () => {
    const h = makeHarness({ transcriptionSilenceMs: 20 });
    h.guard.pushAudio("a1"); // audio flowing, transcription never arrives
    await new Promise((r) => setTimeout(r, 60));
    expect(h.played).toEqual([]);
    expect(h.calls).toContain("failClosed:transcription-missing");
    expect(h.guard.halted).toBe(true);
  });

  it("structural: no catch-and-continue — the single sink site sits behind the release gate", () => {
    const src = fs.readFileSync(path.join(__dirname, "liveTurnGuard.ts"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s*\/\/[^\n"']*$/gm, "");
    // Exactly ONE deps.sink call site in the whole module (the release loop).
    expect(code.match(/deps\.sink\(/g)?.length).toBe(1);
    // The release loop is unreachable without a server "continue": the guard
    // returns out of endModelTurn on every non-continue action before it.
    const releaseIdx = code.indexOf("deps.sink(");
    const gateIdx = code.indexOf('verdict.action !== "continue"');
    expect(gateIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeLessThan(releaseIdx);
    // Every catch around the server verdict fails closed — no catch block
    // anywhere in the module releases audio or continues the session.
    const catchBodies = [...code.matchAll(/catch\s*(?:\([^)]*\))?\s*\{([^}]*)\}/g)].map((m) => m[1]);
    expect(catchBodies.length).toBeGreaterThan(0);
    for (const body of catchBodies) {
      expect(body).not.toContain("sink");
      expect(body).not.toContain("continue");
    }
    // The verdict-catch specifically routes to failClosed.
    expect(code).toMatch(/catch\s*\{\s*failClosed\("screen-unavailable"\);\s*return;\s*\}/);
  });
});
