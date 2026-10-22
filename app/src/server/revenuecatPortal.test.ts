import { beforeEach, describe, expect, it, vi } from "vitest";
import { pickWebSubscription, resetRevenueCatProjectCache, webManagementUrl, type PortalFetch } from "./revenuecatPortal.js";

const KEY = "sk_test_portal_key";
const UID = "parent-uid-123";
const LINK = "https://billing.revenuecat.com/manage?token=one-time";

const answer = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

/** Answers each RevenueCat path in order; records what was asked. */
function rc(...answers: Array<ReturnType<typeof answer>>) {
  return vi.fn<PortalFetch>(async () => {
    const next = answers.shift();
    if (!next) throw new Error("unexpected RevenueCat call");
    return next;
  });
}

const webSub = (over: Record<string, unknown> = {}) => ({ id: "sub_web", store: "rc_billing", gives_access: true, current_period_ends_at: 2_000, ...over });

describe("B-GA-13: a web subscriber gets their own cancel link", () => {
  beforeEach(() => resetRevenueCatProjectCache());

  it("without a key it asks RevenueCat nothing and returns null", async () => {
    const fetcher = rc();
    await expect(webManagementUrl({}, UID, fetcher)).resolves.toBeNull();
    await expect(webManagementUrl({ revenuecatApiKey: KEY }, "", fetcher)).resolves.toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns the single-use portal link for the parent's web subscription", async () => {
    const fetcher = rc(answer({ items: [webSub()] }), answer({ object: "authenticated_management_url", management_url: LINK }));
    await expect(webManagementUrl({ revenuecatApiKey: KEY, revenuecatProjectId: "proj1" }, UID, fetcher)).resolves.toBe(LINK);
    const [list, link] = fetcher.mock.calls;
    expect(list[0]).toBe(`https://api.revenuecat.com/v2/projects/proj1/customers/${UID}/subscriptions?limit=20`);
    expect(link[0]).toBe("https://api.revenuecat.com/v2/projects/proj1/subscriptions/sub_web/authenticated_management_url");
    for (const [, init] of fetcher.mock.calls) {
      expect(init.headers.Authorization).toBe(`Bearer ${KEY}`);
      expect(init.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it("looks the project up once per key when no project id is set", async () => {
    const fetcher = rc(
      answer({ items: [{ id: "proj_found" }] }),
      answer({ items: [webSub()] }),
      answer({ management_url: LINK }),
      answer({ items: [webSub()] }),
      answer({ management_url: LINK }),
    );
    await webManagementUrl({ revenuecatApiKey: KEY }, UID, fetcher);
    await webManagementUrl({ revenuecatApiKey: KEY }, UID, fetcher);
    const paths = fetcher.mock.calls.map(([url]) => url);
    expect(paths.filter((url) => url.endsWith("/projects?limit=2"))).toHaveLength(1);
    expect(paths[1]).toContain("/projects/proj_found/customers/");
  });

  it("refuses to guess between several projects", async () => {
    const fetcher = rc(answer({ items: [{ id: "a" }, { id: "b" }] }));
    await expect(webManagementUrl({ revenuecatApiKey: KEY }, UID, fetcher)).rejects.toThrow("set REVENUECAT_PROJECT_ID");
  });

  it("returns null for a parent with no web subscription (store or none)", async () => {
    const fetcher = rc(answer({ items: [{ id: "sub_ios", store: "app_store", gives_access: true }] }));
    await expect(webManagementUrl({ revenuecatApiKey: KEY, revenuecatProjectId: "p" }, UID, fetcher)).resolves.toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each(["http://billing.revenuecat.com/manage", "https://user:pw@billing.revenuecat.com/manage", "", null])(
    "never hands the parent an unsafe or empty link: %s",
    async (management_url) => {
      const fetcher = rc(answer({ items: [webSub()] }), answer({ management_url }));
      await expect(webManagementUrl({ revenuecatApiKey: KEY, revenuecatProjectId: "p" }, UID, fetcher)).resolves.toBeNull();
    },
  );

  it("names the failed step without the uid or the key", async () => {
    const fetcher = rc(answer({ message: "nope" }, 403));
    const error = await webManagementUrl({ revenuecatApiKey: KEY, revenuecatProjectId: "p" }, UID, fetcher).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("RevenueCat subscription list answered 403");
    expect((error as Error).message).not.toContain(UID);
    expect((error as Error).message).not.toContain(KEY);
  });
});

describe("which subscription a parent means", () => {
  it("prefers the web subscription that still gives access, then the latest period", () => {
    expect(pickWebSubscription([
      webSub({ id: "old", gives_access: false, current_period_ends_at: 9_000 }),
      webSub({ id: "live", gives_access: true, current_period_ends_at: 1_000 }),
      { id: "ios", store: "app_store", gives_access: true, current_period_ends_at: 99_000 },
    ])?.id).toBe("live");
    expect(pickWebSubscription([
      webSub({ id: "a", gives_access: false, current_period_ends_at: 1_000 }),
      webSub({ id: "b", gives_access: false, current_period_ends_at: 5_000 }),
    ])?.id).toBe("b");
    expect(pickWebSubscription([{ store: "rc_billing" }, { id: "x", store: "play_store" }])).toBeNull();
  });
});
