import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCheckoutVerificationCache, verifyCheckoutLink } from "./checkoutConfiguration.js";

// Synthetic provider responses only; no real checkout token, public key or user.
const LINK = "https://pay.rev.cat/opaqueFixture";
const metadata = (environment: string | undefined = undefined, apiKey = "rcb_ch_fixture", storeType = "rc_billing") => ({
  api_key: apiKey,
  config: { store_config: { environment, store_type: storeType } },
});
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
const fetchWith = (body: unknown) => vi.fn<typeof fetch>(async () => json(body));

beforeEach(() => { resetCheckoutVerificationCache(); });
afterEach(() => { vi.useRealTimers(); resetCheckoutVerificationCache(); });

describe("hosted checkout environment verification", () => {
  it("detects an opaque sandbox link with no sandbox path from provider metadata", async () => {
    const fetcher = fetchWith(metadata("test_only", "rcb_sb_ch_fixture"));
    expect(await verifyCheckoutLink(LINK, fetcher)).toBe("sandbox");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("uses the provider's actual SDK key without guessing optional store environment values", async () => {
    expect(await verifyCheckoutLink(LINK, fetchWith(metadata()))).toBe("live");
    expect(await verifyCheckoutLink(`${LINK}Other`, fetchWith(metadata("future_capability")))).toBe("live");
    expect(await verifyCheckoutLink(`${LINK}Test`, fetchWith(metadata("future_capability", "rcb_sb_ch_fixture")))).toBe("sandbox");
  });

  it.each([
    metadata("test_only", "rcb_ch_fixture"),
    metadata(undefined, "new_key_format"),
    metadata(undefined, "sk_fixture"),
    metadata(undefined, "strp_ch_fixture"),
    metadata(undefined, "rcb_"),
    metadata("test_only", "rcb_sb_"),
    metadata(undefined, "rcb__"),
    metadata(undefined, "rcb_ch_fixture", "unknown_provider"),
    {}, { api_key: "rcb_ch_fixture", config: {} }, null, [],
  ])("does not turn conflicting, unknown or incomplete metadata into live: %j", async (body) => {
    expect(await verifyCheckoutLink(LINK, fetchWith(body))).toBe("unverified");
  });

  it("reads only the fixed public config endpoint and never sends query or identity data", async () => {
    const fetcher = fetchWith(metadata());
    expect(await verifyCheckoutLink(` ${LINK}/?email=synthetic%40example.com&package_id=plus_monthly#private `, fetcher)).toBe("live");
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe("https://pay.rev.cat/v1/checkoutportal/config/opaqueFixture");
    expect(options).toMatchObject({ method: "GET", redirect: "error", credentials: "omit", cache: "no-store" });
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(options?.headers).toEqual({ Accept: "application/json", "X-Requested-With": "XMLHttpRequest" });
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain("synthetic");
  });

  it.each([
    "https://pay.rev.cat.evil.example/token",
    "https://pay.rev.cat./token",
    "https://user:password@pay.rev.cat/token",
    "https://pay.rev.cat:444/token",
    "https://evil.example@pay.rev.cat/token",
    "https://buy.stripe.com.evil.example/test_token",
    "https://unknown.example/sandbox/token",
    "http://pay.rev.cat/token",
    "javascript:alert(1)",
    "not a URL",
    "https://pay.rev.cat/",
    "https://pay.rev.cat/token/identity",
    "https://pay.rev.cat/token/identity/checkout",
    "https://pay.rev.cat/token%2Fidentity",
    "https://pay.rev.cat//token",
  ])("rejects untrusted or non-base links without a network request: %s", async (link) => {
    const fetcher = fetchWith(metadata());
    expect(await verifyCheckoutLink(link, fetcher)).toBe("unverified");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("classifies explicitly test-only paths without guessing a replacement production URL", async () => {
    const fetcher = fetchWith(metadata());
    expect(await verifyCheckoutLink("https://pay.rev.cat/sandbox/opaqueFixture/", fetcher)).toBe("sandbox");
    expect(await verifyCheckoutLink("https://buy.stripe.com/test_012345Fixture", fetcher)).toBe("sandbox");
    expect(await verifyCheckoutLink("https://buy.stripe.com/012345Fixture", fetcher)).toBe("unverified");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("keeps missing configuration distinct from unverifiable configuration", async () => {
    const fetcher = fetchWith(metadata());
    expect(await verifyCheckoutLink(undefined, fetcher)).toBe("none");
    expect(await verifyCheckoutLink("   ", fetcher)).toBe("none");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([301, 400, 404, 429, 500, 503])("fails closed for HTTP %i", async (status) => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response("{}", { status, headers: { "Content-Type": "application/json" } }));
    expect(await verifyCheckoutLink(LINK, fetcher)).toBe("unverified");
  });

  it("fails closed for network errors, redirects, non-JSON and malformed JSON", async () => {
    const rejected = vi.fn<typeof fetch>(async () => { throw new TypeError("fetch failed"); });
    expect(await verifyCheckoutLink(`${LINK}Network`, rejected)).toBe("unverified");
    const redirected = json(metadata());
    Object.defineProperty(redirected, "redirected", { value: true });
    expect(await verifyCheckoutLink(`${LINK}Redirect`, vi.fn<typeof fetch>(async () => redirected))).toBe("unverified");
    expect(await verifyCheckoutLink(`${LINK}Html`, vi.fn<typeof fetch>(async () => new Response("<html>unavailable</html>", { headers: { "Content-Type": "text/html" } })))).toBe("unverified");
    expect(await verifyCheckoutLink(`${LINK}Json`, vi.fn<typeof fetch>(async () => new Response("{bad", { headers: { "Content-Type": "application/json" } })))).toBe("unverified");
  });

  it("bounds declared and streamed provider response size", async () => {
    const declared = vi.fn<typeof fetch>(async () => new Response("{}", { headers: { "Content-Type": "application/json", "Content-Length": "1000000" } }));
    expect(await verifyCheckoutLink(`${LINK}Declared`, declared)).toBe("unverified");
    const oversized = vi.fn<typeof fetch>(async () => json({ ...metadata(), padding: "x".repeat(40_000) }));
    expect(await verifyCheckoutLink(`${LINK}Stream`, oversized)).toBe("unverified");
  });

  it("settles after four seconds even when the fetcher never responds", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>(() => new Promise(() => undefined));
    const result = verifyCheckoutLink(LINK, fetcher);
    await vi.advanceTimersByTimeAsync(4000);
    expect(await result).toBe("unverified");
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it("also bounds a stalled response body and cancels its reader", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel });
    const fetcher = vi.fn<typeof fetch>(async () => new Response(body, { headers: { "Content-Type": "application/json" } }));
    const result = verifyCheckoutLink(LINK, fetcher);
    await vi.advanceTimersByTimeAsync(4000);
    expect(await result).toBe("unverified");
    expect(cancel).toHaveBeenCalledOnce();
  });
});

describe("checkout verification cache", () => {
  it("deduplicates concurrent probes and normalizes harmless base-link variations", async () => {
    let resolve!: (response: Response) => void;
    const fetcher = vi.fn<typeof fetch>(() => new Promise((done) => { resolve = done; }));
    const first = verifyCheckoutLink(LINK, fetcher);
    const second = verifyCheckoutLink(`${LINK}/?currency=ILS`, fetcher);
    expect(fetcher).toHaveBeenCalledOnce();
    resolve(json(metadata()));
    expect(await Promise.all([first, second])).toEqual(["live", "live"]);
    expect(await verifyCheckoutLink(LINK, fetcher)).toBe("live");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each([
    [undefined, "rcb_ch_fixture", "live"],
    ["test_only", "rcb_sb_ch_fixture", "sandbox"],
  ])("expires verified %s results after sixty seconds", async (environment, key, expected) => {
    vi.useFakeTimers();
    const fetcher = fetchWith(metadata(environment, key));
    expect(await verifyCheckoutLink(LINK, fetcher)).toBe(expected);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(await verifyCheckoutLink(LINK, fetcher)).toBe(expected);
    expect(fetcher).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(await verifyCheckoutLink(LINK, fetcher)).toBe(expected);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("retries unverified results after five seconds and never reuses expired live evidence", async () => {
    vi.useFakeTimers();
    const fetcher = fetchWith(metadata());
    expect(await verifyCheckoutLink(LINK, fetcher)).toBe("live");
    fetcher.mockRejectedValue(new Error("network unavailable"));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await verifyCheckoutLink(LINK, fetcher)).toBe("unverified");
    expect(fetcher).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(4999);
    expect(await verifyCheckoutLink(LINK, fetcher)).toBe("unverified");
    expect(fetcher).toHaveBeenCalledTimes(2);
    fetcher.mockImplementation(async () => json(metadata()));
    await vi.advanceTimersByTimeAsync(1);
    expect(await verifyCheckoutLink(LINK, fetcher)).toBe("live");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("bounds cache size and does not mix provider results between configured tokens", async () => {
    const fetcher = fetchWith(metadata());
    for (let i = 0; i < 33; i++) expect(await verifyCheckoutLink(`${LINK}${i}`, fetcher)).toBe("live");
    fetcher.mockImplementation(async () => json(metadata("test_only", "rcb_sb_ch_fixture")));
    expect(await verifyCheckoutLink(`${LINK}0`, fetcher)).toBe("sandbox");
    expect(fetcher).toHaveBeenCalledTimes(34);
  });

  it("bounds simultaneous probes while retaining deduplication of active requests", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>(() => new Promise(() => undefined));
    const requests = Array.from({ length: 32 }, (_, i) => verifyCheckoutLink(`${LINK}${i}`, fetcher));
    expect(await verifyCheckoutLink(`${LINK}overflow`, fetcher)).toBe("unverified");
    const duplicate = verifyCheckoutLink(`${LINK}0`, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(32);
    await vi.advanceTimersByTimeAsync(4000);
    expect(await Promise.all([...requests, duplicate])).toEqual(Array(33).fill("unverified"));
  });
});
