import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { translate } from "../../lib/i18n";

/**
 * N9 (F04 coach chat streaming) — client structural pins for the progressive
 * Ask answer render (askJourneyUx house pattern; the vitest env is node-only,
 * so the layout-level acceptance is pinned structurally). Route halves live in
 * routes/chatStreaming.test.ts; the pure reducers in lib/chatStream.test.ts.
 *
 * Pinned here:
 *  1. Progressive render — server-screened `delta` events fold into the live
 *     bubble via applyChatDelta, `done` settles via settleChatTurn (the
 *     retract-and-replace seam), and the request opts into SSE explicitly.
 *  2. Graceful fallback — a non-SSE response (old server / proxy strips the
 *     stream) is read as plain JSON through the SAME settle seam, so the
 *     spinner path keeps working with zero divergence.
 *  3. E7/F-08 live region — CoachTab's chat-status region is ALWAYS mounted
 *     (aria-live nodes must pre-exist to announce), cycles streaming → ready,
 *     and the visible spinner mirror is aria-hidden so status is spoken once.
 */

const SRC_ROOT = path.resolve(__dirname, "..", "..");
function read(rel: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
}
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

const coachRaw = read("components/tabs/CoachTab.tsx");
const coach = stripComments(coachRaw);
const ctx = stripComments(read("context/ArborContext.tsx"));

describe("N9 — progressive streamed render (client wiring)", () => {
  it("the chat request opts into SSE and folds screened deltas via the applyChatDelta reducer", () => {
    expect(ctx).toContain('headers: await authHeaders({ Accept: "text/event-stream" }),');
    // Only server-screened delta text ever reaches the live bubble.
    expect(ctx).toContain('setChatMessages((prev) => applyChatDelta(prev, String(data.text || ""), selectedLens));');
    // Honest milestone stage keys → localized status copy owned client-side.
    expect(ctx).toContain('setChatStreamStatus(chatStageStatus(String(data.stage || "")));');
  });

  it("`done` settles through settleChatTurn — the ONE seam where a blocked payload retracts streamed prose", () => {
    expect(ctx).toContain("setChatMessages((prev) => settleChatTurn(prev, data, selectedLens));");
    // A stream that ends without `done` is an error, never a silent settle.
    expect(ctx).toContain('if (!finalPayload) throw new Error("Streaming chat ended without a final Arbor response");');
    // Server `error` events surface as a thrown error (→ the calm retry card),
    // and every failure path drops the live bubble via abortChatStream.
    expect(ctx).toContain('throw new Error(data.details || data.error || "Streaming chat failed");');
    expect(ctx).toContain("setChatMessages((prev) => abortChatStream(prev));");
  });

  it("FALLBACK: a non-SSE response is read as plain JSON through the same settle seam (old-client/spinner path intact)", () => {
    const gate = /const readChatPayload = [\s\S]*?\n  };/.exec(ctx)?.[0] ?? "";
    expect(gate).toContain('if (contentType.includes("text/event-stream"))');
    expect(gate).toContain("return readStreamingChatResponse(res);");
    expect(gate).toContain("return await res.json();");
  });
});

describe("N9 — E7/F-08 always-mounted chat-status live region", () => {
  it("exactly one polite live region exists on the Ask surface and it renders chatLiveStatus", () => {
    expect(coach.match(/aria-live="polite"/g)?.length).toBe(1);
    expect(coach).toMatch(/role="status" aria-live="polite">\s*\{chatLiveStatus\}/);
  });

  it("the region is ALWAYS mounted — never inside the isChatLoading conditional; the visible spinner mirror is aria-hidden", () => {
    const regionAt = coach.indexOf('aria-live="polite"');
    const spinnerAt = coach.indexOf("{isChatLoading && (");
    expect(regionAt).toBeGreaterThan(-1);
    expect(spinnerAt).toBeGreaterThan(regionAt); // mounted before (outside) the conditional
    const spinnerBlock = /\{isChatLoading && \(([\s\S]*?)\n\s*\)\}/.exec(coach)?.[1] ?? "";
    expect(spinnerBlock).not.toBe("");
    expect(spinnerBlock).not.toContain("aria-live"); // spoken exactly once, from the region
    expect(spinnerBlock).toContain("aria-hidden>{chatStreamStatus || t(\"coach.loading\")}");
  });

  it("status text cycles streaming → ready: streaming copy while loading, coach.status.ready on a clean settle", () => {
    expect(coach).toContain('setChatLiveStatus(chatStreamStatus || t("coach.loading"));');
    expect(coach).toContain('setChatLiveStatus(t("coach.status.ready"));');
    // Failures stay silent here — the role=alert retry card owns the announcement.
    const effect = /const wasLoading = wasChatLoadingRef.current;[\s\S]*?\[isChatLoading, chatStreamStatus, apiError\]/.exec(coach)?.[0] ?? "";
    expect(effect).toContain('setChatLiveStatus("")');
    expect(effect).toContain("if (apiError)");
  });

  it("the status copy exists in BOTH languages (localized client-side, never server English)", () => {
    for (const key of ["coach.status.ready", "coach.status.sources", "coach.status.plan", "coach.loading", "coach.ack"]) {
      for (const lang of ["en", "he"] as const) {
        expect(translate(lang, key).trim()).not.toBe("");
        expect(translate(lang, key)).not.toBe(key);
      }
    }
    expect(translate("he", "coach.status.ready")).not.toMatch(/[a-z]/i);
  });
});
