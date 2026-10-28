/* B-AIOPS-06 — the app's model pins, price table, retirement record and AI SDK
 * versions agree with the dated facts record (docs/ops/model-facts.md).
 *
 * Hard failures (any day): a drift between the app and the record, a pinned
 * model past its recorded retirement, and an SDK still in use on or after its
 * recorded hard-fail date. The record's age follows the helpline record's shape
 * (LC-15): it fails only after 90 days and warns from 14 days before, so a
 * routine re-read never blocks a release or a hotfix. An SDK past its announced
 * removal warns on every run until its hard-fail date, which must fall before
 * the earliest recorded retirement of a pinned model.
 *
 * Warnings go through the test context's annotate(message, "warning"): in CI
 * (GITHUB_ACTIONS=true) vitest's github-actions reporter prints them as clean
 * `::warning file=…,line=…::` workflow commands; a console line would carry
 * reporter colour codes before the `::` and never render.
 *
 * What is checked deterministically: every model the app pins, deploys, judges
 * with, records as retired or prices has a row; PRICE_TABLE and the TTS price
 * match the row's numbers (an "unverified" row is allowed only when it says so);
 * the recorded retirement dates in evals/pinned-models.json match; a model past
 * its retirement is listed retired and no pin names it; the introductory price
 * step the record states is the one estimateCostUsd applies. No model id is
 * written here: ids come from pinned-models.json and the record. No network. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PRICE_TABLE, PRICE_TABLE_AS_OF, estimateCostUsd, type ModelPrice } from "./priceTable";
import { TTS_PRICE_AS_OF, estimateTtsCostUsd } from "./ttsUsage";

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, "..", "..", "..");
const RECORD = readFileSync(path.join(REPO, "docs", "ops", "model-facts.md"), "utf8");
const PINNED = JSON.parse(readFileSync(path.join(REPO, "evals", "pinned-models.json"), "utf8"));
const DAY = 86_400_000;
const MAX_AGE_DAYS = 90;
const WARN_DAYS = 14;
const APP = path.join(REPO, "app");
const PACKAGE = JSON.parse(readFileSync(path.join(APP, "package.json"), "utf8"));
const LOCK = JSON.parse(readFileSync(path.join(APP, "package-lock.json"), "utf8"));
/** The AI SDKs a server path can call a model through. */
const AI_SDK = /^(@google-cloud\/vertexai|@google\/genai|@google-cloud\/(aiplatform|text-to-speech|speech)|@anthropic-ai\/.+|openai)$/;
type Deps = Record<string, { pinned: string; installed: string | undefined }>;
const DEPS: Deps = Object.fromEntries(Object.entries({ ...PACKAGE.dependencies, ...PACKAGE.devDependencies } as Record<string, string>)
  .filter(([name]) => AI_SDK.test(name))
  .map(([name, pinned]) => [name, { pinned, installed: LOCK.packages?.[`node_modules/${name}`]?.version }]));
const STALE_HELP = 're-read sources A–D listed in docs/ops/model-facts.md (A model pricing, B TTS pricing, C model versions and retirement, D SDK registry notes), update the rows, then the "Checked on:" line';

/** What production deploys, read from the deploy config itself (cloudbuild.prod.yaml env). */
const PROD_ENV = Object.fromEntries(
  [...readFileSync(path.join(REPO, "cloudbuild.prod.yaml"), "utf8").matchAll(/(?:\||\^)(VERTEX_MODEL_CHAT|VERTEX_MODEL_IMAGE|LIVE_MODEL|TTS_VOICE_EN|TTS_VOICE_HE)=([^|\s]+)/g)]
    .map((m) => [m[1], m[2]]),
) as Record<string, string>;

type Row = Record<string, string>;

function factsTable(doc: string, heading = "Facts"): Row[] {
  const start = doc.indexOf(`\n## ${heading}\n`);
  if (start < 0) return [];
  const rest = doc.slice(start + heading.length + 5);
  const end = rest.search(/\n## /);
  const lines = (end < 0 ? rest : rest.slice(0, end)).split("\n").filter((l) => l.startsWith("|"));
  const cells = (line: string) => line.slice(1, -1).split("|").map((c) => c.trim());
  const header = cells(lines[0] ?? "|");
  return lines.slice(2).map((l) => Object.fromEntries(cells(l).map((c, i) => [header[i], c])));
}

const checkedOn = (doc: string) => doc.match(/^Checked on: (\d{4}-\d{2}-\d{2})$/m)?.[1] ?? null;
const num = (cell: string | undefined): number | undefined => (cell && /^\d+(\.\d+)?$/.test(cell) ? Number(cell) : undefined);
/** Model ids a row stands for: the cell itself, or every backticked id in it. */
const idsOf = (row: Row): string[] => {
  const ticked = [...(row.Model ?? "").matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  return ticked.length ? ticked : [row.Model];
};
const scheduled = (row: Row) => (/^\d{4}-\d{2}-\d{2}$/.test(row.Retirement ?? "") ? row.Retirement : null);

type Pinned = {
  routes: Record<string, { resolved: string }>;
  production: Record<string, string>;
  retiredModels: Record<string, string>;
  judgeModels: string[];
  auxiliary?: string[];
  $retiredComment?: string;
};

/** Models the app runs, pins or judges with (not legacy or retired). */
const activeModels = (pinned: Pinned): string[] => [...new Set([
  ...Object.values(pinned.routes).map((r) => r.resolved),
  pinned.production.VERTEX_MODEL_CHAT,
  ...pinned.judgeModels,
  ...(pinned.auxiliary ?? []),
])];

/** Age of the record against `nowMs`: fail past MAX_AGE_DAYS, warn inside WARN_DAYS. */
function recordAge(doc: string, nowMs: number): { checkedOn: string | null; ageDays: number; stale: boolean; daysRemaining: number } {
  const date = checkedOn(doc);
  const ageDays = date ? Math.floor((nowMs - Date.parse(date)) / DAY) : Infinity;
  return { checkedOn: date, ageDays, stale: !date || ageDays > MAX_AGE_DAYS, daysRemaining: MAX_AGE_DAYS - ageDays };
}

function factsErrors(doc: string, pinned: Pinned, priceTable: Readonly<Record<string, ModelPrice>>, nowMs: number, deployed: Record<string, string> = PROD_ENV, deps: Deps = DEPS): string[] {
  const errors: string[] = [];
  const rows = factsTable(doc);
  if (!rows.length) return ["no Facts table"];
  const date = checkedOn(doc);
  if (!date) errors.push("no 'Checked on' date");
  const byId = new Map<string, Row>();
  for (const row of rows) for (const id of idsOf(row)) byId.set(id, row);

  // Coverage: active, retired and priced models each have a row.
  for (const id of activeModels(pinned)) if (!byId.has(id)) errors.push(`pinned model ${id} has no row`);
  for (const id of Object.keys(pinned.retiredModels)) if (!byId.has(id)) errors.push(`retired model ${id} has no row`);
  for (const id of Object.keys(priceTable)) if (!byId.has(id)) errors.push(`priced model ${id} has no row`);
  for (const [key, id] of Object.entries(deployed)) if (!byId.has(id)) errors.push(`deployed ${key}=${id} has no row`);

  // Prices: the app's table equals the record, or the record says unverified.
  for (const [id, price] of Object.entries(priceTable)) {
    const row = byId.get(id);
    if (!row) continue;
    if (/unverified/i.test(row["Price basis"])) {
      if (num(row.In) !== price.inputPerM || num(row.Out) !== price.outputPerM) errors.push(`${id}: unverified row must still show the price the app uses`);
      continue;
    }
    if (/not priced by the app/i.test(row["Price basis"])) { errors.push(`${id}: the record says the app does not price it, but PRICE_TABLE does`); continue; }
    const pairs: [string, number | undefined, number | undefined][] = [
      ["input", price.inputPerM, num(row.In)],
      ["output", price.outputPerM, num(row.Out)],
    ];
    if (price.audioInputPerM !== undefined) pairs.push(["audio input", price.audioInputPerM, num(row["Audio in"])]);
    if (price.cacheReadPerM !== undefined) pairs.push(["cached input", price.cacheReadPerM, num(row["Cached in"])]);
    const [w5, w1] = (row["Cache write 5m / 1h"] ?? "").split("/").map((c) => num(c.trim()));
    if (price.cacheWrite5mPerM !== undefined) pairs.push(["5m cache write", price.cacheWrite5mPerM, w5]);
    if (price.cacheWrite1hPerM !== undefined) pairs.push(["1h cache write", price.cacheWrite1hPerM, w1]);
    for (const [what, app, record] of pairs) if (app !== record) errors.push(`${id}: ${what} is ${app} in PRICE_TABLE, ${record} in the record`);
  }
  for (const row of rows) {
    if (/not priced by the app/i.test(row["Price basis"]) && idsOf(row).some((id) => id in priceTable)) errors.push(`${row.Model}: priced by the app against the record`);
  }

  // Retirement: recorded dates agree; past dates are listed retired; no pin names a retired model.
  for (const [id, when] of Object.entries(pinned.retiredModels)) {
    const row = byId.get(id);
    if (row && scheduled(row) !== when) errors.push(`${id}: retirement ${when} in pinned-models.json, ${row.Retirement} in the record`);
  }
  for (const m of (pinned.$retiredComment ?? "").matchAll(/([a-z0-9.-]+) \(retires (\d{4}-\d{2}-\d{2})\)/g)) {
    const row = byId.get(m[1]);
    if (!row || scheduled(row) !== m[2]) errors.push(`${m[1]}: pinned-models.json says it retires ${m[2]}, the record says ${row?.Retirement ?? "nothing"}`);
  }
  for (const row of rows) {
    const when = scheduled(row);
    if (!when || Date.parse(when) > nowMs) continue;
    for (const id of idsOf(row)) {
      if (!(id in pinned.retiredModels)) errors.push(`${id} retired ${when} but is not in retiredModels`);
      if (activeModels(pinned).includes(id)) errors.push(`${id} retired ${when} and is still pinned`);
    }
  }

  // SDKs: every AI SDK dependency has a row matching package.json and the
  // lockfile; a row past its announced removal says so and names the successor.
  const sdkRows = factsTable(doc, "SDKs");
  for (const [name, dep] of Object.entries(deps)) {
    const row = sdkRows.find((r) => r.Package === name);
    if (!row) { errors.push(`AI SDK ${name} has no row`); continue; }
    if (row.Pinned !== dep.pinned) errors.push(`${name}: pinned ${dep.pinned} in package.json, ${row.Pinned} in the record`);
    if (row.Installed !== dep.installed) errors.push(`${name}: installed ${dep.installed} in package-lock.json, ${row.Installed} in the record`);
    const removal = /^\d{4}-\d{2}-\d{2}$/.test(row.Removal ?? "") ? row.Removal : null;
    if (removal && Date.parse(removal) <= nowMs) {
      if (!/past removal/i.test(row.Lifecycle ?? "")) errors.push(`${name}: removed ${removal} but the lifecycle does not say "past removal"`);
      if (!row.Successor || row.Successor === "—" || !(row["Owner action"] ?? "").includes(row.Successor)) errors.push(`${name}: past removal without a successor named in the owner action`);
      if (!row["Migration row"] || row["Migration row"] === "—" || !row["Migration row"].includes(row.Successor)) errors.push(`${name}: past removal without a migration row naming ${row.Successor || "its successor"}`);
      const hardFail = /^\d{4}-\d{2}-\d{2}$/.test(row["Hard fail from"] ?? "") ? row["Hard fail from"] : null;
      const firstRetirement = rows.filter((r) => scheduled(r) && idsOf(r).some((id) => activeModels(pinned).includes(id))).map((r) => scheduled(r)!).sort()[0];
      if (!hardFail) errors.push(`${name}: past removal without a hard-fail date`);
      else if (firstRetirement && hardFail >= firstRetirement) errors.push(`${name}: hard-fail date ${hardFail} is not before the first pinned retirement (${firstRetirement})`);
    }
  }
  for (const row of sdkRows) if (!(row.Package in deps)) errors.push(`SDK row ${row.Package} is not a dependency`);

  // The app's price dates are not later than the check that confirmed them.
  if (date && PRICE_TABLE_AS_OF > date) errors.push(`PRICE_TABLE_AS_OF ${PRICE_TABLE_AS_OF} is later than the record (${date})`);
  if (date && TTS_PRICE_AS_OF > date) errors.push(`TTS_PRICE_AS_OF ${TTS_PRICE_AS_OF} is later than the record (${date})`);
  return errors;
}

/* ── the live record ──────────────────────────────────────────────────────── */

describe("B-AIOPS-06 — model facts record matches the app", () => {
  it("the record parses and covers what production runs (non-vacuous)", () => {
    const rows = factsTable(RECORD);
    expect(rows.length).toBeGreaterThanOrEqual(activeModels(PINNED).length);
    const ids = rows.flatMap(idsOf);
    expect(ids).toContain(PINNED.production.VERTEX_MODEL_CHAT);
    // The deploy config is read, not assumed: all five deployed ids are found.
    expect(Object.keys(PROD_ENV).sort()).toEqual(["LIVE_MODEL", "TTS_VOICE_EN", "TTS_VOICE_HE", "VERTEX_MODEL_CHAT", "VERTEX_MODEL_IMAGE"]);
    for (const id of Object.values(PROD_ENV)) expect(ids).toContain(id);
  });

  it("pins, retirement dates and the price table agree with the record", () => {
    expect(factsErrors(RECORD, PINNED, PRICE_TABLE, Date.parse(checkedOn(RECORD)!))).toEqual([]);
  });

  it("the TTS voice price is the record's per-1M-character price", () => {
    const row = factsTable(RECORD).find((r) => r.Source === "B")!;
    const voices = idsOf(row);
    expect(voices.length).toBeGreaterThanOrEqual(2);
    for (const voice of voices) expect(estimateTtsCostUsd(voice, 1_000_000)).toBe(num(row.In));
  });

  it("the introductory price step the record states is the one the estimate applies", () => {
    const row = factsTable(RECORD).find((r) => /introductory to (\d{4}-\d{2}-\d{2})/.test(r["Price basis"]))!;
    expect(row).toBeTruthy();
    const end = row["Price basis"].match(/introductory to (\d{4}-\d{2}-\d{2})/)![1];
    const usage = { promptTokens: 1_000_000, outputTokens: 1_000_000 };
    const before = estimateCostUsd(row.Model, usage, Date.parse(`${end}T23:59:59Z`))!;
    const after = estimateCostUsd(row.Model, usage, Date.parse(`${end}T23:59:59Z`) + 1000)!;
    expect(before).toBeCloseTo(num(row.In)! + num(row.Out)!, 6);
    expect(after).toBeCloseTo(2 * before, 6);
    expect(row.Lifecycle).toMatch(/doubles/);
  });
});

/* LC-15 pattern: the real clock. The run that reliably happens is CI, so the
 * staleness check runs here against Date.now(); fixing a red run means
 * re-reading the sources and updating the record, never widening the window. */
/** SDKs still installed on or after their recorded hard-fail date. */
function sdkPastHardFail(doc: string, nowMs: number, deps: Deps = DEPS): Row[] {
  return factsTable(doc, "SDKs").filter((r) => r.Package in deps && /^\d{4}-\d{2}-\d{2}$/.test(r["Hard fail from"] ?? "") && Date.parse(r["Hard fail from"]) <= nowMs);
}

describe("B-AIOPS-06 — the record's age and the SDK notices (real clock)", () => {
  it(`docs/ops/model-facts.md "Checked on:" is at most ${MAX_AGE_DAYS} days old (warning from ${WARN_DAYS} days before)`, async ({ annotate }) => {
    const age = recordAge(RECORD, Date.now());
    if (!age.stale && age.daysRemaining <= WARN_DAYS) {
      await annotate(`Model facts re-check due: docs/ops/model-facts.md "Checked on: ${age.checkedOn}" reaches ${MAX_AGE_DAYS} days in ${age.daysRemaining} day(s); ${STALE_HELP}.`, "warning");
    }
    expect(age.stale, `docs/ops/model-facts.md "Checked on: ${age.checkedOn}" is ${age.ageDays} days old (limit ${MAX_AGE_DAYS}): ${STALE_HELP}`).toBe(false);
  });

  it("an SDK past its announced removal warns on every run until its hard-fail date, then fails", async ({ annotate }) => {
    const now = Date.now();
    const past = factsTable(RECORD, "SDKs").filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.Removal ?? "") && Date.parse(r.Removal) <= now && r.Package in DEPS);
    for (const r of past) {
      await annotate(`AI SDK past removal: ${r.Package} ${DEPS[r.Package].installed} (removal announced for ${r.Removal}); CI fails from ${r["Hard fail from"]}. Migration row: ${r["Migration row"]}.`, "warning");
    }
    const due = sdkPastHardFail(RECORD, now);
    expect(due.map((r) => r.Package), due.map((r) => `${r.Package} is still installed on or after its hard-fail date ${r["Hard fail from"]} (docs/ops/model-facts.md, SDKs): land "${r["Migration row"]}" or record Guy's new date`).join("; ")).toEqual([]);
  });

  it("no pinned model is past its recorded retirement today", () => {
    const now = Date.now();
    const past = factsTable(RECORD).filter((r) => scheduled(r) && Date.parse(scheduled(r)!) <= now)
      .flatMap(idsOf).filter((id) => activeModels(PINNED).includes(id));
    expect(past).toEqual([]);
  });
});

/* ── negative controls ────────────────────────────────────────────────────── */

describe("B-AIOPS-06 — negative controls", () => {
  const at = Date.parse(checkedOn(RECORD)!);

  it(`a record older than ${MAX_AGE_DAYS} days is stale; one ${MAX_AGE_DAYS} days old is not`, () => {
    expect(recordAge(RECORD, at + MAX_AGE_DAYS * DAY).stale).toBe(false);
    expect(recordAge(RECORD, at + (MAX_AGE_DAYS + 1) * DAY).stale).toBe(true);
    expect(recordAge(RECORD.replace(/^Checked on: .*$/m, ""), at).stale).toBe(true);
  });

  it("a price drift in PRICE_TABLE fails", () => {
    const id = PINNED.production.VERTEX_MODEL_CHAT;
    const drifted = { ...PRICE_TABLE, [id]: { ...PRICE_TABLE[id], outputPerM: PRICE_TABLE[id].outputPerM + 1 } };
    expect(factsErrors(RECORD, PINNED, drifted, at)).toContain(`${id}: output is ${PRICE_TABLE[id].outputPerM + 1} in PRICE_TABLE, ${PRICE_TABLE[id].outputPerM} in the record`);
  });

  it("a newly pinned or deployed model without a row fails", () => {
    const pinned = { ...PINNED, judgeModels: [...PINNED.judgeModels, "synthetic-unrecorded-model-1"] };
    expect(factsErrors(RECORD, pinned, PRICE_TABLE, at)).toContain("pinned model synthetic-unrecorded-model-1 has no row");
    expect(factsErrors(RECORD, PINNED, PRICE_TABLE, at, { ...PROD_ENV, LIVE_MODEL: "synthetic-unrecorded-live-2" }))
      .toContain("deployed LIVE_MODEL=synthetic-unrecorded-live-2 has no row");
  });

  it("a retirement date that drifts from pinned-models.json fails", () => {
    const [id] = Object.keys(PINNED.retiredModels);
    const pinned = { ...PINNED, retiredModels: { ...PINNED.retiredModels, [id]: "2026-11-30" } };
    expect(factsErrors(RECORD, pinned, PRICE_TABLE, at).some((e) => e.startsWith(`${id}: retirement 2026-11-30`))).toBe(true);
  });

  it("a pinned model past its recorded retirement fails", () => {
    const imageRow = factsTable(RECORD).find((r) => scheduled(r) && Date.parse(scheduled(r)!) > at)!;
    const later = Date.parse(scheduled(imageRow)!) + DAY;
    const errors = factsErrors(RECORD, PINNED, PRICE_TABLE, later);
    expect(errors).toContain(`${imageRow.Model} retired ${imageRow.Retirement} and is still pinned`);
    expect(errors).toContain(`${imageRow.Model} retired ${imageRow.Retirement} but is not in retiredModels`);
  });

  it("pricing a model the record marks as not priced by the app fails", () => {
    const live = factsTable(RECORD).find((r) => /not priced by the app/.test(r["Price basis"]))!;
    const priced = { ...PRICE_TABLE, [live.Model]: { inputPerM: 1, outputPerM: 1 } };
    expect(factsErrors(RECORD, PINNED, priced, at)).toContain(`${live.Model}: the record says the app does not price it, but PRICE_TABLE does`);
  });

  it("an AI SDK version drift, a missing SDK row, or a past-removal row without its successor fails", () => {
    const [name] = Object.keys(DEPS);
    expect(factsErrors(RECORD, PINNED, PRICE_TABLE, at, PROD_ENV, { ...DEPS, [name]: { ...DEPS[name], installed: "0.0.1" } }))
      .toContain(`${name}: installed 0.0.1 in package-lock.json, ${DEPS[name].installed} in the record`);
    expect(factsErrors(RECORD, PINNED, PRICE_TABLE, at, PROD_ENV, { ...DEPS, "openai": { pinned: "^9.0.0", installed: "9.0.0" } }))
      .toContain("AI SDK openai has no row");
    const past = factsTable(RECORD, "SDKs").find((r) => /past removal/i.test(r.Lifecycle))!;
    const stripped = RECORD.replace(past["Owner action"], "Nothing planned");
    expect(factsErrors(stripped, PINNED, PRICE_TABLE, at)).toContain(`${past.Package}: past removal without a successor named in the owner action`);
  });

  it("a past-removal SDK needs a migration row and a hard-fail date before the first pinned retirement", () => {
    const past = factsTable(RECORD, "SDKs").find((r) => /past removal/i.test(r.Lifecycle))!;
    expect(factsErrors(RECORD.replace(past["Migration row"], "—"), PINNED, PRICE_TABLE, at)).toContain(`${past.Package}: past removal without a migration row naming ${past.Successor}`);
    expect(factsErrors(RECORD.replace(`| ${past["Hard fail from"]} |`, "| — |"), PINNED, PRICE_TABLE, at)).toContain(`${past.Package}: past removal without a hard-fail date`);
    expect(factsErrors(RECORD.replace(`| ${past["Hard fail from"]} |`, "| 2027-04-01 |"), PINNED, PRICE_TABLE, at).some((e) => e.startsWith(`${past.Package}: hard-fail date 2027-04-01 is not before the first pinned retirement`))).toBe(true);
  });

  it("the SDK hard fail trips on its date, not the day before", () => {
    const past = factsTable(RECORD, "SDKs").find((r) => /past removal/i.test(r.Lifecycle))!;
    const day = Date.parse(past["Hard fail from"]);
    expect(sdkPastHardFail(RECORD, day - 1).map((r) => r.Package)).toEqual([]);
    expect(sdkPastHardFail(RECORD, day).map((r) => r.Package)).toEqual([past.Package]);
  });
});
