// B-INF-14: capture runs end with no unexplained diagnostics — every exception the law lets
// through is named with its reason, an intended state that never rendered fails, and the
// sweep's states only wait for targets the app still renders.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EXPLAINED_DIAGNOSTICS, explanationFor, validateExplained } from "./capture/explained-diagnostics.mjs";
import { sweepLawExplained, sweepLawFailures } from "./capture/sweep-law.mjs";

const scripts = path.dirname(fileURLToPath(import.meta.url));
const sweep = readFileSync(path.join(scripts, "rendered-sweep.mjs"), "utf8");
const cell = (over: Record<string, unknown> = {}) => ({
  route: "sharing", viewport: "375x812", lang: "en", mounted: true, consoleErrors: [],
  overflow: { scrollWidth: 375, clientWidth: 375 }, ...over,
});
const doc = (cells: unknown[]) => ({ completed: true, cells });
const explainedFixture = [{ route: "sharing", kind: "RESOURCE_HTTP_401", why: "the sandbox stand-in has no co-parent account; the server's deliberate 401", owner: "B-INF-14" }];

describe("explained diagnostics", () => {
  it("lets an explained kind through on its own route only, and names it with its reason", () => {
    const explained = cell({ consoleErrors: ["RESOURCE_HTTP_401"] });
    expect(sweepLawFailures(doc([explained]), explainedFixture)).toEqual([]);
    expect(sweepLawExplained(doc([explained]), explainedFixture)).toEqual([
      { cell: "sharing 375x812 en", kind: "RESOURCE_HTTP_401", why: explainedFixture[0].why, owner: "B-INF-14" },
    ]);
    // The same kind elsewhere, or a second unexplained kind beside it, still fails.
    expect(sweepLawFailures(doc([cell({ route: "care-team", consoleErrors: ["RESOURCE_HTTP_401"] })]), explainedFixture)[0].reasons).toEqual(["console-error"]);
    expect(sweepLawFailures(doc([cell({ consoleErrors: ["RESOURCE_HTTP_401", "TYPE_ERROR"] })]), explainedFixture)[0]).toMatchObject({ reasons: ["console-error"], detail: "TYPE_ERROR" });
    // With the shipped (empty) list nothing is explained.
    expect(sweepLawFailures(doc([explained]))[0].reasons).toEqual(["console-error"]);
  });

  it("refuses an entry that explains nothing: no route, a catch-all kind, no reason or no owner", () => {
    expect(validateExplained(EXPLAINED_DIAGNOSTICS)).toBe(EXPLAINED_DIAGNOSTICS);
    expect(validateExplained(explainedFixture)).toBe(explainedFixture);
    const base = explainedFixture[0];
    expect(() => validateExplained([{ ...base, route: "" }])).toThrow("EXPLAINED_ROUTE_REQUIRED");
    expect(() => validateExplained([{ ...base, kind: "OTHER_ERROR" }])).toThrow("EXPLAINED_KIND_INVALID");
    expect(() => validateExplained([{ ...base, kind: "STATE_ASSERTION_FAILED" }])).toThrow("EXPLAINED_KIND_INVALID");
    expect(() => validateExplained([{ ...base, why: "noise" }])).toThrow("EXPLAINED_WHY_REQUIRED");
    expect(() => validateExplained([{ ...base, owner: "" }])).toThrow("EXPLAINED_OWNER_REQUIRED");
    expect(explanationFor({ route: "sharing", state: "preview" }, "RESOURCE_HTTP_401", [{ ...base, state: "base" }])).toBeNull();
  });

  it("fails an intended state that never rendered, unless its own precondition was absent", () => {
    const stale = cell({ route: "coach", state: "answered", reached: false, retryable: true, reason: "STATE_TARGET_MISSING", message: "the More block of the answer did not render" });
    const absent = cell({ route: "memory", state: "after-approve", reached: false, retryable: false, reason: "STATE_PRECONDITION_ABSENT" });
    expect(sweepLawFailures(doc([stale, absent]))).toEqual([
      { cell: "coach 375x812 en answered", reasons: ["state-unready"], detail: "STATE_TARGET_MISSING: the More block of the answer did not render" },
    ]);
    const explainedStale = [{ route: "coach", state: "answered", kind: "STATE_TARGET_MISSING", why: "fixture: the answer block is captured by the release harness", owner: "B-INF-14" }];
    expect(sweepLawFailures(doc([stale]), explainedStale)).toEqual([]);
    expect(sweepLawExplained(doc([stale]), explainedStale)).toHaveLength(1);
  });

  it("names every state failure (never OTHER_ERROR) and treats a missing target as a failure, not an absent precondition", () => {
    expect(sweep).toContain("function stateFailureReason(err)");
    expect(sweep).toContain('return kind === "OTHER_ERROR" ? "STATE_ASSERTION_FAILED" : kind;');
    expect(sweep).toContain("if (!el) throw new StateTargetMissing(`${what} not found");
    expect(sweep).toContain("if (!el) throw new StateTargetMissing(`${what} did not render`);");
    expect(sweep).not.toMatch(/if \(!el\) skip\(`\$\{what\} not found/);
    expect(sweep).toContain("const reason = stateFailureReason(err);");
  });

  it("only waits for targets the app still renders (a stale selector is caught here, not in a capture cell)", () => {
    let src = "";
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const file = path.join(dir, name);
        if (statSync(file).isDirectory()) walk(file);
        else if (/\.(tsx?|mjs)$/.test(name) && !/\.test\./.test(name)) src += readFileSync(file, "utf8");
      }
    };
    walk(path.join(scripts, "..", "src"));
    // A template id (data-testid={`journal-filter-${f}`}) covers every id with its prefix.
    const prefixes = [...src.matchAll(/data-testid=\{`([a-z0-9-]+-)\$\{/g)].map((m) => m[1]);
    const rendered = (id: string) => src.includes(id) || prefixes.some((p) => id.startsWith(p));
    const ids = [...new Set([...sweep.matchAll(/data-testid[=~^]*"?([a-z0-9][a-z0-9-]*)/g)].map((m) => m[1]))];
    const modules = [...new Set([...sweep.matchAll(/data-module[=^]*"?([a-z0-9][a-z0-9-]*)/g)].map((m) => m[1]))];
    expect(ids.length).toBeGreaterThan(40);
    expect(ids.filter((id) => !rendered(id))).toEqual([]);
    expect(modules.filter((id) => !rendered(id))).toEqual([]);
    // Negative control: the answer block the old "answered"/"more-open" states waited for.
    expect(rendered("coach-answer-more")).toBe(false);
    expect(rendered("coach-answer-cards")).toBe(true);
  });
});
