import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { createApiRouter } from "../routes/api.js";
import { createTestConfig } from "../testConfig.js";
import { loadFramework } from "../services/framework.js";
import { LocalMemoryStore } from "../memory/localMemoryStore.js";
import { LocalShareStore } from "../sharing/shares.js";
import { LocalConsentStore } from "../sharing/consent.js";
import { createCounterStore } from "./quotaStore.js";
import { createEntitlementStore } from "./entitlements.js";
import { createReferralStore } from "./referral.js";
import { createConsultStore } from "./consultRequests.js";
import { createAdminMetricsStore } from "./adminMetrics.js";
import { createWaitlistStore } from "./waitlist.js";
import type { ModelProvider } from "../ai/modelRouter.js";
import {
  DIGEST_OPTIN_COLLECTION,
  DIGEST_OPTIN_DOC_KEYS,
  DIGEST_SEND_MIN_INTERVAL_DAYS,
  buildDigestOptIn,
  decideDigestSend,
  NullDigestOptInStore,
  type DigestOptInRow,
  type DigestOptInStore,
  type VerifiedEmail,
  type VerifiedEmailResolver,
} from "./digestOptIn.js";

/**
 * N1-07 (OBJ-INF-03) — the weekly recap email had a provider, a body and a
 * preview, and NO WIRE: zero callers of sendWeeklyDigestEmail, no send route,
 * and a localStorage-only opt-in the server could not read. This guard pins the
 * wire's refusals, because the only failure mode that matters here reaches a
 * real parent's inbox.
 *
 * Every case below asserts the SENDER WAS CALLED ZERO TIMES, not merely that a
 * refusal object came back — a route that refuses after sending is exactly the
 * defect this item exists to prevent.
 */

const DAY = 86_400_000;
const NOW = Date.parse("2026-09-15T09:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();

const VERIFIED: VerifiedEmail = { email: "parent@example.com", verified: true };
const row = (over: Partial<DigestOptInRow> = {}): DigestOptInRow => ({
  email: "parent@example.com",
  language: "en",
  optedInAt: iso(NOW - 30 * DAY),
  lastSentAt: null,
  ...over,
});

/** A sender double that records every call. The point of the whole file. */
const spySender = () => {
  const calls: unknown[] = [];
  return { calls, send: vi.fn(async (msg: unknown) => { calls.push(msg); return { sent: true as const }; }) };
};

/** Drive the decision exactly as the route does, then only send if allowed. */
const attemptSend = async (input: Parameters<typeof decideDigestSend>[0], sender: ReturnType<typeof spySender>) => {
  const decision = decideDigestSend(input);
  if (!decision.send) return { sent: false, reason: decision.reason };
  await sender.send({ to: decision.to });
  return { sent: true };
};

/* ── (a) the four fail-closed axes, each proving zero sends ───────────────── */

describe("decideDigestSend — four fail-closed axes, sender called zero times", () => {
  it("axis 1 — no server-side opt-in row → not_opted_in", async () => {
    const sender = spySender();
    const out = await attemptSend({ row: null, verified: VERIFIED, providerEnabled: true, now: NOW }, sender);
    expect(out).toEqual({ sent: false, reason: "not_opted_in" });
    expect(sender.send).toHaveBeenCalledTimes(0);
  });

  it("axis 2 — the address is no longer verified → unverified_address", async () => {
    const sender = spySender();
    const out = await attemptSend(
      { row: row(), verified: { email: "parent@example.com", verified: false }, providerEnabled: true, now: NOW },
      sender,
    );
    expect(out).toEqual({ sent: false, reason: "unverified_address" });
    expect(sender.send).toHaveBeenCalledTimes(0);
  });

  it("axis 2 — a row whose address is NOT the account's verified one → unverified_address", async () => {
    const sender = spySender();
    const out = await attemptSend(
      { row: row({ email: "someone.else@example.com" }), verified: VERIFIED, providerEnabled: true, now: NOW },
      sender,
    );
    expect(out).toEqual({ sent: false, reason: "unverified_address" });
    expect(sender.send).toHaveBeenCalledTimes(0);
  });

  it("axis 3 — unset provider OR missing credentials → provider_disabled", async () => {
    const sender = spySender();
    const out = await attemptSend({ row: row(), verified: VERIFIED, providerEnabled: false, now: NOW }, sender);
    expect(out).toEqual({ sent: false, reason: "provider_disabled" });
    expect(sender.send).toHaveBeenCalledTimes(0);
  });

  it("axis 4 — lastSentAt inside the window → already_sent_this_week", async () => {
    const sender = spySender();
    const out = await attemptSend(
      { row: row({ lastSentAt: iso(NOW - 2 * DAY) }), verified: VERIFIED, providerEnabled: true, now: NOW },
      sender,
    );
    expect(out).toEqual({ sent: false, reason: "already_sent_this_week" });
    expect(sender.send).toHaveBeenCalledTimes(0);
  });

  it("an unparseable lastSentAt refuses rather than mails a parent twice", async () => {
    const sender = spySender();
    const out = await attemptSend(
      { row: row({ lastSentAt: "not-a-date" }), verified: VERIFIED, providerEnabled: true, now: NOW },
      sender,
    );
    expect(out).toEqual({ sent: false, reason: "already_sent_this_week" });
    expect(sender.send).toHaveBeenCalledTimes(0);
  });

  it("all four satisfied → exactly one send, to the STORED address", async () => {
    const sender = spySender();
    const out = await attemptSend({ row: row(), verified: VERIFIED, providerEnabled: true, now: NOW }, sender);
    expect(out).toEqual({ sent: true });
    expect(sender.send).toHaveBeenCalledTimes(1);
    expect(sender.calls[0]).toEqual({ to: "parent@example.com" });
  });

  it("refusal order is opt-in → address → provider → idempotence", () => {
    // Day-0 with the env unset must still answer "not_opted_in": the honest
    // answer about a family, not an answer about the hosting environment.
    expect(decideDigestSend({ row: null, verified: VERIFIED, providerEnabled: false, now: NOW }))
      .toEqual({ send: false, reason: "not_opted_in" });
    // An opted-in family with the env unset reads as provider_disabled, which
    // is the fail-closed proof the measure plan looks for at T+7.
    expect(decideDigestSend({ row: row({ lastSentAt: iso(NOW) }), verified: VERIFIED, providerEnabled: false, now: NOW }))
      .toEqual({ send: false, reason: "provider_disabled" });
  });
});

/* ── (b) the 6-day idempotence boundary ──────────────────────────────────── */

describe("6-day idempotence boundary", () => {
  const at = (daysAgo: number) =>
    decideDigestSend({ row: row({ lastSentAt: iso(NOW - daysAgo * DAY) }), verified: VERIFIED, providerEnabled: true, now: NOW });

  it("is configured at six days", () => {
    expect(DIGEST_SEND_MIN_INTERVAL_DAYS).toBe(6);
  });

  it("refuses strictly INSIDE the window (0 d, 5 d, 5.999 d)", () => {
    expect(at(0)).toEqual({ send: false, reason: "already_sent_this_week" });
    expect(at(5)).toEqual({ send: false, reason: "already_sent_this_week" });
    expect(at(5.999)).toEqual({ send: false, reason: "already_sent_this_week" });
  });

  it("allows at exactly 6 days and at 7 days", () => {
    expect(at(6)).toEqual({ send: true, to: "parent@example.com", language: "en" });
    expect(at(7)).toEqual({ send: true, to: "parent@example.com", language: "en" });
  });

  it("a second attempt right after a send is refused (the double-trigger case)", async () => {
    const sender = spySender();
    let stored = row();
    const trigger = async () => {
      const out = await attemptSend({ row: stored, verified: VERIFIED, providerEnabled: true, now: NOW }, sender);
      if (out.sent) stored = { ...stored, lastSentAt: iso(NOW) };
      return out;
    };
    expect(await trigger()).toEqual({ sent: true });
    expect(await trigger()).toEqual({ sent: false, reason: "already_sent_this_week" });
    expect(sender.send).toHaveBeenCalledTimes(1);
  });
});

/* ── (c) the address never comes from a request body ─────────────────────── */

describe("the address comes from the verified identity, never from req.body", () => {
  const apiSrc = fs.readFileSync(path.resolve(__dirname, "..", "routes", "api.ts"), "utf8").replace(/\r\n/g, "\n");
  const optInRoute = apiSrc.slice(
    apiSrc.indexOf('router.post("/digest/email-optin"'),
    apiSrc.indexOf('router.get("/privacy/export'),
  );

  it("the routes exist at all (the pre-fix api.ts had no send route — negative control)", () => {
    expect(apiSrc).toContain('router.post("/digest/email-optin"');
    expect(apiSrc).toContain('router.delete("/digest/email-optin"');
    expect(apiSrc).toContain('router.post("/digest/email-send"');
    expect(optInRoute.length).toBeGreaterThan(200);
    // NEGATIVE CONTROL: the pre-fix body of this region — the preview route
    // alone — must fail the pin above.
    const preFix = apiSrc.slice(apiSrc.indexOf('router.post("/digest/email-preview"'), apiSrc.indexOf('router.post("/digest/email-optin"'));
    expect(preFix).not.toContain('router.post("/digest/email-send"');
  });

  it("neither route reads an email address out of the request body", () => {
    expect(optInRoute).not.toMatch(/req\.body[^\n]*\bemail\b/);
    expect(optInRoute).not.toMatch(/\bbody\.email\b/);
    expect(optInRoute).not.toMatch(/\bto:\s*req\./);
    // The only sanctioned sources.
    expect(optInRoute).toContain("resolveVerifiedEmail");
    expect(optInRoute).toContain("decision.to");
  });

  it("the send route builds its body through the ONE sanctioned renderer", () => {
    const sendRoute = apiSrc.slice(apiSrc.indexOf('router.post("/digest/email-send"'), apiSrc.indexOf('router.get("/privacy/export'));
    expect(sendRoute).toContain("buildDigestEmail");
    expect(sendRoute).toContain("fallbackDigestNarrative");
    expect(sendRoute).toContain("isAdmin");
    // A body is never logged: the send's error path reports a message, never
    // the rendered email.
    expect(sendRoute).not.toMatch(/logger\.[a-z]+\([^)]*bodyText/);
  });

  it("NEGATIVE CONTROL — a req.body-sourced address would fail this scan", () => {
    const badRoute = 'router.post("/digest/email-send", async (req, res) => { const to = req.body.email; });';
    expect(badRoute).toMatch(/req\.body[^\n]*\bemail\b/);
  });

  it("NEGATIVE CONTROL — a body-carried address never reaches the sender", async () => {
    // The decision function has no parameter a body could travel through: the
    // only address it can return is the stored one, re-verified.
    const sender = spySender();
    const hostileBody = { email: "attacker@evil.example", language: "en" };
    const out = await attemptSend({ row: row(), verified: VERIFIED, providerEnabled: true, now: NOW }, sender);
    expect(out).toEqual({ sent: true });
    expect(JSON.stringify(sender.calls)).not.toContain(hostileBody.email);
    expect(sender.calls[0]).toEqual({ to: "parent@example.com" });
  });
});

/* ── opt-in row construction ─────────────────────────────────────────────── */

describe("buildDigestOptIn — a row only ever holds a verified address", () => {
  it("refuses to build a row for an unverified or absent address", () => {
    expect(buildDigestOptIn({ verified: { email: "x@y.co", verified: false }, language: "en", now: new Date(NOW) }))
      .toEqual({ optedIn: false, reason: "unverified_address" });
    expect(buildDigestOptIn({ verified: { email: null, verified: true }, language: "en", now: new Date(NOW) }))
      .toEqual({ optedIn: false, reason: "unverified_address" });
  });

  it("stores exactly the documented key set — no child data, ever", () => {
    const result = buildDigestOptIn({ verified: VERIFIED, language: "he", now: new Date(NOW) });
    expect(result.optedIn).toBe(true);
    if (!result.optedIn) return;
    expect(Object.keys(result.row).sort()).toEqual([...DIGEST_OPTIN_DOC_KEYS]);
    expect(result.row).toEqual({
      email: "parent@example.com",
      language: "he",
      optedInAt: iso(NOW),
      lastSentAt: null,
    });
  });

  it("NEGATIVE CONTROL — a row carrying a childName fails the key-set pin", () => {
    const hostile = { ...row(), childName: "Maya" };
    expect(Object.keys(hostile).sort()).not.toEqual([...DIGEST_OPTIN_DOC_KEYS]);
  });

  it("an unknown language coerces to en rather than shipping a raw body value", () => {
    const result = buildDigestOptIn({ verified: VERIFIED, language: "<script>", now: new Date(NOW) });
    expect(result.optedIn && result.row.language).toBe("en");
  });

  it("re-opting in at the SAME address keeps the send stamp (no window bypass)", () => {
    const previous = row({ lastSentAt: iso(NOW - DAY) });
    const again = buildDigestOptIn({ verified: VERIFIED, language: "en", now: new Date(NOW), previous });
    expect(again.optedIn && again.row.lastSentAt).toBe(previous.lastSentAt);
    // …and a genuinely new address is a new consent, so it starts clean.
    const moved = buildDigestOptIn({
      verified: { email: "new@example.com", verified: true },
      language: "en",
      now: new Date(NOW),
      previous,
    });
    expect(moved.optedIn && moved.row.lastSentAt).toBeNull();
  });
});

/* ── the sandbox store ───────────────────────────────────────────────────── */

describe("NullDigestOptInStore — local/sandbox never 500s and never remembers", () => {
  it("reads as no consent and swallows writes", async () => {
    const store = new NullDigestOptInStore();
    await store.put("u1", row());
    expect(await store.get("u1")).toBeNull();
    await expect(store.markSent("u1", iso(NOW))).resolves.toBeUndefined();
    await expect(store.remove("u1")).resolves.toBeUndefined();
  });
});

/* ── rules: the row is not client-writable, and not cross-readable ───────── */

describe("firestore.rules — digestOptIn and retentionRollups", () => {
  const rules = fs.readFileSync(path.resolve(__dirname, "..", "..", "..", "firestore.rules"), "utf8").replace(/\r\n/g, "\n");
  const block = (name: string) => {
    const start = rules.indexOf(`match /${name}/{uid}`);
    return start === -1 ? "" : rules.slice(start, rules.indexOf("}", rules.indexOf("allow", start)) + 1);
  };

  it("declares the collection the store actually writes", () => {
    expect(DIGEST_OPTIN_COLLECTION).toBe("digestOptIn");
    expect(rules).toContain("match /digestOptIn/{uid}");
    expect(rules).toContain("match /retentionRollups/{uid}");
  });

  it("retentionRollups is owner-scoped — no cross-family read", () => {
    expect(block("retentionRollups")).toContain("request.auth.uid == uid");
  });

  it("digestOptIn denies client writes outright (the address is server-set)", () => {
    const b = rules.slice(rules.indexOf("match /digestOptIn/{uid}"));
    expect(b).toContain("allow read: if signedIn() && request.auth.uid == uid;");
    expect(b).toContain("allow write: if false;");
  });

  it("NEGATIVE CONTROL — an unscoped rule would fail the owner pin", () => {
    const bad = "match /retentionRollups/{uid} { allow read, write: if signedIn(); }";
    expect(bad).not.toContain("request.auth.uid == uid");
  });
});

/* ── route behaviour: the acceptance cases, against the REAL handlers ─────── */

/**
 * The refusals above are proved on the pure decision function. These prove the
 * ROUTE wires it: that the admin gate comes first, that the opt-in row is
 * really written, that a hostile `email` in the request body never reaches the
 * sender, and that the whole lane is inert with the provider off.
 */

class MemoryDigestOptInStore implements DigestOptInStore {
  rows = new Map<string, DigestOptInRow>();
  async get(uid: string) { return this.rows.get(uid) ?? null; }
  async put(uid: string, r: DigestOptInRow) { this.rows.set(uid, { ...r }); }
  async remove(uid: string) { this.rows.delete(uid); }
  async markSent(uid: string, atIso: string) {
    const r = this.rows.get(uid);
    if (r) this.rows.set(uid, { ...r, lastSentAt: atIso });
  }
}

const stubModelProvider = {
  async *streamText() { yield ""; },
  generateJson: async () => ({}),
  async *generateJsonStream() { yield "{}"; },
} as unknown as ModelProvider;

const buildRouteApp = (opts: {
  uid: string;
  store: DigestOptInStore;
  verified?: VerifiedEmail;
  sender: ReturnType<typeof spySender>;
}) => {
  const config = createTestConfig();
  const entitlementStore = createEntitlementStore(config);
  const resolver: VerifiedEmailResolver = async () => opts.verified ?? { email: null, verified: false };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { (req as any).user = { uid: opts.uid, email: "parent@example.com" }; next(); });
  app.use("/api", createApiRouter({
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
    digestOptInStore: opts.store,
    verifiedEmailResolver: resolver,
    digestEmailSender: opts.sender.send as never,
  }));
  return app;
};

const listen = async (app: express.Express) => {
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  return { server, baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
};

const armProvider = () => {
  process.env.EMAIL_PROVIDER = "resend";
  process.env.RESEND_API_KEY = "re_x";
  process.env.EMAIL_FROM = "Arbor <hi@a.co>";
};

describe("routes — /digest/email-optin and /digest/email-send", () => {
  const ADMIN_UID = "founder-uid";
  const servers: Server[] = [];

  beforeEach(() => {
    process.env.ARBOR_ADMIN_UIDS = ADMIN_UID;
    delete process.env.EMAIL_PROVIDER;
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
  });

  afterAll(async () => {
    delete process.env.ARBOR_ADMIN_UIDS;
    await Promise.all(servers.map((s) => new Promise<void>((res, rej) => s.close((e) => (e ? rej(e) : res())))));
  });

  const harness = async (over: { uid?: string; verified?: VerifiedEmail; store?: DigestOptInStore } = {}) => {
    const sender = spySender();
    const store = over.store ?? new MemoryDigestOptInStore();
    const app = buildRouteApp({ uid: over.uid ?? ADMIN_UID, store, verified: over.verified ?? VERIFIED, sender });
    const { server, baseUrl } = await listen(app);
    servers.push(server);
    const post = async (p: string, body: unknown = {}) => {
      const res = await fetch(`${baseUrl}${p}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return { status: res.status, body: (await res.json()) as Record<string, any> };
    };
    const del = async (p: string) => {
      const res = await fetch(`${baseUrl}${p}`, { method: "DELETE" });
      return { status: res.status, body: (await res.json()) as Record<string, any> };
    };
    return { sender, store, post, del };
  };

  it("provider OFF: opting in writes the server row, and a send refuses with provider_disabled", async () => {
    const { sender, store, post } = await harness();
    expect((await post("/api/digest/email-optin", { language: "he" })).body).toEqual({ optedIn: true });
    expect(await store.get(ADMIN_UID)).toMatchObject({ email: "parent@example.com", language: "he", lastSentAt: null });
    expect((await post("/api/digest/email-send", { logs: [], milestones: [] })).body)
      .toEqual({ sent: false, reason: "provider_disabled" });
    expect(sender.send).toHaveBeenCalledTimes(0);
  });

  it("day-0: no opt-in row → not_opted_in, sender untouched", async () => {
    const { sender, post } = await harness();
    armProvider();
    expect((await post("/api/digest/email-send")).body).toEqual({ sent: false, reason: "not_opted_in" });
    expect(sender.send).toHaveBeenCalledTimes(0);
  });

  it("an unverified address never writes a row and never sends", async () => {
    const { sender, store, post } = await harness({ verified: { email: "parent@example.com", verified: false } });
    expect((await post("/api/digest/email-optin")).body).toEqual({ optedIn: false, reason: "unverified_address" });
    expect(await store.get(ADMIN_UID)).toBeNull();
    expect(sender.send).toHaveBeenCalledTimes(0);
  });

  it("provider ON: one send, one stamp, and a second trigger inside 6 days refuses", async () => {
    const { sender, store, post } = await harness();
    await post("/api/digest/email-optin", { language: "en" });
    armProvider();
    const first = await post("/api/digest/email-send", { childProfile: { name: "Maya" }, logs: [], milestones: [] });
    expect(first.body).toEqual({ sent: true });
    expect(sender.send).toHaveBeenCalledTimes(1);
    expect((await store.get(ADMIN_UID))?.lastSentAt).toBeTruthy();
    const second = await post("/api/digest/email-send", { childProfile: { name: "Maya" }, logs: [], milestones: [] });
    expect(second.body).toEqual({ sent: false, reason: "already_sent_this_week" });
    expect(sender.send).toHaveBeenCalledTimes(1);
  });

  it("the sent body is the sanctioned render — counts only, no % and no trend", async () => {
    const { sender, post } = await harness();
    await post("/api/digest/email-optin", { language: "en" });
    armProvider();
    await post("/api/digest/email-send", { childProfile: { name: "Maya" }, logs: [], milestones: [] });
    const msg = sender.calls[0] as { to: string; subject: string; bodyText: string };
    expect(msg.to).toBe("parent@example.com");
    expect(msg.subject).toContain("Maya");
    expect(`${msg.subject}\n${msg.bodyText}`).not.toMatch(/\d+\s*%/u);
    expect(`${msg.subject}\n${msg.bodyText}`).not.toMatch(/\b(easing|steady|worsening|improving|declining)\b/i);
  });

  it("NEGATIVE CONTROL — a req.body email is ignored; the stored address is used", async () => {
    const { sender, post } = await harness();
    await post("/api/digest/email-optin", { email: "attacker@evil.example", language: "en" });
    armProvider();
    const out = await post("/api/digest/email-send", {
      email: "attacker@evil.example",
      to: "attacker@evil.example",
      childProfile: { name: "Maya" },
      logs: [],
      milestones: [],
    });
    expect(out.body).toEqual({ sent: true });
    expect(JSON.stringify(sender.calls)).not.toContain("attacker@evil.example");
    expect((sender.calls[0] as { to: string }).to).toBe("parent@example.com");
  });

  it("a non-admin gets 403 and the store is never read", async () => {
    const store = new MemoryDigestOptInStore();
    const spy = vi.spyOn(store, "get");
    const { sender, post } = await harness({ uid: "some-parent", store });
    const out = await post("/api/digest/email-send", { logs: [] });
    expect(out.status).toBe(403);
    expect(spy).toHaveBeenCalledTimes(0);
    expect(sender.send).toHaveBeenCalledTimes(0);
  });

  it("opting out removes the row", async () => {
    const { store, post, del } = await harness();
    await post("/api/digest/email-optin");
    expect(await store.get(ADMIN_UID)).not.toBeNull();
    expect((await del("/api/digest/email-optin")).body).toEqual({ optedIn: false });
    expect(await store.get(ADMIN_UID)).toBeNull();
  });
});
