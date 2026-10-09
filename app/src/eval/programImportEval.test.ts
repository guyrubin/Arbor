import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { validateSuite, deterministicGateErrors, type EvalSuite } from "./acceptance";
import { runnerInputError } from "./runnerInput";
import { parseRecommendationDraft, parseProgramDocument, PROGRAM_IMPORT_VERSION } from "../lib/programImport";
import { PROGRAM_IMPORT_PROMPT } from "../ai/programImportPrompt";
import { syntheticPdf } from "../../scripts/evalDocumentFixture.mjs";
import { startServer } from "../../scripts/eval-judge.mjs";

const suite = JSON.parse(readFileSync(new URL("../../../evals/home-program-import.eval.json", import.meta.url), "utf8")) as EvalSuite;
const repo = fileURLToPath(new URL("../../../", import.meta.url));

describe("home-program-import eval contract", () => {
  it("has a pinned valid suite, real runner inputs, both file kinds and safety/edge scenarios", () => {
    expect(validateSuite(suite, ["gemini-3.8-flash"])).toEqual([]);
    expect(deterministicGateErrors(suite, repo)).toEqual([]);
    expect(suite.scenarios).toHaveLength(8);
    expect(suite.scenarios.filter((scenario) => scenario.id.startsWith("edge-")).length).toBeGreaterThanOrEqual(2);
    expect(suite.scenarios.some((scenario) => scenario.locale === "he" && scenario.input?.documentKind === "photo")).toBe(true);
    expect(suite.scenarios.every((scenario) => runnerInputError(scenario) === null)).toBe(true);
    expect(suite.runner?.extractionPromptVersion).toBe(PROGRAM_IMPORT_VERSION);
    expect(suite.runner?.extractionPromptSha256).toBe(createHash("sha256").update(PROGRAM_IMPORT_PROMPT).digest("hex"));
  });

  for (const scenario of suite.scenarios) it(`${scenario.id}: golden selections preserve whole source lines`, () => {
    const lines = scenario.input!.sourceLines as string[];
    const expected = scenario.input!.expectedRecommendations as string[];
    expect(expected.every((line) => lines.includes(line))).toBe(true);
    expect(parseRecommendationDraft({ sourceText: lines.join("\n"), recommendations: expected, unreadable: false, offTopic: false }).recommendations).toEqual(expected);
  });

  it("rejects missing, huge and mismatched fixture inputs", () => {
    expect(runnerInputError({ route: "/api/vision", input: {} })).not.toBeNull();
    expect(runnerInputError({ route: "/api/vision", input: { documentKind: "pdf", sourceLines: ["עברית"] } })).not.toBeNull();
    expect(runnerInputError({ route: "/api/vision", input: { documentKind: "photo", sourceLines: ["a".repeat(201)] } })).not.toBeNull();
    expect(() => syntheticPdf(["עברית"])).toThrow();
  });

  it("creates a complete PDF object/xref structure and accepts it through the actual upload parser", () => {
    const bytes = syntheticPdf(["Read a picture book together."]);
    const text = bytes.toString("ascii");
    expect(text).toContain("/Type /Page"); expect(text).toContain("/BaseFont /Helvetica");
    expect(text).toContain("xref\n0 6"); expect(text.endsWith("%%EOF\n")).toBe(true);
    const xref = Number(/startxref\n(\d+)/.exec(text)?.[1]);
    expect(text.slice(xref).startsWith("xref")).toBe(true);
    expect(parseProgramDocument(`data:application/pdf;base64,${bytes.toString("base64")}`).mimeType).toBe("application/pdf");
  });
});

describe("home-program-import real route with synthetic transcription", () => {
  let running: Awaited<ReturnType<typeof startServer>>;
  let reply: unknown;
  const generateJson = vi.fn(async () => reply);
  beforeAll(async () => {
    vi.stubEnv("ARBOR_ENV", "local"); vi.stubEnv("MEMORY_ADAPTER", "local"); vi.stubEnv("MODEL_PROVIDER", "mock"); vi.stubEnv("ENABLE_OUTPUT_SAFETY_CLASSIFIER", "false");
    running = await startServer((provider) => Object.assign(provider, { generateJson }));
  });
  afterAll(async () => {
    if (running) await new Promise<void>((resolve, reject) => running.server.close((error) => error ? reject(error) : resolve()));
    vi.unstubAllEnvs();
  });

  for (const scenario of suite.scenarios.filter((item) => item.input?.documentKind === "pdf")) it(`${scenario.id}: passes PDF bytes to extraction and preserves the draft boundary`, async () => {
    generateJson.mockClear();
    const lines = scenario.input!.sourceLines as string[];
    const expected = scenario.input!.expectedRecommendations as string[];
    reply = { sourceText: lines.join("\n"), recommendations: expected, unreadable: false, offTopic: false };
    const dataUrl = `data:application/pdf;base64,${syntheticPdf(lines).toString("base64")}`;
    const response = await fetch(`${running.baseUrl}/api/vision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ childId: "eval-synthetic-import", mode: "recommendations", image: { dataUrl }, language: scenario.locale }) });
    const body = await response.json();
    if (response.status === 422 && scenario.input?.allowSafetyBlock) expect(body.outputBlocked).toBe(true);
    else { expect(response.status).toBe(200); expect(body.recommendations).toEqual(expected); }
    expect(generateJson).toHaveBeenCalledOnce();
    const call = generateJson.mock.calls[0] as unknown as [{ prompt: string; images: { mimeType: string; data: string }[] }];
    expect(call[0].prompt).toBe(PROGRAM_IMPORT_PROMPT);
    expect(call[0].images[0].mimeType).toBe("application/pdf");
    expect(Buffer.from(call[0].images[0].data, "base64").equals(syntheticPdf(lines))).toBe(true);
  });
});
