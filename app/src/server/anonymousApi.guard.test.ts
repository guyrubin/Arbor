/**
 * B-RESID-05 — anonymous access to a private API fails.
 *
 * The real app (createApp) is built for production with REQUIRE_AUTH unset,
 * as a release that dropped the variable would run it. Every route the API
 * router registers is called without a token and must answer 401, except the
 * documented public paths (server/authMiddleware PUBLIC_API_PATHS: the
 * pre-account waitlist) and the scheduler job, which verifies its own OIDC
 * token and still refuses an anonymous caller. A route added tomorrow is
 * covered the day it is written: the list is read from the router itself.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "./createApp.js";
import { createTestConfig } from "../testConfig.js";

type Route = { method: string; path: string };

/** The API router's routes (Express 4 layer stack, mounted at /api), with
 *  the feature routers it mounts at its own root (co-parent, book assets,
 *  plans, narration). A sub-router mounted under a prefix would be missed, so
 *  the scan refuses one rather than guessing its paths. */
function apiRoutes(app: any): Route[] {
  const out: Route[] = [];
  const walk = (stack: any[]) => {
    for (const inner of stack) {
      if (inner.name === "router") {
        expect(inner.regexp.test("/"), "a sub-router mounted under a prefix: teach this scan its prefix").toBe(true);
        walk(inner.handle.stack);
        continue;
      }
      if (!inner.route) continue;
      const paths = Array.isArray(inner.route.path) ? inner.route.path : [inner.route.path];
      for (const path of paths) {
        if (typeof path !== "string") continue;
        for (const method of Object.keys(inner.route.methods)) if (method !== "_all") out.push({ method: method.toUpperCase(), path });
      }
    }
  };
  for (const layer of app._router.stack as any[]) {
    if (layer.name === "router" && layer.regexp?.test("/api/anything")) walk(layer.handle.stack);
  }
  return out;
}

const PUBLIC = new Set(["POST /waitlist"]);
const SELF_VERIFIED_JOBS = new Set(["POST /jobs/weekly-digest"]);

describe("B-RESID-05 · production refuses every private API call without a session", () => {
  let server: Server | undefined;
  let origin = "";
  let routes: Route[] = [];

  beforeAll(async () => {
    vi.stubEnv("REQUIRE_AUTH", "");
    const app = createApp(createTestConfig({ arborEnv: "prod", geminiApiKey: undefined }));
    routes = apiRoutes(app);
    server = await new Promise<Server>((resolve) => {
      const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    if (server) await new Promise<void>((resolve, reject) => server!.close((error) => (error ? reject(error) : resolve())));
  });

  it("the scan is real: the router's private routes are all found", () => {
    expect(routes.length).toBeGreaterThan(80);
    const names = new Set(routes.map((r) => `${r.method} ${r.path}`));
    for (const known of ["POST /chat", "POST /voice", "POST /generate-plan", "GET /live/availability", "POST /referral/activate", "POST /waitlist", "GET /co-parent/invitations", "POST /children/:childId/plan-narration"]) expect(names.has(known), known).toBe(true);
  });

  it("every route answers 401 to an anonymous caller (the waitlist alone is public)", async () => {
    const open: string[] = [];
    let n = 0;
    for (const { method, path } of routes) {
      const name = `${method} ${path}`;
      if (PUBLIC.has(name)) continue;
      const url = `${origin}/api${path.replace(/:[A-Za-z_]+\??/g, "x").replace(/\*/g, "x")}`;
      // A distinct client address per call keeps the per-IP limiter out of the way.
      const response = await fetch(url, {
        method,
        headers: { "content-type": "application/json", "x-forwarded-for": `10.9.${Math.floor(n / 250)}.${(n++ % 250) + 1}` },
        ...(method === "GET" || method === "HEAD" ? {} : { body: "{}" }),
      });
      const allowed = SELF_VERIFIED_JOBS.has(name) ? response.status === 401 || response.status === 403 : response.status === 401;
      if (!allowed) open.push(`${name} → ${response.status}`);
    }
    expect(open).toEqual([]);
  }, 60_000);

  it("negative control: with a non-production config and no REQUIRE_AUTH the same call is let through", async () => {
    const app = createApp(createTestConfig({ arborEnv: "local", geminiApiKey: undefined }));
    const local = await new Promise<Server>((resolve) => { const l = app.listen(0, "127.0.0.1", () => resolve(l)); });
    try {
      const response = await fetch(`http://127.0.0.1:${(local.address() as AddressInfo).port}/api/live/availability`);
      expect(response.status).not.toBe(401);
    } finally {
      await new Promise<void>((resolve) => local.close(() => resolve()));
    }
  });
});
