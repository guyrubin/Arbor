/**
 * Verify the environment of a hosted checkout before sending a parent there.
 * RevenueCat Purchase Link tokens are opaque: a URL without `/sandbox/` can
 * still open a test-only checkout. Read the same public bootstrap metadata as
 * RevenueCat's hosted client, without sending a customer id, email or card.
 *
 * The bootstrap endpoint is a first-party hosted-client contract, not the
 * documented management REST API. Keep the adapter here, and treat changed,
 * missing or unavailable metadata as unverified, never as live.
 */
export type CheckoutMode = "live" | "sandbox" | "unverified" | "none";

const PROVIDER_ORIGIN = "https://pay.rev.cat";
const PROBE_TIMEOUT_MS = 4000;
const MAX_RESPONSE_BYTES = 32 * 1024;
const VERIFIED_CACHE_MS = 60_000;
const UNVERIFIED_CACHE_MS = 5000;
const MAX_CACHE_ENTRIES = 32;

type CacheEntry = {
  expiresAt: number;
  mode?: CheckoutMode;
  pending?: Promise<CheckoutMode>;
};
const cache = new Map<string, CacheEntry>();

/** Test seam. Forget results without letting older in-flight work restore them. */
export const resetCheckoutVerificationCache = (): void => { cache.clear(); };

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Compare provider metadata, never the Purchase Link token's spelling. */
function modeFromBootstrap(body: unknown): CheckoutMode {
  if (!object(body) || !object(body.config) || !object(body.config.store_config)) return "unverified";
  const store = body.config.store_config;
  if (store.store_type !== "rc_billing" || typeof body.api_key !== "string") return "unverified";

  // These are the public SDK key rules used by RevenueCat's hosted checkout.
  // A management secret or another provider's key is not evidence of live mode.
  const key = body.api_key;
  if (!/^rcb_[a-zA-Z0-9_.-]+$/.test(key)) return "unverified";
  const sandbox = key.startsWith("rcb_sb_");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(key.slice(sandbox ? "rcb_sb_".length : "rcb_".length))) return "unverified";
  // The returned SDK key is what the hosted client uses to select the actual
  // payment environment. `test_only` is an observed explicit veto; the optional
  // store field describes account capabilities and its other enum values are
  // not a documented public contract, so do not guess their meaning.
  if (store.environment === "test_only" && !sandbox) return "unverified";
  return sandbox ? "sandbox" : "live";
}

async function readBoundedJson(response: Response, signal: AbortSignal): Promise<unknown> {
  if (!/^application\/json\b/i.test(response.headers.get("content-type") ?? "")) throw new Error("Unexpected checkout metadata format");
  const declaredLength = Number(response.headers.get("content-length"));
  if (declaredLength > MAX_RESPONSE_BYTES || !response.body) throw new Error("Checkout metadata exceeds limit or is empty");

  const reader = response.body.getReader();
  const abort = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", abort, { once: true });
  let length = 0;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let text = "";
  try {
    while (true) {
      if (signal.aborted) throw new Error("Checkout metadata probe aborted");
      const chunk = await reader.read();
      if (signal.aborted) throw new Error("Checkout metadata probe aborted");
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > MAX_RESPONSE_BYTES) {
        abort();
        throw new Error("Checkout metadata exceeds limit");
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}

async function probe(token: string, fetcher: typeof fetch): Promise<CheckoutMode> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<CheckoutMode>((resolve) => {
    timer = setTimeout(() => { controller.abort(); resolve("unverified"); }, PROBE_TIMEOUT_MS);
  });
  try {
    const result = (async (): Promise<CheckoutMode> => {
      const response = await fetcher(`${PROVIDER_ORIGIN}/v1/checkoutportal/config/${token}`, {
        method: "GET",
        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
        signal: controller.signal,
        redirect: "error",
        credentials: "omit",
        cache: "no-store",
      });
      if (response.status !== 200 || response.redirected) return "unverified";
      return modeFromBootstrap(await readBoundedJson(response, controller.signal));
    })().catch((): CheckoutMode => "unverified");
    return await Promise.race([result, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    controller.abort();
  }
}

/**
 * Check a configured BASE link. Only RevenueCat's exact origin is fetched;
 * query parameters, fragments and user-specific paths never leave this server.
 * Stripe test links are identifiable, but a non-test-looking link alone is not
 * proof that it is an enabled live checkout, so it remains unverified.
 */
export async function verifyCheckoutLink(raw: string | undefined, fetcher: typeof fetch = fetch): Promise<CheckoutMode> {
  if (!raw?.trim()) return "none";
  let url: URL;
  try { url = new URL(raw.trim()); } catch { return "unverified"; }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return "unverified";

  if (url.hostname === "buy.stripe.com") {
    return /^\/test_[a-zA-Z0-9]+\/?$/.test(url.pathname) ? "sandbox" : "unverified";
  }
  if (url.origin !== PROVIDER_ORIGIN) return "unverified";
  if (/^\/sandbox\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname)) return "sandbox";
  const match = /^\/([a-zA-Z0-9_-]{1,200})\/?$/.exec(url.pathname);
  if (!match) return "unverified";
  const token = match[1];
  const normalized = `${PROVIDER_ORIGIN}/${token}`;
  const now = Date.now();
  const previous = cache.get(normalized);
  if (previous?.pending) return previous.pending;
  if (previous?.mode && previous.expiresAt > now) return previous.mode;

  // Expired results never authorize checkout. Bound memory and concurrent work;
  // if all slots are busy, a new configuration is unverified until one settles.
  for (const [key, entry] of cache) if (!entry.pending && entry.expiresAt <= now) cache.delete(key);
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestSettled = [...cache].find(([, entry]) => !entry.pending);
    if (!oldestSettled) return "unverified";
    cache.delete(oldestSettled[0]);
  }
  const entry: CacheEntry = { expiresAt: 0 };
  cache.set(normalized, entry);
  entry.pending = probe(token, fetcher).then((mode) => {
    if (cache.get(normalized) === entry) {
      entry.mode = mode;
      entry.expiresAt = Date.now() + (mode === "unverified" ? UNVERIFIED_CACHE_MS : VERIFIED_CACHE_MS);
      delete entry.pending;
    }
    return mode;
  });
  return entry.pending;
}
