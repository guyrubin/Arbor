import express from "express";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ArborConfig } from "../config/env.js";

/**
 * B-DIST-01 — GET /sandbox/demo-family.json serves the bundle
 * `npm run seed:demo -- --apply` wrote to app/.data/demo-family.json, so the
 * sandbox client (lib/demoFamilyHydrate.ts) can put the invented family into
 * the same per-child storage keys the app reads.
 *
 * Mounted ONLY outside prod with the local memory adapter (the sandbox), and
 * outside /api (no auth, not on the 30/min limiter the sweep shares). In prod
 * the route does not exist at all: `createDemoFamilyRouter` returns null.
 */
export const DEMO_FAMILY_BUNDLE_PATH = path.join(process.cwd(), ".data", "demo-family.json");

export function createDemoFamilyRouter(
  config: Pick<ArborConfig, "arborEnv" | "memoryAdapter">,
  bundlePath: string = DEMO_FAMILY_BUNDLE_PATH,
): express.Router | null {
  if (config.arborEnv === "prod" || config.memoryAdapter !== "local") return null;
  const router = express.Router();
  router.get("/sandbox/demo-family.json", async (_req, res) => {
    try {
      const raw = await readFile(bundlePath, "utf8");
      res.setHeader("Cache-Control", "no-store");
      res.type("application/json").send(raw);
    } catch {
      res.status(404).json({ error: "No demo family seeded. Run `npm run seed:demo -- --apply`." });
    }
  });
  return router;
}
