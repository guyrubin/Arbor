/**
 * B-KID-167 / B-BOOK-77 — the server side of Everyday Plans: the visibility
 * gate (an UNSIGNED pattern is composable only in the sandbox and for the
 * owner allow-list; a signed one for everyone who owns the child), the
 * composition against the sourced menu, the own-words phrasing (one model
 * call, screened, returned UNAPPROVED) and the approval stamp (B-GA-11: an
 * own line without the parent's approval cannot become a book). The words
 * are never in the request or the response except as the phrased line.
 */
import express, { type RequestHandler } from "express";
import type { AddressInfo } from "node:net";
import { afterAll, describe, expect, it } from "vitest";
import { createPlansRouter, mockPhrase, screenPhrasedLine, viewerOf } from "./plans";
import { PLAN_POO_SIT } from "../lib/library/plans/patterns/planPooSit";

type Cfg = Parameters<typeof createPlansRouter>[0]["config"];

const base: Cfg = { plansReviewed: {}, plansOwnerUids: ["owner-uid"], plansOwnerEmails: ["guy@example.test"], memoryAdapter: "firestore", arborEnv: "prod", modelProvider: "mock" };

function serve(cfg: Cfg, user: { uid: string; email?: string } | null, modelProvider?: Parameters<typeof createPlansRouter>[0]["modelProvider"]) {
  const app = express();
  app.use((req, _res, next) => {
    if (user) (req as any).user = user;
    next();
  });
  const ownership: RequestHandler = (req, res, next) => (String(req.params.childId) === "victims-kid" ? res.status(403).json({ error: "Not authorized for this child." }) : next());
  app.use("/api", createPlansRouter({ config: cfg, requireOwnership: ownership, modelProvider, now: () => "2026-10-26T20:00:00.000Z" }));
  return new Promise<{ url: string; close: () => void }>((resolve) => {
    const server = app.listen(0, () => resolve({ url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`, close: () => server.close() }));
  });
}

const good = { pattern: "plan-poo-sit", lang: "en", stepMenuIds: ["sit-after-meal", "the-box", "just-try"], minutes: 5, time: "evening", boxItemIds: ["book", "soap-bubbles"], durationDays: 21 };
const json = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const post = (url: string, body: unknown) => json(`${url}/children/kid-1/plan-books`, body);

describe("B-KID-167: GET /plans/visibility", () => {
  const servers: { close: () => void }[] = [];
  afterAll(() => servers.forEach((s) => s.close()));

  it("a family outside the allow-list sees every pattern unsigned and not composable", async () => {
    const s = await serve(base, { uid: "family-1" });
    servers.push(s);
    const body = await (await fetch(`${s.url}/plans/visibility`)).json();
    expect(body.reviewed["plan-poo-sit"]).toEqual({ en: false, he: false });
    expect(body.composable["plan-poo-sit"]).toEqual({ en: false, he: false });
    expect(Object.keys(body.composable)).toHaveLength(8);
  });

  it("B-BOOK-75 plates: `admin` is false for everyone unless the painter dep says so for THIS viewer", async () => {
    const s = await serve(base, { uid: "owner-uid", email: "guy@example.test" });
    servers.push(s);
    expect((await (await fetch(`${s.url}/plans/visibility`)).json()).admin).toBe(false);
    const app = express();
    app.use((req, _res, next) => { (req as any).user = { uid: "founder", email: "founder@example.test" }; next(); });
    app.use("/api", createPlansRouter({ config: base, requireOwnership: (_req, _res, next) => next(), painter: (v) => v.email === "founder@example.test" }));
    const server = await new Promise<import("node:http").Server>((resolve) => { const srv = app.listen(0, () => resolve(srv)); });
    servers.push({ close: () => server.close() });
    const body = await (await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/plans/visibility`)).json();
    expect(body.admin).toBe(true);
    // the flag opens no door: the table itself is unchanged
    expect(body.composable["plan-poo-sit"]).toEqual({ en: false, he: false });
  });

  it("the owner (uid or verified email) may compose an unsigned pattern; nothing reads as reviewed", async () => {
    for (const user of [{ uid: "owner-uid" }, { uid: "someone", email: "Guy@Example.test" }]) {
      const s = await serve(base, user);
      servers.push(s);
      const body = await (await fetch(`${s.url}/plans/visibility`)).json();
      expect(body.reviewed["plan-poo-sit"]).toEqual({ en: false, he: false });
      expect(body.composable["plan-poo-sit"]).toEqual({ en: true, he: true });
    }
  });

  it("a signed language is composable for everyone; only a literal true signs", async () => {
    const s = await serve({ ...base, plansReviewed: { "plan-poo-sit": { en: true, he: "yes" as unknown as boolean }, "plan-made-up": { en: true } } }, { uid: "family-1" });
    servers.push(s);
    const body = await (await fetch(`${s.url}/plans/visibility`)).json();
    expect(body.reviewed["plan-poo-sit"]).toEqual({ en: true, he: false });
    expect(body.composable["plan-poo-sit"]).toEqual({ en: true, he: false });
    expect(body.reviewed["plan-made-up"]).toBeUndefined();
  });

  it("the local sandbox (no token, local adapter, not prod) composes everything; prod never counts as sandbox", () => {
    expect(viewerOf({} as express.Request, { memoryAdapter: "local", arborEnv: "local" }).sandbox).toBe(true);
    expect(viewerOf({} as express.Request, { memoryAdapter: "local", arborEnv: "prod" }).sandbox).toBe(false);
    expect(viewerOf({} as express.Request, base).sandbox).toBe(false);
    expect(viewerOf({ user: { uid: "u" } } as unknown as express.Request, { memoryAdapter: "local", arborEnv: "local" }).sandbox).toBe(false);
  });
});

describe("B-KID-167: POST /children/:childId/plan-books", () => {
  const servers: { close: () => void }[] = [];
  afterAll(() => servers.forEach((s) => s.close()));

  it("refuses an unsigned pattern for a family outside the allow-list (403 plan_unsigned)", async () => {
    const s = await serve(base, { uid: "family-1" });
    servers.push(s);
    const r = await post(s.url, good);
    expect(r.status).toBe(403);
    expect((await r.json()).code).toBe("plan_unsigned");
  });

  it("the owner composes an unsigned pattern: the doc holds the choices and the approval, never the words", async () => {
    const s = await serve(base, { uid: "owner-uid" });
    servers.push(s);
    const r = await post(s.url, good);
    expect(r.status).toBe(201);
    const body = await r.json();
    expect(body.why).toBe("owner");
    expect(body.doc).toEqual({
      id: "plan-poo-sit.kid-1", bookId: "plan-poo-sit.kid-1", kind: "plan", pattern: "plan-poo-sit", lang: "en",
      stepMenuIds: ["sit-after-meal", "the-box", "just-try"], minutes: 5, time: "evening", boxItemIds: ["book", "soap-bubbles"], durationDays: 21,
      approvedAt: "2026-10-26T20:00:00.000Z", approvedBy: "owner-uid", createdAt: "2026-10-26T20:00:00.000Z", updatedAt: "2026-10-26T20:00:00.000Z", status: "active",
    });
    expect(JSON.stringify(body)).not.toMatch(/tummy|poo |wonder box/i);
  });

  it("a signed pattern composes for any owner of the child, in that language only", async () => {
    const s = await serve({ ...base, plansReviewed: { "plan-poo-sit": { en: true } } }, { uid: "family-1" });
    servers.push(s);
    expect((await post(s.url, good)).status).toBe(201);
    expect((await post(s.url, { ...good, lang: "he" })).status).toBe(403);
  });

  it("refuses a composition outside the pattern's menu or bounds (400, problems named)", async () => {
    const s = await serve(base, { uid: "owner-uid" });
    servers.push(s);
    const r = await post(s.url, { ...good, stepMenuIds: ["the-box", "the-box", "just-try"], minutes: 25, time: "whenever", boxItemIds: ["sweets"], durationDays: 90 });
    expect(r.status).toBe(400);
    const body = await r.json();
    expect(body.code).toBe("plan_bad_composition");
    expect(body.problems.map((p: { code: string }) => p.code).sort()).toEqual(["bad_box_item", "bad_duration", "bad_minutes", "bad_step", "bad_time"]);
  });

  it("another family's child is refused by ownership; an unknown pattern is 404", async () => {
    const s = await serve(base, { uid: "owner-uid" });
    servers.push(s);
    const other = await fetch(`${s.url}/children/victims-kid/plan-books`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(good) });
    expect(other.status).toBe(403);
    expect((await post(s.url, { ...good, pattern: "plan-anything" })).status).toBe(404);
    expect((await post(s.url, { ...good, pattern: "plan-new-food", stepMenuIds: ["sits-on-my-plate", "tiny-taste", "comes-back-many-times"], boxItemIds: [] })).status).toBe(201);
  });

  it("the sandbox composes without a token", async () => {
    const s = await serve({ ...base, memoryAdapter: "local", arborEnv: "local" }, null);
    servers.push(s);
    const r = await post(s.url, good);
    expect(r.status).toBe(201);
    const body = await r.json();
    expect(body.why).toBe("sandbox");
    expect(body.doc.approvedBy).toBe("local-sandbox");
  });

  it("B-GA-11: an own-words step composes only with the parent's approval on the exact line; the server stamps the time", async () => {
    const s = await serve(base, { uid: "owner-uid" });
    servers.push(s);
    const step = mockPhrase(2, "the therapist said: blow bubbles while sitting");
    const own = { slot: 2, sourceText: "the therapist said: blow bubbles while sitting", text: step, aiPhrased: true };
    const body = { ...good, stepMenuIds: ["sit-after-meal", "own", "just-try"] };
    const unapproved = await post(s.url, { ...body, ownStep: own });
    expect(unapproved.status).toBe(400);
    expect((await unapproved.json()).problems.map((p: { code: string }) => p.code)).toEqual(["own_step_unapproved"]);
    const missing = await post(s.url, body);
    expect(missing.status).toBe(400);
    const approved = await post(s.url, { ...body, ownStep: { ...own, approvedAt: "client-claims-2026" } });
    expect(approved.status).toBe(201);
    const doc = (await approved.json()).doc;
    expect(doc.stepMenuIds).toEqual(["sit-after-meal", "own", "just-try"]);
    expect(doc.ownStep).toEqual({ ...own, approvedAt: "2026-10-26T20:00:00.000Z" });
    // a line that fails the screens cannot become a book even when approved
    const bad = { ...own, text: { en: "Step two: you must sit, you have constipation.", he: { m: "שלב שני: אתה חייב לשבת.", f: "שלב שני: את חייבת לשבת." } }, approvedAt: "x" };
    const refused = await post(s.url, { ...body, ownStep: bad });
    expect(refused.status).toBe(422);
    expect((await refused.json()).code).toBe("plan_phrase_refused");
  });
});

describe("B-GA-11: POST /plans/phrase", () => {
  const servers: { close: () => void }[] = [];
  afterAll(() => servers.forEach((s) => s.close()));

  it("the mock provider phrases deterministically; the answer is an UNAPPROVED own step, marked AI-phrased", async () => {
    const s = await serve(base, { uid: "owner-uid" });
    servers.push(s);
    const r = await json(`${s.url}/plans/phrase`, { pattern: "plan-poo-sit", slot: 2, lang: "en", text: "we blow bubbles while sitting" });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.aiPhrased).toBe(true);
    expect(body.step.approvedAt).toBeUndefined();
    expect(body.step).toMatchObject({ slot: 2, sourceText: "we blow bubbles while sitting", aiPhrased: true });
    expect(body.step.text.en).toBe("Step two: every day, we blow bubbles while sitting. The same way every day. My body gets a chance.");
    expect(body.step.text.he.m).toMatch(/^שלב שני:/);
  });

  it("B-BOOK-79 door (a): a step relayed from the professional who works with the child keeps its origin label; anything else is the parent's own", async () => {
    const s = await serve(base, { uid: "owner-uid" });
    servers.push(s);
    const pro = await json(`${s.url}/plans/phrase`, { pattern: "plan-poo-sit", slot: 2, lang: "en", text: "we blow bubbles while sitting", origin: "practitioner" });
    expect(pro.status).toBe(200);
    expect((await pro.json()).step).toMatchObject({ slot: 2, origin: "practitioner", aiPhrased: true });
    const own = await json(`${s.url}/plans/phrase`, { pattern: "plan-poo-sit", slot: 2, lang: "en", text: "we blow bubbles while sitting", origin: "doctor" });
    expect(own.status).toBe(200);
    expect((await own.json()).step.origin).toBeUndefined();
  });

  it("B-GA-05: crisis language in the parent's words is screened BEFORE the gate and the model — 409 with the escalation contract, provider never called", async () => {
    let calls = 0;
    const provider = { generateJson: async () => { calls += 1; return { en: "Step two: x.", he_m: "שלב שני: x.", he_f: "שלב שני: x." }; } } as unknown as NonNullable<Parameters<typeof createPlansRouter>[0]["modelProvider"]>;
    const owner = await serve({ ...base, modelProvider: "vertex" } as Cfg, { uid: "owner-uid" }, provider);
    const outside = await serve({ ...base, modelProvider: "vertex" } as Cfg, { uid: "family-1" }, provider);
    servers.push(owner, outside);
    const r = await json(`${owner.url}/plans/phrase`, { pattern: "plan-poo-sit", slot: 2, lang: "en", text: "he says he wants to hurt himself when we sit" });
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ error: "Professional support recommended", escalationCategory: "self_harm" });
    // The screen outranks the visibility gate: a family outside the owner list gets the helplines, not a 403.
    const gated = await json(`${outside.url}/plans/phrase`, { pattern: "plan-poo-sit", slot: 2, lang: "en", text: "I am thinking about suicide" });
    expect(gated.status).toBe(409);
    expect(calls).toBe(0);
  });

  it("the gate holds here too; empty words and a bad slot are refused", async () => {
    const outside = await serve(base, { uid: "family-1" });
    const owner = await serve(base, { uid: "owner-uid" });
    servers.push(outside, owner);
    expect((await json(`${outside.url}/plans/phrase`, { pattern: "plan-poo-sit", slot: 2, lang: "en", text: "bubbles" })).status).toBe(403);
    expect((await json(`${owner.url}/plans/phrase`, { pattern: "plan-poo-sit", slot: 4, lang: "en", text: "bubbles" })).status).toBe(400);
    expect((await json(`${owner.url}/plans/phrase`, { pattern: "plan-poo-sit", slot: 2, lang: "en", text: "a" })).status).toBe(400);
  });

  it("a real provider's line passes the screens or is refused (422, the reason named); a provider error is 503", async () => {
    const fine = { generateJson: async () => ({ en: "Step two: while I sit, we sing our bubble song, slow and soft. My tummy gets a chance.", he_m: "שלב שני: בזמן שאני יושב, אנחנו שרים את שיר הבועות שלנו, לאט ורך. הבטן שלי מקבלת הזדמנות.", he_f: "שלב שני: בזמן שאני יושבת, אנחנו שרים את שיר הבועות שלנו, לאט ורך. הבטן שלי מקבלת הזדמנות." }) };
    const diag = { generateJson: async () => ({ en: "Step two: you must sit because of your constipation.", he_m: "שלב שני: אתה חייב לשבת.", he_f: "שלב שני: את חייבת לשבת." }) };
    const down = { generateJson: async () => { throw new Error("upstream"); } };
    const cfg = { ...base, modelProvider: "vertex" as const };
    const a = await serve(cfg, { uid: "owner-uid" }, fine);
    const b = await serve(cfg, { uid: "owner-uid" }, diag);
    const c = await serve(cfg, { uid: "owner-uid" }, down);
    servers.push(a, b, c);
    const ok = await json(`${a.url}/plans/phrase`, { pattern: "plan-poo-sit", slot: 2, lang: "en", text: "sing the bubble song" });
    expect(ok.status).toBe(200);
    const refused = await json(`${b.url}/plans/phrase`, { pattern: "plan-poo-sit", slot: 2, lang: "en", text: "sit" });
    expect(refused.status).toBe(422);
    expect((await refused.json()).reason).toMatch(/^(output_screen|clinical_term|lint)/);
    expect((await json(`${c.url}/plans/phrase`, { pattern: "plan-poo-sit", slot: 2, lang: "en", text: "sit calmly" })).status).toBe(503);
  });

  it("the screen names what it refuses: second person, pressure, a diagnosis noun, a digit", () => {
    const ok = mockPhrase(2, "we blow bubbles");
    expect(screenPhrasedLine(PLAN_POO_SIT, 2, ok, "we blow bubbles")).toBeNull();
    expect(screenPhrasedLine(PLAN_POO_SIT, 2, { en: "Step two: you sit on the toilet.", he: { m: "שלב שני: אתה יושב.", f: "שלב שני: את יושבת." } }, "x")).toMatch(/second-person/);
    expect(screenPhrasedLine(PLAN_POO_SIT, 2, { en: "Step two: I must sit for 3 songs.", he: { m: "שלב שני: אני יושב.", f: "שלב שני: אני יושבת." } }, "x")).toMatch(/pressure-modal|digit/);
    expect(screenPhrasedLine(PLAN_POO_SIT, 2, { en: "Step two: my constipation gets better when I sit.", he: { m: "שלב שני: אני יושב.", f: "שלב שני: אני יושבת." } }, "x")).toMatch(/diagnosis|clinical/);
  });
});
