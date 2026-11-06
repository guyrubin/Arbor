import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

const provider = vi.hoisted(() => ({
  verify: vi.fn(async (_raw: string | undefined): Promise<"live" | "sandbox" | "unverified" | "none"> => "live"),
}));
const identity = vi.hoisted(() => ({ verify: vi.fn() }));
vi.mock("./checkoutConfiguration.js", () => ({ verifyCheckoutLink: provider.verify }));
vi.mock("firebase-admin/auth", () => ({ getAuth: () => ({ verifyIdToken: identity.verify }) }));

import { createApp } from "./createApp.js";
import { createTestConfig } from "../testConfig.js";

// Synthetic identities and an opaque link exercise the real app/auth/checkout
// boundary. The provider adapter and Firebase token verification are the only
// external seams replaced; no purchase, provider call or Firestore write occurs.
const LINK = "https://pay.rev.cat/opaque-checkout-token";
const UID = "parent-checkout-test";
const EMAIL = "parent+checkout@example.test";
const TOKEN = "valid-checkout-test-token";
const config = createTestConfig({
  arborEnv: "prod",
  geminiApiKey: undefined,
  billingWebPurchaseLink: LINK,
  billingCurrencies: ["EUR", "ILS"],
  // A webhook test flag must never make the production checkout accept a
  // sandbox destination, even if somebody enables it in configuration.
  billingAcceptSandbox: true,
});
const servers: Server[] = [];
let origin: string;

async function start(settings = config): Promise<string> {
  const app = createApp(settings);
  const server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  servers.push(server);
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const checkout = (body: Record<string, unknown>, token: string | null = TOKEN, base = origin) =>
  fetch(`${base}/api/billing/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

beforeAll(async () => {
  // The production invariant must enforce auth even when this setting is lost.
  vi.stubEnv("REQUIRE_AUTH", "");
  origin = await start();
});

beforeEach(() => {
  provider.verify.mockReset().mockResolvedValue("live");
  identity.verify.mockReset().mockImplementation(async (token: string) => {
    if (token !== TOKEN) throw new Error("Invalid synthetic token");
    return { uid: UID, email: EMAIL, email_verified: true };
  });
  config.billingWebPurchaseLink = LINK;
  config.billingCheckoutUrls = {};
});

afterAll(async () => {
  await Promise.all(servers.map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  })));
  vi.unstubAllEnvs();
});

describe("production checkout verifies the provider before returning a payment URL", () => {
  it.each(["sandbox", "unverified", "none"] as const)("refuses %s without exposing a checkout URL", async (mode) => {
    provider.verify.mockResolvedValue(mode);
    const response = await checkout({ plan: "plus", cadence: "monthly", currency: "ILS" });
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "Checkout unavailable", code: "checkout_unavailable" });
    expect(provider.verify).toHaveBeenCalledExactlyOnceWith(LINK);
  });

  it.each([
    ["monthly", "ILS"],
    ["annual", "ILS"],
    ["monthly", "EUR"],
    ["annual", "EUR"],
  ] as const)("preserves the authenticated parent and the selected %s / %s offer after live verification", async (cadence, currency) => {
    const response = await checkout({ plan: "plus", cadence, currency, uid: "another-parent", email: "another@example.test" });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    const target = new URL(body.url);
    expect(target.origin).toBe("https://pay.rev.cat");
    expect(target.pathname).toBe(`/opaque-checkout-token/${UID}`);
    expect(target.searchParams.get("package_id")).toBe(`plus_${cadence}`);
    expect(target.searchParams.get("currency")).toBe(currency);
    expect(target.searchParams.get("email")).toBe(EMAIL);
    expect(target.hash).toBe("");
    // Only the configured base reaches the verifier: never the parent URL,
    // email, UID, or caller-supplied identity fields.
    expect(provider.verify).toHaveBeenCalledExactlyOnceWith(LINK);
    expect(identity.verify).toHaveBeenCalledExactlyOnceWith(TOKEN);
  });

  it("returns unavailable without calling the provider when no checkout is configured", async () => {
    config.billingWebPurchaseLink = undefined;
    const response = await checkout({ plan: "plus", cadence: "annual" });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: "Checkout not configured" });
    expect(provider.verify).not.toHaveBeenCalled();
  });

  it.each([
    { plan: "family", cadence: "monthly" },
    { plan: "plus", cadence: "weekly" },
  ])("rejects an unavailable plan or cadence before provider lookup: %j", async (body) => {
    const response = await checkout(body);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid plan or cadence" });
    expect(provider.verify).not.toHaveBeenCalled();
  });

  it.each([null, "invalid-synthetic-token"])("keeps production auth enforced for token %s", async (token) => {
    const response = await checkout({ plan: "plus", cadence: "monthly" }, token);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: "Unauthorized" });
    expect(provider.verify).not.toHaveBeenCalled();
  });

  it("preserves sandbox checkout in a non-production environment", async () => {
    provider.verify.mockResolvedValue("sandbox");
    const stage = await start(createTestConfig({
      arborEnv: "stage",
      geminiApiKey: undefined,
      billingWebPurchaseLink: LINK,
      billingCurrencies: ["EUR", "ILS"],
    }));
    const response = await checkout({ plan: "plus", cadence: "monthly", currency: "ILS" }, TOKEN, stage);
    expect(response.status).toBe(200);
    expect(new URL((await response.json()).url).searchParams.get("package_id")).toBe("plus_monthly");
    expect(provider.verify).not.toHaveBeenCalled();
  });
});
