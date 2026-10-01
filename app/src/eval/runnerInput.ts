/**
 * B-CAREPRO-12 residue — what the live judge runner (scripts/eval-judge.mts)
 * needs from a scenario's `input`, per route. One pure module so the runner
 * and a CI guard read the same rule: `npm run eval:judge -- school-handoff-v1`
 * threw at the first scenario because the runner had no /api/generate-handoff
 * branch and fell through to the coach path, which requires a parentMessage.
 * The fixture's logs/milestones were the right shape; the runner was not.
 */
import type { EvalScenario } from "./acceptance.js";

/** Routes the live runner can drive. */
export const RUNNER_ROUTES = ["/api/chat", "/api/voice", "/api/live/turn", "/api/extract-log", "/api/generate-handoff"] as const;

const DAY = 86_400_000;

/** Why the runner cannot drive this scenario, or null when it can. */
export function runnerInputError(scenario: Pick<EvalScenario, "route" | "input" | "cardId">): string | null {
  const route = scenario.route ?? "/api/chat";
  if (!(RUNNER_ROUTES as readonly string[]).includes(route)) return `has a route the runner cannot drive (${route})`;
  const input = (scenario.input ?? {}) as Record<string, unknown>;
  // live/turn and extract-log take their text as-is (empty is a scenario).
  if (route === "/api/live/turn" || route === "/api/extract-log") return null;
  if (route === "/api/generate-handoff") {
    if (!Array.isArray(input.logs)) return "has no logs input for /api/generate-handoff";
    if (input.milestones !== undefined && !Array.isArray(input.milestones)) return "has a non-array milestones input";
    return null;
  }
  // Coach-seed scenarios build the message from the card seed + followUp.
  if (scenario.cardId) return null;
  return String(input.parentMessage ?? "") ? null : "has no parentMessage/followUp input";
}

/** The body a School Brief client posts for a handoff scenario. Scenario logs
 *  carry `ageDays`; a current client sends `day` (YYYY-MM-DD), an older one
 *  (`rawTimestampsOnly`) sends the raw `timestamp`. Everything else in the log
 *  is forwarded as the scenario wrote it — the server's allow-list is what the
 *  scenario tests. Same shape as handoffRoute.test.ts's offline gate. */
export function handoffWireBody(
  input: Record<string, unknown>,
  childProfile: Record<string, unknown>,
  now: number = Date.now(),
): { childProfile: Record<string, unknown>; logs: Record<string, unknown>[]; milestones: unknown[]; audience: "teacher"; language?: string } {
  const logs = (Array.isArray(input.logs) ? input.logs : []).map((raw) => {
    const { ageDays, ...rest } = (raw ?? {}) as Record<string, unknown>;
    const ts = new Date(now - (typeof ageDays === "number" ? ageDays : 0) * DAY).toISOString();
    return input.rawTimestampsOnly ? { ...rest, timestamp: ts } : { ...rest, day: ts.slice(0, 10) };
  });
  return {
    childProfile,
    logs,
    milestones: Array.isArray(input.milestones) ? input.milestones : [],
    audience: "teacher",
    ...(typeof input.language === "string" ? { language: input.language } : {}),
  };
}
