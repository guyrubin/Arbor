import { describe, it, expect, beforeEach } from "vitest";
import { setAiLanguage, aiLanguageInstruction, authHeaders, setAuthTokenProvider, api } from "./api";

describe("aiLanguageInstruction", () => {
  beforeEach(() => setAiLanguage("en"));

  it("is empty for English", () => {
    setAiLanguage("en");
    expect(aiLanguageInstruction()).toBe("");
  });

  it("instructs Hebrew output when set to he", () => {
    setAiLanguage("he");
    const out = aiLanguageInstruction();
    expect(out).toContain("Hebrew");
    expect(out.length).toBeGreaterThan(0);
  });
});

describe("authHeaders", () => {
  it("always includes JSON content-type and merges extras", async () => {
    setAuthTokenProvider(async () => null);
    const h = await authHeaders({ Accept: "text/event-stream" });
    expect(h["Content-Type"]).toBe("application/json");
    expect(h.Accept).toBe("text/event-stream");
    expect(h.Authorization).toBeUndefined();
  });

  it("adds a bearer token when the provider returns one", async () => {
    setAuthTokenProvider(async () => "tok123");
    const h = await authHeaders();
    expect(h.Authorization).toBe("Bearer tok123");
  });

  it("ignores token-provider errors", async () => {
    setAuthTokenProvider(async () => {
      throw new Error("boom");
    });
    const h = await authHeaders();
    expect(h.Authorization).toBeUndefined();
  });
});

describe("api.requestAccess", () => {
  it("submits pre-auth access requests to the backend waitlist with explicit consent", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ ok: true, duplicate: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      await expect(api.requestAccess({ email: "parent@example.com", source: "login-access", market: "il" }))
        .resolves.toEqual({ ok: true, duplicate: false });
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/api/waitlist");
    expect(calls[0].init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      email: "parent@example.com",
      source: "login-access",
      market: "il",
      consent: true,
    });
  });
});
