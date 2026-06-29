import { describe, it, expect, beforeEach } from "vitest";
import { setAiLanguage, aiLanguageInstruction, authHeaders, setAuthTokenProvider } from "./api";

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
