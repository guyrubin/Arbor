/**
 * B-RESID-05 — share → activation, end to end through the real handlers, with
 * synthetic accounts only:
 *   sharer's GET /api/referral/code → the weekly invite's send path with no OS
 *   sheet (lib/share shareInviteLink: caption + attributed link copied) →
 *   the recipient lands on that link (lib/attribution captureAttribution),
 *   survives the sign-in round trip, and activates with the first plan
 *   (lib/referralActivation → POST /api/referral/activate) →
 *   the events the client wrote (lib/analytics track, Firestore faked) are
 *   read through the cohort store's egress projection → GET
 *   /api/admin/cohorts counts the chain in funnels.share, with no child data.
 */
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

// The client's analytics sink: capture each event document it writes.
const written = vi.hoisted(() => [] as { path: string; doc: { event: string; props: Record<string, unknown> } }[]);
vi.mock("firebase/firestore", () => ({
  addDoc: (ref: { path: string }, doc: { event: string; props: Record<string, unknown> }) => { written.push({ path: ref.path, doc }); return Promise.resolve(); },
  collection: (_db: unknown, p: string) => ({ path: p }),
  serverTimestamp: () => "SERVER_TS",
}));
vi.mock("../lib/firebase", () => ({ firebaseEnabled: true, db: {}, auth: null }));

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
import { FUNNEL_CHAINS, projectEventProps, scanForbiddenKeys, type CohortEventDoc, type CohortMetricsStore } from "./cohortMetrics.js";
import * as reportScript from "../../scripts/cohort-report.mjs";
import { setAnalyticsUser, setGlobalProps } from "../lib/analytics";
import { setAnalyticsOptOut } from "../lib/analyticsOptOut";
import { attributionProps, captureAttribution, loadAttribution } from "../lib/attribution";
import { shareInviteLink } from "../lib/share";
import { activateCapturedReferral } from "../lib/referralActivation";
import { translate } from "../lib/i18n";

/** The cohort store over what the client wrote, projected at the egress as the real store does. */
class WrittenEventsStore implements CohortMetricsStore {
  readonly mode = "firestore" as const;
  async listRetentionRollups() { return []; }
  async listEvents(): Promise<CohortEventDoc[]> {
    return written.map(({ path, doc }) => ({ uid: path.split("/")[1], event: doc.event, at: new Date().toISOString(), props: projectEventProps(doc.props, doc.event) }));
  }
}

/** One device: its own storage, the URL it is on, its referrer. */
function onDevice(storage: Map<string, string>, href: string, referrer = "") {
  const u = new URL(href);
  vi.stubGlobal("localStorage", { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => void storage.set(k, v), removeItem: (k: string) => void storage.delete(k) });
  vi.stubGlobal("location", { search: u.search, pathname: u.pathname, hostname: u.hostname, href });
  vi.stubGlobal("document", { documentElement: { lang: "en" }, referrer });
}

const servers: Server[] = [];
afterAll(async () => { await Promise.all(servers.map((s) => new Promise<void>((r) => s.close(() => r())))); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); written.length = 0; });

async function startApi() {
  const config = createTestConfig();
  const entitlementStore = createEntitlementStore(config);
  const app = express();
  app.use(express.json());
  // Synthetic accounts: the test names the signed-in uid per request.
  app.use((req, _res, next) => { (req as any).user = { uid: String(req.header("x-test-uid") || ""), email: null }; next(); });
  app.use("/api", createApiRouter({
    config,
    modelProvider: { generateJson: async () => ({}) } as unknown as ModelProvider,
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
    cohortMetricsStore: new WrittenEventsStore(),
  }));
  const server = await new Promise<Server>((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  servers.push(server);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const as = (uid: string) => ({
    get: async (p: string) => (await fetch(`${base}${p}`, { headers: { "x-test-uid": uid } })).json(),
    post: async (p: string, body: unknown) => (await fetch(`${base}${p}`, { method: "POST", headers: { "x-test-uid": uid, "content-type": "application/json" }, body: JSON.stringify(body) })).json(),
  });
  return { as };
}

describe("B-RESID-05 · share → activation is measurable end to end, without child data", () => {
  it("one invite sent without an OS sheet, one family activated: funnels.share counts 1 → 1", async () => {
    vi.stubEnv("ARBOR_ADMIN_UIDS", "founder-uid");
    const { as } = await startApi();

    // ── the sharer, on their own device, came to Arbor directly ──
    const sharerDevice = new Map<string, string>();
    onDevice(sharerDevice, "https://arborparentingapp.com/#/weekly");
    captureAttribution();
    setGlobalProps(() => attributionProps(loadAttribution()));
    setAnalyticsUser(() => "sharer-uid");
    await setAnalyticsOptOut("sharer-uid", false, null);
    const { link, code } = await as("sharer-uid").get("/referral/code");
    expect(link).toBe(`http://localhost:3000/?ref=${encodeURIComponent(code)}`);
    const pasted: string[] = [];
    const sent = await shareInviteLink(
      { link, caption: translate("en", "set.referral.shareText"), surface: "weekly_invite", mode: "share" },
      { share: undefined as unknown as Navigator["share"], clipboard: { writeText: async (text: string) => { pasted.push(text); } } as unknown as Clipboard },
    );
    expect(sent).toBe("copied");
    const [caption, sharedLink] = pasted[0].split("\n");
    expect(caption).toBe(translate("en", "set.referral.shareText"));
    expect(new URL(sharedLink).searchParams.get("ref")).toBe(code);

    // ── the recipient opens the pasted link on another device ──
    const recipientDevice = new Map<string, string>();
    onDevice(recipientDevice, sharedLink, "https://wa.me/");
    const landing = captureAttribution();
    expect(landing).toMatchObject({ referralCode: code, source: "share", utmMedium: "invite", utmCampaign: "organic_share" });
    // Sign-in brings them back without the query; first touch holds.
    onDevice(recipientDevice, "http://localhost:3000/#/overview");
    expect(captureAttribution()).toEqual(landing);
    setGlobalProps(() => attributionProps(loadAttribution()));
    setAnalyticsUser(() => "recipient-uid");
    await setAnalyticsOptOut("recipient-uid", false, null);
    // The family's first plan activates the referral through the real route.
    const refreshed = vi.fn();
    const activate = (c: string) => as("recipient-uid").post("/referral/activate", { code: c });
    await expect(activateCapturedReferral({ activate, onActivated: refreshed })).resolves.toBe("activated");
    expect(refreshed).toHaveBeenCalledOnce();
    // A second plan on this device, and a second POST from another device, add nothing.
    await expect(activateCapturedReferral({ activate })).resolves.toBe("already_here");
    recipientDevice.delete("arbor.referralActivated");
    await expect(activateCapturedReferral({ activate })).resolves.toBe("not_activated");
    expect((await as("sharer-uid").get("/referral/code")).earnedMonths).toBe(1);
    expect((await as("recipient-uid").get("/entitlement")).plan).not.toBe("free");

    // ── what the client wrote: names, ids and attribution only ──
    const chain = written.map(({ path, doc }) => [path, doc.event, doc.props.artifact ?? doc.props.role ?? null]);
    expect(chain).toEqual([
      ["users/sharer-uid/events", "share_initiated", "invite"],
      ["users/sharer-uid/events", "share_completed", "invite"],
      ["users/sharer-uid/events", "invite_sent", null],
      ["users/recipient-uid/events", "invite_activated", "referred"],
    ]);
    const allowed = new Set(["artifact", "surface", "channel", "role", "market", "source", "referral_code", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]);
    for (const { doc } of written) for (const key of Object.keys(doc.props)) expect(allowed.has(key), key).toBe(true);

    // ── the founder's cohort read counts the chain ──
    const report = await as("founder-uid").get("/admin/cohorts");
    const totals = Object.fromEntries(FUNNEL_CHAINS.share.map((stage) => [stage, 0]));
    for (const row of report.funnels.share) for (const s of row.stages) totals[s.stage] += s.count;
    expect(totals).toEqual({ share_completed: 1, invite_activated: 1 });
    expect(report.funnels.share.find((row: { key: string }) => row.key === "share").stages).toEqual([{ stage: "share_completed", count: 0 }, { stage: "invite_activated", count: 1 }]);
    expect(scanForbiddenKeys(report)).toEqual([]);
    expect(JSON.stringify(report)).not.toContain(code);
    expect(JSON.stringify(report)).not.toMatch(/sharer-uid|recipient-uid/);
  });

  it("the share chain is one definition: server and the cohort-report script agree", () => {
    expect([...FUNNEL_CHAINS.share]).toEqual(["share_completed", "invite_activated"]);
    expect(reportScript.FUNNEL_CHAINS.share).toEqual([...FUNNEL_CHAINS.share]);
  });

  it("negative control: a share whose recipient never activates counts 1 → 0", async () => {
    vi.stubEnv("ARBOR_ADMIN_UIDS", "founder-uid");
    const { as } = await startApi();
    onDevice(new Map(), "https://arborparentingapp.com/");
    captureAttribution();
    setGlobalProps(() => attributionProps(loadAttribution()));
    setAnalyticsUser(() => "sharer-uid");
    await setAnalyticsOptOut("sharer-uid", false, null);
    const { link } = await as("sharer-uid").get("/referral/code");
    await shareInviteLink({ link, caption: "c", surface: "weekly_invite", mode: "share" }, { share: async () => undefined, clipboard: undefined as unknown as Clipboard });
    const report = await as("founder-uid").get("/admin/cohorts");
    const totals = Object.fromEntries(FUNNEL_CHAINS.share.map((stage) => [stage, 0]));
    for (const row of report.funnels.share) for (const s of row.stages) totals[s.stage] += s.count;
    expect(totals).toEqual({ share_completed: 1, invite_activated: 0 });
  });
});
