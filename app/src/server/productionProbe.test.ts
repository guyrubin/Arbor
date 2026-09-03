import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import { createApp } from "./createApp.js";
import { createTestConfig } from "../testConfig.js";
import { validateTarget, verifyCandidate } from "../../scripts/post-deploy-smoke.mjs";

const SHA = "1234567890abcdef1234567890abcdef12345678";
const shell = () => new Response("<!doctype html><html></html>", { status: 200 });
const health = (payload: unknown = { status: "ok", version: SHA }) => Response.json(payload);

function mockFetch(second: Response | Error, first = shell()) {
  return vi.fn<typeof fetch>().mockResolvedValueOnce(first).mockImplementationOnce(async () => {
    if (second instanceof Error) throw second;
    return second;
  });
}

describe("candidate exact revision gate", () => {
  it("passes only after the shell and exact full SHA both respond", async () => {
    const fetcher = mockFetch(health());
    await expect(verifyCandidate("https://candidate.example/", SHA, fetcher)).resolves.toBe(SHA);
    expect(fetcher.mock.calls[1][0]).toBe(`https://candidate.example/api/health?release=${SHA}`);
    for (const [, options] of fetcher.mock.calls) {
      expect(options).toMatchObject({ cache: "no-store", redirect: "error" });
      expect(options?.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it.each([
    ["stale revision", () => health({ status: "ok", version: "a".repeat(40) })],
    ["missing revision", () => health({ status: "ok" })],
    ["unhealthy response", () => health({ status: "error", version: SHA })],
    ["null response", () => health(null)],
    ["ingress 404", () => new Response("Not found", { status: 404 })],
    ["HTML fallback", () => shell()],
    ["malformed JSON", () => new Response("{", { headers: { "Content-Type": "application/json" } })],
    ["network failure", () => new Error("unreachable")],
  ] as const)("blocks promotion for %s even when the shell is live", async (_label, response) => {
    await expect(verifyCandidate("https://candidate.example", SHA, mockFetch(response()))).rejects.toThrow();
  });

  it.each([
    new Response("broken", { status: 503 }),
    new Response("not an app", { status: 200 }),
    new Response("<!doctype html>", { status: 201 }),
  ])("also requires a 200 app shell", async (response) => {
    const fetcher = mockFetch(health(), response);
    await expect(verifyCandidate("https://candidate.example", SHA, fetcher)).rejects.toThrow("App shell");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, "", SHA.slice(0, 7), "dev", "g".repeat(40)])("rejects an absent or incomplete expected SHA: %s", (value) => {
    expect(() => validateTarget("https://candidate.example", value)).toThrow("full 40-character");
  });

  it.each([undefined, "", "file:///tmp/probe", "https://user:secret@example.test", "https://example.test/path", "https://example.test/?q=1", "https://example.test/#fragment"])("rejects an invalid candidate origin: %s", (value) => {
    expect(() => validateTarget(value, SHA)).toThrow();
  });

  it("keeps the full identity connected from GitHub through Cloud Run and the smoke gate", () => {
    const workflow = readFileSync(new URL("../../../.github/workflows/arbor-deploy.yml", import.meta.url), "utf8");
    const build = readFileSync(new URL("../../../cloudbuild.prod.yaml", import.meta.url), "utf8");
    expect(workflow).toContain("_REVISION=${GITHUB_SHA}");
    expect(workflow).toContain('node scripts/post-deploy-smoke.mjs "$CANDIDATE_URL" "$GITHUB_SHA"');
    expect(build).toContain("|GITHUB_SHA=${_REVISION}|");
    expect(workflow).toMatch(/promote:\s+needs: deploy-candidate/);
    expect(workflow).toContain('revision: ${{ steps.candidate.outputs.revision }}');
    expect(workflow).toContain('CANDIDATE_REVISION: ${{ needs.deploy-candidate.outputs.revision }}');
    expect(workflow).toContain('--to-revisions="$CANDIDATE_REVISION=100"');
    expect(workflow).not.toContain('--to-latest');
    expect(workflow.indexOf('echo "revision=$CANDIDATE_REVISION"')).toBeGreaterThan(workflow.indexOf('node scripts/post-deploy-smoke.mjs'));
    expect(build).not.toMatch(/^\s+_REVISION:/m);
  });
});

describe("real app public version route with auth enforced", () => {
  let server: Server | undefined;
  let origin: string;

  beforeAll(async () => {
    vi.stubEnv("REQUIRE_AUTH", "true");
    vi.stubEnv("GITHUB_SHA", SHA);
    vi.stubEnv("ARBOR_ENV", "prod");
    const app = createApp(createTestConfig({ geminiApiKey: undefined }));
    server = await new Promise<Server>((resolve) => {
      const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
  });

  it.each(["/api/health", "/healthz"])("serves only non-sensitive build identity at %s without a session", async (path) => {
    const response = await fetch(`${origin}${path}?release=${SHA}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body).toMatchObject({ status: "ok", version: SHA, env: "prod" });
    expect(Object.keys(body).sort()).toEqual(["env", "status", "ts", "version"]);
    expect(new Date(body.ts).toISOString()).toBe(body.ts);
  });

  it.each(["/api/live/availability", "/api/health/private"])("still rejects unauthenticated requests at %s", async (path) => {
    const response = await fetch(`${origin}${path}`);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: "Unauthorized" });
  });
});
