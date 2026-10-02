/**
 * B-CAREPRO-12 residue — every scenario of every pinned suite has an input
 * shape the live judge runner can drive. `npm run eval:judge --
 * school-handoff-v1` threw at its first scenario ("has no parentMessage/
 * followUp input") because the runner had no /api/generate-handoff branch.
 * The rule lives in src/eval/runnerInput.ts and the runner calls it.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handoffWireBody, runnerInputError, todaysFocusWireBody } from "./runnerInput";
import type { EvalSuite } from "./acceptance";

const here = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(here, "..", "..");
const EVALS = path.resolve(APP, "..", "evals");
const suites = readdirSync(EVALS)
  .filter((f) => f.endsWith(".eval.json"))
  .map((f) => JSON.parse(readFileSync(path.join(EVALS, f), "utf8")) as EvalSuite);

describe("every pinned scenario is drivable by the live runner", () => {
  it("the scan read the suites (school-handoff-v1 among them)", () => {
    expect(suites.length).toBeGreaterThanOrEqual(6);
    expect(suites.map((s) => s.suite)).toContain("school-handoff-v1");
  });

  for (const suite of suites) {
    it(`${suite.suite}: 0 scenarios the runner would throw on`, () => {
      const bad = suite.scenarios.map((sc) => [sc.id, runnerInputError(sc)]).filter(([, e]) => e !== null);
      expect(bad).toEqual([]);
    });
  }

  it("NEGATIVE CONTROL: a coach scenario without a message, a handoff scenario without logs, an unknown route", () => {
    expect(runnerInputError({ route: "/api/chat", input: {} })).toMatch(/parentMessage/);
    expect(runnerInputError({ route: "/api/generate-handoff", input: { milestones: [] } })).toMatch(/logs/);
    expect(runnerInputError({ route: "/api/explain", input: { parentMessage: "x" } })).toMatch(/cannot drive/);
    // before the handoff branch, the handoff scenario was judged by the coach rule:
    const handoff = suites.find((s) => s.suite === "school-handoff-v1")!.scenarios.find((s) => s.id === "handoff-allowlist-strips-notes-en")!;
    expect(runnerInputError({ ...handoff, route: "/api/chat" })).toMatch(/parentMessage/);
  });
});

describe("the handoff wire body is what a School Brief client posts", () => {
  const now = Date.parse("2026-10-01T12:00:00.000Z");
  const profile = { id: "eval-x", name: "Mia" };

  it("ageDays becomes day (current client); notes etc. are forwarded as written — the server's allow-list is under test", () => {
    const body = handoffWireBody({ logs: [{ behaviorType: "T", notes: "PRIVATE", ageDays: 2 }], milestones: [{ domain: "language", title: "x" }] }, profile, now);
    expect(body.logs).toEqual([{ behaviorType: "T", notes: "PRIVATE", day: "2026-09-29" }]);
    expect(body.milestones).toEqual([{ domain: "language", title: "x" }]);
    expect(body).toMatchObject({ childProfile: profile, audience: "teacher" });
    expect(body).not.toHaveProperty("language");
  });

  it("rawTimestampsOnly sends the timestamp (older client); language rides through", () => {
    const body = handoffWireBody({ rawTimestampsOnly: true, language: "he", logs: [{ behaviorType: "T", ageDays: 1 }] }, profile, now);
    expect(body.logs).toEqual([{ behaviorType: "T", timestamp: "2026-09-30T12:00:00.000Z" }]);
    expect(body.language).toBe("he");
  });

  it("B-TODAY-24: a todays-focus scenario needs the child and signals.count; the wire body is what Today posts", () => {
    expect(runnerInputError({ route: "/api/todays-focus", input: { signals: { count: 1 } } })).toMatch(/childProfile/);
    expect(runnerInputError({ route: "/api/todays-focus", input: { childProfile: { id: "c" } } })).toMatch(/signals\.count/);
    expect(runnerInputError({ route: "/api/todays-focus", input: { childProfile: { id: "c" }, signals: { count: 0 } } })).toBeNull();
    const body = todaysFocusWireBody(
      {
        childProfile: { id: "eval-c3", name: "Maya", age: 5 },
        signals: { count: 3, topTrigger: "bedtime" },
        ledger: [{ recommendation: "Use a two-minute sand timer", status: "completed", outcome: "not_today" }],
        approvedFacts: ["NEVER POSTED"],
        language: "he",
      },
      profile,
    );
    expect(body).toEqual({
      childProfile: { id: "eval-c3", name: "Maya", age: 5 },
      signals: { count: 3, topTrigger: "bedtime", lastActionRecommendation: "Use a two-minute sand timer", lastActionOutcome: "not_today" },
      language: "he",
    });
    expect(JSON.stringify(body)).not.toContain("NEVER POSTED");
    const runner = readFileSync(path.join(APP, "scripts", "eval-judge.mts"), "utf8").replace(/\r\n/g, "\n");
    expect(runner).toMatch(/if \(route === "\/api\/todays-focus"\) \{[\s\S]{0,900}todaysFocusWireBody\(input, scenarioProfile\)[\s\S]{0,900}seedApprovedMemory\(baseUrl, sibling\.childId/);
  });

  it("the runner calls the rule and has the handoff branch", () => {
    const runner = readFileSync(path.join(APP, "scripts", "eval-judge.mts"), "utf8").replace(/\r\n/g, "\n");
    expect(runner).toContain('import { handoffWireBody, runnerInputError, todaysFocusWireBody } from "../src/eval/runnerInput.js";');
    expect(runner).toContain("const inputError = runnerInputError(scenario);");
    expect(runner).toMatch(/if \(route === "\/api\/generate-handoff"\) \{[\s\S]{0,400}handoffWireBody\(input, scenarioProfile\)/);
  });
});
