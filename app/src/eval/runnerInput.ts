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
export const RUNNER_ROUTES = ["/api/chat", "/api/voice", "/api/live/turn", "/api/extract-log", "/api/generate-handoff", "/api/todays-focus"] as const;

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
  // B-TODAY-24 (today-focus-v1): the step card's route posts the child and
  // the client's signals; approved facts / a sibling seed are SEEDED through
  // the real memory seam by the runner, never posted.
  if (route === "/api/todays-focus") {
    const cp = input.childProfile as Record<string, unknown> | undefined;
    if (!cp || typeof cp !== "object" || !String(cp.id ?? "")) return "has no childProfile.id input for /api/todays-focus";
    const sig = input.signals as Record<string, unknown> | undefined;
    if (!sig || typeof sig !== "object" || !Number.isFinite(Number(sig.count))) return "has no signals.count input for /api/todays-focus";
    if (input.approvedFacts !== undefined && !Array.isArray(input.approvedFacts)) return "has a non-array approvedFacts input";
    if (input.ledger !== undefined && !Array.isArray(input.ledger)) return "has a non-array ledger input";
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

/** The body Today's step card posts to /api/todays-focus for a scenario
 *  (same shape as routes/todaysFocus.test.ts's postFocus): the scenario's own
 *  child, its signals, and the language. The client sends its newest RATED
 *  step as lastActionRecommendation/lastActionOutcome (the server prefers the
 *  ledger it can read through CompanionContext and falls back to these), so a
 *  scenario `ledger` rides in that way. Approved facts are never posted — the
 *  runner seeds them through the propose→approve seam. */
export function todaysFocusWireBody(
  input: Record<string, unknown>,
  fallbackProfile: Record<string, unknown>,
): {
  childProfile: Record<string, unknown>;
  signals: { count: number; topTrigger?: string; lastActionRecommendation?: string; lastActionOutcome?: string };
  language: "en" | "he";
} {
  const cp = input.childProfile && typeof input.childProfile === "object" ? (input.childProfile as Record<string, unknown>) : fallbackProfile;
  const sig = (input.signals ?? {}) as Record<string, unknown>;
  const rated = (Array.isArray(input.ledger) ? input.ledger : [])
    .map((e) => (e ?? {}) as Record<string, unknown>)
    .filter((e) => typeof e.recommendation === "string" && ["helped", "somewhat", "not_today"].includes(String(e.outcome)));
  const last = rated[rated.length - 1];
  return {
    childProfile: cp,
    signals: {
      count: Number(sig.count) || 0,
      ...(typeof sig.topTrigger === "string" ? { topTrigger: sig.topTrigger } : {}),
      ...(last ? { lastActionRecommendation: String(last.recommendation), lastActionOutcome: String(last.outcome) } : {}),
    },
    language: input.language === "he" ? "he" : "en",
  };
}
