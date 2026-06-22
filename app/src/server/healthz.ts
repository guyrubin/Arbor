import type { Request, Response } from "express";

/**
 * OPS-A1 — unauthenticated liveness + version probe.
 *
 * Mounted before the /api auth chain so a deploy can be verified from outside the
 * app (CI smoke, uptime check, `curl /healthz`) without a signed-in session — which
 * closes the "deploys go blind / can't confirm the live revision" gap. Carries NO
 * secrets and NO child data — only build/version/env identity.
 */

export interface HealthPayload {
  status: "ok";
  /** The deployed build identity. GITHUB_SHA is set by the deploy workflow;
   *  K_REVISION is auto-set by Cloud Run; "dev" locally. */
  version: string;
  env: string;
  ts: string;
}

export function buildHealthPayload(now: Date = new Date()): HealthPayload {
  return {
    status: "ok",
    version: process.env.GITHUB_SHA || process.env.K_REVISION || "dev",
    env: process.env.ARBOR_ENV || process.env.NODE_ENV || "unknown",
    ts: now.toISOString(),
  };
}

export function healthzHandler(_req: Request, res: Response): void {
  res.status(200).json(buildHealthPayload());
}
