/**
 * AI-07, the half that a route test cannot see.
 *
 * The server can stream /api/council perfectly and a parent still gets a silent
 * spinner, because what they experience is decided one call earlier — in
 * ArborContext.handleCouncilSend. That call sat on the non-SSE `api.council()`
 * while the streaming seam existed and was tested, which is the most expensive
 * shape a "done" item can have: everything built, nothing delivered.
 *
 * So this pins the CLIENT end. It is a source scan, and source scans have
 * silently passed on empty files in this repo before — every check below
 * therefore proves it read the real thing first, and every matcher is shown to
 * discriminate against the verbatim pre-change code.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const read = (rel: string) =>
  fs
    .readFileSync(path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", rel), "utf8")
    .replace(/\r\n/g, "\n");

const ctx = read("context/ArborContext.tsx");
/** handleCouncilSend's body, sliced at the next top-level `const handle`. */
const councilHandler = (() => {
  const start = ctx.indexOf("const handleCouncilSend");
  const next = ctx.indexOf("\n  const ", start + 10);
  return start < 0 ? "" : ctx.slice(start, next < 0 ? ctx.length : next);
})();
/**
 * The same slice with comments removed. This matters more than it looks: the
 * handler's own comment explains that it USED to call `api.council(...)`, and a
 * matcher run over raw source reads that sentence as the call still being
 * there. A guard that cannot tell a mention from a call is worse than none —
 * it fails on correct code and trains the next person to delete it.
 */
const councilCode = councilHandler.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("the council answer actually streams to the parent", () => {
  it("the scan found the real handler (an empty slice is not a pass)", () => {
    expect(ctx.length).toBeGreaterThan(20_000);
    expect(councilHandler.length).toBeGreaterThan(500);
    expect(councilCode).toContain("const handleCouncilSend");
    // The slice must stop at the handler, not run to end of file.
    expect(councilHandler.length).toBeLessThan(ctx.length / 2);
    // ...and the comment-stripper left real code behind rather than eating it.
    expect(councilCode.length).toBeGreaterThan(400);
    expect(councilCode).not.toContain("silent spinner");
  });

  it("drives the streaming seam, not the blocking one", () => {
    expect(councilCode).toContain("streamCouncil(");
    expect(
      /\bapi\.council\s*\(/.test(councilCode),
      "handleCouncilSend is back on the awaited JSON path — the parent sees a silent spinner again",
    ).toBe(false);
    expect(ctx).toContain("streamCouncil");
  });

  it("renders screened deltas through the SAME reducers as /chat", () => {
    // If the council grew its own rendering path, the two answers could differ
    // in how (or whether) a retraction lands.
    expect(councilCode).toContain("applyChatDelta");
    expect(councilCode).toContain("settleChatTurn");
    expect(councilCode).toContain("appendChatAck");
  });

  it("is cancellable through the Stop button that already exists", () => {
    expect(councilCode).toContain("new AbortController()");
    expect(councilCode).toContain("chatAbortRef.current = controller");
    expect(councilCode).toContain("controller.signal");
    // handleCancelChat aborts chatAbortRef — so council inherits Stop only
    // because it parks its controller in that same ref.
    expect(ctx).toContain("chatAbortRef.current?.abort()");
  });

  it("a stop keeps screened prose and writes no message into the thread", () => {
    expect(councilCode).toContain('err.name === "AbortError"');
    expect(councilCode).toContain("abortChatStream");
    // A cancel bubble would persist into the saved conversation.
    expect(/setChatMessages\(\(prev\) => \[[\s\S]{0,200}cancel/i.test(councilCode)).toBe(false);
  });

  it("NEGATIVE CONTROL: every matcher rejects the verbatim pre-change handler", () => {
    const before = `
  const handleCouncilSend = async (customPrompt?: string) => {
    setChatMessages((prev) => appendChatUser(prev, promptValue, selectedLens));
    setIsChatLoading(true);
    try {
      const data = await api.council({ message: promptValue, childProfile });
      setChatMessages((prev) => [...prev, { sender: "ai", text: data.text }]);
    } finally {
      setIsChatLoading(false);
    }
  };`;
    expect(before).not.toContain("streamCouncil(");
    expect(/\bapi\.council\s*\(/.test(before)).toBe(true);
    expect(before).not.toContain("applyChatDelta");
    expect(before).not.toContain("settleChatTurn");
    expect(before).not.toContain("new AbortController()");
    expect(before).not.toContain('err.name === "AbortError"');
  });
});

describe("the route comment does not outlive the wiring", () => {
  /**
   * The /council docblock previously said, correctly at the time, that the
   * caller had not been switched. Left standing after the swap it would tell
   * the next reader of a safety-critical screening seam the opposite of what
   * ships — the same class of defect as the relay docblock that claimed
   * /council streamed before it did.
   */
  const routes = read("routes/api.ts");

  it("the scanned file is real", () => {
    expect(routes.length).toBeGreaterThan(20_000);
    expect(routes).toContain('router.post("/council"');
  });

  it("no longer claims the parent waits on the JSON path", () => {
    expect(routes).not.toContain("still waits on the JSON path");
    expect(routes).not.toContain("the in-app caller has NOT been switched");
  });
});
