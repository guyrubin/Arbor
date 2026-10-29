/* B-PROG-04 (agent half, dark) — on-shelf /chat and /voice answers open with
 * the active program week's coach script verbatim; off-shelf they do not; the
 * escalation answer is byte-identical with and without a program; and with the
 * flag off (the default) nothing changes. Real router, stub provider, a ledger
 * with an active Talk Together enrolment (the words shelf). Synthetic data.
 * Old code fails the on-shelf clauses: no route ever opened with the script. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
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
import type { CompanionLedgerSource } from "../server/companionContext.js";
import type { ModelProvider } from "../ai/modelRouter.js";
import { TALK_TOGETHER } from "../content/programs/talkTogether.js";
import { enrolInProgram } from "../lib/programs/enrolment.js";
import { onProgramShelf, programWeekScript } from "../lib/programs/weekScript.js";

const UID = "synthetic-parent-prog04";
const CHILD = "synthetic-child-prog04";
const PROFILE = { id: CHILD, name: "Noa", age: 2, challenges: [] as string[] };
const WEEK1 = TALK_TOGETHER.weeks[0].coachScripts[0].text;
const ON_SHELF = { en: "She barely talks and it frustrates her", he: "היא כמעט לא מדברת וזה מתסכל אותה" };
const OFF_SHELF = "He hits his sister when she takes his toys";
const CRISIS = "My child says he wants to die";

const contract = () => ({
  text: "That sounds hard. Try one small step together.", riskLevel: "Low", ageBand: "1-3", domains: ["language_communication"],
  nonDiagnosticHypotheses: [], todayPlan: ["Sit together with one book."], parentScript: "Let's look together.",
  avoid: ["Long lectures."], observe: ["What happens next."], escalateIf: ["The pattern continues for two weeks."],
  frameRouting: { aim: "support", twoAxes: "connection", story: "a small step", shadow: "pause", marriage: "teamwork", shepherd: "guide" },
  memoryProposals: [], handoffNotes: { teacher: "", professional: "" }, sourceCardsUsed: [],
});
const provider = {
  routeDecision: (route: string) => ({ route, provider: "mock", model: "synthetic" }),
  async generateJson(o: { schema?: { properties?: Record<string, unknown> } }) { return o.schema?.properties?.safe ? { safe: true, reason: "synthetic" } : {}; },
  async *generateJsonStream() { yield JSON.stringify(contract()); },
  async *streamText() { yield "That sounds hard. Try one small step together."; },
} as unknown as ModelProvider;

const ledgerSource: CompanionLedgerSource = {
  load: async () => ({ actionLoops: [], insights: [], programs: [(enrolInProgram([], TALK_TOGETHER.id, new Date(Date.now() - 86_400_000)) as { enrolment: unknown }).enrolment] }),
};

const servers: Server[] = [];
async function mount(flag: boolean): Promise<string> {
  const memoryStore = new LocalMemoryStore();
  Object.assign(memoryStore, { ownsChild: async (uid: string, childId: string) => uid === UID && childId === CHILD });
  const config = createTestConfig({ modelProvider: "mock", programScriptInCoach: flag });
  const entitlements = createEntitlementStore(config);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { (req as any).user = { uid: UID }; next(); });
  app.use("/api", createApiRouter({
    config, modelProvider: provider, memoryStore, shareStore: new LocalShareStore(), consentStore: new LocalConsentStore(),
    framework: loadFramework(), entitlementStore: entitlements, referralStore: createReferralStore(config, entitlements),
    counters: createCounterStore(config), consultStore: createConsultStore(config), adminMetrics: createAdminMetricsStore(config),
    waitlistStore: createWaitlistStore(config), companionLedgerSource: ledgerSource,
  }));
  const server = await new Promise<Server>((done) => { const s = app.listen(0, "127.0.0.1", () => done(s)); });
  servers.push(server);
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
let on = "";
let off = "";
beforeAll(async () => { on = await mount(true); off = await mount(false); });
afterAll(async () => { for (const s of servers) await new Promise<void>((done) => s.close(() => done())); });

const chat = async (base: string, message: string, language: "en" | "he" = "en") => {
  const res = await fetch(`${base}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, childProfile: PROFILE, childId: CHILD, language }) });
  return { status: res.status, body: (await res.json()) as { text: string; contract?: { text?: string } } };
};
const voice = async (base: string, message: string, language: "en" | "he" = "en") => {
  const res = await fetch(`${base}/api/voice`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, childProfile: PROFILE, contextChildId: CHILD, language }) });
  const raw = await res.text();
  const frames = raw.split("\n\n").map((b) => ({ event: b.match(/^event: (.+)$/m)?.[1], data: b.match(/^data: (.+)$/m)?.[1] }))
    .filter((f) => f.event && f.data).map((f) => ({ event: f.event!, data: JSON.parse(f.data!) }));
  return { status: res.status, raw, deltas: frames.filter((f) => f.event === "delta").map((f) => f.data.text as string) };
};

describe("B-PROG-04 · the on-shelf test (deterministic, EN + HE)", () => {
  // Round-2 critic P1: a bare talk/speak/night/wake caught hard moments about
  // something else. The cue is now the program's own topic, and a hard moment
  // about hurting or danger never takes the script.
  const OFF: [string, string][] = [
    ["words", "Can we talk about his hitting at daycare?"],
    ["sleep", "Last night he bit another kid at the park"],
    ["sleep", "בלילה הוא הרביץ לאחותו"],
    ["words", "He hits his sister when I'm talking on the phone"],
    ["words", "I need to speak to you about tantrums"],
    ["sleep", "He woke up angry and threw his plate"],
    ["sleep", "She screams when I turn the TV off at night"],
    ["words", "אני רוצה לדבר על ההתקפי זעם שלו"],
    ["words", "He bit his brother because he has no words for it"],
    // Round 3: rude or mean language is a behaviour, not the words shelf.
    ["words", "He says mean words to his sister"],
    ["words", "She uses bad language when she's angry"],
    ["words", "הוא משתמש במילים גסות"],
  ];
  const ON: [string, string][] = [
    ["words", "He only says three words at 2"],
    ["words", "היא כמעט לא מדברת וזה מתסכל אותה"],
    ["sleep", "He won't fall asleep before 10pm"],
    ["sleep", "הוא מתעורר בלילה כל שעה"],
    ["words", "She barely talks and it frustrates her"],
    ["sleep", "Bedtime takes an hour every night"],
  ];
  for (const [shelf, m] of OFF) it(`off: ${m}`, () => expect(onProgramShelf(m, shelf)).toBe(false));
  for (const [shelf, m] of ON) it(`on (${shelf}): ${m}`, () => expect(onProgramShelf(m, shelf)).toBe(true));

  it("names the shelf in plain words; another shelf or no program never matches", () => {
    expect(onProgramShelf(ON_SHELF.en, "words")).toBe(true);
    expect(onProgramShelf(ON_SHELF.he, "words")).toBe(true);
    expect(onProgramShelf(OFF_SHELF, "words")).toBe(false);
    expect(onProgramShelf(ON_SHELF.en, "sleep")).toBe(false);
    expect(onProgramShelf(ON_SHELF.en, "hands")).toBe(false);
    expect(programWeekScript(null, ON_SHELF.en, "en")).toBeNull();
    expect(programWeekScript({ shelf: "words", scripts: [WEEK1] }, ON_SHELF.he, "he")).toBe(WEEK1.he);
  });
});

describe("B-PROG-04 · /chat (flag on)", () => {
  it("an on-shelf answer opens with the week's script verbatim, EN and HE", async () => {
    for (const lang of ["en", "he"] as const) {
      const { status, body } = await chat(on, ON_SHELF[lang], lang);
      expect(status).toBe(200);
      expect(body.text.startsWith(`${WEEK1[lang]}\n\n`), body.text.slice(0, 120)).toBe(true);
      expect(body.contract?.text?.startsWith(WEEK1[lang])).toBe(true);
    }
  });
  it("off-shelf: absent", async () => {
    const { body } = await chat(on, OFF_SHELF);
    expect(body.text).not.toContain(WEEK1.en);
  });
  it("escalation is byte-identical with the flag on, the flag off, and an active program", async () => {
    const a = await chat(on, CRISIS);
    const b = await chat(off, CRISIS);
    expect(a.body).toEqual(b.body);
    expect(a.body.text).not.toContain(WEEK1.en);
  });
});

describe("B-PROG-04 · /voice (flag on)", () => {
  it("an on-shelf spoken answer's first delta is the week's script", async () => {
    const { status, deltas } = await voice(on, ON_SHELF.en);
    expect(status).toBe(200);
    expect(deltas[0]).toBe(`${WEEK1.en} `);
    expect(deltas.join("")).toContain("That sounds hard.");
  });
  it("off-shelf: absent; escalation byte-identical", async () => {
    expect((await voice(on, OFF_SHELF)).deltas.join("")).not.toContain(WEEK1.en);
    expect((await voice(on, CRISIS)).raw).toBe((await voice(off, CRISIS)).raw);
  });
});

describe("B-PROG-04 · dark by default", () => {
  it("the flag defaults off; with it off, an on-shelf turn is unchanged on both routes", async () => {
    expect(createTestConfig().programScriptInCoach).toBeFalsy();
    expect((await chat(off, ON_SHELF.en)).body.text).not.toContain(WEEK1.en);
    expect((await voice(off, ON_SHELF.en)).deltas.join("")).not.toContain(WEEK1.en);
  });
});
