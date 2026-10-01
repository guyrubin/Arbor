/**
 * /shares route bodies against the REAL router (explainRoute.test.ts harness).
 *
 * B-CAREPRO-10 — co-parent 402s:
 *  (a) a Family holder whose co-parent seat is in use gets 409 `seat_in_use`
 *      with NO upgrade object (was: 402 + Family upsell to a Family holder);
 *  (b) the Free/Plus 402 body says nothing about "your account" (a co-parent
 *      gets a read-only view of what is shared, never the account).
 *
 * The test mounts a tiny identity shim in front of the router so each request
 * can act as a different signed-in parent (x-test-uid / x-test-email).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
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

const ENV_KEYS = ["ENFORCE_ENTITLEMENTS", "ARBOR_FAMILY_UIDS"] as const;
const savedEnv: Record<string, string | undefined> = {};

let server: Server;
let baseUrl = "";

beforeAll(async () => {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  process.env.ENFORCE_ENTITLEMENTS = "true";
  process.env.ARBOR_FAMILY_UIDS = "family-parent";

  const config = createTestConfig();
  const entitlementStore = createEntitlementStore(config);
  const app = express();
  app.use(express.json());
  // identity shim — stands in for server/authMiddleware in this harness
  app.use((req, _res, next) => {
    const uid = req.header("x-test-uid");
    if (uid) {
      (req as any).user = {
        uid,
        email: req.header("x-test-email") || null,
        emailVerified: req.header("x-test-verified") === "true",
      };
    }
    next();
  });
  app.use(
    "/api",
    createApiRouter({
      config,
      modelProvider: {} as unknown as ModelProvider,
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
  await new Promise<void>((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
});

const as = (uid: string, email: string, verified = true) => ({
  "Content-Type": "application/json",
  "x-test-uid": uid,
  "x-test-email": email,
  "x-test-verified": verified ? "true" : "false",
});

const invite = async (uid: string, email: string, recipientEmail: string, role = "co_parent") => {
  const res = await fetch(`${baseUrl}/api/shares`, {
    method: "POST",
    headers: as(uid, email),
    body: JSON.stringify({ childId: `child-of-${uid}`, childName: "Dylan", recipientEmail, role, scopes: ["milestones"], duration: "30d" }),
  });
  return { status: res.status, text: await res.text() };
};

describe("B-CAREPRO-10 · /shares co-parent bodies", () => {
  it("Free → 402 for a co-parent invite, and the body never says 'your account'", async () => {
    const { status, text } = await invite("free-parent", "free@example.com", "other@example.com");
    expect(status).toBe(402);
    const body = JSON.parse(text);
    expect(body.upgrade).toEqual({ feature: "coParentSeats", plan: "family" });
    expect(text.toLowerCase()).not.toContain("your account");
    expect(body.details).toBe("Co-parent invites are part of Arbor Family.");
  });

  it("Free → a viewer share is not gated (the identical read-only view)", async () => {
    const { status } = await invite("free-parent", "free@example.com", "viewer@example.com", "viewer");
    expect(status).toBe(200);
  });

  it("Family + one live co-parent → second invite is 409 seat_in_use with no upgrade object", async () => {
    const first = await invite("family-parent", "fam@example.com", "coparent1@example.com");
    expect(first.status).toBe(200);
    const second = await invite("family-parent", "fam@example.com", "coparent2@example.com");
    expect(second.status).toBe(409);
    const body = JSON.parse(second.text);
    expect(body).toEqual({ error: "seat_in_use" });
    expect(body.upgrade).toBeUndefined();
    expect(second.text.toLowerCase()).not.toContain("your account");
  });
});

/* ── B-CAREPRO-10 client half — the seat code is not a safety escalation, and
 * the wizard points at the roster row instead of the Family paywall. */
import { vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { api, ApiError, EscalationRequiredError, SEAT_IN_USE } from "../lib/api";
import { en as lcEn, he as lcHe } from "../lib/i18nElevation/learnCare";

describe("B-CAREPRO-10 · client: seat_in_use is a hint, not a paywall or an escalation", () => {
  const stub = (status: number, body: unknown) =>
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status, headers: { get: () => null }, json: async () => body })));

  it("the 409 seat_in_use body becomes ApiError(409, seat_in_use)", async () => {
    stub(409, { error: "seat_in_use" });
    const err = await api.createShare({ childId: "c", recipientEmail: "x@example.com", role: "co_parent" }).catch((e) => e);
    vi.unstubAllGlobals();
    expect(err).toBeInstanceOf(ApiError);
    expect(err).not.toBeInstanceOf(EscalationRequiredError);
    expect(err.status).toBe(409);
    expect(err.message).toBe(SEAT_IN_USE);
  });

  it("NEGATIVE CONTROL: every other 409 still escalates", async () => {
    stub(409, { error: "Professional support recommended" });
    const err = await api.createShare({ childId: "c", recipientEmail: "x@example.com" }).catch((e) => e);
    vi.unstubAllGlobals();
    expect(err).toBeInstanceOf(EscalationRequiredError);
  });

  it("TrustedSharing: default role viewer, seat hint keyed EN + HE and pointed at the roster row", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(path.join(here, "..", "components", "sections", "TrustedSharing.tsx"), "utf8").replace(/\r\n/g, "\n");
    expect(src).toContain('const DEFAULT_ROLE: ShareRole = "viewer";');
    expect(src).not.toContain('role: "co_parent" as ShareRole');
    expect(src).toContain("e instanceof ApiError && e.status === 409 && e.message === SEAT_IN_USE");
    expect(src).toContain('t("elev.learnCare.share.seatInUse", { email: seatInUse.email })');
    expect(src).toContain("id={`share-row-${g.id}`}");
    expect(src).toContain("document.getElementById(`share-row-${seatInUse.grantId}`)");
    for (const k of ["elev.learnCare.share.seatInUse", "elev.learnCare.share.seatInUse.unnamed", "elev.learnCare.share.seatInUse.show"]) {
      expect(lcEn[k], `${k} EN`).toBeTruthy();
      expect(lcHe[k], `${k} HE`).toMatch(/[֐-׿]/);
    }
    expect(lcEn["elev.learnCare.share.seatInUse"]).toContain("{email}");
    expect(lcHe["elev.learnCare.share.seatInUse"]).toContain("{email}");
  });
});
