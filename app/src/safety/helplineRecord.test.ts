/* B-GA-04 — the crisis helpline verification record stays true to the app.
 *
 * docs/compliance/crisis-helplines.md is the dated, sourced record of every
 * phone number Arbor shows a parent in crisis. This suite holds the record and
 * the code together in both directions:
 *   1. every number on screen (escalation copy, Safety labels EN + HE,
 *      hard-moment danger lines EN + HE) has a row, and no row names a number
 *      the app no longer shows;
 *   2. every number the copy shows is dialable (a HELPLINE_DIRECTORY entry) or
 *      deliberately display-only with a reason (DISPLAY_ONLY_HELPLINE_NUMBERS):
 *      be_cps 0800 32 123 sat in the self-harm copy as plain text until 28 Oct;
 *   3. HELPLINES_REVIEWED_ON only moves with a complete run Guy approved:
 *      every row checked on that date with a result and an official source.
 * Pure parsing; no network, no number is ever called. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DISPLAY_ONLY_HELPLINE_NUMBERS,
  HELPLINE_DIRECTORY,
  HELPLINE_REVIEW_INTERVAL_DAYS,
  HELPLINES_REVIEWED_ON,
  escalationCategories,
  type HelplineEntry,
} from "./escalation";
import { en as safetyEn, he as safetyHe } from "../lib/i18nElevation/safety";
import { DANGER as SCHOOL_DANGER, SELF_HARM_ROUTE } from "../content/hardMomentCardsSchool";
import { DANGER as TODDLER_DANGER } from "../content/hardMomentCardsToddler";

const here = path.dirname(fileURLToPath(import.meta.url));
const RECORD_PATH = path.resolve(here, "..", "..", "..", "docs", "compliance", "crisis-helplines.md");
const RECORD = readFileSync(RECORD_PATH, "utf8");

/* ── parsing ──────────────────────────────────────────────────────────────── */

type Row = Record<string, string>;

/** The first Markdown table under `## <heading>`, as header-keyed rows. */
function tableUnder(doc: string, heading: string): Row[] {
  const start = doc.indexOf(`\n## ${heading}\n`);
  if (start < 0) return [];
  const rest = doc.slice(start + heading.length + 5);
  const end = rest.search(/\n## /);
  const lines = (end < 0 ? rest : rest.slice(0, end)).split("\n").filter((l) => l.startsWith("|"));
  if (lines.length < 2) return [];
  const cells = (line: string) => line.slice(1, line.endsWith("|") ? -1 : undefined).split("|").map((c) => c.trim());
  const header = cells(lines[0]);
  return lines.slice(2).map((line) => Object.fromEntries(cells(line).map((c, i) => [header[i], c])));
}

const lineValue = (doc: string, label: string): string | null =>
  doc.match(new RegExp(`^${label}: \`?([^\`\\n(]+?)\`?(?: \\(|$)`, "m"))?.[1]?.trim() ?? null;

const digits = (s: string) => s.replace(/\D/g, "");

/** Phone-like runs (3+ digits; "24/7" and similar never count). */
function phoneNumbersIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/(?<![\w/])\+?\d(?:[\d -]*\d)?(?![\w/])/g)) {
    if (digits(m[0]).length >= 3) out.push(m[0].trim());
  }
  return out;
}

const addDays = (iso: string, days: number) => new Date(Date.parse(iso) + days * 86_400_000).toISOString().slice(0, 10);

/* ── what the app shows ───────────────────────────────────────────────────── */

const helplineLabels = (record: Record<string, string>) =>
  Object.entries(record).filter(([k]) => k.startsWith("elev.safety.helpline.")).map(([, v]) => v);

const DISPLAYED_TEXT = [
  ...escalationCategories.map((c) => c.resources),
  ...helplineLabels(safetyEn),
  ...helplineLabels(safetyHe),
  SCHOOL_DANGER.en, SCHOOL_DANGER.he, TODDLER_DANGER.en, TODDLER_DANGER.he, SELF_HARM_ROUTE.en, SELF_HARM_ROUTE.he,
];

type Facts = {
  reviewedOn: string;
  intervalDays: number;
  directory: readonly HelplineEntry[];
  displayOnly: Readonly<Record<string, string>>;
  displayed: readonly string[];
};

const LIVE: Facts = {
  reviewedOn: HELPLINES_REVIEWED_ON,
  intervalDays: HELPLINE_REVIEW_INTERVAL_DAYS,
  directory: HELPLINE_DIRECTORY,
  displayOnly: DISPLAY_ONLY_HELPLINE_NUMBERS,
  displayed: DISPLAYED_TEXT.flatMap(phoneNumbersIn),
};

/* ── the rules ────────────────────────────────────────────────────────────── */

function recordErrors(doc: string, facts: Facts): string[] {
  const errors: string[] = [];
  const rows = tableUnder(doc, "Numbers shown");
  const runs = tableUnder(doc, "Verification runs");
  if (!rows.length) return ["no 'Numbers shown' table"];
  if (!runs.length) return ["no 'Verification runs' table"];

  // Constants version and next due date.
  const version = lineValue(doc, "Constants version");
  if (version !== `HELPLINES_REVIEWED_ON = ${facts.reviewedOn}`) errors.push(`constants version line reads "${version}", code has ${facts.reviewedOn}`);
  const due = lineValue(doc, "Next verification due");
  const expectedDue = addDays(facts.reviewedOn, facts.intervalDays);
  if (due !== expectedDue) errors.push(`next verification due reads "${due}", expected ${expectedDue}`);

  // Coverage, both directions, by dialled digits.
  const byDigits = new Map(rows.map((r) => [digits(r.Number ?? ""), r]));
  const shown = new Set(facts.displayed.map(digits));
  for (const n of facts.displayed) if (!byDigits.has(digits(n))) errors.push(`number ${n} is shown but has no row in the record`);
  for (const r of rows) if (!shown.has(digits(r.Number ?? ""))) errors.push(`row ${r.ID} names ${r.Number}, which the app no longer shows`);

  // Dialable or deliberately display-only.
  const dialable = new Set(facts.directory.map((h) => digits(h.number)));
  const declared = new Set(Object.keys(facts.displayOnly).map(digits));
  for (const n of facts.displayed) {
    if (!dialable.has(digits(n)) && !declared.has(digits(n))) errors.push(`number ${n} is shown without a tel: link and is not declared display-only`);
  }
  for (const [n, reason] of Object.entries(facts.displayOnly)) {
    if (dialable.has(digits(n))) errors.push(`display-only ${n} is also a directory entry`);
    if (reason.trim().length < 20) errors.push(`display-only ${n} has no reason`);
    if (byDigits.get(digits(n))?.tel !== "—") errors.push(`display-only ${n} must have tel "—" in the record`);
  }
  for (const h of facts.directory) {
    const r = rows.find((row) => row.ID === h.id);
    if (!r) { errors.push(`directory entry ${h.id} has no row`); continue; }
    if (r.Number !== h.number || r.tel !== h.tel) errors.push(`row ${h.id} reads ${r.Number} / ${r.tel}, code has ${h.number} / ${h.tel}`);
  }
  for (const r of rows) {
    if (r.tel !== "—" && !facts.directory.some((h) => h.id === r.ID)) errors.push(`row ${r.ID} has a tel target but no directory entry`);
    if (!/https:\/\/|gov\.il/.test(r["Official source"] ?? "")) errors.push(`row ${r.ID} names no official source`);
  }

  // Only a baseline or a Guy-approved complete run may set the constant.
  const kinds = new Set(["baseline", "attempt", "approved"]);
  for (const run of runs) if (!kinds.has(run.Kind)) errors.push(`run ${run.Date} has unknown kind "${run.Kind}"`);
  const setting = runs.filter((run) => run.Kind === "baseline" || run.Kind === "approved").sort((a, b) => a.Date.localeCompare(b.Date));
  const latest = setting.at(-1);
  if (!latest) errors.push("no baseline or approved run");
  else {
    if (latest.Date !== facts.reviewedOn) errors.push(`HELPLINES_REVIEWED_ON is ${facts.reviewedOn} but the latest approved run is ${latest.Date}`);
    if (latest.Kind === "approved") {
      if (!/\bGuy\b/.test(latest["Approved by"] ?? "")) errors.push(`run ${latest.Date} is not approved by Guy`);
      for (const r of rows) {
        if (!(r["Last recorded check"] ?? "").startsWith(latest.Date)) errors.push(`row ${r.ID} was not checked on ${latest.Date}`);
        if (!/^(confirmed|changed: .+)$/.test(r["Result of latest run"] ?? "")) errors.push(`row ${r.ID} has no result for ${latest.Date}`);
        if (!/https:\/\//.test(r["Official source"] ?? "")) errors.push(`row ${r.ID} has no exact source URL for ${latest.Date}`);
      }
    }
  }
  return errors;
}

/* ── the live record ──────────────────────────────────────────────────────── */

describe("B-GA-04 — the crisis helpline record matches the app", () => {
  it("the record has its two tables and names every directory entry", () => {
    expect(tableUnder(RECORD, "Numbers shown").length).toBeGreaterThanOrEqual(HELPLINE_DIRECTORY.length);
    expect(tableUnder(RECORD, "Verification runs").length).toBeGreaterThanOrEqual(1);
  });

  it("the scan reads the numbers a parent actually sees (non-vacuous)", () => {
    const shown = new Set(LIVE.displayed.map(digits));
    for (const n of ["112", "911", "101", "100", "1201", "08000113", "113", "1813", "080032123", "988", "118", "105", "08002000", "1712", "18004224453", "070245245"]) {
      expect(shown.has(n), `scan missed ${n}`).toBe(true);
    }
    expect(phoneNumbersIn("ERAN (24/7) · room 12 · call 1201")).toEqual(["1201"]);
  });

  it("record, directory, copy and constant agree", () => {
    expect(recordErrors(RECORD, LIVE)).toEqual([]);
  });

  it("be_cps (0800 32 123) is a tap-to-call entry in Belgium, after the Dutch talk line", () => {
    const be = HELPLINE_DIRECTORY.filter((h) => h.region === "be").map((h) => h.id);
    expect(be.indexOf("be_cps")).toBe(be.indexOf("be_1813") + 1);
    expect(safetyEn["elev.safety.helpline.be_cps"]).toMatch(/French/);
    expect(safetyHe["elev.safety.helpline.be_cps"]).toMatch(/[֐-׿]/);
  });
});

/* ── negative controls: each rule fails on the defect it exists for ───────── */

describe("B-GA-04 — negative controls", () => {
  const withoutCps = HELPLINE_DIRECTORY.filter((h) => h.id !== "be_cps");

  it("the pre-28-Oct directory (no be_cps) fails: 0800 32 123 is shown with no tel: link", () => {
    const errors = recordErrors(RECORD, { ...LIVE, directory: withoutCps });
    expect(errors).toContain("number 0800 32 123 is shown without a tel: link and is not declared display-only");
  });

  it("a number added to the copy without a record row fails", () => {
    const errors = recordErrors(RECORD, { ...LIVE, displayed: [...LIVE.displayed, "0800 99 999"] });
    expect(errors.some((e) => e.startsWith("number 0800 99 999 is shown but has no row"))).toBe(true);
  });

  it("a row for a number the app dropped fails", () => {
    const errors = recordErrors(RECORD, { ...LIVE, displayed: LIVE.displayed.filter((n) => digits(n) !== "070245245"), displayOnly: { "113": DISPLAY_ONLY_HELPLINE_NUMBERS["113"], "105": DISPLAY_ONLY_HELPLINE_NUMBERS["105"] } });
    expect(errors).toContain("row be_antigif names 070 245 245, which the app no longer shows");
  });

  it("bumping HELPLINES_REVIEWED_ON without an approved run fails", () => {
    const errors = recordErrors(RECORD.replace("HELPLINES_REVIEWED_ON = 2026-10-01", "HELPLINES_REVIEWED_ON = 2026-11-20").replace("2027-03-30", addDays("2026-11-20", 180)),
      { ...LIVE, reviewedOn: "2026-11-20" });
    expect(errors).toContain("HELPLINES_REVIEWED_ON is 2026-11-20 but the latest approved run is 2026-10-01");
  });

  it("an approved run that leaves a row unchecked, or lacks Guy, fails; a complete one passes", () => {
    const date = "2026-11-20";
    const bumped = RECORD.replace("HELPLINES_REVIEWED_ON = 2026-10-01", `HELPLINES_REVIEWED_ON = ${date}`)
      .replace("2027-03-30", addDays(date, 180));
    const runRow = (approver: string) => `| ${date} | approved | All rows | Engineering | ${approver} | page captures |\n\nKinds:`;
    const approvedBySomeone = bumped.replace(/\n\nKinds:/, `\n${runRow("Engineering")}`);
    const facts = { ...LIVE, reviewedOn: date };
    const partial = recordErrors(approvedBySomeone, facts);
    expect(partial).toContain(`run ${date} is not approved by Guy`);
    expect(partial).toContain(`row il_eran was not checked on ${date}`);

    // Complete run: every row checked on the date with a result and a URL.
    const lines = bumped.replace(/\n\nKinds:/, `\n${runRow("Guy")}`).split("\n");
    const header = lines.find((l) => l.startsWith("| ID |"))!;
    const cols = header.slice(1, -1).split("|").map((c) => c.trim());
    const complete = lines.map((l) => {
      if (!l.startsWith("| ") || l === header || l.startsWith("|---") || !/^\| [a-z]+_/.test(l)) return l;
      const cells = l.slice(1, -1).split("|").map((c) => c.trim());
      cells[cols.indexOf("Last recorded check")] = date;
      cells[cols.indexOf("Result of latest run")] = "confirmed";
      if (!/https:\/\//.test(cells[cols.indexOf("Official source")])) cells[cols.indexOf("Official source")] = "https://www.gov.il/";
      return `| ${cells.join(" | ")} |`;
    }).join("\n");
    expect(recordErrors(complete, facts)).toEqual([]);
  });
});
