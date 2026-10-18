import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

/** Execute the production handler's preflight under an auth-header barrier.
 * This catches a real async race that a rendered disabled button cannot. */
const source = ts.createSourceFile("ArborContext.tsx", readFileSync(new URL("./ArborContext.tsx", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let initializer = "";
const visit = (node: ts.Node) => { if (ts.isVariableDeclaration(node) && node.name.getText(source) === "handleChatSend" && node.initializer) initializer = node.initializer.getText(source); ts.forEachChild(node, visit); };
visit(source);
const javascript = ts.transpileModule(`(${initializer})`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText.trim().replace(/;$/, "");
const deferred = () => { let resolve!: (value: Record<string, string>) => void; const promise = new Promise<Record<string, string>>(done => { resolve = done; }); return { promise, resolve }; };

describe("B-GROWTH-44 · source validation at actual chat egress", () => {
  it("does not append a quoted turn or fetch when the source is revoked during auth", async () => {
    const token = deferred(); let current = true;
    const env = { parseCompanionAttachments: () => [], childProfile: { id: "c1" }, setApiError: vi.fn(), chatInput: "", getAiLanguage: () => "en", isChatLoading: false,
      sourceHeaderPending: { current: false }, authHeaders: vi.fn(() => token.promise), prepareTopicConversation: vi.fn(), setChatMessages: vi.fn(), fetch: vi.fn() };
    const send = new Function(...Object.keys(env), `return ${javascript}`)(...Object.values(env));
    const pending = send("Reviewed source words", { isCurrent: () => current });
    expect(env.authHeaders).toHaveBeenCalledTimes(1); expect(env.prepareTopicConversation).not.toHaveBeenCalled();
    current = false; token.resolve({ Authorization: "invented-test-token" }); expect(await pending).toBe(false);
    expect(env.prepareTopicConversation).not.toHaveBeenCalled(); expect(env.setChatMessages).not.toHaveBeenCalled(); expect(env.fetch).not.toHaveBeenCalled();
  });
  it("rejects stale approval before auth and prevents duplicate guarded header attempts", async () => {
    const token = deferred(); const headers = vi.fn(() => token.promise); let current = false;
    const env = { parseCompanionAttachments: () => [], childProfile: { id: "c1" }, setApiError: vi.fn(), chatInput: "", getAiLanguage: () => "en", isChatLoading: false,
      sourceHeaderPending: { current: false }, authHeaders: headers, prepareTopicConversation: vi.fn() };
    const send = new Function(...Object.keys(env), `return ${javascript}`)(...Object.values(env));
    expect(await send("A question", { isCurrent: () => current })).toBe(false); expect(headers).not.toHaveBeenCalled();
    current = true; const first = send("A question", { isCurrent: () => current }); expect(await send("A question", { isCurrent: () => current })).toBe(false); expect(headers).toHaveBeenCalledTimes(1);
    current = false; token.resolve({}); expect(await first).toBe(false); expect(env.sourceHeaderPending.current).toBe(false);
  });
});
