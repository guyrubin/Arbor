/* B-GA-05 — the release proof that every enabled crisis channel on THIS
 * candidate hands the parent crisis direction before anything ordinary.
 *
 * One matrix through the real router with a provider that records every call:
 * two crisis categories (self-harm, abuse) × EN + HE per channel. For each
 * case: zero server model calls, zero ledger reads (so an active program's
 * script and approved memory can never precede the crisis direction), and the
 * channel's escalation contract DIRECTED to the input's category (the
 * category's own resources block, never the other one's): the coach routes
 * return the resources with tel: links; voice speaks the request language and
 * carries the resources for the loop to stop on; Live's /live/turn answers
 * stop_crisis with the resources and a spoken redirect; every other route
 * answers 409 + escalationCategory (lib/api.ts → EscalationRequiredError).
 *
 * Live is the one channel where a model hears the parent first: the browser
 * streams audio to the Live model, and /live/turn screens the transcript. Its
 * guarantee is the halt (the client guard stops the session and releases no
 * model audio for the turn: lib/liveTurnGuard.test.ts), not "no model call".
 *
 * The channel list is derived from the screenForImmediateEscalation( call
 * sites in routes/api.ts (TypeScript AST), so a newly screened route without a
 * case here fails. Synthetic data only; no network. */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
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
import { escalationMatchForCategory, renderEscalationMarkdown, screenForImmediateEscalation } from "../safety/escalation.js";
import { PROGRAMS, programMeta } from "../content/programs/index.js";
import { enrolInProgram } from "../lib/programs/enrolment.js";
import { PATTERN_IDS } from "../lib/library/plans/planVisibility.js";
import { getPattern } from "../lib/library/plans/planBooks.js";

const ROOT = path.resolve(__dirname, "..", "..", "..");
const UID = "synthetic-parent-ga05";
const CHILD = "synthetic-child-ga05";
const PROFILE = { id: CHILD, name: "Noa", age: 5, challenges: [] as string[] };
/** One input per category and language; the screen must route each to its own category. */
const CRISIS = {
  self_harm: { en: "My child says he wants to die", he: "הילדה אומרת שהיא רוצה למות" },
  abuse_or_unsafe_home: { en: "Someone is hurting my child at home", he: "פוגעים בה בבית" },
} as const;
type Category = keyof typeof CRISIS;
const OTHER: Record<Category, Category> = { self_harm: "abuse_or_unsafe_home", abuse_or_unsafe_home: "self_harm" };
const PROGRAM = PROGRAMS[0];
const PROGRAM_NAME = programMeta(PROGRAM.id)!.name.en;
const MEMORY_CANARY = "GA05_MEMORY_CANARY likes the blue cup.";
/** An authored Everyday Plans pattern, so /plans/phrase reaches its crisis screen. */
const PLAN_PATTERN = PATTERN_IDS.find((id) => getPattern(id))!;

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
type Channel = { kind: "coach" | "voice" | "live" | "409"; body: (text: string, lang: Lang) => Record<string, unknown> };
const who = { childProfile: PROFILE, contextChildId: CHILD, childId: CHILD };
const IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";

const CHANNELS: Record<string, Channel> = {
  "/chat": { kind: "coach", body: (t, l) => ({ message: t, language: l, ...who }) },
  "/council": { kind: "coach", body: (t, l) => ({ message: t, language: l, ...who }) },
  "/voice": { kind: "voice", body: (t, l) => ({ message: t, language: l, ...who }) },
  "/live/turn": { kind: "live", body: (t, l) => ({ role: "user", text: t, language: l, ...who }) },
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
  // Everyday Plans (server/plans.ts, mounted through router.use): screened before the visibility gate and the model since main 283c3b84.
  "/plans/phrase": { kind: "409", body: (t, l) => ({ pattern: PLAN_PATTERN, slot: 1, text: t, lang: l }) },
};

/** Screened routes with no parent or child free text: no case can reach them. */
const NOT_A_CHANNEL: Record<string, string> = {
  "/generate-hero-journey": "screens the authored story theme (getStorySpec); no parent or child text reaches it",
};

/* ── the release proof ────────────────────────────────────────────────────── */

/** Every `router.<method>("/path", …)` in routes/api.ts that calls
 *  screenForImmediateEscalation, plus every call site that has NO enclosing
 *  route (a helper const or function): those cannot be attributed to a
 *  channel, so the author must inline the screen in the route or register it. */
function screenedRoutes(source = readFileSync(path.join(ROOT, "app", "src", "routes", "api.ts"), "utf8")): { routes: string[]; unattributed: number[] } {
  const file = ts.createSourceFile("api.ts", source, ts.ScriptTarget.Latest, true);
  const out = new Set<string>();
  const unattributed: number[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "screenForImmediateEscalation") {
      let route: string | null = null;
      for (let p: ts.Node | undefined = node.parent; p && !route; p = p.parent) {
        if (ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression) && p.expression.expression.getText(file) === "router"
          && p.arguments[0] && ts.isStringLiteral(p.arguments[0])) route = p.arguments[0].text;
      }
      if (route) out.add(route);
      else unattributed.push(file.getLineAndCharacterOfPosition(node.getStart()).line + 1);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return { routes: [...out].sort(), unattributed };
}

/** Directories that only ever run in the browser (React components, contexts, hooks, the native shell). */
const CLIENT_ONLY_DIRS = ["components", "context", "hooks", "native"];
/** Modules outside those directories that call the screen in the browser, before posting to a
 *  server route that screens again; each with the route the matrix covers. */
const CLIENT_SCREENS: Record<string, string> = {
  "lib/describeChild.ts": "the browser describe session screens before it posts; POST /describe-child screens again (in the matrix)",
  "lib/onboardingFirstRun.ts": "the browser first-run flow screens the worry words before it posts; POST /describe-child screens again (in the matrix)",
};
/** Server-side directories: a module there is never a browser module, so it can never be registered. */
const SERVER_DIRS = ["server/", "routes/", "services/", "safety/"];
const clientScreenRegistryErrors = (registry: Record<string, string>): string[] =>
  Object.keys(registry).filter((rel) => SERVER_DIRS.some((d) => rel.startsWith(d)))
    .map((rel) => `${rel} is server code and cannot be registered as a browser module: inline the screen in its route and add the channel to this matrix`);
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

/** Every non-client, non-test source file other than routes/api.ts that calls the screen and is not a
 *  registered browser module. A router module whose every screen call sits inside a
 *  `router.<method>("/path", …)` contributes those routes as channels (`routes`); any other call
 *  (a wrapper in safety/ or lib/, a helper in server/) is `unregistered`, a channel this matrix cannot
 *  see. `extra` adds synthetic files for the negative controls. */
function serverScreens(extra: Record<string, string> = {}): { unregistered: string[]; routes: Record<string, string[]> } {
  const srcRoot = path.join(ROOT, "app", "src");
  const files: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      const rel = path.relative(srcRoot, p).split(path.sep).join("/");
      if (e.isDirectory()) { if (!CLIENT_ONLY_DIRS.includes(rel)) walk(p); }
      else if (/\.tsx?$/.test(e.name) && !/\.(test|spec)\.tsx?$|\.d\.ts$/.test(e.name)) files[rel] = readFileSync(p, "utf8");
    }
  };
  walk(srcRoot);
  const unregistered: string[] = [];
  const routes: Record<string, string[]> = {};
  for (const [rel, src] of Object.entries({ ...files, ...extra })) {
    if (rel === "routes/api.ts" || rel in CLIENT_SCREENS || !/\bscreenForImmediateEscalation\(/.test(stripComments(src))) continue;
    const found = screenedRoutes(src);
    if (found.routes.length && !found.unattributed.length) routes[rel] = found.routes;
    else unregistered.push(rel);
  }
  return { unregistered: unregistered.sort(), routes };
}
const unregisteredScreens = (extra: Record<string, string> = {}) => serverScreens(extra).unregistered;

/** The category's own resources are there; the other category's are not. */
function directed(markdown: string, category: Category) {
  expect(markdown).toContain(escalationMatchForCategory(category).resources);
  expect(markdown).not.toContain(escalationMatchForCategory(OTHER[category]).resources);
}
const sentences = (text: string) => text.split(/[.!?](?:\s|$)/).filter((x) => x.trim()).length;

describe("B-GA-05 — every enabled crisis channel directs to help before anything ordinary", () => {
  for (const [route, channel] of Object.entries(CHANNELS)) {
    for (const category of Object.keys(CRISIS) as Category[]) {
      for (const lang of ["en", "he"] as const) {
        it(`${route} (${category}, ${lang}): zero model calls, zero ledger reads, the directed crisis contract`, async () => {
          const input = CRISIS[category][lang];
          const match = screenForImmediateEscalation({ message: input })!;
          expect(match.category).toBe(category);
          const r = await post(route, channel.body(input, lang));
          expect(calls, `${route} called the model`).toEqual([]);
          expect(loadLedger).not.toHaveBeenCalled();
          expect(r.raw).not.toContain(PROGRAM_NAME);
          expect(r.raw).not.toContain(MEMORY_CANARY);
          if (channel.kind === "coach") {
            expect(r.status).toBe(200);
            expect(r.json.escalationCategory).toBe(category);
            expect(r.json.text).toBe(renderEscalationMarkdown(match));
            directed(r.json.text, category);
            expect(r.json.contract).toBeUndefined();
          } else if (channel.kind === "voice") {
            const spoken = r.frames.filter((f) => f.event === "delta").map((f) => f.data.text).join("");
            const done = r.frames.find((f) => f.event === "done")!.data;
            expect(done.escalation).toBe(category);
            expect(done.resourcesMarkdown).toBe(renderEscalationMarkdown(match));
            directed(done.resourcesMarkdown, category);
            // The spoken redirect is in the request language, at most three sentences.
            expect(/[֐-׿]/.test(spoken)).toBe(lang === "he");
            expect(sentences(spoken)).toBeLessThanOrEqual(3);
          } else if (channel.kind === "live") {
            // The Live model heard the parent; the server verdict halts the turn.
            expect(r.status).toBe(200);
            expect(r.json.action).toBe("stop_crisis");
            expect(r.json.category).toBe(category);
            expect(r.json.resourcesMarkdown).toBe(renderEscalationMarkdown(match));
            directed(r.json.resourcesMarkdown, category);
            expect(/[֐-׿]/.test(r.json.spokenText)).toBe(lang === "he");
            expect(sentences(r.json.spokenText)).toBeLessThanOrEqual(3);
          } else {
            expect(r.status, r.raw).toBe(409);
            expect(r.json.escalationCategory).toBe(category);
          }
        });
      }
    }
  }

  it("the matrix covers every route that calls screenForImmediateEscalation (derived from the source)", () => {
    const { routes, unattributed } = screenedRoutes();
    expect(unattributed, `screenForImmediateEscalation( at routes/api.ts line(s) ${unattributed.join(", ")} has no enclosing router route: inline it in the route or register the channel here`).toEqual([]);
    expect(clientScreenRegistryErrors(CLIENT_SCREENS)).toEqual([]);
    expect(unregisteredScreens(), "a source file outside routes/api.ts calls the crisis screen: in server code, inline it in the route and add the channel to this matrix (server/, routes/, services/ and safety/ can never be registered); only a browser-only module may go in CLIENT_SCREENS, with the route that screens again").toEqual([]);
    // Router modules mounted from server/ (today server/plans.ts → /plans/phrase) are channels too.
    const moduleRoutes = Object.values(serverScreens().routes).flat();
    expect(moduleRoutes).toContain("/plans/phrase");
    const derived = [...new Set([...routes, ...moduleRoutes])].sort();
    expect(derived.length).toBeGreaterThanOrEqual(19);
    expect(derived).toContain("/live/turn");
    expect([...Object.keys(CHANNELS), ...Object.keys(NOT_A_CHANNEL)].sort()).toEqual(derived);
  });

  it("negative control: a router module in server/ that screens a new route adds a channel the matrix must cover", () => {
    const router = 'import { screenForImmediateEscalation } from "../safety/escalation";\nexport const build = (router: any) => { router.post("/synthetic-module-route", (req: any, res: any) => res.json(screenForImmediateEscalation({ message: req.body.text }))); };\n';
    const { unregistered, routes } = serverScreens({ "server/syntheticModuleRouter.ts": router });
    expect(unregistered).toEqual([]);
    expect(routes["server/syntheticModuleRouter.ts"]).toEqual(["/synthetic-module-route"]);
    expect(Object.keys(CHANNELS)).not.toContain("/synthetic-module-route");
  });

  it("negative control: a screen reached through a helper const is flagged, not silently missed", () => {
    const api = readFileSync(path.join(ROOT, "app", "src", "routes", "api.ts"), "utf8");
    const helper = `${api}\nconst screenHelper = (text: string) => screenForImmediateEscalation({ message: text });\nconst late = (router: any) => router.post("/synthetic-helper-route", (req: any, res: any) => res.json(screenHelper(req.body.text)));\n`;
    const { routes, unattributed } = screenedRoutes(helper);
    expect(routes).not.toContain("/synthetic-helper-route");
    expect(unattributed).toHaveLength(1);
  });

  it("negative control: server code can never be registered as a browser module", () => {
    for (const rel of ["server/syntheticRouter.ts", "routes/syntheticRoutes.ts", "services/syntheticService.ts", "safety/syntheticWrapper.ts"]) {
      expect(clientScreenRegistryErrors({ ...CLIENT_SCREENS, [rel]: "a reason" })).toEqual([`${rel} is server code and cannot be registered as a browser module: inline the screen in its route and add the channel to this matrix`]);
    }
    expect(clientScreenRegistryErrors({ ...CLIENT_SCREENS, "lib/syntheticBrowserFlow.ts": "a reason" })).toEqual([]);
  });

  it("negative control: a screen wrapper in safety/ or lib/, or a router in server/, is flagged", () => {
    const wrapper = 'import { screenForImmediateEscalation } from "./escalation";\nexport const screenParentWords = (t: string) => screenForImmediateEscalation({ message: t });\n';
    expect(unregisteredScreens({ "safety/syntheticWrapper.ts": wrapper, "lib/syntheticWrapper.ts": wrapper, "server/syntheticRouter.ts": wrapper }))
      .toEqual(["lib/syntheticWrapper.ts", "safety/syntheticWrapper.ts", "server/syntheticRouter.ts"]);
    // A mention in a comment is not a call.
    expect(unregisteredScreens({ "safety/commentOnly.ts": "// calls screenForImmediateEscalation(x) upstream\nexport const x = 1;\n" })).toEqual([]);
    // The registered browser modules still screen (the registry is not stale).
    for (const rel of Object.keys(CLIENT_SCREENS)) expect(readFileSync(path.join(ROOT, "app", "src", rel), "utf8")).toMatch(/screenForImmediateEscalation\(/);
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

  it("a benign /plans/phrase step is not a 409 (the 409 above is the screen)", async () => {
    const r = await post("/plans/phrase", CHANNELS["/plans/phrase"].body("We read one book and then lights out", "en"));
    expect(r.status, r.raw).not.toBe(409);
  });

  it("a benign Live user turn continues (the stop_crisis above is the screen)", async () => {
    const r = await post("/live/turn", CHANNELS["/live/turn"].body("How do I make mornings calmer?", "en"));
    expect(r.status).toBe(200);
    expect(r.json.action).toBe("continue");
  });

  it("a benign /voice turn streams a model reply (the crisis frames above are the screen)", async () => {
    const r = await post("/voice", CHANNELS["/voice"].body("How do I make mornings calmer?", "en"));
    expect(calls.some((c) => c.method === "streamText")).toBe(true);
    expect(r.frames.find((f) => f.event === "done")?.data.escalation).toBeUndefined();
  });
});
