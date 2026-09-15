import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/* ══════════════════════════════════════════════════════════════════════════
   N1-01-R6 — no analytics call may pass a FREE-TEXT prop.

   THE DEFECT THIS CLOSES
   ──────────────────────
   `ArborContext.handleGenerateActionPlan` shipped a MODEL-GENERATED plan title
   as an analytics prop — twice, to `plan_generated` and to `first_plan` from
   the same object. A plan title routinely names the child's difficulty, so the
   sink held a per-family free-text description of what a child struggles with.
   `lib/kpiEvents.ts` exists precisely to stop that, and the call site simply
   went around it by calling `track()` directly.

   WHY A SOURCE SCAN AND NOT A RUNTIME ASSERTION
   ─────────────────────────────────────────────
   A runtime allow-list inside `track()` would only cover the props it knows
   about; the leak class is a NEW prop added at a NEW call site, which no
   runtime check can anticipate. The property that has to hold is about the
   code, not about one execution: nowhere in `app/src/**` does an analytics
   call hand the sink a prop whose NAME says "this is prose".

   The banned names are the ones that are free text in this codebase by
   construction: `title` (model-generated), `text`/`transcript` (what a parent
   or child said), `note`/`summary` (log bodies and kept lines), `name` (a
   child's first name, which the wave's §0 found already riding in nudge vars).

   This scan is deliberately NAME-based, not value-based: a prop called
   `surface` holding a literal id is fine, and a prop called `title` is not,
   whatever is assigned to it that day. Values are sanitised separately by
   `shortId`/`capabilityId`/`oneOf` in lib/kpiEvents (pinned in kpiEvents.test).
   ══════════════════════════════════════════════════════════════════════════ */

const SRC = path.resolve(__dirname, "..");

/** Prop NAMES that carry prose in this codebase. Never analytics props. */
export const BANNED_PROP_NAMES = ["title", "text", "note", "summary", "name", "transcript"] as const;

const BANNED_KEY = new RegExp(
  `(^|[{,\\s])(${BANNED_PROP_NAMES.join("|")})\\s*:`,
);

/** Strip comments so the scan reads live code, not prose about it. */
const strip = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

export interface AnalyticsCall {
  /** The callee, e.g. `track(`, `trackFirstPlan(`. */
  callee: string;
  /** The argument text between the balanced parentheses. */
  args: string;
  /** 1-based line of the callee inside the (comment-stripped) source. */
  line: number;
}

/**
 * Every `track…(` call in a source text, with its balanced argument list.
 * Balanced-paren walking rather than a line regex: the leak that shipped was a
 * one-liner, but a multi-line `track(KpiEvent.X, {\n title: …\n })` is the same
 * defect and a line-scoped grep would miss it.
 */
export function analyticsCalls(source: string): AnalyticsCall[] {
  const found: AnalyticsCall[] = [];
  const callee = /\btrack[A-Za-z]*\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = callee.exec(source))) {
    let i = callee.lastIndex;
    let depth = 1;
    while (i < source.length && depth > 0) {
      const ch = source[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      i++;
    }
    found.push({
      callee: match[0],
      args: source.slice(callee.lastIndex, i - 1),
      line: source.slice(0, match.index).split("\n").length,
    });
  }
  return found;
}

/** The call sites in `source` that pass a banned prop name. */
export function freeTextPropViolations(source: string): AnalyticsCall[] {
  return analyticsCalls(strip(source)).filter((call) => BANNED_KEY.test(call.args));
}

describe("N1-01-R6 — analytics props are ids and counts, never prose", () => {
  const files = sourceFiles(SRC);

  it("the scan is not vacuous: it walks the tree and finds real call sites", () => {
    // A guard that scans nothing passes forever. Both floors are far below the
    // present counts, so ordinary churn never trips them, but a broken walk or
    // a broken matcher does.
    expect(files.length).toBeGreaterThan(200);
    const calls = files.flatMap((file) => analyticsCalls(strip(fs.readFileSync(file, "utf8"))));
    expect(calls.length).toBeGreaterThan(80);
    // …and it reads the file the defect shipped in.
    expect(files.some((f) => f.endsWith(path.join("context", "ArborContext.tsx")))).toBe(true);
  });

  it("no track() call in app/src/** passes title/text/note/summary/name/transcript", () => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const call of freeTextPropViolations(fs.readFileSync(file, "utf8"))) {
        offenders.push(
          `${path.relative(SRC, file)}:${call.line} ${call.callee}${call.args.replace(/\s+/g, " ").slice(0, 100)})`,
        );
      }
    }
    expect(offenders).toEqual([]);
  });

  it("NEGATIVE CONTROL: the pre-fix plan_generated line is caught", () => {
    const preFix = `
      await plansCol.upsert(planData);
      track("plan_generated", { title: planData.title });
      trackFirstPlan({ title: planData.title }); // activation: only the family's first plan
    `;
    const hits = freeTextPropViolations(preFix);
    expect(hits).toHaveLength(2);
    expect(hits[0].callee).toBe("track(");
    expect(hits[1].callee).toBe("trackFirstPlan(");
  });

  it("NEGATIVE CONTROL: a multi-line call and a child name are caught too", () => {
    expect(
      freeTextPropViolations('track(KpiEvent.KeepThis, {\n  field: "journal",\n  text: kept,\n});'),
    ).toHaveLength(1);
    expect(freeTextPropViolations('trackBellItemTap("nudge", { name: child.name });')).toHaveLength(1);
  });

  it("a comment mentioning a banned name is not a violation (no false positives)", () => {
    expect(freeTextPropViolations('// never pass { title: plan.title }\ntrack("x", { steps: 3 });')).toEqual([]);
    expect(freeTextPropViolations('track("x", { surface: "plans", steps: 3, plan: "free" });')).toEqual([]);
  });

  it("the fixed call site reports counts and a surface id", () => {
    const ctx = strip(fs.readFileSync(path.join(SRC, "context", "ArborContext.tsx"), "utf8"));
    expect(ctx).toContain("trackPlanGenerated({ steps: planSteps, source: \"plans\" });");
    expect(ctx).toContain("trackFirstPlan(planProps);");
    // first_plan must reuse the SANITISED object, not re-derive its own props.
    expect(ctx).not.toMatch(/trackFirstPlan\(\{/);
  });
});
