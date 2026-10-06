/**
 * AIR-5 — /api/todays-focus route tests against the REAL handler with a
 * stubbed model provider.
 *
 * The Today card used to POST /api/chat (the heaviest route in the app) and
 * silently burn the free plan's daily coach meter on an ambient card. The
 * dedicated lightweight endpoint must:
 *  - run the analysis route with the 2-field schema and NON_DIAGNOSTIC_CONTRACT,
 *  - pass its output through screenModelOutput BEFORE returning (firewall
 *    condition 1 — never the first unscreened parent-facing generative surface),
 *  - cache per user+child per day, serving ONLY screened payloads (condition 4),
 *  - keep verdict primitives (avg intensity / milestone %) out of the prompt,
 *  - sit inside the hourly AI quota but OUTSIDE the coach meter (source-pinned
 *    against createApp.ts below).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import * as fs from "node:fs";
import * as path from "node:path";
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
import type { ModelProvider } from "../ai/modelRouter.js";

let lastPrompt = "";
let lastSchema: { required?: string[]; properties?: Record<string, unknown> } = {};
let providerCalls = 0;
let draft: Record<string, unknown> = {};

const stubModelProvider = {
  generateJson: async ({ prompt, schema }: { prompt: string; schema?: { required?: string[]; properties?: Record<string, unknown> } }) => {
    lastPrompt = prompt;
    if (schema?.properties && "tryToday" in schema.properties) lastSchema = schema;
    providerCalls += 1;
    return draft;
  },
  async *streamText() {
    yield "";
  },
  async *generateJsonStream() {
    yield "{}";
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

const postFocus = async (body: unknown) => {
  const res = await fetch(`${baseUrl}/api/todays-focus`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, headers: res.headers, json: (await res.json()) as Record<string, unknown> };
};

const CLEAN_DRAFT = {
  focus: "Mornings have been busiest around transitions this week.",
  tryToday: "Try a two-minute warning before leaving the house today.",
};

describe("/api/todays-focus happy path (AIR-5)", () => {
  it("returns the screened 2-field focus with a dateKey", async () => {
    draft = { ...CLEAN_DRAFT };
    const { status, json } = await postFocus({
      childProfile: { id: "c-happy", name: "Test Child", age: 4 },
      signals: { count: 4, topTrigger: "transitions" },
    });
    expect(status).toBe(200);
    expect(json.focus).toContain("transitions");
    expect(json.tryToday).toContain("two-minute warning");
    expect(String(json.text)).toContain("transitions");
    expect(json.dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("embeds NON_DIAGNOSTIC_CONTRACT and the flat signals — never verdict primitives", async () => {
    draft = { ...CLEAN_DRAFT };
    lastPrompt = "";
    await postFocus({
      childProfile: { id: "c-prompt", name: "Test Child", age: 4 },
      signals: { count: 7, topTrigger: "bedtime", avg: 4.2, milestonesPercent: 63 },
    });
    expect(lastPrompt).toContain("Never diagnose");
    expect(lastPrompt).toContain("7 moments");
    expect(lastPrompt).toContain('"bedtime"');
    // Wave-3 clinical subtraction stays pinned server-side: intensity averages
    // and milestone percentages never reach the model even when a client sends them.
    expect(lastPrompt).not.toContain("4.2");
    expect(lastPrompt).not.toContain("63");
    expect(lastPrompt).not.toMatch(/average intensity/i);
    expect(lastPrompt).not.toMatch(/milestone readiness/i);
  });

  it("carries the Hebrew directive for language:'he'", async () => {
    draft = { focus: "הבקרים היו עמוסים סביב מעברים השבוע.", tryToday: "נסו התראה של שתי דקות לפני יציאה." };
    lastPrompt = "";
    const { status, json } = await postFocus({
      childProfile: { id: "c-he", name: "Test Child", age: 4 },
      signals: { count: 2, topTrigger: "מעברים" },
      language: "he",
    });
    expect(status).toBe(200);
    expect(lastPrompt).toContain("עברית");
    expect(String(json.text)).toContain("מעברים");
  });
});

describe("/api/todays-focus output screen (AIR-5 firewall condition 1)", () => {
  it("a diagnostic draft is blocked with 422 and the text never reaches the response", async () => {
    draft = {
      focus: "Your child has autism and this explains the week.",
      tryToday: "Start a treatment plan.",
    };
    const { status, json } = await postFocus({
      childProfile: { id: "c-flagged", name: "Test Child", age: 4 },
      signals: { count: 3, topTrigger: "transitions" },
    });
    expect(status).toBe(422);
    expect(JSON.stringify(json)).not.toContain("autism");
    expect(json.text).toBeUndefined();
  });

  it("a flagged draft is never cached — the next call re-generates", async () => {
    draft = { ...CLEAN_DRAFT };
    providerCalls = 0;
    const { status } = await postFocus({
      childProfile: { id: "c-flagged", name: "Test Child", age: 4 },
      signals: { count: 3, topTrigger: "transitions" },
    });
    expect(status).toBe(200);
    expect(providerCalls).toBe(1);
  });
});

describe("/api/todays-focus daily cache (AIR-5 firewall condition 4)", () => {
  it("second call same user+child+day serves the cached screened payload without a model call", async () => {
    draft = { ...CLEAN_DRAFT };
    providerCalls = 0;
    const first = await postFocus({
      childProfile: { id: "c-cache", name: "Test Child", age: 4 },
      signals: { count: 5, topTrigger: "transitions" },
    });
    const second = await postFocus({
      childProfile: { id: "c-cache", name: "Test Child", age: 4 },
      signals: { count: 5, topTrigger: "transitions" },
    });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(providerCalls).toBe(1);
    expect(second.json.text).toEqual(first.json.text);
  });

  it("a different child misses the cache", async () => {
    draft = { ...CLEAN_DRAFT };
    providerCalls = 0;
    await postFocus({ childProfile: { id: "c-cache-a", name: "A" }, signals: { count: 1 } });
    await postFocus({ childProfile: { id: "c-cache-b", name: "B" }, signals: { count: 1 } });
    expect(providerCalls).toBe(2);
  });
});

describe("createApp wiring (AIR-5/AIR-6 metering, source-pinned)", () => {
  const createAppSrc = fs.readFileSync(path.resolve(__dirname, "../server/createApp.ts"), "utf8");
  const quotaBlock = /app\.use\(\s*\[[\s\S]*?\],\s*createAiQuota\(counters\)\s*\);/.exec(createAppSrc)?.[0] ?? "";

  it("/api/todays-focus sits INSIDE the hourly AI quota", () => {
    expect(quotaBlock).toContain('"/api/todays-focus"');
  });

  it("/api/todays-focus never touches the coach meter (X-Coach-Remaining unaffected)", () => {
    const gateLine = /app\.use\(\s*\[[^\]]*\],\s*createCoachGate\([\s\S]*?\)\);/.exec(createAppSrc)?.[0] ?? "";
    expect(gateLine).toContain('"/api/chat"');
    expect(gateLine).toContain('"/api/council"');
    expect(gateLine).not.toContain("todays-focus");
  });

  it("/api/tts left the model-call quota for its own char meter (AIR-6)", () => {
    expect(quotaBlock).not.toContain('"/api/tts"');
    expect(createAppSrc).toContain('app.use("/api/tts", createTtsQuota(counters))');
  });
});

describe("B-AI-03 · the prompt states only what the parent logged", () => {
  it("count 0, no trigger → no trigger clause, a first-day cold start with no week (todays_focus 1.3.0), a starter step, inputsUsed without topTrigger", async () => {
    draft = { focus: "A quiet week to notice what your child enjoys.", tryToday: "Try naming one feeling together at dinner." };
    lastPrompt = "";
    const { status, json } = await postFocus({
      childProfile: { id: "c-ai03-zero", name: "Test Child", age: 3 },
      signals: { count: 0 },
    });
    expect(status).toBe(200);
    expect(lastPrompt).not.toContain("transitions");
    expect(lastPrompt).not.toContain("most often around");
    expect(lastPrompt).toContain("nothing yet, and no earlier step is on record — treat today as a first day together");
    expect(lastPrompt).not.toContain("logged this week");
    expect(lastPrompt).toMatch(/never invent a period \("this week", "lately"/);
    expect(lastPrompt).toMatch(/age-appropriate starter step/);
    const inputs = json.inputsUsed as Record<string, unknown>;
    expect(inputs.momentCount).toBe(0);
    expect(inputs).not.toHaveProperty("topTrigger");
  });

  it("topTrigger '' with moments → the count only; never the 'transitions' default (B-TODAY-04 acceptance)", async () => {
    draft = { ...CLEAN_DRAFT };
    lastPrompt = "";
    const { json } = await postFocus({
      childProfile: { id: "c-ai03-empty", name: "Test Child", age: 4 },
      signals: { count: 3, topTrigger: "" },
    });
    expect(lastPrompt).toContain("3 moments.");
    expect(lastPrompt).not.toContain("transitions");
    expect(lastPrompt).not.toContain("most often around");
    expect(json.inputsUsed as Record<string, unknown>).not.toHaveProperty("topTrigger");
  });

  it("Hebrew, no trigger → neither 'transitions' nor 'מעברים' in the prompt", async () => {
    draft = { focus: "שבוע שקט.", tryToday: "נסו לקרוא יחד ספר קצר." };
    lastPrompt = "";
    await postFocus({ childProfile: { id: "c-ai03-he", name: "Test Child", age: 4 }, signals: { count: 0 }, language: "he" });
    expect(lastPrompt).toContain("עברית");
    expect(lastPrompt).not.toContain("transitions");
    expect(lastPrompt).not.toContain("מעברים");
  });

  it("a trigger sent with zero moments is not a fact — dropped from prompt and inputsUsed", async () => {
    draft = { ...CLEAN_DRAFT };
    lastPrompt = "";
    const { json } = await postFocus({ childProfile: { id: "c-ai03-orphan", name: "T", age: 4 }, signals: { count: 0, topTrigger: "bedtime" } });
    expect(lastPrompt).not.toContain("bedtime");
    expect(json.inputsUsed as Record<string, unknown>).not.toHaveProperty("topTrigger");
  });
});

/* ── B-TODAY-24: grounded step — sayThis + a truthful why-line input ──────── */
describe("B-TODAY-24 · /todays-focus returns one screened sayThis (≤140) and factCount", () => {
  it("the schema carries sayThis (REQUIRED since todays_focus 1.3.1)", async () => {
    draft = { ...CLEAN_DRAFT, sayThis: "Two more minutes, then shoes on together." };
    providerCalls = 0;
    const { status, json } = await postFocus({ childProfile: { id: "c-say-1", name: "T", age: 4 }, signals: { count: 2 } });
    expect(status).toBe(200);
    expect(providerCalls).toBe(1); // model calls per focus unchanged (1)
    expect(Object.keys(lastSchema.properties ?? {})).toEqual(["focus", "tryToday", "sayThis"]);
    expect(lastSchema.required).toEqual(["focus", "tryToday", "sayThis"]);
    expect(json.sayThis).toBe("Two more minutes, then shoes on together.");
    expect(lastPrompt).toContain('"sayThis": exactly ONE sentence (under 140 characters; never two sentences)');
  });

  it("an over-long sayThis is dropped, never cut", async () => {
    draft = { ...CLEAN_DRAFT, sayThis: "x".repeat(141) };
    const { status, json } = await postFocus({ childProfile: { id: "c-say-2", name: "T", age: 4 }, signals: { count: 2 } });
    expect(status).toBe(200);
    expect(json).not.toHaveProperty("sayThis");
  });

  it("sayThis passes the SAME output screen: a diagnostic line blocks the whole focus (422)", async () => {
    draft = { ...CLEAN_DRAFT, sayThis: "Tell her she has autism and that is why." };
    const { status, json } = await postFocus({ childProfile: { id: "c-say-3", name: "T", age: 4 }, signals: { count: 2 } });
    expect(status).toBe(422);
    expect(JSON.stringify(json)).not.toContain("autism");
  });

  it("factCount is the count of approved facts placed in the context (0 with none)", async () => {
    draft = { ...CLEAN_DRAFT };
    const { json } = await postFocus({ childProfile: { id: "c-say-4", name: "T", age: 4 }, signals: { count: 2 } });
    expect((json.inputsUsed as Record<string, unknown>).factCount).toBe(0);
    const src = fs.readFileSync(path.join(__dirname, "api.ts"), "utf8");
    expect(src).toContain("factCount: approvedFacts.length");
    // The Hebrew directive covers every field now (focus, tryToday, sayThis).
    expect(src).toContain("Write every field in natural, warm Hebrew (עברית).");
  });

  it("today-focus-v1 is authored against this route (the suite's offline gate)", () => {
    const suite = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "..", "..", "evals", "today-focus-v1.eval.json"), "utf8")) as {
      suite: string; promptVersions: Record<string, string>; scenarios: { id: string; route?: string; locale?: string; safetyMustHold?: boolean }[];
    };
    expect(suite.suite).toBe("today-focus-v1");
    expect(suite.promptVersions.todays_focus).toBe("1.3.2");
    const ids = suite.scenarios.map((s) => s.id);
    for (const required of ["cold-start", "approved-fact-used", "not-today-not-repeated", "he-output", "two-child-isolation", "safety-trip-no-score-trend-diagnosis", "saythis-length",
      // B-LOOP-13: the journal scenarios + the live-judge fixes on 1.2.0
      "loop-thin-shelf", "loop-not-sure-avoided", "loop-why-no-verdict", "loop-he-register", "loop-candidate-only", "saythis-one-sentence", "cold-start-first-day"]) {
      expect(ids.some((id) => id.startsWith(required)), required).toBe(true);
    }
    for (const sc of suite.scenarios) {
      expect(sc.route).toBe("/api/todays-focus");
      expect(sc.safetyMustHold).toBe(true);
    }
  });
});

/* ── B-TODAY-11: local day accepted ±1 day; rev in the cache key ─────────── */
describe("B-TODAY-11 · /todays-focus dateKey + rev", () => {
  const serverDay = () => new Date().toISOString().slice(0, 10);
  const shift = (days: number) => new Date(Date.parse(`${serverDay()}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

  it("a client local day within ±1 of the server's UTC day is used; anything else falls back", async () => {
    draft = { ...CLEAN_DRAFT };
    const plus = await postFocus({ childProfile: { id: "c-day-1", name: "T", age: 4 }, signals: { count: 1 }, dateKey: shift(1) });
    expect(plus.json.dateKey).toBe(shift(1));
    const minus = await postFocus({ childProfile: { id: "c-day-2", name: "T", age: 4 }, signals: { count: 1 }, dateKey: shift(-1) });
    expect(minus.json.dateKey).toBe(shift(-1));
    const far = await postFocus({ childProfile: { id: "c-day-3", name: "T", age: 4 }, signals: { count: 1 }, dateKey: shift(3) });
    expect(far.json.dateKey).toBe(serverDay());
    const junk = await postFocus({ childProfile: { id: "c-day-4", name: "T", age: 4 }, signals: { count: 1 }, dateKey: "tomorrow" });
    expect(junk.json.dateKey).toBe(serverDay());
  });

  it("rev(count, lastOutcome, latestAt) is in the cache key: nothing new → cache hit; a new capture → one call", async () => {
    draft = { ...CLEAN_DRAFT };
    const body = (latestAt: string, count = 2) => ({ childProfile: { id: "c-rev", name: "T", age: 4 }, signals: { count, latestAt }, dateKey: serverDay() });
    providerCalls = 0;
    await postFocus(body("2026-10-02T06:00:00.000Z"));
    expect(providerCalls).toBe(1);
    await postFocus(body("2026-10-02T06:00:00.000Z"));
    expect(providerCalls).toBe(1); // re-open with nothing new: 0 calls
    await postFocus(body("2026-10-02T09:30:00.000Z", 3));
    expect(providerCalls).toBe(2); // a capture after it: one call
    const src = fs.readFileSync(path.join(__dirname, "api.ts"), "utf8");
    expect(src).toContain("const cacheKey = `${actorOf(req).uid}:${childProfile?.id ?? \"none\"}:${dateKey}:${lang}:${rev}:${journalKey}`;");
  });
});

/* ── B-LOOP-13: the journal, the AI's practice pick and the why-line ──────── */
/* Round 2 (framer, 6 Oct): the model picks only inside the FIRST TIER of the
   chooser's order; the why is server-rendered (whyEmpty / whyFewest); sayThis
   is required and falls back to the practice's own say-line. */
describe("B-LOOP-13 · /todays-focus chooses the practice from the journal", () => {
  // child aged 2: pr-sleep-08 (sleep, shelf-level) and pr-cdc-24m-4 (words) are in window
  const journal = { candidatePracticeIds: ["pr-cdc-24m-4", "pr-sleep-08"], shelfCoverage: { sleep: 0, words: 3, food: 2, feelings: 2, play: 2, moving: 2, hands: 2, school: 2, family: 2 } };
  const body = (id: string, over: Record<string, unknown> = {}) => ({ childProfile: { id, name: "Noa Levi", age: 2 }, signals: { count: 2 }, journal, ...over });
  const SAY = "Try the bedtime picture page together tonight.";
  const DRAFT = { focus: "Bedtime is today's small thing.", tryToday: "Look at the bedtime picture page together tonight.", sayThis: "Let's find the bedtime picture together." };

  it("the schema: sayThis REQUIRED, optional practiceId only when the AI may pick, never a model why; one model call", async () => {
    draft = { ...DRAFT, practiceId: "pr-sleep-08" };
    providerCalls = 0;
    const { status, json } = await postFocus(body("c-loop-1"));
    expect(status).toBe(200);
    expect(providerCalls).toBe(1);
    expect(Object.keys(lastSchema.properties ?? {})).toEqual(["focus", "tryToday", "sayThis", "practiceId"]);
    expect(lastSchema.required).toEqual(["focus", "tryToday", "sayThis"]);
    expect(lastPrompt).toContain("THE PARENT'S JOURNAL");
    expect(json.practiceId).toBe("pr-sleep-08");
    expect(json.practiceVia).toBe("ai");
  });

  it("the server re-applies the chooser's order: sleep (0 notes) is the first tier whatever the wire order; words is never listed", async () => {
    draft = { ...DRAFT, practiceId: "pr-sleep-08" };
    await postFocus(body("c-loop-order"));
    expect(lastPrompt).toContain('- pr-sleep-08 · sleep · "What comes after pyjamas? Show me on our page."');
    expect(lastPrompt).not.toContain("- pr-cdc-24m-4");
  });

  it("a pick outside the first tier (a later candidate, an unknown id, a non-string) → the chooser's pick, practiceVia 'chooser', no why", async () => {
    for (const bad of ["pr-cdc-24m-4", "pr-cdc-2m-3", "pr-made-up", "", 42]) {
      draft = { ...DRAFT, practiceId: bad };
      const { status, json } = await postFocus(body(`c-loop-bad-${String(bad)}`));
      expect(status).toBe(200);
      expect(json.practiceId).toBe("pr-sleep-08");
      expect(json.practiceVia).toBe("chooser");
      expect(json).not.toHaveProperty("why");
    }
  });

  it("a shelf tied with the chooser's is first tier too; a rested shelf never is", async () => {
    const tied = { candidatePracticeIds: ["pr-sleep-08", "pr-cdc-24m-4"], shelfCoverage: { sleep: 1, words: 1, food: 3, feelings: 3, play: 3, moving: 3, hands: 3, school: 3, family: 3 } };
    draft = { ...DRAFT, practiceId: "pr-cdc-24m-4" };
    const { json } = await postFocus(body("c-loop-tie", { journal: tied }));
    expect(json.practiceId).toBe("pr-cdc-24m-4");
    expect(json.practiceVia).toBe("ai");
    const { json: rested } = await postFocus(body("c-loop-rested", { journal: { ...tied, restedShelves: ["words"] } }));
    expect(lastPrompt).not.toContain("- pr-cdc-24m-4");
    expect(rested.practiceId).toBe("pr-sleep-08");
    expect(rested.practiceVia).toBe("chooser");
  });

  it("the why is SERVER-RENDERED in the shipped A3 shapes (EN + HE), never the model's text", async () => {
    draft = { ...DRAFT, practiceId: "pr-sleep-08", why: "MODEL_WHY has the most notes of all." };
    const { json } = await postFocus(body("c-loop-why-en"));
    expect(json.why).toBe("Nothing on Noa's Sleep shelf yet this month, so today's small thing is for it.");
    expect(JSON.stringify(json)).not.toContain("MODEL_WHY");
    draft = { ...DRAFT, practiceId: "pr-sleep-08", sayThis: "בואי נמצא את דף השינה ביחד.", tryToday: "תסתכלו יחד על דף השינה הערב." };
    const { json: he } = await postFocus(body("c-loop-why-he", { language: "he", childProfile: { id: "c-loop-why-he", name: "נועה", age: 2 } }));
    expect(String(he.why)).toContain("עדיין אין כלום במדף");
    expect(String(he.why)).toContain("נועה");
    // "fewest": the shelf is the thinnest of all, with notes
    const fewest = { ...journal, shelfCoverage: { ...journal.shelfCoverage, sleep: 1 } };
    draft = { ...DRAFT, practiceId: "pr-sleep-08" };
    const { json: f } = await postFocus(body("c-loop-why-fewest", { journal: fewest }));
    expect(f.why).toBe("Sleep has the fewest notes on Noa's shelves this month, so today's small thing is for it.");
  });

  it("a diagnostic line in any model field still blocks the whole focus with 422 (the same output screen)", async () => {
    draft = { ...DRAFT, practiceId: "pr-sleep-08", sayThis: "Your child has autism so bedtime is hard." };
    const { status, json } = await postFocus(body("c-loop-diag"));
    expect(status).toBe(422);
    expect(JSON.stringify(json)).not.toContain("autism");
  });

  it("sayThis missing, too short, or unrelated to tryToday → the chosen practice's own say-line (EN / HE)", async () => {
    for (const [i, say] of [undefined, "", "Ok.", "Here comes the dinosaur bus."].entries()) {
      draft = { ...DRAFT, practiceId: "pr-sleep-08", sayThis: say };
      const { json } = await postFocus(body(`c-loop-say-${i}`));
      expect(json.sayThis, String(say)).toBe("What comes after pyjamas? Show me on our page.");
    }
    draft = { ...DRAFT, practiceId: "pr-sleep-08", sayThis: "" };
    const { json: he } = await postFocus(body("c-loop-say-he", { language: "he" }));
    expect(String(he.sayThis)).toMatch(/[֐-׿]/);
    draft = { ...DRAFT, practiceId: "pr-sleep-08" };
    const { json: kept } = await postFocus(body("c-loop-say-kept"));
    expect(kept.sayThis).toBe(DRAFT.sayThis);
  });

  it("a day pin or a dose row sets today's practice: no pick, no why, the practice line in the prompt; sayThis falls back to that practice", async () => {
    draft = { ...DRAFT, practiceId: "pr-cdc-24m-4", sayThis: "" };
    const { json } = await postFocus(body("c-loop-pin", { journal: { ...journal, pinnedPracticeId: "pr-cdc-24m-4" } }));
    expect(lastPrompt).toContain("Today's practice: 'Where's the bear? There he is! A big brown bear.' (pending).");
    expect(Object.keys(lastSchema.properties ?? {})).toEqual(["focus", "tryToday", "sayThis"]);
    expect(json).not.toHaveProperty("practiceId");
    expect(json).not.toHaveProperty("why");
    expect(json.sayThis).toBe("Where's the bear? There he is! A big brown bear.");
  });

  it("no journal → no practiceId, no why; a bad sayThis is dropped (nothing to fall back to)", async () => {
    draft = { ...CLEAN_DRAFT, practiceId: "pr-sleep-08", sayThis: "" };
    const { json } = await postFocus({ childProfile: { id: "c-loop-none", name: "T", age: 2 }, signals: { count: 2 } });
    expect(json).not.toHaveProperty("practiceId");
    expect(json).not.toHaveProperty("why");
    expect(json).not.toHaveProperty("sayThis");
    expect(lastPrompt).not.toContain("THE PARENT'S JOURNAL");
  });

  it("sayThis is exactly ONE sentence: a second sentence is cut at the first boundary (live judge on 1.2.0)", async () => {
    draft = { ...CLEAN_DRAFT, sayThis: "Two more minutes on the slide. Then we put our shoes on together." };
    const { json } = await postFocus({ childProfile: { id: "c-say-one", name: "T", age: 4 }, signals: { count: 2 } });
    expect(json.sayThis).toBe("Two more minutes on the slide.");
    draft = { ...CLEAN_DRAFT, sayThis: "Ok. Then we put our shoes on together." };
    const { json: short } = await postFocus({ childProfile: { id: "c-say-short", name: "T", age: 4 }, signals: { count: 2 } });
    expect(short).not.toHaveProperty("sayThis");
  });
});

/* ── B-LOOP-13 round 3: a graded difficulty fails the focus closed ────────── */
describe("B-LOOP-13 round 3 · graded difficulty → 422 (the pure chooser's card)", () => {
  it("EN and HE graded lines in focus / tryToday / sayThis block the focus; plain words pass; nothing is cached", async () => {
    for (const [i, d] of [
      { focus: "These evenings may point to a slight difficulty with transitions.", tryToday: "Try a two-minute warning." },
      { focus: "ערבים שעשויים להצביע על קושי קל במעברים.", tryToday: "נסו הודעה של שתי דקות." },
      { focus: "Dinner is today's moment.", tryToday: "Try one calm minute.", sayThis: "There is a mild delay in your words." },
    ].entries()) {
      draft = d;
      const { status, json } = await postFocus({ childProfile: { id: `c-grade-${i}`, name: "T", age: 4 }, signals: { count: 2 }, language: i === 1 ? "he" : "en" });
      expect(status, JSON.stringify(d)).toBe(422);
      expect(JSON.stringify(json)).not.toMatch(/slight|קושי|mild/);
    }
    draft = { focus: "קשה לו להירדם, אז הערב נתחיל לאט.", tryToday: "נסו דקה שקטה לפני המיטה.", sayThis: "בוא נשב רגע בשקט ביחד לפני המיטה." };
    const ok = await postFocus({ childProfile: { id: "c-grade-ok", name: "T", age: 4 }, signals: { count: 2 }, language: "he" });
    expect(ok.status).toBe(200);
  });
  it("the prompt tells the focus never to grade the child", async () => {
    draft = { ...CLEAN_DRAFT };
    await postFocus({ childProfile: { id: "c-grade-prompt", name: "T", age: 4 }, signals: { count: 2 } });
    expect(lastPrompt).toContain("The focus never grades or assesses the child");
  });
});
