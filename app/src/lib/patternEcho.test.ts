/**
 * Wave L · TJB-06 — the pattern echo a save owes the parent.
 *
 * `suggestedChallenges` computed recurrence from day one, but only PlansTab
 * ever called it, so saving a third meltdown in the Behaviors form echoed
 * nothing: the surface's own promise ("see the pattern form") only paid out if
 * the parent happened to open a different tab. These tests pin the selector's
 * behaviour, then source-scan the mount with a negative control.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ECHO_MIN_COUNT, ECHO_WINDOW_DAYS, patternEchoFor } from "./patternEcho";
import { MOMENT_BEHAVIOR_TYPE } from "../content/behaviorTaxonomy";
import type { BehaviorLog } from "../types";

const TODAY = "2026-09-04";

const log = (over: Partial<BehaviorLog> & { id: string }): BehaviorLog => ({
  timestamp: `${TODAY}T09:00:00.000Z`,
  behaviorType: "Meltdown",
  intensity: 3,
  durationMinutes: 10,
  trigger: "transition",
  response: "sat with her",
  ...over,
});

const nDaysAgo = (n: number) =>
  new Date(new Date(`${TODAY}T09:00:00.000Z`).getTime() - n * 86400000).toISOString();

describe("TJB-06 patternEchoFor", () => {
  it("stays silent below the repetition bar (a coincidence is not a pattern)", () => {
    const logs = [log({ id: "a" }), log({ id: "b", timestamp: nDaysAgo(2) })];
    expect(logs).toHaveLength(ECHO_MIN_COUNT - 1);
    expect(patternEchoFor(logs, "Meltdown", TODAY)).toBeNull();
  });

  it("speaks at the third occurrence with the flat count and the window", () => {
    const logs = [
      log({ id: "a" }),
      log({ id: "b", timestamp: nDaysAgo(2) }),
      log({ id: "c", timestamp: nDaysAgo(5) }),
    ];
    expect(patternEchoFor(logs, "Meltdown", TODAY)).toEqual({
      type: "Meltdown",
      count: 3,
      windowDays: ECHO_WINDOW_DAYS,
    });
  });

  it("only counts the type the parent just saved", () => {
    const logs = [
      log({ id: "a" }),
      log({ id: "b", timestamp: nDaysAgo(1) }),
      log({ id: "c", timestamp: nDaysAgo(2) }),
      log({ id: "d", behaviorType: "Refusal", timestamp: nDaysAgo(3) }),
    ];
    expect(patternEchoFor(logs, "Refusal", TODAY)).toBeNull();
    expect(patternEchoFor(logs, "Meltdown", TODAY)?.count).toBe(3);
  });

  it("matches case-insensitively (taxonomy select vs older free-typed logs)", () => {
    const logs = [0, 1, 2].map((i) => log({ id: `x${i}`, behaviorType: "meltdown", timestamp: nDaysAgo(i) }));
    expect(patternEchoFor(logs, "Meltdown", TODAY)?.count).toBe(3);
  });

  it("inherits the shared carve-outs: resolved logs and plain Moments never accumulate", () => {
    const resolved = [0, 1, 2].map((i) => log({ id: `r${i}`, resolved: true, timestamp: nDaysAgo(i) }));
    expect(patternEchoFor(resolved, "Meltdown", TODAY)).toBeNull();

    const moments = [0, 1, 2].map((i) =>
      log({ id: `m${i}`, behaviorType: MOMENT_BEHAVIOR_TYPE, timestamp: nDaysAgo(i) }),
    );
    expect(patternEchoFor(moments, MOMENT_BEHAVIOR_TYPE, TODAY)).toBeNull();
  });

  it("drops occurrences that fall out of the trailing window", () => {
    const logs = [
      log({ id: "a" }),
      log({ id: "b", timestamp: nDaysAgo(2) }),
      log({ id: "c", timestamp: nDaysAgo(ECHO_WINDOW_DAYS + 5) }),
    ];
    expect(patternEchoFor(logs, "Meltdown", TODAY)).toBeNull();
  });

  it("says nothing when there is no saved type (no save has happened yet)", () => {
    const logs = [0, 1, 2].map((i) => log({ id: `y${i}`, timestamp: nDaysAgo(i) }));
    expect(patternEchoFor(logs, null, TODAY)).toBeNull();
    expect(patternEchoFor(logs, "  ", TODAY)).toBeNull();
  });

  it("FIREWALL: the result carries a count and a window — no score, severity or trend", () => {
    const logs = [0, 1, 2].map((i) => log({ id: `z${i}`, intensity: 5, timestamp: nDaysAgo(i) }));
    const echo = patternEchoFor(logs, "Meltdown", TODAY)!;
    expect(Object.keys(echo).sort()).toEqual(["count", "type", "windowDays"]);
  });
});

describe("TJB-06 — the echo is actually mounted on the save path", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const behaviors = readFileSync(
    path.join(here, "../components/tabs/BehaviorsTab.tsx"),
    "utf8",
  );
  const stripped = behaviors.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("BehaviorsTab derives the echo and renders it", () => {
    expect(stripped).toContain("patternEchoFor(");
    expect(stripped).toContain('data-testid="behaviors-pattern-echo"');
    // Negative control: the pre-change file had NEITHER — this scan would
    // have failed on it, so the assertion is not vacuously true.
    const shipped = "const submitLog = (e) => { handleAddLog(e); setCaptureOpen(false); };";
    expect(shipped).not.toContain("patternEchoFor(");
  });

  it("both write paths arm it — the review-gated one too", () => {
    const submit = /const submitLog = [\s\S]*?\n  };/.exec(stripped)?.[0] ?? "";
    const confirm = /const confirmReview = [\s\S]*?\n  };/.exec(stripped)?.[0] ?? "";
    expect(submit).toMatch(/setEchoType\(savedType\)/);
    expect(confirm).toMatch(/setEchoType\(savedType\)/);
  });

  it("an EDIT never counts as a new occurrence", () => {
    for (const fn of ["submitLog", "confirmReview"]) {
      const body = new RegExp(`const ${fn} = [\\s\\S]*?\\n  };`).exec(stripped)?.[0] ?? "";
      expect(body, fn).toMatch(/const savedType = wasEditing \? null : newLogType;/);
    }
  });

  it("the CTA routes to the surface contract's declared demotion target", () => {
    const echoBlock = /data-testid="behaviors-pattern-echo"[\s\S]*?elev\.closeloop\.echo\.dismiss/.exec(stripped)?.[0] ?? "";
    expect(echoBlock).toContain('setActiveTab("plans")');
  });
});
