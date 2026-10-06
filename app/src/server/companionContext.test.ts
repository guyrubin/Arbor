/**
 * B-AI-01 — CompanionContext v1 guard: isolation, expiry, cap, ranking, the
 * spoken projection's byte-stability, and the two consuming routes
 * (`/chat`, `/todays-focus`) reading the server ledger.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { sanitizeRecentTurns } from "../ai/chatContext.js";
import { promptProfile, PROMPT_VERSIONS } from "../ai/prompts.js";
import type { SpokenContext } from "../ai/spokenContext.js";
import { enforceMemoryRetention, foldMemoryEvents, isMemoryExpired } from "../memory/memoryService.js";
import type { MemoryLedgerEvent, MemoryStore } from "../memory/types.js";
import {
  assembleCompanionContext,
  projectActiveProgram,
  projectAcceptedActions,
  projectKeptInsights,
  type CompanionLedger,
  type CompanionLedgerSource,
} from "./companionContext.js";
import { assembleSpokenContext, spokenChildId } from "./spokenContext.js";
import { programById } from "../content/programs/index.js";
import { createApiRouter } from "../routes/api.js";
import { createTestConfig } from "../testConfig.js";
import { loadFramework } from "../services/framework.js";
import type { ModelProvider } from "../ai/modelRouter.js";
import { LocalShareStore } from "../sharing/shares.js";
import { LocalConsentStore } from "../sharing/consent.js";
import { createCounterStore } from "./quotaStore.js";
import { createEntitlementStore } from "./entitlements.js";
import { createReferralStore } from "./referral.js";
import { createConsultStore } from "./consultRequests.js";
import { createAdminMetricsStore } from "./adminMetrics.js";
import { createWaitlistStore } from "./waitlist.js";

const DAY = 86_400_000;
const NOW = Date.parse("2026-10-01T12:00:00.000Z");
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const localDay = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

const ev = (
  fact: string,
  opts: { status?: MemoryLedgerEvent["status"]; childId?: string; createdAt?: string; retention?: string } = {},
): MemoryLedgerEvent => {
  const status = opts.status ?? "approved";
  return {
    eventId: `e-${fact}`, memoryId: `m-${fact}`, familyId: "fam-a", childId: opts.childId ?? "child-a", fact, status,
    eventType: status === "pending" ? "proposed" : (status as MemoryLedgerEvent["eventType"]),
    createdAt: opts.createdAt ?? iso(DAY), source: "parent", retention: opts.retention ?? "3 months", actor: "parent",
  };
};

const storeOf = (events: MemoryLedgerEvent[]): MemoryStore => ({
  listEvents: async () => events,
  appendEvent: async () => {},
  eraseChild: async () => 0,
});

const ledgerOf = (byChild: Record<string, CompanionLedger>): CompanionLedgerSource & { reads: string[] } => {
  const reads: string[] = [];
  return {
    reads,
    load: async (uid: string, childId: string) => {
      reads.push(`${uid}/${childId}`);
      return byChild[`${uid}/${childId}`] ?? { actionLoops: [], insights: [] };
    },
  };
};

describe("B-AI-01 — assembleCompanionContext", () => {
  const events = [
    ev("A_ONLY: bath before bed calms her", { childId: "child-a" }),
    ev("B_ONLY: he loves the slide", { childId: "child-b" }),
    ev("PENDING_SECRET", { status: "pending" }),
    ev("REJECTED_SECRET", { status: "rejected" }),
    ev("EXPIRED_SECRET", { createdAt: iso(200 * DAY), retention: "1 month" }),
    ev("FUTURE_SECRET", { createdAt: new Date(NOW + DAY).toISOString() }),
  ];

  it("two children: a fact approved for child A never appears in child B's context (and vice versa)", async () => {
    const store = storeOf(events);
    const a = await assembleCompanionContext({ purpose: "chat", audience: "parent", childId: "child-a", memoryStore: store, now: NOW });
    const b = await assembleCompanionContext({ purpose: "chat", audience: "parent", childId: "child-b", memoryStore: store, now: NOW });
    expect(a.approvedFacts.map((f) => f.text)).toEqual(["A_ONLY: bath before bed calms her"]);
    expect(b.approvedFacts.map((f) => f.text)).toEqual(["B_ONLY: he loves the slide"]);
  });

  it("expired, rejected, pending and future-dated facts are excluded", async () => {
    const ctx = await assembleCompanionContext({ purpose: "chat", audience: "parent", childId: "child-a", memoryStore: storeOf(events), now: NOW });
    const text = JSON.stringify(ctx);
    for (const secret of ["PENDING_SECRET", "REJECTED_SECRET", "EXPIRED_SECRET", "FUTURE_SECRET"]) expect(text).not.toContain(secret);
  });

  it("a request about bedtime ranks an older bedtime fact above a newer unrelated fact", async () => {
    const store = storeOf([
      ev("She loves painting with her grandmother", { createdAt: iso(1 * DAY) }),
      ev("Bedtime goes better after a warm bath", { createdAt: iso(40 * DAY) }),
    ]);
    const ranked = await assembleCompanionContext({ purpose: "chat", audience: "parent", childId: "child-a", memoryStore: store, query: "How do I make bedtime easier?", now: NOW });
    expect(ranked.approvedFacts.map((f) => f.text)[0]).toBe("Bedtime goes better after a warm bath");
    // Negative control: with no query the order is the ledger's newest first.
    const plain = await assembleCompanionContext({ purpose: "chat", audience: "parent", childId: "child-a", memoryStore: store, now: NOW });
    expect(plain.approvedFacts.map((f) => f.text)[0]).toBe("She loves painting with her grandmother");
  });

  it("keeps the 2,400-char cap (per fact ≤600) and the fact cap", async () => {
    const many = Array.from({ length: 12 }, (_, i) => ev(`${String(i).padStart(2, "0")} ${"x".repeat(700)}`, { createdAt: iso((i + 1) * 3_600_000) }));
    const ctx = await assembleCompanionContext({ purpose: "chat", audience: "parent", childId: "child-a", memoryStore: storeOf(many), maxFacts: 40, now: NOW });
    const chars = ctx.approvedFacts.reduce((n, f) => n + f.text.length, 0) + Math.max(0, ctx.approvedFacts.length - 1);
    expect(ctx.approvedFacts.every((f) => f.text.length <= 600)).toBe(true);
    expect(chars).toBeLessThanOrEqual(2400);
    // 600 + 1 + 600 + 1 + 600 = 1,802; a fourth 600-char fact would reach 2,403.
    expect(ctx.approvedFacts).toHaveLength(3);
    const capped = await assembleCompanionContext({ purpose: "chat", audience: "parent", childId: "child-a", memoryStore: storeOf(events), maxFacts: 1, now: NOW });
    expect(capped.approvedFacts).toHaveLength(1);
  });

  it("each fact carries its provenance {text, sourceId, createdAt}", async () => {
    const ctx = await assembleCompanionContext({ purpose: "chat", audience: "parent", childId: "child-a", memoryStore: storeOf(events), now: NOW });
    expect(ctx.approvedFacts[0]).toMatchObject({ text: "A_ONLY: bath before bed calms her", sourceId: "m-A_ONLY: bath before bed calms her" });
  });

  it("the ledger is read only at the caller's own uid + child path", async () => {
    const ledger = ledgerOf({
      "parent-a/child-a": { actionLoops: [{ recommendation: "A step", source: "coach", status: "accepted", acceptedAt: iso(DAY) }], insights: [] },
      "parent-a/child-b": { actionLoops: [{ recommendation: "B step", source: "coach", status: "accepted", acceptedAt: iso(DAY) }], insights: [] },
    });
    const a = await assembleCompanionContext({ purpose: "chat", audience: "parent", childId: "child-a", memoryStore: storeOf([]), ledgerSource: ledger, uid: "parent-a", now: NOW });
    expect(a.acceptedActions.map((x) => x.recommendation)).toEqual(["A step"]);
    expect(ledger.reads).toEqual(["parent-a/child-a"]);
  });

  it("the child audience gets no family context at all (fail closed)", async () => {
    const ctx = await assembleCompanionContext({ purpose: "chat", audience: "child", childId: "child-a", childProfile: { id: "child-a", age: 4 }, memoryStore: storeOf(events), now: NOW });
    expect(ctx).toEqual({ profile: null, approvedFacts: [], acceptedActions: [], keptInsights: [] });
  });

  it("a failed memory read returns an empty fact list, never a thrown request", async () => {
    const broken: MemoryStore = { listEvents: async () => { throw new Error("down"); }, appendEvent: async () => {}, eraseChild: async () => 0 };
    const ctx = await assembleCompanionContext({ purpose: "chat", audience: "parent", childId: "child-a", memoryStore: broken, now: NOW });
    expect(ctx.approvedFacts).toEqual([]);
  });
});

describe("B-AI-01 — ledger projections", () => {
  it("accepted actions: ≤5 newest, superseded and malformed rows dropped, outcome only on completed", () => {
    const rows = [
      ...Array.from({ length: 7 }, (_, i) => ({ recommendation: `step ${i}`, source: "coach", status: "accepted", acceptedAt: iso((i + 1) * DAY) })),
      { recommendation: "replaced", source: "coach", status: "superseded", acceptedAt: iso(1000) },
      { recommendation: "", source: "coach", status: "accepted", acceptedAt: iso(1000) },
      { recommendation: "rated", source: "bogus", status: "completed", outcome: "not_today", acceptedAt: iso(500) },
    ];
    const out = projectAcceptedActions(rows);
    expect(out).toHaveLength(5);
    expect(out[0]).toMatchObject({ recommendation: "rated", source: "today-guidance", status: "completed", outcome: "not_today" });
    expect(out.map((a) => a.recommendation)).not.toContain("replaced");
  });

  it("kept insights: ≤5 newest kept-insight rows, verbatim; analysis rows ignored", () => {
    const rows = [
      ...Array.from({ length: 6 }, (_, i) => ({ kind: "kept-insight", text: `kept ${i}`, createdAt: iso((i + 1) * DAY) })),
      { kind: "behavior-analysis", createdAt: iso(10), analysis: { summary: "NOT_KEPT" } },
    ];
    const out = projectKeptInsights(rows);
    expect(out.map((k) => k.text)).toEqual(["kept 0", "kept 1", "kept 2", "kept 3", "kept 4"]);
  });
});

/** The pre-B-AI-01 assembler, verbatim — the byte-stability reference. */
const legacyAssembleSpokenContext = async (input: {
  memoryStore: MemoryStore; childProfile?: unknown; recentTurns?: unknown; contextChildId?: unknown; privateMode?: unknown; canReadMemory: boolean; maxMemoryFacts?: number;
}): Promise<SpokenContext> => {
  const EMPTY = (): SpokenContext => ({ profile: null, approvedMemory: "", approvedMemoryFactsUsed: 0, recentTurns: [] });
  if (input.privateMode === true || !input.canReadMemory) return EMPTY();
  const childId = spokenChildId(input.childProfile);
  const context = EMPTY();
  context.profile = promptProfile(input.childProfile);
  if (childId && input.contextChildId === childId) context.recentTurns = sanitizeRecentTurns(input.recentTurns);
  if (!childId) return context;
  let current;
  try {
    current = await enforceMemoryRetention(input.memoryStore, foldMemoryEvents(await input.memoryStore.listEvents(childId), childId));
  } catch {
    return context;
  }
  const cap = Math.min(8, Math.max(1, input.maxMemoryFacts ?? 8));
  const facts: string[] = [];
  let chars = 0;
  for (const item of current) {
    const createdAt = Date.parse(item.createdAt);
    if (item.status !== "approved" || !Number.isFinite(createdAt) || createdAt > Date.now() || isMemoryExpired(item)) continue;
    const fact = item.fact.trim().slice(0, 600);
    if (!fact || chars + fact.length + (facts.length ? 1 : 0) > 2400) continue;
    facts.push(fact);
    chars += fact.length + (facts.length > 1 ? 1 : 0);
    if (facts.length >= cap) break;
  }
  context.approvedMemory = facts.join("\n");
  context.approvedMemoryFactsUsed = facts.length;
  return context;
};

describe("B-AI-01 — /voice and /live/token context is byte-identical before/after", () => {
  const recent = Date.now() - DAY;
  const mixed = [
    ...Array.from({ length: 10 }, (_, i) => ev(`fact ${i} bedtime ${"y".repeat(i * 90)}`, { createdAt: new Date(recent - i * 3_600_000).toISOString() })),
    ev("PENDING", { status: "pending", createdAt: new Date(recent).toISOString() }),
    ev("B side", { childId: "child-b", createdAt: new Date(recent).toISOString() }),
  ];
  const cases = [
    { name: "default cap", maxMemoryFacts: undefined },
    { name: "cap 3", maxMemoryFacts: 3 },
    { name: "cap 40 (clamped to 8)", maxMemoryFacts: 40 },
  ];
  for (const c of cases) {
    it(`${c.name}: same JSON as the legacy assembler`, async () => {
      const input = {
        memoryStore: storeOf(mixed), childProfile: { id: "child-a", name: "Noa", age: 4 }, recentTurns: [{ role: "parent", text: "hi" }],
        contextChildId: "child-a", canReadMemory: true, maxMemoryFacts: c.maxMemoryFacts,
      };
      expect(JSON.stringify(await assembleSpokenContext(input))).toBe(JSON.stringify(await legacyAssembleSpokenContext(input)));
    });
  }
  it("private mode / unread memory / no child id / failing store: same as legacy", async () => {
    const broken: MemoryStore = { listEvents: async () => { throw new Error("x"); }, appendEvent: async () => {}, eraseChild: async () => 0 };
    const inputs = [
      { memoryStore: storeOf(mixed), childProfile: { id: "child-a" }, privateMode: true, canReadMemory: true },
      { memoryStore: storeOf(mixed), childProfile: { id: "child-a" }, canReadMemory: false },
      { memoryStore: storeOf(mixed), childProfile: { name: "Noa", age: 3 }, canReadMemory: true },
      { memoryStore: broken, childProfile: { id: "child-a", age: 3 }, recentTurns: [{ role: "coach", text: "ok" }], contextChildId: "child-a", canReadMemory: true },
    ];
    for (const input of inputs) {
      expect(JSON.stringify(await assembleSpokenContext(input))).toBe(JSON.stringify(await legacyAssembleSpokenContext(input)));
    }
  });
});

/* ── Route level: /todays-focus and /chat read the server ledger ─────────── */

let focusPrompt = "";
let chatPrompt = "";
const provider = {
  generateJson: async ({ prompt }: { prompt: string }) => {
    if (prompt.includes("Today's Focus writer")) {
      focusPrompt = prompt;
      return { focus: "Notice the evening.", tryToday: "Try a quiet first minute." };
    }
    return { safe: true, reason: "" };
  },
  async *generateJsonStream({ prompt }: { prompt: string }) {
    chatPrompt = prompt;
    yield JSON.stringify({
      text: "A calm first sentence.", riskLevel: "Low", ageBand: "3-4", domains: ["social_emotional"],
      nonDiagnosticHypotheses: [{ label: "Big feelings at transitions", confidence: "one possibility", rationale: "Common at this age." }],
      todayPlan: ["Name the feeling and offer two choices."], parentScript: "I can see this is hard.", avoid: ["Long lectures."],
      observe: ["When it starts."], escalateIf: ["The pattern intensifies for two weeks."],
      frameRouting: { aim: "a", twoAxes: "b", story: "c", shadow: "d", marriage: "e", shepherd: "f" },
      memoryProposals: [], handoffNotes: { teacher: "t", professional: "p" }, sourceCardsUsed: [],
    });
  },
  async *streamText() { yield ""; },
} as unknown as ModelProvider;

const routeEvents = [
  ev("Bedtime goes better after a warm bath", { childId: "child-a", createdAt: new Date(Date.now() - 30 * DAY).toISOString() }),
  ev("CHILD_B_FACT she likes puzzles", { childId: "child-b", createdAt: new Date(Date.now() - DAY).toISOString() }),
];
const routeLedger = ledgerOf({
  "parent-a/child-a": {
    actionLoops: [
      { recommendation: "Two-minute warning before leaving", source: "digest", status: "completed", outcome: "not_today", acceptedAt: new Date(Date.now() - 2 * DAY).toISOString() },
    ],
    insights: [{ kind: "kept-insight", text: "Name the feeling first", createdAt: new Date(Date.now() - DAY).toISOString() }],
    // B-PROG-01: child A is in week 2 of Talk Together (started 8 local days ago).
    programs: [{ id: "talk-together.x", programId: "talk-together", startedAt: localDay(Date.now() - 8 * DAY), enrolledAt: "t", currentWeek: 1, status: "active", baseline: { childProxy: null, capturedAt: null }, updatedAt: "t" }],
  },
});
let server: Server;
let base: string;

beforeAll(async () => {
  const config = createTestConfig();
  const entitlementStore = createEntitlementStore(config);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { (req as any).user = { uid: "parent-a" }; next(); });
  app.use("/api", createApiRouter({
    config, modelProvider: provider, memoryStore: storeOf(routeEvents), shareStore: new LocalShareStore(),
    consentStore: new LocalConsentStore(), framework: loadFramework(), entitlementStore,
    referralStore: createReferralStore(config, entitlementStore), counters: createCounterStore(config),
    consultStore: createConsultStore(config), adminMetrics: createAdminMetricsStore(config), waitlistStore: createWaitlistStore(config),
    companionLedgerSource: routeLedger,
  }));
  await new Promise<void>((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const post = (route: string, body: unknown) =>
  fetch(`${base}${route}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("B-AI-01 — routes consume CompanionContext", () => {
  it("/todays-focus cites the last rated step and its outcome from the SERVER ledger when the client sends none", async () => {
    const res = await post("/todays-focus", { childProfile: { id: "child-a", age: 4 }, signals: { count: 2 }, language: "en" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(focusPrompt).toContain('The parent last tried "Two-minute warning before leaving" and reported the attempt as "not_today"');
    expect(focusPrompt).toContain("Bedtime goes better after a warm bath");
    expect(focusPrompt).not.toContain("CHILD_B_FACT");
    expect(body.inputsUsed).toMatchObject({ momentCount: 2, lastActionOutcome: "not_today", factCount: 1 });
  });

  it("/todays-focus for child B carries none of child A's ledger or facts", async () => {
    const res = await post("/todays-focus", { childProfile: { id: "child-b", age: 4 }, signals: { count: 0 }, language: "he" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(focusPrompt).not.toContain("Two-minute warning");
    expect(focusPrompt).not.toContain("Bedtime goes better");
    expect(focusPrompt).toContain("CHILD_B_FACT she likes puzzles");
    expect(focusPrompt).toContain("עברית");
    expect(body.inputsUsed.factCount).toBe(1);
    expect(body.inputsUsed.lastActionOutcome).toBeUndefined();
  });

  it("/chat ranks facts against the question, carries the ledger block, and backfills the fact count", async () => {
    const res = await post("/chat", { message: "bedtime is hard tonight", childProfile: { id: "child-a", age: 4 }, language: "en" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(chatPrompt).toContain("- Bedtime goes better after a warm bath (parent; retention: 3 months)");
    expect(chatPrompt).toContain("STEPS THE PARENT CHOSE TO TRY");
    expect(chatPrompt).toContain('"Two-minute warning before leaving" (accepted');
    expect(chatPrompt).toContain("parent reported: not today");
    expect(chatPrompt).toContain('- "Name the feeling first"');
    expect(chatPrompt).not.toContain("CHILD_B_FACT");
    expect(body.contract?.approvedMemoryFactsUsed ?? body.approvedMemoryFactsUsed).toBe(1);
    expect(PROMPT_VERSIONS.coach_chat.version).toBe("1.6.0");
  });
});

/* B-PROG-01 — CompanionContext v2 `program`: present only when an enrolment is
   active; the child audience never sees it; the four routes render the one
   "Active program" line from it (todays_focus / coach_chat here; the spoken
   pair through assembleSpokenContext). */
describe("B-PROG-01 — the program block", () => {
  const TT = programById("talk-together")!;
  const enrolment = (over: Record<string, unknown> = {}) => ({ id: "e1", programId: "talk-together", startedAt: localDay(NOW - 8 * DAY), enrolledAt: "t", currentWeek: 1, status: "active", baseline: { childProxy: null, capturedAt: null }, updatedAt: "t", ...over });
  const ledger = (programs: unknown[]) => ledgerOf({ "parent-a/child-a": { actionLoops: [], insights: [], programs } });
  const ctxOf = (programs: unknown[], audience: "parent" | "child" = "parent") =>
    assembleCompanionContext({ purpose: "chat", audience, childId: "child-a", childProfile: { id: "child-a", age: 2 }, memoryStore: storeOf([]), ledgerSource: ledger(programs), uid: "parent-a", now: NOW });

  it("an active enrolment → { id, name, shelf, week, skill, scripts ≤ 3, measures } for the current week", async () => {
    const ctx = await ctxOf([enrolment()]);
    expect(ctx.program).toEqual({
      id: "talk-together",
      name: { en: "Talk Together", he: "מדברים ביחד" },
      shelf: "words",
      week: 2,
      skill: TT.weeks[1].skill,
      scripts: TT.weeks[1].coachScripts.slice(0, 3).map((s) => s.text),
      measures: { dose: true, parentProxy: { id: "turns-waited", label: "Turns you waited for" }, childProxy: { id: "new-words", label: "New words this week" } },
    });
    expect(ctx.program!.scripts.length).toBeLessThanOrEqual(3);
  });

  it("absent when no enrolment is active (none, paused, done, unknown program, malformed)", async () => {
    for (const rows of [[], [enrolment({ status: "paused", pausedAt: localDay(NOW - DAY) })], [enrolment({ status: "done" })], [enrolment({ programId: "nope" })], [{ status: "active" }], [null]]) {
      const ctx = await ctxOf(rows as unknown[]);
      expect("program" in ctx, JSON.stringify(rows)).toBe(false);
    }
    expect(projectActiveProgram([], NOW)).toBeNull();
  });

  it("the child audience NEVER sees it (the whole context is empty, fail closed), and no ledger is read for it", async () => {
    const src = ledger([enrolment()]);
    const ctx = await assembleCompanionContext({ purpose: "chat", audience: "child", childId: "child-a", memoryStore: storeOf([]), ledgerSource: src, uid: "parent-a", now: NOW });
    expect(ctx).toEqual({ profile: null, approvedFacts: [], acceptedActions: [], keptInsights: [] });
    expect(src.reads).toEqual([]);
  });

  it("a memory-unauthorised caller or a failing ledger read gets no program block", async () => {
    const denied = await assembleCompanionContext({ purpose: "chat", audience: "parent", childId: "child-a", memoryStore: storeOf([]), ledgerSource: ledger([enrolment()]), uid: "parent-a", canReadMemory: false, now: NOW });
    expect("program" in denied).toBe(false);
    const broken = { load: async () => { throw new Error("down"); } };
    const failed = await assembleCompanionContext({ purpose: "chat", audience: "parent", childId: "child-a", memoryStore: storeOf([]), ledgerSource: broken, uid: "parent-a", now: NOW });
    expect("program" in failed).toBe(false);
  });

  it("the spoken context carries the program line only with a ledger source; without one it is the legacy shape", async () => {
    const withLedger = await assembleSpokenContext({ memoryStore: storeOf([]), childProfile: { id: "child-a", age: 2 }, canReadMemory: true, ledgerSource: ledger([enrolment({ startedAt: localDay(Date.now() - 8 * DAY) })]), uid: "parent-a" });
    expect(withLedger.program).toEqual({ name: "Talk Together", week: 2, skill: TT.weeks[1].skill.en });
    const without = await assembleSpokenContext({ memoryStore: storeOf([]), childProfile: { id: "child-a", age: 2 }, canReadMemory: true });
    expect("program" in without).toBe(false);
  });

  it("routes: /todays-focus and /chat for child A carry the one line; child B's never does", async () => {
    const LINE = `Active program: Talk Together, week 2: ${TT.weeks[1].skill.en}`;
    expect((await post("/todays-focus", { childProfile: { id: "child-a", age: 2 }, signals: { count: 1 }, language: "en" })).status).toBe(200);
    expect(focusPrompt.split(LINE).length - 1).toBe(1);
    expect((await post("/chat", { message: "he points and waits", childProfile: { id: "child-a", age: 2 }, language: "en" })).status).toBe(200);
    expect(chatPrompt.split(LINE).length - 1).toBe(1);
    expect((await post("/todays-focus", { childProfile: { id: "child-b", age: 2 }, signals: { count: 0 }, language: "en" })).status).toBe(200);
    expect(focusPrompt).not.toContain("Active program:");
  });
});
