/**
 * AI-07 (council-streaming, 2026-09-04) — route tests for /api/council once it
 * is driven through the SHARED screened sentence relay.
 *
 * The defect these tests exist to catch: /council used to end with one
 * `res.json(...)` after the whole multi-agent orchestration finished, so a
 * council answer was a silent spinner the parent could not cancel — and the
 * screening logic it would otherwise need was a second copy of /chat's, free to
 * drift from it.
 *
 * Asserted here:
 *  - the council prose arrives as SCREENED SENTENCE deltas, the first of them
 *    strictly BEFORE the provider finishes generating (it really streams);
 *  - CLINICAL FIREWALL: a flagged span reaches NO SSE frame, structured panels
 *    and the per-scholar takes stay gated at `done`, and a done-time flag
 *    returns the retractable blocked payload;
 *  - cancellation: a client that goes away aborts the signal the route threaded
 *    INTO the provider, so the upstream call actually stops;
 *  - the non-SSE request shape is unchanged (one JSON body, no SSE framing);
 *  - createScreenedProseRelay is constructed at exactly TWO sites (/chat and
 *    /council) and /council contains no second copy of the screening call — the
 *    non-drift property the extraction exists for — and the relay's docblock
 *    describes what actually ships.
 *
 * Every block below carries a NEGATIVE CONTROL: an assertion that fails if the
 * test is passing vacuously (an empty stream, an empty source scan, a matcher
 * that matches nothing).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import express from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApiRouter } from "./api.js";
import { createTestConfig } from "../testConfig.js";
import { loadFramework } from "../services/framework.js";
import { LocalMemoryStore } from "../memory/localMemoryStore.js";
import { LocalShareStore } from "../sharing/shares.js";
import { LocalConsentStore } from "../sharing/consent.js";
import { createCounterStore } from "../server/quotaStore.js";
import { createEntitlementStore } from "../server/entitlements.js";
import { createReferralStore } from "../server/referral.js";
import { createConsultStore } from "../server/consultRequests.js";
import { createAdminMetricsStore } from "../server/adminMetrics.js";
import { createWaitlistStore } from "../server/waitlist.js";
import { screenForImmediateEscalation, renderEscalationMarkdown } from "../safety/escalation.js";
import { renderBlockedOutputMarkdown } from "../safety/outputScreen.js";
import type { ModelProvider } from "../ai/modelRouter.js";

// ── Instrumented stub provider ──────────────────────────────────────────────
/** The coach contract the synthesis stub streams; `text` leads (schema order). */
const contractFor = (text: string, extra: Record<string, unknown> = {}) => ({
  text,
  riskLevel: "Low",
  ageBand: "3-4",
  domains: ["social_emotional"],
  nonDiagnosticHypotheses: [
    { label: "Big feelings at transitions", confidence: "one possibility", rationale: "Common at this age." },
  ],
  todayPlan: ["Name the feeling and offer two choices."],
  parentScript: "I can see this is hard. Let's take one breath together.",
  avoid: ["Long lectures in the moment."],
  observe: ["When it starts and how long it lasts."],
  escalateIf: ["The pattern intensifies for two weeks."],
  frameRouting: { aim: "a", twoAxes: "b", story: "c", shadow: "d", marriage: "e", shepherd: "f" },
  memoryProposals: [],
  handoffNotes: { teacher: "t", professional: "p" },
  sourceCardsUsed: [],
  ...extra,
});

let providerDocument = "";
let providerChunkSize = 8;
let providerDelayMs = 0;
let timeline: string[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const stubModelProvider = {
  /** The SYNTHESIS call — the one the screened relay tails. */
  async *generateJsonStream(options: any) {
    // AI-07 cancellation evidence: the route must thread its budget signal INTO
    // the provider. If it stops doing so, `provider:signal-abort` never appears
    // and the cancellation test below fails.
    options?.budget?.signal?.addEventListener?.("abort", () => timeline.push("provider:signal-abort"), { once: true });
    for (let i = 0; i < providerDocument.length; i += providerChunkSize) {
      if (providerDelayMs) await sleep(providerDelayMs);
      timeline.push(`provider:yield:${Math.floor(i / providerChunkSize) + 1}`);
      yield providerDocument.slice(i, i + providerChunkSize);
    }
    timeline.push("provider:done");
  },
  /** Two callers share this: the parallel scholar takes and the output classifier. */
  async generateJson(options: any) {
    if (options?.route === "creative_low_risk") {
      timeline.push("provider:take");
      return { takeaway: "Transitions ask a lot of a small nervous system.", suggestion: "Offer two choices at the door." };
    }
    return { safe: true, reason: "" };
  },
  async *streamText() {
    yield "";
  },
} as unknown as ModelProvider;

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const config = createTestConfig();
  const entitlementStore = createEntitlementStore(config);
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createApiRouter({
      config,
      modelProvider: stubModelProvider,
      memoryStore: new LocalMemoryStore(),
      shareStore: new LocalShareStore(),
      consentStore: new LocalConsentStore(),
      framework: loadFramework(),
      entitlementStore,
      referralStore: createReferralStore(config, entitlementStore),
      counters: createCounterStore(config),
      consultStore: createConsultStore(config),
      adminMetrics: createAdminMetricsStore(config),
      waitlistStore: createWaitlistStore(config),
    }),
  );
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
});

beforeEach(() => {
  providerDocument = "";
  providerChunkSize = 8;
  providerDelayMs = 0;
  timeline = [];
  vi.unstubAllEnvs();
});

// ── SSE helpers ─────────────────────────────────────────────────────────────
type SseEvent = { event: string; data: Record<string, any> };

const parseSse = (raw: string): SseEvent[] => {
  const events: SseEvent[] = [];
  for (const block of raw.split("\n\n")) {
    if (!block.trim()) continue;
    let event = "message";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length) events.push({ event, data: JSON.parse(dataLines.join("\n")) });
  }
  return events;
};

/** Stream /api/council, logging each delta arrival on the shared timeline so
 *  cadence is asserted CAUSALLY against provider progress. */
async function postCouncilStreamed(
  body: unknown,
  opts: { abortAfterDeltas?: number } = {},
): Promise<{ events: SseEvent[]; raw: string; aborted: boolean }> {
  const controller = new AbortController();
  let aborted = false;
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/council`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    return { events: [], raw: "", aborted: true };
  }
  const reader = (res.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let sseBuf = "";
  let raw = "";
  let deltaCount = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      raw += chunk;
      sseBuf += chunk;
      let idx: number;
      let stop = false;
      while ((idx = sseBuf.indexOf("\n\n")) >= 0) {
        const block = sseBuf.slice(0, idx);
        sseBuf = sseBuf.slice(idx + 2);
        const [ev] = parseSse(`${block}\n\n`);
        if (!ev) continue;
        if (ev.event === "delta") {
          timeline.push(`client:delta:${++deltaCount}`);
          if (opts.abortAfterDeltas && deltaCount >= opts.abortAfterDeltas) stop = true;
        }
        if (ev.event === "done") timeline.push("client:done");
      }
      if (stop) {
        timeline.push("client:abort");
        aborted = true;
        controller.abort();
        break;
      }
    }
  } catch {
    aborted = true;
  }
  return { events: parseSse(raw), raw, aborted };
}

const deltas = (events: SseEvent[]) => events.filter((e) => e.event === "delta");
const statuses = (events: SseEvent[]) => events.filter((e) => e.event === "status");
const deltaText = (events: SseEvent[]) => deltas(events).map((e) => String(e.data.text ?? "")).join("");
const doneOf = (events: SseEvent[]) => events.find((e) => e.event === "done")?.data;

const CHILD = { id: "c1", name: "Mia" };
const PROSE =
  "You're not alone — mornings are a very common battleground. Try laying out two choices tonight. A small sense of control often melts the standoff. It usually eases within a week or two.";

describe("/api/council real streaming (AI-07)", () => {
  it("the council answer streams: >=3 screened sentence deltas, first delta BEFORE the provider finishes; done carries text + contract + takes", async () => {
    providerDocument = JSON.stringify(contractFor(PROSE));
    providerDelayMs = 5;
    const { events } = await postCouncilStreamed({ message: "Mornings are war", childProfile: CHILD });

    // REGRESSION DETECTOR: if /council reverts to generateJson + res.json, this
    // is 0 and the causal ordering below is unreachable.
    expect(deltas(events).length).toBeGreaterThanOrEqual(3);
    expect(deltaText(events).length).toBeGreaterThan(0);
    // Concatenated deltas are a byte-exact PREFIX of the prose (the trailing
    // fragment with no sentence boundary arrives via `done`, never as a delta).
    expect(PROSE.startsWith(deltaText(events))).toBe(true);
    expect(deltas(events)[0].data.text).toBe("You're not alone — mornings are a very common battleground. ");
    // Causal cadence: first visible words BEFORE generation finished. This is
    // what "not a silent spinner" means, asserted rather than assumed.
    const firstDeltaAt = timeline.indexOf("client:delta:1");
    const providerDoneAt = timeline.indexOf("provider:done");
    expect(firstDeltaAt).toBeGreaterThanOrEqual(0);
    expect(providerDoneAt).toBeGreaterThanOrEqual(0);
    expect(firstDeltaAt).toBeLessThan(providerDoneAt);

    const done = doneOf(events);
    expect(done?.outputBlocked).toBeUndefined();
    expect(String(done?.text)).toContain(PROSE);
    expect(done?.contract?.text).toBe(PROSE);
    // The multi-agent orchestration still ran and its takes still ship at done.
    expect(timeline.filter((t) => t === "provider:take").length).toBeGreaterThan(0);
    expect(Array.isArray(done?.council)).toBe(true);
    expect(done?.council.length).toBeGreaterThan(0);
  });

  it("NEGATIVE CONTROL for the streaming assertions: the SAME request without the SSE Accept header produces ZERO SSE frames and one JSON body", async () => {
    // Without this, every `deltas(...)` assertion above could be satisfied by a
    // harness that invents frames. Here the identical provider document yields
    // no frames at all, proving the deltas come from the route's SSE path.
    providerDocument = JSON.stringify(contractFor(PROSE));
    const res = await fetch(`${baseUrl}/api/council`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Mornings are war", childProfile: CHILD }),
    });
    const bodyText = await res.text();
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(bodyText).not.toContain("event: delta");
    expect(parseSse(bodyText)).toHaveLength(0);
    // …and the legacy contract is untouched: one JSON payload, same shape.
    const data = JSON.parse(bodyText);
    expect(data.text).toContain(PROSE);
    expect(data.contract?.text).toBe(PROSE);
    expect(Array.isArray(data.council)).toBe(true);
  });

  it("status events are milestone STAGE KEYS in order (memory → council → sources → plan) with NO copy in any language", async () => {
    providerDocument = JSON.stringify(contractFor(PROSE));
    const { events } = await postCouncilStreamed({ message: "Mornings are war", childProfile: CHILD });
    expect(statuses(events).map((e) => e.data.stage)).toEqual(["memory", "council", "sources", "plan"]);
    for (const s of statuses(events)) {
      // NEGATIVE CONTROL against a server-authored English status line leaking
      // into a Hebrew session: the frame carries the key and nothing else.
      expect(Object.keys(s.data)).toEqual(["stage"]);
    }
  });

  it("ACCEPTANCE ANCHOR: 'Mia has autism' mid-synthesis never renders — prior clean sentence delivered, blocked done, tail never yielded", async () => {
    const flaggedProse =
      "It is really common for kids to test the same limit. Mia has autism and that explains it. SENTINEL-NEVER-DELIVERED.";
    providerDocument = JSON.stringify(contractFor(flaggedProse));
    providerChunkSize = 6;
    providerDelayMs = 2;
    const { events, raw } = await postCouncilStreamed({ message: "Why does she keep doing this?", childProfile: CHILD });

    // NEGATIVE CONTROL: the stream is genuinely live — the clean sentence
    // BEFORE the flag was delivered, so `not.toContain` below is not passing
    // merely because nothing was ever streamed.
    expect(deltas(events)[0]?.data.text).toBe("It is really common for kids to test the same limit. ");
    expect(raw.length).toBeGreaterThan(0);
    expect(raw).toContain("common for kids to test the same limit");

    // …the flagged sentence appears in NO SSE frame…
    expect(raw).not.toContain("has autism");
    expect(raw).not.toContain("SENTINEL-NEVER-DELIVERED");
    // …done is the standard blocked payload (the client retracts the bubble)…
    const done = doneOf(events);
    expect(done?.outputBlocked).toBe(true);
    expect(done?.blockedCategory).toBe("diagnosis");
    expect(done?.text).toBe(renderBlockedOutputMarkdown());
    // …structured panels AND the per-scholar takes never ship on a flag…
    expect(done?.contract).toBeUndefined();
    expect(done?.council).toEqual([]);
    // …and generation stopped at the flag: the provider never finished.
    expect(timeline.indexOf("provider:done")).toBe(-1);
  });

  it("alias restoration precedes the screen AND the deltas: [Child] in the synthesis reaches the parent as the real name", async () => {
    providerDocument = JSON.stringify(
      contractFor("It helps to narrate what [Child] is feeling. Try that at the door today."),
    );
    const { events } = await postCouncilStreamed({ message: "Door dramas", childProfile: CHILD });
    // The NAME_SUBJECT lexical floor assumes restored names, so the restorer
    // must run BEFORE the screen — visible here as the real name on the wire.
    expect(deltaText(events)).toContain("Mia is feeling");
    expect(deltaText(events)).not.toContain("[Child]");
  });

  it("classifier ON: deltas still stream, and a done-time semantic flag returns the blocked payload the client retracts to", async () => {
    vi.stubEnv("ENABLE_OUTPUT_SAFETY_CLASSIFIER", "true");
    const classifierProvider = {
      ...stubModelProvider,
      async generateJson(options: any) {
        if (options?.route === "creative_low_risk") {
          timeline.push("provider:take");
          return { takeaway: "t", suggestion: "s" };
        }
        return { safe: false, reason: "sounded diagnostic" };
      },
    } as unknown as ModelProvider;
    // A dedicated app instance so the unsafe classifier verdict cannot leak
    // into the other cases in this file.
    const config = createTestConfig();
    const entitlementStore = createEntitlementStore(config);
    const app = express();
    app.use(express.json());
    app.use(
      "/api",
      createApiRouter({
        config,
        modelProvider: classifierProvider,
        memoryStore: new LocalMemoryStore(),
        shareStore: new LocalShareStore(),
        consentStore: new LocalConsentStore(),
        framework: loadFramework(),
        entitlementStore,
        referralStore: createReferralStore(config, entitlementStore),
        counters: createCounterStore(config),
        consultStore: createConsultStore(config),
        adminMetrics: createAdminMetricsStore(config),
        waitlistStore: createWaitlistStore(config),
      }),
    );
    const local = await new Promise<Server>((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    try {
      providerDocument = JSON.stringify(contractFor(PROSE));
      const res = await fetch(`http://127.0.0.1:${(local.address() as AddressInfo).port}/api/council`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ message: "Mornings are war", childProfile: CHILD }),
      });
      const events = parseSse(await res.text());
      // Streaming is NOT suppressed by the classifier (parity with /chat)…
      expect(deltas(events).length).toBeGreaterThanOrEqual(3);
      // …but done is the RETRACTABLE blocked payload.
      const done = doneOf(events);
      expect(done?.outputBlocked).toBe(true);
      expect(done?.blockedCategory).toBe("semantic_unsafe");
      expect(done?.text).toBe(renderBlockedOutputMarkdown());
      expect(done?.council).toEqual([]);
    } finally {
      await new Promise<void>((resolve, reject) => local.close((e) => (e ? reject(e) : resolve())));
    }
  });

  it("escalation pre-screen unchanged on BOTH transports: crisis input → immediate resources, model NEVER invoked", async () => {
    providerDocument = JSON.stringify(contractFor(PROSE));
    const message = "Sometimes I am afraid I will hurt my child when it gets this bad.";
    const match = screenForImmediateEscalation({ message });
    expect(match).toBeTruthy();

    const { events } = await postCouncilStreamed({ message, childProfile: CHILD });
    // No takes, no synthesis — the model was never called. (The timeline also
    // carries client-side markers from the harness; only `provider:*` entries
    // are evidence about the route.)
    expect(timeline.filter((t) => t.startsWith("provider:"))).toEqual([]);
    expect(deltas(events)).toHaveLength(0);
    expect(statuses(events)).toHaveLength(0);
    const done = doneOf(events);
    expect(done?.riskLevel).toBe("urgent");
    expect(done?.escalationCategory).toBe(match!.category);
    expect(done?.text).toBe(renderEscalationMarkdown(match!));
    expect(done?.council).toEqual([]);

    // NEGATIVE CONTROL / byte-identity: the non-SSE body is the same object.
    const res = await fetch(`${baseUrl}/api/council`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, childProfile: CHILD }),
    });
    expect(await res.json()).toEqual(done);
  });

  it("CANCELLATION: a parent who leaves mid-answer aborts the signal the route threaded INTO the provider — the upstream call stops", async () => {
    providerDocument = JSON.stringify(contractFor(PROSE));
    providerChunkSize = 4;
    providerDelayMs = 12;
    const { aborted } = await postCouncilStreamed(
      { message: "Mornings are war", childProfile: CHILD },
      { abortAfterDeltas: 1 },
    );
    expect(aborted).toBe(true);
    // Give the server a tick to observe the closed response.
    await sleep(150);
    // The route's budget signal fired INSIDE the provider call…
    expect(timeline).toContain("provider:signal-abort");
    // …and the document was never finished, so generation genuinely stopped
    // rather than running on (and billing) behind a discarded response.
    expect(timeline).not.toContain("provider:done");
  });

  it("NEGATIVE CONTROL for cancellation: an un-aborted run of the SAME request finishes and never reports a signal abort", async () => {
    // Without this, the cancellation test could pass on a provider that always
    // aborts or a stream that never completes.
    providerDocument = JSON.stringify(contractFor(PROSE));
    providerChunkSize = 4;
    providerDelayMs = 1;
    const { events, aborted } = await postCouncilStreamed({ message: "Mornings are war", childProfile: CHILD });
    expect(aborted).toBe(false);
    expect(timeline).toContain("provider:done");
    expect(timeline).not.toContain("provider:signal-abort");
    expect(doneOf(events)?.contract?.text).toBe(PROSE);
  });
});

// ── The non-drift property the extraction exists for ────────────────────────
const API_SOURCE_PATH = fileURLToPath(new URL("./api.ts", import.meta.url));
const API_SOURCE = readFileSync(API_SOURCE_PATH, "utf8");

/**
 * Slice out one `router.post("<path>", ...)` handler, ending at the NEXT route
 * registration. Brace-balance slicing is wrong here: this file's handlers are
 * full of braces inside strings, template literals and regexes, so a counter
 * silently runs to the end of the file and every `not.toContain` becomes a
 * false failure (and every `toContain` a false pass). Route registrations are
 * the one unambiguous delimiter — all of them sit at two-space indentation
 * inside createApiRouter.
 */
const NEXT_ROUTE = /\n {2}router\.(post|get|put|delete|use)\(/;
const handlerSource = (routePath: string): string => {
  const start = API_SOURCE.indexOf(`router.post("${routePath}"`);
  if (start === -1) return "";
  const rest = API_SOURCE.slice(start + 1);
  const next = NEXT_ROUTE.exec(rest);
  const block = next ? API_SOURCE.slice(start, start + 1 + next.index) : API_SOURCE.slice(start);
  // Drop the trailing docblock that belongs to the NEXT route.
  const end = block.lastIndexOf("\n  });");
  return end === -1 ? block : block.slice(0, end + "\n  });".length);
};

describe("source scan — createScreenedProseRelay is ONE seam shared by /chat and /council", () => {
  it("the scan reads a real, non-empty source file and really finds both handlers (negative control for every assertion below)", () => {
    // A silently-empty scan is a false pass. Prove the text exists first.
    expect(API_SOURCE.length).toBeGreaterThan(50_000);
    expect(API_SOURCE).toContain("const createScreenedProseRelay = (");
    expect(handlerSource("/chat").length).toBeGreaterThan(2_000);
    expect(handlerSource("/council").length).toBeGreaterThan(2_000);
    // …and that the slicer DISCRIMINATES — a route that does not exist yields
    // nothing, so a passing `toContain` below cannot come from a stray match.
    expect(handlerSource("/no-such-route-exists")).toBe("");
  });

  it("the relay is constructed at exactly TWO sites, and they are /chat and /council", () => {
    const sites = API_SOURCE.match(/createScreenedProseRelay\(res,/g) ?? [];
    expect(sites).toHaveLength(2);
    expect(handlerSource("/chat")).toContain("createScreenedProseRelay(res,");
    expect(handlerSource("/council")).toContain("createScreenedProseRelay(res,");
  });

  it("/council holds NO second copy of the screening logic — it calls the shared relay, never screenModelOutputLexical directly", () => {
    const council = handlerSource("/council");
    // The lexical floor is CALLED in exactly one place for the council path:
    // inside createScreenedProseRelay. A copy here is the drift this item
    // exists to prevent. Matched as a call (`name(`), not a mention — both
    // handlers name the function in prose, and a comment is not a screen.
    const LEXICAL_CALL = /screenModelOutputLexical\s*\(/;
    expect(LEXICAL_CALL.test(council)).toBe(false);
    expect(LEXICAL_CALL.test(handlerSource("/chat"))).toBe(false);
    // NEGATIVE CONTROL: the call really is present in this file (so the two
    // assertions above are about placement, not about a renamed function), and
    // the matcher really does fire on it.
    expect(API_SOURCE).toContain("screenModelOutputLexical((released + bytes).trim())");
    expect(LEXICAL_CALL.test(API_SOURCE)).toBe(true);
    // The done-time full screen still runs on the complete rendered answer.
    expect(council).toContain("await screenModelOutput(modelProvider, renderedText)");
  });

  it("/council streams and is cancellable: it drives generateJsonStream through abortableIterate with the route budget", () => {
    const council = handlerSource("/council");
    expect(council).toContain("abortableIterate(modelProvider.generateJsonStream(");
    expect(council).toContain("budget: budget.budget");
    expect(council).toContain("budget.signal");
    // The defect shape: a single blocking synthesis call.
    expect(council).not.toContain("modelProvider.generateJson({");
  });

  it("the relay docblock describes what SHIPS — the stale one-site / res.json claims are gone", () => {
    const docStart = API_SOURCE.indexOf("* AI-07 — the screened sentence relay");
    expect(docStart).toBeGreaterThan(-1);
    const raw = API_SOURCE.slice(docStart, API_SOURCE.indexOf("const createScreenedProseRelay = ("));
    // Comment leaders and hard wrapping are formatting, not meaning — compare
    // on the prose so a re-wrap never silently disarms this test.
    const doc = raw.replace(/^[ \t]*\*+[ \t]?/gm, "").replace(/\s+/g, " ").trim();
    // NEGATIVE CONTROL: the extracted docblock is real text, not an empty slice.
    expect(doc.length).toBeGreaterThan(400);
    expect(doc).toContain("CLINICAL FIREWALL");
    // The claims that were true before AI-07 and are false after it.
    expect(doc).not.toContain("that move has NOT happened");
    expect(doc).not.toContain("exactly one site");
    expect(doc).not.toContain("/council still ends with res.json");
    // And the claim it makes now is the one the count test above verifies.
    expect(doc).toContain("exactly TWO sites");
  });
});
