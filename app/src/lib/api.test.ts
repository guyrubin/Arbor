import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setAiLanguage, aiLanguageInstruction, authHeaders, setAuthTokenProvider, api, EscalationRequiredError } from "./api";

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

// DUX-032: a 409 is the server-side escalation screen firing. The api layer must
// surface it as a typed EscalationRequiredError (never a generic Error) so the
// escalation UI cannot be missed by fragile message substring-matching.
describe("EscalationRequiredError (DUX-032)", () => {
  const withFetch = async (impl: typeof fetch, run: () => Promise<void>) => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = impl;
    try {
      await run();
    } finally {
      globalThis.fetch = originalFetch;
    }
  };

  it("throws a typed EscalationRequiredError on the bedtime-story escalation 409", async () => {
    // Exact body shape from routes/api.ts /generate-bedtime-story.
    const body = {
      error: "Professional support recommended",
      details:
        "Today's logged events may require professional or urgent assessment before Arbor generates a bedtime story. Category: self-harm.",
      escalationCategory: "self-harm",
    };
    await withFetch(
      (async () =>
        new Response(JSON.stringify(body), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        })) as typeof fetch,
      async () => {
        const err = await api
          .generateBedtimeStory({ childName: "Mia", age: 4, dayEvents: [{ description: "x" }] })
          .then(
            () => null,
            (e: unknown) => e
          );
        expect(err).toBeInstanceOf(EscalationRequiredError);
        const esc = err as EscalationRequiredError;
        expect(esc.status).toBe(409);
        expect(esc.code).toBe("ESCALATION_REQUIRED");
        expect(esc.category).toBe("self-harm");
        // Message is the server `details` verbatim, so legacy substring checks
        // downstream behave exactly as before.
        expect(esc.message).toBe(body.details);
      }
    );
  });

  it("still types a 409 whose body lacks the escalation marker (never fires less often)", async () => {
    await withFetch(
      (async () => new Response("conflict", { status: 409 })) as typeof fetch,
      async () => {
        const err = await api
          .generateBedtimeStory({ childName: "Mia", age: 4, dayEvents: [{ description: "x" }] })
          .then(
            () => null,
            (e: unknown) => e
          );
        expect(err).toBeInstanceOf(EscalationRequiredError);
        expect((err as EscalationRequiredError).category).toBeUndefined();
      }
    );
  });

  // Source-contract assertions (node env, no jsdom — same style as
  // TrustPanel.test.ts): the tab must reach the escalation UI state from BOTH
  // the typed error and the deprecated legacy substrings.
  describe("BedtimeStoriesTab escalation branch", () => {
    const tab = readFileSync(
      resolve(process.cwd(), "src", "components", "tabs", "BedtimeStoriesTab.tsx"),
      "utf8"
    );

    it("branches on the typed error first (typed path → escalation UI state)", () => {
      expect(tab).toContain("err instanceof EscalationRequiredError");
      const typedIdx = tab.indexOf("err instanceof EscalationRequiredError");
      const legacyIdx = tab.indexOf('message.includes("Professional support recommended")');
      expect(typedIdx).toBeGreaterThan(-1);
      expect(legacyIdx).toBeGreaterThan(typedIdx);
    });

    it("keeps BOTH deprecated substring fallbacks (legacy path → escalation UI state)", () => {
      expect(tab).toContain('message.includes("Professional support recommended")');
      expect(tab).toContain('message.includes("409")');
    });

    it("every escalation branch sets the escalated UI state", () => {
      // The three conditions are OR'd into ONE branch whose body is setEscalated(true),
      // so no path can bypass the escalation wall.
      expect(tab).toMatch(
        /err instanceof EscalationRequiredError \|\|[\s\S]{0,300}message\.includes\("Professional support recommended"\) \|\|\s*message\.includes\("409"\)\s*\)\s*\{\s*setEscalated\(true\);/
      );
    });
  });
});
