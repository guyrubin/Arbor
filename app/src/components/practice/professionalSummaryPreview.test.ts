/**
 * Masterplan 2.3 — no resettable streak on a PARENT surface.
 *
 * History (visual audit 2026-08-12): #/copilot ("The Full Picture") rendered
 * the clinician export verbatim in its preview <pre>, so the parent read
 * "Home practice, last 7 days: 0 interactions on 0 day(s) across 0 domain(s).
 * Streak: 0 day(s)." — `computeStreak().current` zeroes on any lapse, which is
 * exactly the resettable counter 2.3 bans from parent-facing surfaces.
 *
 * Fix under test: ONE builder, two outputs.
 *   • clinicianSummary — the copy-to-clipboard EXPORT. Keeps the streak clause
 *     (last-week adherence is what a clinician reading the sheet uses); it is
 *     never rendered on a parent surface.
 *   • previewSummary  — what the <pre> shows. Same text, streak clause dropped.
 *
 * SOURCE scan (suite runs in `environment: "node"`, no DOM render), in the
 * Screening.firewall.test.ts style: negative controls first so the matchers can
 * never rot into a vacuous pass.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, "DevelopmentCopilot.tsx"), "utf8");

/** The streak clause in any interpolated form. */
const STREAK_CLAUSE = /Streak:\s*\$\{[^}]*streak[^}]*\}/;
/** Same, global — counts the clause as a STRING (the `withStreak:` parameter
 *  annotation also contains "Streak:", so a bare /Streak:/ over-counts). */
const STREAK_CLAUSE_G = /Streak:\s*\$\{[^}]*streak[^}]*\}/g;
/** The <pre> preview and the identifier it renders. */
const PREVIEW_PRE = /<pre[\s\S]{0,400}?\{(\w+)\s*\?\?/;

/* ── Negative controls: verbatim fixtures of the pre-fix source ───────────── */
const OLD_HOME_PRACTICE_LINE =
  "`Home practice, last 7 days: ${data.week.sessions} interactions on ${data.week.activeDays} day(s) across ${data.week.domainsTouched.length} domain(s). Streak: ${data.streak} day(s).`";
const OLD_PREVIEW = `<pre className="text-[11px] leading-relaxed whitespace-pre-wrap rounded-xl p-4 select-text" style={{ background: "var(--arbor-paper-deep)" }}>
          {clinicianSummary ?? "This summary did not pass Arbor's export safety check, so nothing was exported."}
        </pre>`;

describe("2.3 guard — the matchers still recognize the OLD mechanism", () => {
  it("catches the streak clause welded onto the home-practice line", () => {
    expect(STREAK_CLAUSE.test(OLD_HOME_PRACTICE_LINE)).toBe(true);
  });
  it("catches the preview rendering the clinician export itself", () => {
    expect(OLD_PREVIEW.match(PREVIEW_PRE)?.[1]).toBe("clinicianSummary");
  });
});

describe("2.3 — the parent-facing preview carries no resettable streak", () => {
  it("renders previewSummary, never clinicianSummary", () => {
    const rendered = src.match(PREVIEW_PRE)?.[1];
    expect(rendered).toBe("previewSummary");
  });

  it("gates the streak clause behind the export-only flag", () => {
    // The clause exists exactly once, as its own value…
    expect(src).toMatch(STREAK_CLAUSE);
    expect(src.match(STREAK_CLAUSE_G) ?? []).toHaveLength(1);
    // …and it only ever reaches the text through the withStreak branch.
    expect(src).toMatch(/withStreak\s*\?\s*`\$\{homePractice\}\$\{streakClause\}`\s*:\s*homePractice/);
  });

  it("builds preview and export from ONE builder, so they cannot drift", () => {
    expect(src).toMatch(/const build\s*=\s*\(withStreak: boolean\)/);
    expect(src).toMatch(/clinicianSummary:\s*build\(true\)/);
    expect(src).toMatch(/previewSummary:\s*build\(false\)/);
  });

  it("keeps the clinician export on the copy path, still ceiling-checked and fail-closed", () => {
    expect(src).toMatch(/navigator\.clipboard\.writeText\(clinicianSummary\)/);
    expect(src).toContain("assertClinicianExportCeiling(text)");
    expect(src).toMatch(/catch\s*\{\s*return null;\s*\}/);
    expect(src).toMatch(/if \(!clinicianSummary\) return;/);
  });
});

describe("3c — the domain row renders once per domain on this screen", () => {
  it("no sr-only mirror of the visible domain list (it announced every row twice)", () => {
    // The visible list is the ONLY per-domain render in the page body.
    expect(src).not.toMatch(/sr-only[\s\S]{0,200}?milestones noticed by you/);
    expect(src.match(/milestones noticed by you/g) ?? []).toHaveLength(0);
  });
  it("keeps the visible per-domain count row (positive control)", () => {
    expect(src).toMatch(/\{c\.reached\} of \{c\.total\} milestones noticed/);
  });
  it("the clinician export's domain block is a separate artifact, not a third copy", () => {
    expect(src.match(/milestones noticed by parent/g) ?? []).toHaveLength(1);
  });
});
