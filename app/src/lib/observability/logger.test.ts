import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ALLOWED_FIELD_KEYS, applyAllowList, logger } from "./logger.js";
import { makeRequestContext, runWithRequestContext } from "./requestContext.js";

const TRACE_KEY = "logging.googleapis.com/trace";

/** Capture console output and parse the single JSON line each logger call emits. */
const captureLine = (fn: () => void): Record<string, unknown> => {
  const out: string[] = [];
  const log = vi.spyOn(console, "log").mockImplementation((l: string) => out.push(l));
  const err = vi.spyOn(console, "error").mockImplementation((l: string) => out.push(l));
  try {
    fn();
  } finally {
    log.mockRestore();
    err.mockRestore();
  }
  expect(out).toHaveLength(1);
  return JSON.parse(out[0]) as Record<string, unknown>;
};

describe("PII allow-list serializer (OPS-1 / GDPR-AVG load-bearing)", () => {
  const savedPid = process.env.GCP_PROJECT_ID;
  afterEach(() => {
    if (savedPid === undefined) delete process.env.GCP_PROJECT_ID;
    else process.env.GCP_PROJECT_ID = savedPid;
  });

  it("drops any field NOT on the allow-list (email, body, freetext, child name)", () => {
    const line = captureLine(() =>
      logger.info("GET /api/chat → 200", {
        requestId: "req-1",
        userUid: "uid-abc",
        // hostile / accidental PII that MUST NOT survive:
        email: "parent@example.com",
        "user.email": "parent@example.com",
        user: { email: "parent@example.com", uid: "uid-abc" },
        childName: "Maya",
        body: { utterance: "my daughter Maya bit her brother" },
        prompt: "secret prompt text",
        text: "free text",
      })
    );
    expect(line.requestId).toBe("req-1");
    expect(line.userUid).toBe("uid-abc");
    const serialized = JSON.stringify(line);
    expect(serialized).not.toContain("parent@example.com");
    expect(serialized).not.toContain("Maya");
    expect(serialized).not.toContain("secret prompt");
    expect(line).not.toHaveProperty("email");
    expect(line).not.toHaveProperty("user");
    expect(line).not.toHaveProperty("body");
    expect(line).not.toHaveProperty("prompt");
  });

  it("query-strips the request URL so ?token / ?email never leak", () => {
    const line = captureLine(() =>
      logger.info("req", {
        httpRequest: {
          requestMethod: "GET",
          requestUrl: "/api/chat?token=abc&email=parent@example.com",
          status: 200,
          latency: "0.123s",
        },
      })
    );
    const http = line.httpRequest as Record<string, unknown>;
    expect(http.requestUrl).toBe("/api/chat");
    expect(JSON.stringify(line)).not.toContain("parent@example.com");
    expect(JSON.stringify(line)).not.toContain("token=abc");
  });

  it("the emitted key set is a subset of the allow-list ∪ envelope ∪ trace keys", () => {
    const line = captureLine(() =>
      logger.info("ai.usage", {
        requestId: "r",
        userUid: "u",
        route: "coach_high_stakes",
        provider: "vertex",
        model: "claude-3-5-sonnet",
        promptTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        leakMe: "nope",
      })
    );
    const envelope = new Set(["severity", "message", "time"]);
    const allowed = new Set<string>([...ALLOWED_FIELD_KEYS, ...envelope, TRACE_KEY]);
    for (const k of Object.keys(line)) {
      expect(allowed.has(k), `unexpected key leaked: ${k}`).toBe(true);
    }
    expect(line).not.toHaveProperty("leakMe");
  });
});

describe("adversarial-fix carve-outs: errorMessage + token counts are NOT stripped", () => {
  it("keeps totalTokens / promptTokens / outputTokens on ai.usage", () => {
    const line = captureLine(() =>
      logger.info("ai.usage", { promptTokens: 100, outputTokens: 50, totalTokens: 150 })
    );
    expect(line.promptTokens).toBe(100);
    expect(line.outputTokens).toBe(50);
    expect(line.totalTokens).toBe(150);
  });

  it("keeps errorMessage and puts the stack in message for Error Reporting", () => {
    const line = captureLine(() => logger.error("boom while scoring", new Error("kaboom")));
    expect(line.severity).toBe("ERROR");
    expect(line.errorMessage).toBe("kaboom");
    expect(String(line.message)).toContain("boom while scoring");
    expect(String(line.message)).toContain("kaboom"); // stack contains the message
  });
});

describe("trace propagation onto ai.usage + error lines via requestContext", () => {
  beforeEach(() => {
    process.env.GCP_PROJECT_ID = "arbor-prod";
  });

  it("merges the active context trace id onto an info (ai.usage) line", () => {
    const ctx = makeRequestContext("req-9", "uid-x", {
      [TRACE_KEY]: "projects/arbor-prod/traces/abc",
    });
    const line = runWithRequestContext(ctx, () =>
      captureLine(() => logger.info("ai.usage", { totalTokens: 42 }))
    );
    expect(line[TRACE_KEY]).toBe("projects/arbor-prod/traces/abc");
    expect(line.totalTokens).toBe(42);
  });

  it("merges the active context trace id onto an ERROR line", () => {
    const ctx = makeRequestContext("req-9", null, {
      [TRACE_KEY]: "projects/arbor-prod/traces/def",
    });
    const line = runWithRequestContext(ctx, () =>
      captureLine(() => logger.error("handler failed", new Error("nope")))
    );
    expect(line[TRACE_KEY]).toBe("projects/arbor-prod/traces/def");
    expect(line.errorMessage).toBe("nope");
  });

  it("emits no trace key when there is no active context (startup / no tracing)", () => {
    const line = captureLine(() => logger.info("boot", { requestId: "n/a" }));
    expect(line).not.toHaveProperty(TRACE_KEY);
  });
});

describe("applyAllowList (unit)", () => {
  it("drops undefined values and unknown keys, keeps allowed", () => {
    const out = applyAllowList({ requestId: "r", userUid: undefined, secret: "x", totalTokens: 3 });
    expect(out).toEqual({ requestId: "r", totalTokens: 3 });
  });
  it("passes trace keys through verbatim", () => {
    const out = applyAllowList({ [TRACE_KEY]: "projects/p/traces/t", nope: 1 });
    expect(out[TRACE_KEY]).toBe("projects/p/traces/t");
    expect(out).not.toHaveProperty("nope");
  });
});
