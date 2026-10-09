/**
 * B-INF-02 — the weekly digest send job.
 *
 *  · idempotent within 6 days per uid (a second run sends nothing);
 *  · a dry run decides and renders, never sends, never stamps;
 *  · unauthenticated → 401 (no SA configured = nobody; a wrong caller = 401);
 *  · a Hebrew opt-in receives a Hebrew body;
 *  · the firewall scan runs on every email body (and the rendered bodies pass);
 *  · moment notes are never read into the email (G-14).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  createOidcJobVerifier,
  digestBodyViolations,
  keepGoingLine,
  renderFamilyDigest,
  runWeeklyDigestJob,
  type DigestJobChild,
  type DigestJobSource,
} from "./digestJob.js";
import type { DigestOptInRow } from "./digestOptIn.js";
import { buildDigestEmail, computeWeeklyDigestStats, fallbackDigestNarrative } from "./digest.js";
import { createAuthMiddleware, JOB_API_PATHS } from "./authMiddleware.js";
import { createApiRouter } from "../routes/api.js";
import { createTestConfig } from "../testConfig.js";
import { loadFramework } from "../services/framework.js";
import type { ModelProvider } from "../ai/modelRouter.js";
import { LocalMemoryStore } from "../memory/localMemoryStore.js";
import { LocalShareStore } from "../sharing/shares.js";
import { LocalConsentStore } from "../sharing/consent.js";
import { createCounterStore } from "./quotaStore.js";
import { createEntitlementStore } from "./entitlements.js";
import { createReferralStore } from "./referral.js";
import { createConsultStore } from "./consultRequests.js";
import { createAdminMetricsStore } from "./adminMetrics.js";
import { createWaitlistStore } from "./waitlist.js";

// This is an offline authentication contract test. Even an invalid token
// makes the real Google verifier download public certificates before parsing
// it; mock that boundary so unit tests never contact an identity provider.
const oidc = vi.hoisted(() => ({ verify: vi.fn() }));
vi.mock("google-auth-library", async (importOriginal) => {
  const actual = await importOriginal<typeof import("google-auth-library")>();
  return { ...actual, OAuth2Client: class { verifyIdToken = oidc.verify; } };
});

const NOW = Date.parse("2026-10-04T05:00:00.000Z");
const DAY = 86_400_000;
const at = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();

const child = (over: Partial<DigestJobChild> = {}): DigestJobChild => ({
  childId: "c1",
  firstName: "Noa",
  logs: [
    { timestamp: at(1), resolved: true, context: "home", behaviorType: "Tantrum", notes: "NOTE_SECRET she bit her brother" } as DigestJobChild["logs"][number],
    { timestamp: at(2), context: "park", behaviorType: "Transition" },
  ],
  milestones: [{ checked: true }, { checked: false }, { checked: false }],
  actionLoops: [{ recommendation: "Two-minute warning before leaving", source: "digest", status: "completed", outcome: "helped", acceptedAt: at(3) }],
  ...over,
});

class FakeSource implements DigestJobSource {
  sent: Record<string, string> = {};
  events: Array<[string, string]> = [];
  constructor(public rows: Array<{ uid: string; row: DigestOptInRow }>, public families: Record<string, DigestJobChild[]>) {}
  async listOptIns() { return this.rows.map((r) => ({ uid: r.uid, row: { ...r.row, lastSentAt: this.sent[r.uid] ?? r.row.lastSentAt } })); }
  async loadFamily(uid: string) { return this.families[uid] ?? []; }
  async markSent(uid: string, atIso: string) { this.sent[uid] = atIso; }
  async recordResult(uid: string, result: string) { this.events.push([uid, result]); }
}

const optIn = (email: string, language: "en" | "he" = "en", lastSentAt: string | null = null): DigestOptInRow =>
  ({ email, language, optedInAt: at(30), lastSentAt });
const verified = async ({ uid }: { uid: string }) => ({ email: `${uid}@example.org`, verified: true });

describe("B-INF-02 — runWeeklyDigestJob", () => {
  it("sends once, then refuses inside 6 days (idempotent per uid); unconsented uids are never mailed", async () => {
    const source = new FakeSource(
      [{ uid: "en-fam", row: optIn("en-fam@example.org") }],
      { "en-fam": [child()], "not-opted": [child()] },
    );
    const outbox: string[] = [];
    const send = async (m: { to: string }) => { outbox.push(m.to); return { sent: true }; };
    const first = await runWeeklyDigestJob({ source, resolveVerifiedEmail: verified, providerEnabled: true, send, now: NOW, dryRun: false });
    const second = await runWeeklyDigestJob({ source, resolveVerifiedEmail: verified, providerEnabled: true, send, now: NOW + DAY, dryRun: false });
    expect(first.results).toEqual({ sent: 1 });
    expect(second.results).toEqual({ already_sent_this_week: 1 });
    expect(outbox).toEqual(["en-fam@example.org"]);
    expect(source.events).toEqual([["en-fam", "sent"], ["en-fam", "already_sent_this_week"]]);
    // A week later the next send is allowed again.
    const third = await runWeeklyDigestJob({ source, resolveVerifiedEmail: verified, providerEnabled: true, send, now: NOW + 6 * DAY, dryRun: false });
    expect(third.results).toEqual({ sent: 1 });
  });

  it("a dry run renders and decides but never sends and never stamps", async () => {
    const source = new FakeSource([{ uid: "fam", row: optIn("fam@example.org") }], { fam: [child()] });
    const send = vi.fn(async () => ({ sent: true }));
    const report = await runWeeklyDigestJob({ source, resolveVerifiedEmail: verified, providerEnabled: true, send, now: NOW, dryRun: true });
    expect(report).toMatchObject({ dryRun: true, considered: 1, results: { would_send: 1 } });
    expect(send).not.toHaveBeenCalled();
    expect(source.sent).toEqual({});
    expect(source.events).toEqual([]);
  });

  it("the fail-closed axes hold: provider off, unverified address, no child record", async () => {
    const source = new FakeSource(
      [{ uid: "a", row: optIn("a@example.org") }, { uid: "b", row: optIn("someone-else@example.org") }, { uid: "c", row: optIn("c@example.org") }],
      { a: [child()] },
    );
    const send = vi.fn(async () => ({ sent: true }));
    const off = await runWeeklyDigestJob({ source, resolveVerifiedEmail: verified, providerEnabled: false, send, now: NOW, dryRun: false });
    expect(off.results).toEqual({ provider_disabled: 2, unverified_address: 1 });
    const on = await runWeeklyDigestJob({ source, resolveVerifiedEmail: verified, providerEnabled: true, send, now: NOW, dryRun: false });
    expect(on.results).toEqual({ sent: 1, unverified_address: 1, no_child_record: 1 });
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("B-INF-02 — the email body", () => {
  it("a Hebrew opt-in receives a Hebrew body", () => {
    const he = renderFamilyDigest([child()], "he", NOW);
    expect(he.subject).toMatch(/[֐-׿]/);
    expect(he.bodyText).toContain("שווה לנסות השבוע:");
    expect(he.bodyText).toContain("תיעדתם 2 רגעים");
    expect(he.bodyText).not.toMatch(/You logged|Try this week/);
    const en = renderFamilyDigest([child()], "en", NOW);
    expect(en.bodyText).toContain("Try this week:");
  });

  it("the parent's helped step is carried forward in their own words", () => {
    expect(renderFamilyDigest([child()], "en", NOW).bodyText).toContain("Keep going with “Two-minute warning before leaving” — you said it helped.");
    expect(keepGoingLine([], "en")).toBeNull();
  });

  it("moment notes never reach the email (G-14)", () => {
    for (const lang of ["en", "he"] as const) expect(renderFamilyDigest([child()], lang, NOW).bodyText).not.toContain("NOTE_SECRET");
  });

  it("every rendered body passes the firewall scan; the scan catches a denominator, a share and a comparison", () => {
    for (const lang of ["en", "he"] as const) {
      expect(digestBodyViolations(renderFamilyDigest([child()], lang, NOW))).toEqual([]);
      expect(digestBodyViolations(renderFamilyDigest([child(), child({ childId: "c2", firstName: "Ari", actionLoops: [] })], lang, NOW))).toEqual([]);
    }
    expect(digestBodyViolations({ subject: "s", preheader: "p", bodyText: "milestones: 1 of 3" })).toHaveLength(1);
    expect(digestBodyViolations({ subject: "s", preheader: "p", bodyText: "40% calmer" })).toHaveLength(1);
    expect(digestBodyViolations({ subject: "s", preheader: "p", bodyText: "more than last week" })).toHaveLength(1);
    expect(digestBodyViolations({ subject: "s", preheader: "p", bodyText: "אבני דרך: 1 מתוך 3" })).toHaveLength(1);
  });

  it("the shared email renderer itself no longer states a milestone total (EN + HE)", () => {
    const stats = computeWeeklyDigestStats([], [{ title: "a", checked: true }, { title: "b", checked: false }], NOW);
    for (const language of ["en", "he"] as const) {
      const email = buildDigestEmail({ childName: "Noa", language, narrative: fallbackDigestNarrative("Noa", stats, language), stats });
      expect(digestBodyViolations(email)).toEqual([]);
    }
  });

  it("a firewall-flagged body is never sent", async () => {
    const source = new FakeSource([{ uid: "fam", row: optIn("fam@example.org") }], {
      fam: [child({ actionLoops: [{ recommendation: "Compare 3 of 5 evenings", source: "coach", status: "completed", outcome: "helped", acceptedAt: at(1) }] })],
    });
    const send = vi.fn(async () => ({ sent: true }));
    const report = await runWeeklyDigestJob({ source, resolveVerifiedEmail: verified, providerEnabled: true, send, now: NOW, dryRun: false });
    expect(report.results).toEqual({ firewall_blocked: 1 });
    expect(send).not.toHaveBeenCalled();
  });
});

describe("B-INF-02 — who may call the job", () => {
  it("no ARBOR_JOB_SA configured → nobody (fail closed), whatever the header", async () => {
    const verify = createOidcJobVerifier({}, "https://api.example/api/jobs/weekly-digest");
    expect(await verify("Bearer anything")).toBe(false);
    expect(await verify(undefined)).toBe(false);
  });

  it("a configured SA still refuses a missing or forged token", async () => {
    oidc.verify.mockRejectedValueOnce(new Error("Synthetic invalid token"));
    const verify = createOidcJobVerifier({ ARBOR_JOB_SA: "job@p.iam.gserviceaccount.com" }, "https://api.example/api/jobs/weekly-digest");
    expect(await verify(undefined)).toBe(false);
    expect(await verify("Bearer not-a-jwt")).toBe(false);
    expect(oidc.verify).toHaveBeenCalledWith({ idToken: "not-a-jwt", audience: "https://api.example/api/jobs/weekly-digest" });
  });

  it("requires the configured service account and a verified email after signature validation", async () => {
    const verify = createOidcJobVerifier({ ARBOR_JOB_SA: "job@p.iam.gserviceaccount.com" }, "https://api.example/api/jobs/weekly-digest");
    for (const [email, email_verified, allowed] of [["other@example.org", true, false], ["job@p.iam.gserviceaccount.com", false, false], ["job@p.iam.gserviceaccount.com", true, true]] as const) {
      oidc.verify.mockResolvedValueOnce({ getPayload: () => ({ email, email_verified }) });
      expect(await verify("Bearer synthetic-signed-token")).toBe(allowed);
    }
  });

  it("the Firebase auth middleware lets ONLY the job path through to the route's own check", async () => {
    expect([...JOB_API_PATHS]).toEqual(["/jobs/weekly-digest"]);
    const prev = process.env.REQUIRE_AUTH;
    process.env.REQUIRE_AUTH = "true";
    try {
      const mw = createAuthMiddleware(createTestConfig());
      const run = (p: string, method = "POST") => new Promise<number | "next">((resolve) => {
        const res = { status: (code: number) => ({ json: () => resolve(code) }) };
        void mw({ path: p, method, headers: {} } as never, res as never, () => resolve("next"));
      });
      expect(await run("/jobs/weekly-digest")).toBe("next");
      expect(await run("/jobs/weekly-digest", "GET")).toBe(401);
      expect(await run("/chat")).toBe(401);
    } finally {
      if (prev === undefined) delete process.env.REQUIRE_AUTH;
      else process.env.REQUIRE_AUTH = prev;
    }
  });
});

/* ── the route ──────────────────────────────────────────────────────────── */

let server: Server;
let base: string;
const routeSource = new FakeSource([{ uid: "fam", row: optIn("fam@example.org", "he") }], { fam: [child()] });
let callerOk = false;
const outbox: Array<{ to: string; subject: string }> = [];

beforeAll(async () => {
  const config = createTestConfig();
  const entitlementStore = createEntitlementStore(config);
  const app = express();
  app.use(express.json());
  app.use("/api", createApiRouter({
    config, modelProvider: {} as ModelProvider, memoryStore: new LocalMemoryStore(), shareStore: new LocalShareStore(),
    consentStore: new LocalConsentStore(), framework: loadFramework(), entitlementStore,
    referralStore: createReferralStore(config, entitlementStore), counters: createCounterStore(config),
    consultStore: createConsultStore(config), adminMetrics: createAdminMetricsStore(config), waitlistStore: createWaitlistStore(config),
    digestJobSource: routeSource,
    jobCallerVerifier: async () => callerOk,
    verifiedEmailResolver: verified,
    digestEmailSender: async (m) => { outbox.push({ to: m.to, subject: m.subject }); return { sent: true }; },
  }));
  await new Promise<void>((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe("B-INF-02 — POST /api/jobs/weekly-digest", () => {
  it("unauthenticated → 401 and nothing is read or sent", async () => {
    callerOk = false;
    const res = await fetch(`${base}/jobs/weekly-digest`, { method: "POST" });
    expect(res.status).toBe(401);
    expect(outbox).toEqual([]);
  });

  it("the scheduler's dry run reports counts only (provider off in tests → provider_disabled)", async () => {
    callerOk = true;
    const res = await fetch(`${base}/jobs/weekly-digest?dryRun=1`, { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ dryRun: true, considered: 1 });
    expect(JSON.stringify(body)).not.toMatch(/@|Noa|fam/);
    expect(outbox).toEqual([]);
  });
});

describe("B-INF-02 — the hand trigger is gone", () => {
  it("no window.__arborDigestSend assignment and no client send helper remain", () => {
    const src = readFileSync(path.join(__dirname, "..", "components", "weekly", "recapEmail.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(src).not.toContain("__arborDigestSend");
    expect(src).not.toContain("requestDigestEmailSend");
    expect(src).not.toContain("/api/digest/email-send");
  });
});
