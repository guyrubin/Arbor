// B-GA-38 — firebase.json must never answer a removed /assets/ chunk with the app shell.
import { describe, expect, it } from "vitest";
import { ROUTE_CASES, cacheControlFor, loadHosting, resolveRewrite } from "./hosting-routes.mjs";

const hosting = loadHosting();

describe("B-GA-38 · Hosting rewrites", () => {
  it.each(ROUTE_CASES)("%s → %s", (path, expected) => {
    expect(resolveRewrite(hosting, path)).toBe(expected);
  });

  it("sends /assets/** misses to the same API service as /api/**, before the shell catch-all", () => {
    const rewrites = hosting.rewrites as Array<{ source?: string; destination?: string; run?: { serviceId: string; region: string } }>;
    const assets = rewrites.findIndex((r) => r.source === "/assets/**");
    const api = rewrites.find((r) => r.source === "/api/**");
    expect(assets).toBeGreaterThanOrEqual(0);
    expect(assets).toBeLessThan(rewrites.findIndex((r) => r.source === "**"));
    expect(rewrites[assets].run).toEqual(api?.run);
    expect(rewrites.at(-1)).toEqual({ source: "**", destination: "/index.html" });
  });

  it("keeps hashed assets immutable and the shell revalidated", () => {
    expect(cacheControlFor(hosting, "/assets/index-abc123.js")).toEqual(["public, max-age=31536000, immutable"]);
    expect(cacheControlFor(hosting, "/index.html")).toEqual(["no-cache"]);
    expect(cacheControlFor(hosting, "/")).toEqual(["no-cache"]);
  });
});
