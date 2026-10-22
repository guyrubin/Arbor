import type { ArborConfig } from "../config/env.js";

/**
 * B-GA-13: a web subscriber's own way out. "Manage subscription" asks
 * RevenueCat API v2 for a single-use link to that parent's Web Billing customer
 * portal, where they cancel (access runs to the end of the paid period) or
 * update their card. Without it a web subscription had no cancel path in Arbor,
 * while the paywall says "Cancel anytime."
 *
 * Needs a v2 secret key (`REVENUECAT_API_KEY`, `sk_…`) with Customer
 * information: read. The project id comes from `REVENUECAT_PROJECT_ID`, or is
 * looked up once with Project configuration: read. Any failure returns null and
 * the caller falls back; the key and the link are never logged.
 */

const API = "https://api.revenuecat.com/v2";

export type PortalFetch = (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<any>;
}>;

interface RcSubscription {
  id?: string;
  store?: string;
  gives_access?: boolean;
  current_period_ends_at?: number | null;
}

/** Web Billing is `rc_billing` in API v2; a Stripe Billing subscription has its
 *  own portal, which `BILLING_MANAGE_URL` names. */
const WEB_BILLING = "rc_billing";

let projectCache: { key: string; id: string } | null = null;

/** Test seam: forget the looked-up project id. */
export const resetRevenueCatProjectCache = () => {
  projectCache = null;
};

const call = async (fetcher: PortalFetch, key: string, path: string, what: string): Promise<any> => {
  const res = await fetcher(`${API}${path}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  // The path carries the uid; the message names only the step.
  if (!res.ok) throw new Error(`RevenueCat ${what} answered ${res.status}`);
  return res.json();
};

const projectId = async (config: Pick<ArborConfig, "revenuecatProjectId">, key: string, fetcher: PortalFetch): Promise<string> => {
  if (config.revenuecatProjectId) return config.revenuecatProjectId;
  if (projectCache?.key === key) return projectCache.id;
  const body = await call(fetcher, key, "/projects?limit=2", "project lookup");
  const items: Array<{ id?: string }> = Array.isArray(body?.items) ? body.items : [];
  if (items.length !== 1 || !items[0].id) throw new Error(`RevenueCat project lookup found ${items.length} projects; set REVENUECAT_PROJECT_ID`);
  projectCache = { key, id: items[0].id };
  return items[0].id;
};

/** The subscription a parent means by "my subscription": a Web Billing one that
 *  still gives access, else the one whose period ends last. */
export const pickWebSubscription = (items: RcSubscription[]): RcSubscription | null => {
  const web = items.filter((item) => String(item.store ?? "").toLowerCase() === WEB_BILLING && item.id);
  if (web.length === 0) return null;
  const ends = (item: RcSubscription) => item.current_period_ends_at ?? 0;
  return [...web].sort((a, b) => Number(Boolean(b.gives_access)) - Number(Boolean(a.gives_access)) || ends(b) - ends(a))[0];
};

export const webManagementUrl = async (
  config: Pick<ArborConfig, "revenuecatApiKey" | "revenuecatProjectId">,
  uid: string,
  fetcher: PortalFetch = fetch as unknown as PortalFetch,
): Promise<string | null> => {
  const key = config.revenuecatApiKey;
  if (!key || !uid) return null;
  const project = encodeURIComponent(await projectId(config, key, fetcher));
  const list = await call(fetcher, key, `/projects/${project}/customers/${encodeURIComponent(uid)}/subscriptions?limit=20`, "subscription list");
  const subscription = pickWebSubscription(Array.isArray(list?.items) ? list.items : []);
  if (!subscription?.id) return null;
  const link = await call(
    fetcher,
    key,
    `/projects/${project}/subscriptions/${encodeURIComponent(subscription.id)}/authenticated_management_url`,
    "management link",
  );
  const url = typeof link?.management_url === "string" ? link.management_url : null;
  if (!url) return null;
  const parsed = new URL(url);
  return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.toString() : null;
};
