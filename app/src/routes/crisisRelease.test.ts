/* B-GA-05 — the release proof that every enabled crisis channel on THIS
 * candidate stops before any model call and hands the parent crisis direction.
 *
 * One matrix, EN + HE crisis input per channel, through the real router with a
 * provider that records every call. For each channel: zero model calls, zero
 * ledger reads (so an active program's script and approved memory can never
 * precede the crisis direction), the channel's escalation contract (the coach
 * routes return the full resources with tel: links, voice speaks the request
 * language and carries the resources for the loop to stop on, every other
 * route answers 409 + escalationCategory, which lib/api.ts turns into
 * EscalationRequiredError). The channel list is tied to the AI caller
 * inventory: a route the inventory marks as crisis-screened without a case
 * here fails. Synthetic data only; no network. */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApiRouter } from "./api.js";
import { createTestConfig } from "../testConfig.js";
import { loadFramework } from "../services/framework.js";
import { LocalMemoryStore } from "../memory/localMemoryStore.js";
import { LocalShareStore } from "../sharing/shares.js";
import { LocalConsentStore, buildConsent } from "../sharing/consent.js";
import { createCounterStore } from "../server/quotaStore.js";
import { createEntitlementStore } from "../server/entitlements.js";
import { createReferralStore } from "../server/referral.js";
import { createConsultStore } from "../server/consultRequests.js";
import { createAdminMetricsStore } from "../server/adminMetrics.js";
import { createWaitlistStore } from "../server/waitlist.js";
import type { CompanionLedgerSource } from "../server/companionContext.js";
import type { ModelProvider } from "../ai/modelRouter.js";
import { renderEscalationMarkdown, screenForImmediateEscalation } from "../safety/escalation.js";
import { PROGRAMS, programMeta } from "../content/programs/index.js";
import { enrolInProgram } from "../lib/programs/enrolment.js";

const ROOT = path.resolve(__dirname, "..", "..", "..");
const UID = "synthetic-parent-ga05";
const CHILD = "synthetic-child-ga05";
const PROFILE = { id: CHILD, name: "Noa", age: 5, challenges: [] as string[] };
const CRISIS = { en: "My child says he wants to die", he: "הילדה אומרת שהיא רוצה למות" } as const;
const PROGRAM = PROGRAMS[0];
const PROGRAM_NAME = programMeta(PROGRAM.id)!.name.en;
const MEMORY_CANARY = "GA05_MEMORY_CANARY likes the blue cup.";

/* ── a provider that records every call, and a ledger with an active program ─ */

const calls: { method: string; route?: string; prompt?: string }[] = [];
const contract = () => ({
  text: "Try one small step together tonight.", riskLevel: "Low", ageBand: "3-5", domains: ["social_emotional"],
  nonDiagnosticHypotheses: [], todayPlan: ["Choose shoes together before bedtime."], parentScript: "Let's choose together.",
  avoid: ["Long lectures."], observe: ["What happens next."], escalateIf: ["The pattern intensifies for two weeks."],
  frameRouting: { aim: "support", twoAxes: "connection", story: "a small step", shadow: "pause", marriage: "teamwork", shepherd: "guide" },
  memoryProposals: [], handoffNotes: { teacher: "", professional: "" }, sourceCardsUsed: [],
});
const provider = {
  routeDecision: (route: string) => ({ route, provider: "mock", model: "synthetic" }),
  async generateJson(o: { route: string; prompt: string; schema?: { properties?: Record<string, unknown> } }) {
    calls.push({ method: "generateJson", route: o.route, prompt: o.prompt });
    if (o.schema?.properties?.safe) return { safe: true, reason: "synthetic" };
    return { phases: [{ title: "Start small", steps: [{ text: "Name the feeling." }] }], title: "Plan", summary: "A calm plan." };
  },
  async *generateJsonStream(o: { route: string; prompt: string }) { calls.push({ method: "generateJsonStream", route: o.route, prompt: o.prompt }); yield JSON.stringify(contract()); },
  async *streamText(o: { route: string; prompt: string }) { calls.push({ method: "streamText", route: o.route, prompt: o.prompt }); yield "Try a small step together tonight."; },
  async generateImage() { calls.push({ method: "generateImage" }); return { data: "aGVsbG8=", mimeType: "image/png" }; },
} as unknown as ModelProvider;

const loadLedger = vi.fn(async () => ({
  actionLoops: [], insights: [],
  programs: [(enrolInProgram([], PROGRAM.id, new Date(Date.now() - 2 * 86_400_000)) as { enrolment: unknown }).enrolment],
}));
const ledgerSource: CompanionLedgerSource = { load: loadLedger };
const memoryStore = new LocalMemoryStore();
Object.assign(memoryStore, { ownsChild: async (uid: string, childId: string) => uid === UID && childId === CHILD });
const consentStore = new LocalConsentStore();
let server: Server;
let base: string;

beforeAll(async () => {
  await consentStore.set(buildConsent({ childId: CHILD, purpose: "companion_attachments", granted: true, actorUid: UID }));
  await memoryStore.appendEvent?.({ eventId: "ga05-m1", memoryId: "ga05-m1", childId: CHILD, familyId: UID, fact: MEMORY_CANARY, status: "approved",
    eventType: "approved", source: "synthetic-parent", actor: "parent", retention: "3 months", createdAt: new Date().toISOString() } as never);
  const config = createTestConfig({ modelProvider: "mock" });
  const entitlements = createEntitlementStore(config);
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use((req, _res, next) => { (req as any).user = { uid: UID }; next(); });
  app.use("/api", createApiRouter({
    config, modelProvider: provider, memoryStore, shareStore: new LocalShareStore(), consentStore,
    framework: loadFramework(), entitlementStore: entitlements, referralStore: createReferralStore(config, entitlements),
    counters: createCounterStore(config), consultStore: createConsultStore(config), adminMetrics: createAdminMetricsStore(config),
    waitlistStore: createWaitlistStore(config), companionLedgerSource: ledgerSource,
  }));
  server = await new Promise<Server>((done) => { const s = app.listen(0, "127.0.0.1", () => done(s)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { await new Promise<void>((done) => server.close(() => done())); });
beforeEach(() => { calls.length = 0; loadLedger.mockClear(); });

async function post(route: string, body: unknown) {
  const res = await fetch(`${base}/api${route}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const raw = await res.text();
  const frames = res.headers.get("content-type")?.includes("text/event-stream")
    ? raw.split("\n\n").map((b) => ({ event: b.match(/^event: (.+)$/m)?.[1], data: b.match(/^data: (.+)$/m)?.[1] }))
      .filter((f) => f.event && f.data).map((f) => ({ event: f.event!, data: JSON.parse(f.data!) }))
    : [];
  let json: any = null;
  try { json = frames.length ? null : JSON.parse(raw); } catch { /* not JSON */ }
  return { status: res.status, raw, json, frames };
}

/* ── the channel matrix ───────────────────────────────────────────────────── */

type Lang = "en" | "he";
type Channel = { kind: "coach" | "voice" | "409"; body: (text: string, lang: Lang) => Record<string, unknown> };
const who = { childProfile: PROFILE, contextChildId: CHILD, childId: CHILD };
const IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";

const CHANNELS: Record<string, Channel> = {
  "/chat": { kind: "coach", body: (t, l) => ({ message: t, language: l, ...who }) },
  "/council": { kind: "coach", body: (t, l) => ({ message: t, language: l, ...who }) },
  "/voice": { kind: "voice", body: (t, l) => ({ message: t, language: l, ...who }) },
  "/extract-log": { kind: "409", body: (t, l) => ({ message: t, language: l, ...who }) },
  "/describe-child": { kind: "409", body: (t, l) => ({ text: t, language: l, ...who }) },
  "/conversation/proposals": { kind: "409", body: (t, l) => ({ transcript: t, milestones: [], language: l, ...who }) },
  "/explain": { kind: "409", body: (t, l) => ({ subject: t, details: t, language: l, ...who }) },
  "/vision": { kind: "409", body: (t, l) => ({ image: IMAGE, note: t, language: l, ...who }) },
  "/generate-avatar": { kind: "409", body: (t) => ({ descriptors: { notes: t }, character: {}, ...who }) },
  "/generate-scene": { kind: "409", body: (t) => ({ imagePrompt: t, avatar: {}, ...who }) },
  "/generate-comic": { kind: "409", body: (t) => ({ theme: t, dialogue: t, avatar: {}, ...who }) },
  "/generate-adventure": { kind: "409", body: (t) => ({ ...who, childProfile: { ...PROFILE, challenges: [t] } }) },
  "/generate-plan": { kind: "409", body: (t, l) => ({ challengeTopic: t, language: l, ...who }) },
  "/generate-bedtime-story": { kind: "409", body: (t, l) => ({ childName: PROFILE.name, age: PROFILE.age, dayEvents: [{ description: t, tone: "hard" }], language: l, ...who }) },
  "/analyze-behavior": { kind: "409", body: (t, l) => ({ logs: [{ behaviorType: "meltdown", trigger: "bedtime", response: "hug", notes: t }], language: l, ...who }) },
  "/generate-handoff": { kind: "409", body: (t, l) => ({ logs: [{ behaviorType: "meltdown", trigger: "bedtime", response: "hug", notes: t }], milestones: [], language: l, ...who }) },
};

/** Screened routes with no parent or child free text: no case can reach them. */
const NOT_A_CHANNEL: Record<string, string> = {
  "/generate-hero-journey": "screens the authored story theme (getStorySpec); no parent or child text reaches it",
};

/* ── the release proof ────────────────────────────────────────────────────── */

describe("B-GA-05 — every enabled crisis channel stops before the model and directs to help", () => {
  for (const [route, channel] of Object.entries(CHANNELS)) {
    for (const lang of ["en", "he"] as const) {
      it(`${route} (${lang}): zero model calls, zero ledger reads, the channel's crisis contract`, async () => {
        const match = screenForImmediateEscalation({ message: CRISIS[lang] })!;
        expect(match.category).toBe("self_harm");
        const r = await post(route, channel.body(CRISIS[lang], lang));
        expect(calls, `${route} called the model`).toEqual([]);
        expect(loadLedger).not.toHaveBeenCalled();
        expect(r.raw).not.toContain(PROGRAM_NAME);
        expect(r.raw).not.toContain(MEMORY_CANARY);
        if (channel.kind === "coach") {
          expect(r.status).toBe(200);
          expect(r.json.text).toBe(renderEscalationMarkdown(match));
          expect(r.json.escalationCategory).toBe("self_harm");
          expect(r.json.text).toContain(lang === "he" ? "(tel:1201)" : "(tel:988)");
          expect(r.json.contract).toBeUndefined();
        } else if (channel.kind === "voice") {
          const spoken = r.frames.filter((f) => f.event === "delta").map((f) => f.data.text).join("");
          const done = r.frames.find((f) => f.event === "done")!.data;
          expect(done.escalation).toBe("self_harm");
          expect(done.resourcesMarkdown).toBe(renderEscalationMarkdown(match));
          // The spoken line is in the request language and stays at most three sentences.
          expect(/[֐-׿]/.test(spoken)).toBe(lang === "he");
          expect(spoken.split(/[.!?](?:\s|$)/).filter((s) => s.trim()).length).toBeLessThanOrEqual(3);
        } else {
          expect(r.status, r.raw).toBe(409);
          expect(r.json.escalationCategory).toBe("self_harm");
        }
      });
    }
  }

  it("the matrix covers every route the AI caller inventory marks as crisis-screened", () => {
    const doc = readFileSync(path.join(ROOT, "docs", "architecture", "ai-caller-inventory.md"), "utf8");
    const screened = doc.split("\n").filter((l) => /^\| api POST /.test(l))
      .map((l) => l.slice(1, -1).split("|").map((c) => c.trim()))
      .filter((cells) => cells[6] === "yes").map((cells) => cells[0].replace("api POST ", ""));
    expect(screened.length).toBeGreaterThanOrEqual(15);
    expect([...Object.keys(CHANNELS), ...Object.keys(NOT_A_CHANNEL)].sort()).toEqual(screened.sort());
  });
});

/* ── controls: the same routes DO reach the model, program and memory ─────── */

describe("B-GA-05 — controls (the zeros above are the screen, not a dead harness)", () => {
  it("a benign /chat question reaches the model with the active program and approved memory in the prompt", async () => {
    const r = await post("/chat", CHANNELS["/chat"].body("What could we try at bedtime?", "en"));
    expect(r.status).toBe(200);
    expect(loadLedger).toHaveBeenCalled();
    const prompt = calls.find((c) => c.method === "generateJsonStream")?.prompt ?? "";
    expect(prompt).toContain(`Active program: ${PROGRAM_NAME}`);
    expect(prompt).toContain(MEMORY_CANARY);
  });

  it("a benign /generate-plan topic reaches the model (the 409 above is the screen)", async () => {
    const r = await post("/generate-plan", CHANNELS["/generate-plan"].body("Taking turns with a sibling", "en"));
    expect(r.status, r.raw).not.toBe(409);
    expect(calls.some((c) => c.method === "generateJson")).toBe(true);
  });

  it("a benign /voice turn streams a model reply (the crisis frames above are the screen)", async () => {
    const r = await post("/voice", CHANNELS["/voice"].body("How do I make mornings calmer?", "en"));
    expect(calls.some((c) => c.method === "streamText")).toBe(true);
    expect(r.frames.find((f) => f.event === "done")?.data.escalation).toBeUndefined();
  });
});
