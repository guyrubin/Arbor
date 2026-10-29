/**
 * B-PROG-12 — the program pilot's admin read-out, its OWN router (mounted by
 * createApp under /api after auth), so the shared routes/api.ts stays
 * untouched. Same gate as /api/admin/cohorts: a non-admin request gets 403
 * and reads NOTHING (neither store is touched before isAdmin). Counts and
 * shares only (server/programPilot summariseProgramPilot); demo always and
 * internal by default excluded, `?includeInternal=1` puts internal back.
 */
import express from "express";
import type { ArborConfig } from "../config/env.js";
import { isAdmin } from "./admin.js";
import { logger, requestIdOf } from "./logger.js";
import { createCohortMetricsStore, type CohortMetricsStore } from "./cohortMetrics.js";
import { createProgramPilotStore, summariseProgramPilot, type ProgramPilotStore } from "./programPilot.js";
import { dayKeyOf } from "../lib/retention.js";

export interface ProgramPilotRouterDeps {
  config: ArborConfig;
  /** Injectable for tests; defaults to the Firestore/null store derived from config. */
  programPilotStore?: ProgramPilotStore;
  /** The retention rollups (cohort tags, D30); defaults like /admin/cohorts'. */
  cohortMetricsStore?: CohortMetricsStore;
}

export const createProgramPilotRouter = ({ config, programPilotStore, cohortMetricsStore }: ProgramPilotRouterDeps): express.Router => {
  const router = express.Router();
  let pilot: ProgramPilotStore | null = programPilotStore ?? null;
  let cohorts: CohortMetricsStore | null = cohortMetricsStore ?? null;
  router.get("/admin/program-pilot", async (req, res) => {
    const actor = { uid: (req as any).user?.uid || "local-sandbox", email: ((req as any).user?.email as string | null) || null };
    if (!isAdmin(actor)) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }
    try {
      pilot ??= createProgramPilotStore(config);
      cohorts ??= createCohortMetricsStore(config);
      const includeInternal = req.query.includeInternal === "1" || req.query.includeInternal === "true";
      const now = new Date();
      const [records, rollups] = await Promise.all([pilot.listEnrolmentRecords(), cohorts.listRetentionRollups()]);
      res.json(summariseProgramPilot(records, rollups, {
        asOfDay: dayKeyOf(now) ?? now.toISOString().slice(0, 10),
        includeInternal,
        mode: pilot.mode,
      }));
    } catch (error: any) {
      logger.error("Arbor Program Pilot Report Error", error, { requestId: requestIdOf(req) });
      res.status(500).json({ error: "Failed to build the program pilot report" });
    }
  });
  return router;
};
