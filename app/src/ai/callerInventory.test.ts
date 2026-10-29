/* B-AIOPS-08 — every AI caller is inventoried against the eligibility
 * foundations it actually passes through (docs/architecture/ai-caller-inventory.md).
 *
 * The suite finds every provider call and AI egress in src/ (TypeScript AST
 * for routes/api.ts, so a call is keyed by the route that encloses it) and
 * holds the inventory to the source:
 *   - every caller has a row, and no row names a caller that is gone;
 *   - a route row's consent gate, crisis screen, output screen and model route
 *     match the handler's source;
 *   - the "True-request result" is what selectProvider really decides for the
 *     request the row declares (audience, data classes, capability), against
 *     the candidates of the decision step that runs today, in a production
 *     configuration — so a gap cannot be written down as "eligible";
 *   - the gap rows are a shrink-only ratchet, and the fixed request behind
 *     the text-route gaps is pinned, so closing a gap forces the table to move.
 * No provider is constructed and nothing leaves the process. */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { createTestConfig } from "../testConfig";
import { candidatesFor } from "./capabilities/candidates";
import { routePolicyFor, selectProvider, type ProviderCandidate, type RoutePolicy } from "./capabilities/policy";
import type { AiAudience, AiCapability, AiDataClass, CapabilityRequest } from "./capabilities/contracts";
import type { ModelRoute } from "./modelRouter";
import { liveCandidatesFor, realtimePolicyFor } from "./liveResidency";
import { ttsCandidateFor } from "../server/tts";
import { bookTtsCandidate } from "../server/bookNarration";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..");
const REPO = path.resolve(SRC, "..", "..");
const DOC = readFileSync(path.join(REPO, "docs", "architecture", "ai-caller-inventory.md"), "utf8");
const PINNED = JSON.parse(readFileSync(path.join(REPO, "evals", "pinned-models.json"), "utf8"));
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");

/** Exact, shrink-only: rows whose true request the current decision does not
 *  evaluate. A new gap fails; a closed gap fails until this number drops. */
const GAP_ROWS_BASELINE = 16;
/** Exact, both ways: the rows that carry a parent's or child's words or voice
 *  (Text in) and run no crisis screen (Crisis screen starts with "no"). */
const CRISIS_SCREEN_GAPS = ["api POST /score-utterance", "server/childAsr.ts", "server/planNarration.ts"];
const SCREEN_CALL = /\bscreenForImmediateEscalation\(/;
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

/* ── discovery ────────────────────────────────────────────────────────────── */

// server/studioPlanPlates.ts decorates the provider (B-KID-150): it implements generateImage by
// delegation and carries no words of its own; see the inventory note 9.
const PROVIDER_IMPLEMENTATIONS = new Set(["ai/modelRouter.ts", "ai/claudeVertexProvider.ts", "ai/mockProvider.ts", "ai/modelDeadlines.ts", "server/studioPlanPlates.ts"]);
const PROVIDER_METHODS = new Set(["generateJson", "generateJsonStream", "streamText", "generateImage"]);
/** Server-side AI egress that is not a ModelProvider method. */
const EGRESS_FUNCTIONS = new Set(["scoreChildUtterance", "synthesizeSpeech", "dispatchSpeechSynthesis", "screenAndSynthesizeSpeech"]);
const OTHER_FILE_EGRESS = /\.(generateJson|generateJsonStream|streamText|generateImage)\(|text:synthesize|deps\.provider\.synthesize\(/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) { if (entry !== "__tests__" && entry !== "__mocks__") walk(p, out); }
    else if (/\.tsx?$/.test(entry) && !/\.(test|spec)\.tsx?$|\.d\.ts$/.test(entry)) out.push(p);
  }
  return out;
}

type Handler = { key: string; text: string; calls: Set<string> };

/** routes/api.ts: each AI call keyed by its enclosing router call (or const). */
function apiHandlers(source = read("routes/api.ts")): Map<string, Handler> {
  const file = ts.createSourceFile("api.ts", source, ts.ScriptTarget.Latest, true);
  const handlers = new Map<string, Handler>();
  /** The enclosing `router.<method>(…)` call; else the outermost const inside
   *  createApiRouter (e.g. `narrationCheck`, handed to two routers). */
  const keyFor = (node: ts.Node): { key: string; text: string } | null => {
    let outerConst: ts.VariableDeclaration | null = null;
    for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
      if (ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression) && p.expression.expression.getText(file) === "router") {
        const method = p.expression.name.text;
        const first = p.arguments[0];
        if (method === "use") {
          const callee = first && ts.isCallExpression(first) ? first.expression.getText(file) : "?";
          return { key: `api use ${callee}`, text: p.getText(file) };
        }
        if (first && ts.isStringLiteral(first)) return { key: `api ${method.toUpperCase()} ${first.text}`, text: p.getText(file) };
      }
      if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name) && p.name.text !== "createApiRouter") outerConst = p;
    }
    return outerConst ? { key: `api ${(outerConst.name as ts.Identifier).text}`, text: outerConst.getText(file) } : null;
  };
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      let kind: string | null = null;
      if (ts.isPropertyAccessExpression(callee) && PROVIDER_METHODS.has(callee.name.text) && /(^|\.)(modelProvider|provider)$/.test(callee.expression.getText(file))) kind = callee.name.text;
      if (ts.isPropertyAccessExpression(callee) && callee.getText(file).endsWith("authTokens.create")) kind = "authTokens.create";
      if (ts.isIdentifier(callee) && EGRESS_FUNCTIONS.has(callee.text)) kind = callee.text;
      if (kind) {
        const where = keyFor(node);
        const key = where?.key ?? `api <unattributed line ${file.getLineAndCharacterOfPosition(node.getStart()).line + 1}>`;
        const h = handlers.get(key) ?? { key, text: where?.text ?? "", calls: new Set<string>() };
        h.calls.add(kind);
        handlers.set(key, h);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return handlers;
}

/** Every other source file that calls a provider or synthesizes speech. */
function otherCallers(): string[] {
  return walk(SRC)
    .map((f) => path.relative(SRC, f).split(path.sep).join("/"))
    .filter((rel) => rel !== "routes/api.ts" && !PROVIDER_IMPLEMENTATIONS.has(rel) && !rel.startsWith("eval/"))
    .filter((rel) => OTHER_FILE_EGRESS.test(read(rel)));
}

/* ── the inventory table ──────────────────────────────────────────────────── */

type Row = Record<string, string>;
function inventory(doc: string): Row[] {
  const start = doc.indexOf("\n## Callers\n");
  if (start < 0) return [];
  const rest = doc.slice(start + 12);
  const end = rest.search(/\n## /);
  const lines = (end < 0 ? rest : rest.slice(0, end)).split("\n").filter((l) => l.startsWith("|"));
  const cells = (line: string) => line.slice(1, -1).split("|").map((c) => c.trim());
  const header = cells(lines[0] ?? "|");
  return lines.slice(2).map((l) => Object.fromEntries(cells(l).map((c, i) => [header[i], c])));
}
const list = (cell: string) => cell.split(",").map((s) => s.trim()).filter(Boolean);

/* ── the policy decision for a row's true request ─────────────────────────── */

const PROD = createTestConfig({
  arborEnv: "prod",
  modelProvider: "vertex",
  vertexLocation: "europe-west3",
  vertexModelChat: PINNED.production.VERTEX_MODEL_CHAT,
  vertexModelStory: PINNED.routes.creative_low_risk.resolved,
  vertexModelAnalysis: PINNED.routes.analysis_structured.resolved,
  vertexModelHandoff: PINNED.routes.handoff_structured.resolved,
});
/** The audit date: Live's global exception (to 2027-03-31) is in force. */
const AUDIT_MS = Date.parse("2026-10-28T12:00:00Z");
const REASON_ORDER = ["capability", "audience", "data_class", "region", "training", "retention"];
/** Admits anything, so selectProvider returns the real candidates' rejection reasons instead of throwing. */
const PROBE: ProviderCandidate = {
  ref: { provider: "probe", model: "probe", region: "eu" },
  capabilities: ["structured_text", "text_stream", "realtime_audio", "speech_recognition", "speech_synthesis", "vision_understanding", "image_generation"],
  audiences: ["parent", "child", "professional", "internal"],
  dataClasses: ["public", "account", "child_profile", "child_voice", "child_image"],
  trainsOnCustomerData: false, retentionDays: 0,
  score: { quality: 0, safety: 0, reliability: 0, latencyFitness: 0, costFitness: 0 },
};

function decisionInputs(row: Row): { candidates: ProviderCandidate[]; policy: RoutePolicy } | null {
  switch (row.Decision) {
    case "routeDecisionFor": return { candidates: candidatesFor(PROD, row["Model route"] as ModelRoute, {}), policy: routePolicyFor(PROD) };
    case "synthesizeSpeech": return { candidates: [ttsCandidateFor(PROD)], policy: routePolicyFor(PROD) };
    case "own selectProvider": return { candidates: [bookTtsCandidate("https://eu-texttospeech.googleapis.com")], policy: routePolicyFor(PROD) };
    case "liveDecision": {
      const live = { ...PROD, liveEnabled: true, geminiApiKey: "synthetic-key", liveModel: PINNED.auxiliary[0], liveGlobalExceptionUntil: "2027-03-31" };
      return { candidates: liveCandidatesFor(live), policy: realtimePolicyFor(live, AUDIT_MS) };
    }
    default: return null; // imageRegions, registry adapter: no selectProvider step
  }
}

function trueRequestResult(row: Row): string {
  const inputs = decisionInputs(row);
  if (!inputs) return "no shared decision";
  const request: CapabilityRequest = {
    capability: row.Capability as AiCapability,
    route: (row["Model route"] === "—" ? "creative_low_risk" : row["Model route"]) as ModelRoute,
    audience: row.Audience as AiAudience,
    locale: "en",
    dataClasses: list(row["Data classes"]) as AiDataClass[],
    risk: "moderate",
  };
  if (!inputs.candidates.length) return "rejects: no candidate";
  const decision = selectProvider(request, inputs.policy, [...inputs.candidates, PROBE]);
  if (decision.eligible.some((c) => c !== PROBE)) return "eligible";
  const reasons = new Set(decision.rejected.flatMap((r) => r.reasons));
  return `rejects: ${REASON_ORDER.filter((r) => reasons.has(r)).join(", ")}`;
}

/* ── the rules ────────────────────────────────────────────────────────────── */

const OUTPUT_SCREENS = /\b(screenModelOutput|screenStructuredModelOutput|screenModelOutputLexical|screenAndSynthesizeSpeech|sendScreenedJson|createScreenedProseRelay)\(/;
const KILL_SWITCH_SOURCES = ["config/env.ts", "server/imageQuota.ts", "safety/outputScreen.ts"].map(read).join("\n");

/** A module row's source: the file named by its key (non-route rows only). */
function moduleSource(key: string): string {
  try { return read(key); } catch { return ""; }
}

function inventoryErrors(doc: string, handlers: Map<string, Handler>, others: string[]): string[] {
  const errors: string[] = [];
  const rows = inventory(doc);
  if (!rows.length) return ["no Callers table"];
  const keys = new Set(rows.map((r) => r.Key));
  const discovered = new Set([...handlers.keys(), ...others]);
  for (const k of discovered) if (!keys.has(k)) errors.push(`caller ${k} has no row`);
  for (const k of keys) if (!discovered.has(k)) errors.push(`row ${k} names no caller in the source`);

  for (const row of rows) {
    const h = handlers.get(row.Key);
    if (h) {
      const yes = (b: boolean) => (b ? "yes" : "no");
      if (row["Crisis screen"] !== yes(h.text.includes("screenForImmediateEscalation("))) errors.push(`${row.Key}: crisis screen reads ${row["Crisis screen"]}, source says ${yes(h.text.includes("screenForImmediateEscalation("))}`);
      if (row["Output screen"] !== yes(OUTPUT_SCREENS.test(h.text))) errors.push(`${row.Key}: output screen reads ${row["Output screen"]}, source says ${yes(OUTPUT_SCREENS.test(h.text))}`);
      const consent = h.text.match(/requireConsent\(consentStore, "(\w+)"/)?.[1] ?? "none";
      if (row["Consent gate"] !== consent) errors.push(`${row.Key}: consent gate reads ${row["Consent gate"]}, source says ${consent}`);
      const routes = new Set([...h.text.matchAll(/route: "(\w+)"/g)].map((m) => m[1]));
      if (routes.size && !routes.has(row["Model route"])) errors.push(`${row.Key}: model route reads ${row["Model route"]}, source uses ${[...routes].join(", ")}`);
      if (h.calls.has("generateImage") && row.Capability !== "image_generation") errors.push(`${row.Key}: generates images but reads ${row.Capability}`);
      if ((h.calls.has("streamText") || h.calls.has("generateJsonStream")) && row.Capability !== "text_stream") errors.push(`${row.Key}: streams but reads ${row.Capability}`);
    }
    const computed = trueRequestResult(row);
    if (row["True-request result"] !== computed) errors.push(`${row.Key}: true-request result reads "${row["True-request result"]}", the policy decides "${computed}"`);
    if (row["Kill switch"] !== "—" && !KILL_SWITCH_SOURCES.includes(row["Kill switch"])) errors.push(`${row.Key}: kill switch ${row["Kill switch"]} is not read anywhere`);
  }
  // Module rows (not a route handler): the crisis cell matches the module's own
  // source, and a "via POST /x" cell names a route whose handler really screens.
  for (const row of rows) {
    if (handlers.has(row.Key)) continue;
    const calls = SCREEN_CALL.test(stripComments(moduleSource(row.Key)));
    const cell = row["Crisis screen"] ?? "";
    if (/^yes/.test(cell) !== calls) errors.push(`${row.Key}: crisis screen reads "${cell}", but the module ${calls ? "calls" : "does not call"} screenForImmediateEscalation(`);
    for (const [column, screens] of [["Crisis screen", (t: string) => t.includes("screenForImmediateEscalation(")], ["Output screen", (t: string) => OUTPUT_SCREENS.test(t)]] as const) {
      const via = (row[column] ?? "").match(/^via (POST \/[\w/-]+)/)?.[1];
      if (!via) continue;
      const h = handlers.get(`api ${via}`);
      if (!h || !screens(h.text)) errors.push(`${row.Key}: ${column} reads "via ${via}", but that route does not screen`);
    }
  }
  // Second exact lock: unscreened rows that carry a parent's or child's words or voice.
  const unscreened = rows.filter((r) => /^no\b/.test(r["Crisis screen"] ?? "") && !/^none\b/.test(r["Text in"] ?? "")).map((r) => r.Key).sort();
  for (const k of unscreened) if (!CRISIS_SCREEN_GAPS.includes(k)) errors.push(`${k}: carries ${rows.find((r) => r.Key === k)!["Text in"]} with no crisis screen and is not in CRISIS_SCREEN_GAPS`);
  for (const k of CRISIS_SCREEN_GAPS) if (!unscreened.includes(k)) errors.push(`${k}: listed in CRISIS_SCREEN_GAPS but no longer an unscreened text or voice row: remove it from the lock`);

  const gaps = rows.filter((r) => r["True-request result"] !== "eligible").length;
  if (gaps > GAP_ROWS_BASELINE) errors.push(`${gaps} gap rows, baseline ${GAP_ROWS_BASELINE} (shrink-only)`);
  if (gaps < GAP_ROWS_BASELINE) errors.push(`${gaps} gap rows: a gap closed, lower GAP_ROWS_BASELINE to ${gaps} (shrink-only lock)`);
  return errors;
}

const HANDLERS = apiHandlers();
const OTHERS = otherCallers();

/* ── the live inventory ───────────────────────────────────────────────────── */

describe("B-AIOPS-08 — AI caller inventory matches the source and the policy", () => {
  it("discovery finds the known callers (non-vacuous)", () => {
    for (const k of ["api POST /chat", "api POST /voice", "api POST /vision", "api POST /live/token", "api POST /tts", "api POST /generate-avatar", "api narrationCheck", "api use createPlanPlatesRouter"]) {
      expect(HANDLERS.has(k), k).toBe(true);
    }
    expect(OTHERS).toEqual(expect.arrayContaining(["services/council.ts", "safety/outputScreen.ts", "server/childAsr.ts", "server/bookNarration.ts"]));
    expect([...HANDLERS.keys()].filter((k) => k.includes("unattributed"))).toEqual([]);
  });

  it("the inventory, the handlers and the policy decisions agree", () => {
    expect(inventoryErrors(DOC, HANDLERS, OTHERS)).toEqual([]);
  });

  it("the text-route gaps exist because routeDecisionFor evaluates one fixed request", () => {
    // When this changes (each caller passes its true request), the rejects
    // rows above must be re-decided and the table updated in the same change.
    const router = read("ai/modelRouter.ts");
    const fixed = router.slice(router.indexOf("export const routeDecisionFor"), router.indexOf("export const toAnthropicVertexModelId"));
    expect(fixed).toMatch(/audience: "parent"/);
    expect(fixed).toMatch(/dataClasses: \["child_profile"\]/);
    expect(fixed).toMatch(/locale: "en"/);
  });

  it("the TTS gap: /tts declares public data; book narration declares the child's name", () => {
    const tts = read("server/tts.ts");
    const request = tts.slice(tts.indexOf("export async function synthesizeSpeech"), tts.indexOf("const decision = selectProvider"));
    expect(request).toMatch(/dataClasses: \["public"\]/);
    expect(read("server/bookNarration.ts")).toMatch(/audience: "child", locale: [^,]+, dataClasses: \["child_profile"\]/);
  });

  it("the TTS residency gap: the declared region follows VERTEX_LOCATION, the call goes to the global endpoint", () => {
    // Gap 6 in the inventory. When /tts calls an EU endpoint (or declares the
    // endpoint's real region), this pin fails and the table moves with it.
    const tts = read("server/tts.ts");
    expect(tts).toMatch(/region: providerRegion\(config\.vertexLocation\)/);
    expect(tts).toContain('fetch("https://texttospeech.googleapis.com/v1/text:synthesize"');
    expect(ttsCandidateFor(PROD).ref.region).toBe("eu");
  });
});

/* ── negative controls ────────────────────────────────────────────────────── */

describe("B-AIOPS-08 — negative controls", () => {
  const without = (key: string) => DOC.split("\n").filter((l) => !l.startsWith(`| ${key} |`)).join("\n");

  it("a caller with no row fails, and a row with no caller fails", () => {
    expect(inventoryErrors(without("api POST /vision"), HANDLERS, OTHERS)).toContain("caller api POST /vision has no row");
    const extra = new Map(HANDLERS); extra.delete("api POST /digest");
    expect(inventoryErrors(DOC, extra, OTHERS)).toContain("row api POST /digest names no caller in the source");
  });

  it("a new route that calls a provider is discovered and must be inventoried", () => {
    const src = `${read("routes/api.ts")}\nconst late = (router: any, modelProvider: any) => router.post("/synthetic-new", async () => modelProvider.generateJson({ route: "analysis_structured" }));\n`;
    expect(apiHandlers(src).has("api POST /synthetic-new")).toBe(true);
    expect(inventoryErrors(DOC, apiHandlers(src), OTHERS)).toContain("caller api POST /synthetic-new has no row");
  });

  it("a gap written down as eligible fails", () => {
    const lied = DOC.replace("| imageRegions | no shared decision |", "| imageRegions | eligible |")
      .replace("| routeDecisionFor | rejects: audience |", "| routeDecisionFor | eligible |");
    const errors = inventoryErrors(lied, HANDLERS, OTHERS);
    expect(errors.some((e) => e.endsWith(`reads "eligible", the policy decides "rejects: audience"`))).toBe(true);
    expect(errors.some((e) => e.endsWith(`reads "eligible", the policy decides "no shared decision"`))).toBe(true);
  });

  it("a wrong crisis-screen or consent cell fails", () => {
    const flipped = DOC.replace("| api POST /explain | structured_text | parent | child_profile | analysis_structured | none | parent text | yes |", "| api POST /explain | structured_text | parent | child_profile | analysis_structured | none | parent text | no |")
      .replace("| face_processing |", "| none |");
    const errors = inventoryErrors(flipped, HANDLERS, OTHERS);
    expect(errors).toContain("api POST /explain: crisis screen reads no, source says yes");
    expect(errors).toContain("api POST /generate-avatar: consent gate reads none, source says face_processing");
  });

  it("a closed gap fails until the baseline is lowered (the lock is exact)", () => {
    const closed = DOC.replace(/(\| api POST \/generate-adventure \| structured_text \| )child( \|[^\n]*\| routeDecisionFor \| )rejects: audience( \|)/, "$1parent$2eligible$3");
    expect(closed).not.toBe(DOC);
    expect(inventoryErrors(closed, HANDLERS, OTHERS)).toContain(`${GAP_ROWS_BASELINE - 1} gap rows: a gap closed, lower GAP_ROWS_BASELINE to ${GAP_ROWS_BASELINE - 1} (shrink-only lock)`);
  });

  it("a new gap row beyond the baseline fails the ratchet", () => {
    const grown = DOC.replace("| api POST /council | text_stream | parent | account, child_profile |", "| api POST /council | text_stream | child | account, child_profile |")
      .replace(/(\| api POST \/council \|[^\n]*\| routeDecisionFor \| )eligible( \|)/, "$1rejects: audience$2");
    expect(inventoryErrors(grown, HANDLERS, OTHERS)).toContain(`${GAP_ROWS_BASELINE + 1} gap rows, baseline ${GAP_ROWS_BASELINE} (shrink-only)`);
  });

  it("crisis-screen lock: a new unscreened text row fails, and a screened one must leave the lock", () => {
    // /hero-pose carries no text today; claim it does and it becomes an unlisted unscreened row.
    const grown = DOC.replace("| none: the stored hero picture |", "| parent text |");
    expect(grown).not.toBe(DOC);
    expect(inventoryErrors(grown, HANDLERS, OTHERS)).toContain("api POST /hero-pose: carries parent text with no crisis screen and is not in CRISIS_SCREEN_GAPS");
    // Mark the plan narration row screened: the lock must shrink with it (and the module check catches the false claim).
    const row = DOC.split("\n").find((l) => l.startsWith("| server/planNarration.ts |"))!;
    const cells = row.slice(1, -1).split("|").map((c) => c.trim());
    const header = DOC.split("\n").find((l) => l.startsWith("| Key |"))!.slice(1, -1).split("|").map((c) => c.trim());
    cells[header.indexOf("Crisis screen")] = "yes (synthetic claim)";
    const screened = DOC.replace(row, `| ${cells.join(" | ")} |`);
    const errors = inventoryErrors(screened, HANDLERS, OTHERS);
    expect(errors).toContain("server/planNarration.ts: listed in CRISIS_SCREEN_GAPS but no longer an unscreened text or voice row: remove it from the lock");
    expect(errors.some((e) => e.startsWith("server/planNarration.ts: crisis screen reads \"yes (synthetic claim)\", but the module does not call"))).toBe(true);
    // The real plans row is screened in the source (main 283c3b84), so calling it unscreened fails too.
    const plansRow = DOC.split("\n").find((l) => l.startsWith("| server/plans.ts |"))!;
    const plansCells = plansRow.slice(1, -1).split("|").map((c) => c.trim());
    plansCells[header.indexOf("Crisis screen")] = "no (synthetic claim)";
    expect(inventoryErrors(DOC.replace(plansRow, `| ${plansCells.join(" | ")} |`), HANDLERS, OTHERS).some((e) => e.startsWith("server/plans.ts: crisis screen reads \"no (synthetic claim)\", but the module calls"))).toBe(true);
  });

  it("a 'via' cell must name a route whose handler really screens", () => {
    const wrong = DOC.replace("| via POST /council | via POST /council |", "| via POST /todays-focus | via POST /council |");
    expect(wrong).not.toBe(DOC);
    expect(inventoryErrors(wrong, HANDLERS, OTHERS)).toContain('services/council.ts: Crisis screen reads "via POST /todays-focus", but that route does not screen');
  });
});
