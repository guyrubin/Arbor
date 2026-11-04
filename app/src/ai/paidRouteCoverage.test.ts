/**
 * B-AIOPS-01: every paid provider call lives in a file that writes a cost
 * record. Stripping the recorder fails this check. Mock is not a paid provider.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { isPaidCostPath } from "../server/bindFamilyCost.js";

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(srcRoot, "..", "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith(".ts") && !full.endsWith(".test.ts") ? [full] : [];
  });
}

const rel = (file: string) => path.relative(srcRoot, file).split(path.sep).join("/");
const read = (file: string) => readFileSync(path.join(srcRoot, file), "utf8");

/** A real paid call, not a comment about one. */
const PAID_CALL = /\.generateContent(?:Stream)?\(|text:synthesize|(?:stream)?rawPredict|ai\.live\.connect|authTokens\.create/;

/** File that contains the call, and the recorder that must stay beside it. */
const RECORD: Record<string, string> = {
  "ai/modelRouter.ts": "recordUsage(",
  "ai/claudeVertexProvider.ts": "recordUsage(",
  "server/tts.ts": "recordTtsUsage(",
  "server/bookNarration.ts": "recordBookNarrationUsage(",
  "lib/geminiLiveClient.ts": "reportUsage",
  "routes/api.ts": "createLiveUsageStore(",
};

function paidFilesMissingRecorder(sources: Map<string, string>): string[] {
  const missing: string[] = [];
  for (const [file, source] of sources) {
    if (!PAID_CALL.test(source)) continue;
    const needle = RECORD[file];
    if (!needle || !source.includes(needle)) missing.push(file);
  }
  return missing.sort();
}

function methodBodies(source: string): { name: string; text: string }[] {
  const sf = ts.createSourceFile("paid.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out: { name: string; text: string }[] = [];
  const visit = (node: ts.Node) => {
    if ((ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node)) && node.body && node.name) {
      out.push({ name: node.name.getText(sf), text: node.body.getText(sf) });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

describe("B-AIOPS-01 every paid route writes a cost record", () => {
  const sources = new Map(sourceFiles(srcRoot).map((file) => [rel(file), readFileSync(file, "utf8")]));

  it("the paid call sites are exactly the files that record them", () => {
    expect([...sources.keys()].filter((file) => PAID_CALL.test(sources.get(file)!)).sort()).toEqual(Object.keys(RECORD).sort());
    expect(paidFilesMissingRecorder(sources)).toEqual([]);
  });

  it("fails when a paid file loses its recorder", () => {
    const stripped = new Map(sources);
    stripped.set("ai/modelRouter.ts", sources.get("ai/modelRouter.ts")!.replaceAll("recordUsage(", "dropped("));
    stripped.set("server/bookNarration.ts", sources.get("server/bookNarration.ts")!.replaceAll("recordBookNarrationUsage(", "dropped("));
    expect(paidFilesMissingRecorder(stripped)).toEqual(["ai/modelRouter.ts", "server/bookNarration.ts"]);
  });

  it("every generateContent method records usage, and stripping that fails", () => {
    const unpaid = (source: string) => methodBodies(source)
      .filter((m) => /\.generateContent(?:Stream)?\(/.test(m.text) && !m.text.includes("recordUsage("))
      .map((m) => m.name);
    const router = sources.get("ai/modelRouter.ts")!;
    expect(unpaid(router)).toEqual([]);
    expect(unpaid(router.replaceAll("recordUsage(", "dropped(")).length).toBeGreaterThan(0);
  });

  it("every Claude fetch records usage", () => {
    const unpaid = (source: string) => methodBodies(source)
      .filter((m) => m.text.includes("fetch(") && !m.text.includes("recordUsage("))
      .map((m) => m.name);
    const claude = sources.get("ai/claudeVertexProvider.ts")!;
    expect(unpaid(claude)).toEqual([]);
    expect(unpaid(claude.replaceAll("recordUsage(", "dropped(")).length).toBeGreaterThan(0);
  });

  it("Live connect reports usage and both session stores write the cost record", () => {
    expect(sources.get("lib/geminiLiveClient.ts")).toContain("ai.live.connect");
    const live = read("server/liveUsage.ts");
    expect(live.match(/recordLiveCost\(/g)?.length).toBeGreaterThanOrEqual(2);
    expect(live).toContain('route: "realtime_audio"');
    expect(read("server/bookNarration.ts")).not.toContain("tts.book");
  });

  it("binds a family id on every paid route and not on the admin reads", () => {
    const app = readFileSync(path.join(srcRoot, "server/createApp.ts"), "utf8");
    const listed = /const modelRoutes = \[([\s\S]*?)\];/.exec(app)?.[1] ?? "";
    const paths = [...listed.matchAll(/"(\/api\/[^"]+)"/g)].map((m) => m[1].replace(/^\/api/, ""));
    expect(paths.length).toBeGreaterThan(10);
    for (const p of paths) expect(isPaidCostPath(p), p).toBe(true);
    for (const p of ["/chat", "/council", "/tts", "/children/c1/book-narration", "/children/c1/plan-narration"]) {
      expect(isPaidCostPath(p), p).toBe(true);
    }
    expect(isPaidCostPath("/admin/overview")).toBe(false);
    expect(isPaidCostPath("/admin/family-cost")).toBe(false);
    const api = sources.get("routes/api.ts")!;
    expect(api).toContain("router.use(bindFamilyForCost(memoryStore))");
    expect(api.indexOf("router.use(bindFamilyForCost(memoryStore))")).toBeLessThan(api.indexOf("router.use(createBookNarrationRouter"));
    expect(read("server/bindFamilyCost.ts")).toContain("isPaidCostPath(req.path)");
    const handler = api.slice(api.indexOf('"/admin/family-cost"'), api.indexOf('"/admin/overview"'));
    expect(handler.indexOf("isAdmin")).toBeLessThan(handler.indexOf("loadFamilyDailyCostReport"));
    expect(readFileSync(path.join(repoRoot, "firestore.rules"), "utf8")).toContain("match /familyCostDaily/{id}");
  });
});
