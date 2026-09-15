/**
 * cohort-report — N1-05 (OBJ-INF-04). The lead's command.
 *
 *   node app/scripts/cohort-report.mjs --since 2026-09-15 \
 *     --retention --activation --funnel billing --events
 *
 * Runs on Application Default Credentials against production Firestore and
 * prints one dated table. ADC bypasses security rules, which is exactly why
 * this script reads only two things:
 *   1. `retentionRollups/{uid}` — day keys, counts and two acquisition props
 *      (N1-04 pins the key set), and
 *   2. event NAMES plus three grouping props.
 * It never touches `users/{uid}/children/**`. A recursive key scan of the
 * printed object refuses /child|name|note|text|transcript/i outright.
 *
 * TWO PRINTING LAWS, both of them about honesty rather than formatting:
 *   - `rate: null` prints "not answerable yet". A young cohort has no answer,
 *     and printing 0% for "nobody is eligible yet" is how a retention
 *     dashboard lies to the person who has to decide on it.
 *   - No percentage is ever printed on an empty denominator. `pct()` returns
 *     the honest string, and there is no second formatter.
 *
 * At T+7 a `d28` bucket with eligible = 0 is the CORRECT answer, not a miss —
 * no cohort is 28 days old yet. WAVE-N1 §6 states the thresholds.
 *
 * Flags: --retention --activation --funnel <name> --events
 *        --since <ISO|YYYY-MM-DD> --group-by source|market --json
 * With no section flag, every section prints.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_SRC = path.resolve(HERE, "..", "src");

const RETENTION_ROLLUP_COLLECTION = "retentionRollups";
const EVENT_PROP_ALLOWLIST = ["source", "market", "utm_campaign"];
const FORBIDDEN_RESPONSE_KEY = /child|name|note|text|transcript/i;
const MAX_ROLLUPS = 5000;
const MAX_EVENTS = 20000;
const DAY_MS = 86_400_000;

/** The named chains. `acquisition` MUST equal lib/attributionFunnel.ts's
 *  FUNNEL_EVENTS (N1-03 added the `activated` stage to it); the guard pins the
 *  two, because a script that prints a stale chain prints a stale funnel. */
const FUNNEL_CHAINS = {
  acquisition: ["install", "first_plan", "activated", "paid"],
  billing: ["paywall_view", "checkout_start", "entitlement_active"],
};

/* ── flags ───────────────────────────────────────────────────────────────── */

function parseArgs(argv) {
  const out = { funnels: [], sections: new Set(), json: false, since: null, groupBy: "source" };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--retention") out.sections.add("retention");
    else if (a === "--activation") out.sections.add("activation");
    else if (a === "--events") out.sections.add("events");
    else if (a === "--funnel") { out.sections.add("funnel"); out.funnels.push(argv[++i]); }
    else if (a === "--since") out.since = argv[++i];
    else if (a === "--group-by") out.groupBy = argv[++i] === "market" ? "market" : "source";
    else if (a === "--json") out.json = true;
    else if (a === "--help" || a === "-h") out.help = true;
  }
  if (out.sections.size === 0) {
    out.sections = new Set(["retention", "activation", "funnel", "events"]);
    if (out.funnels.length === 0) out.funnels = Object.keys(FUNNEL_CHAINS);
  }
  if (!out.since) out.since = new Date(Date.now() - 7 * DAY_MS).toISOString();
  return out;
}

/* ── the two printing laws ───────────────────────────────────────────────── */

/** A rate that does not exist prints as a sentence, never as a number. */
export function formatRate(rate, eligible) {
  if (eligible === 0 || rate === null || rate === undefined) return "not answerable yet";
  return `${Math.round(rate * 1000) / 10}%`;
}

/** No percentage on an empty denominator. Ever. */
export function pct(numerator, denominator) {
  if (!denominator) return "not answerable yet";
  return `${Math.round((numerator / denominator) * 1000) / 10}%`;
}

export function scanForbiddenKeys(value, keyPath = "$") {
  if (Array.isArray(value)) return value.flatMap((v, i) => scanForbiddenKeys(v, `${keyPath}[${i}]`));
  if (!value || typeof value !== "object") return [];
  const hits = [];
  for (const [key, v] of Object.entries(value)) {
    if (FORBIDDEN_RESPONSE_KEY.test(key)) hits.push(`${keyPath}.${key}`);
    hits.push(...scanForbiddenKeys(v, `${keyPath}.${key}`));
  }
  return hits;
}

/* ── the activation definition, read from the module that owns it ────────── */

/**
 * N1-03 (builder A) owns the definition. This script cannot import a
 * TypeScript module at runtime, so it reads the SOURCE — which is also the
 * point: the printed sentence and the code that computes the number come from
 * the same file, so they cannot drift. An absent module prints a loud line, not
 * a silent default.
 */
export function readActivationDefinition(srcDir = APP_SRC) {
  const file = path.join(srcDir, "lib", "activation.ts");
  if (!fs.existsSync(file)) {
    return { definition: null, definitionStatus: `lib/activation.ts not found — N1-03 has not landed; the activation count has no printed definition` };
  }
  const src = fs.readFileSync(file, "utf8");
  const days = src.match(/ACTIVATION_WINDOW_DAYS\s*(?::[^=]+)?=\s*(\d+)/);
  const loopEvents = src.match(/ACTIVATION_LOOP_EVENTS\s*(?::[^=]+)?=\s*\[([\s\S]*?)\]/);
  const names = loopEvents
    ? loopEvents[1].split(",").map((s) => s.trim().replace(/^["'`]|["'`]$/g, "")).filter(Boolean)
    : null;

  // The declaration is a `+`-concatenation of literals and the two constants
  // above, so the whole right-hand side is resolved token by token rather than
  // matched as one quoted string — a regex that stopped at the first closing
  // quote would print a TRUNCATED definition, which is worse than none.
  const declared = src.match(/ACTIVATION_DEFINITION\s*(?::[^=]+)?=([\s\S]*?);\s*(?:\r?\n|$)/);
  if (declared) {
    const parts = [];
    let unresolved = null;
    for (const raw of declared[1].split("+")) {
      const token = raw.trim();
      if (!token) continue;
      const literal = token.match(/^(["'`])([\s\S]*)\1$/);
      if (literal) { parts.push(literal[2]); continue; }
      const joined = token.match(/^ACTIVATION_LOOP_EVENTS\.join\(\s*(["'`])([\s\S]*?)\1\s*\)$/);
      if (joined && names) { parts.push(names.join(joined[2])); continue; }
      if (token === "ACTIVATION_WINDOW_DAYS" && days) { parts.push(days[1]); continue; }
      if (token === "ACTIVATION_START_EVENT") { parts.push("onboarding_completed"); continue; }
      unresolved = token;
      break;
    }
    if (!unresolved && parts.length > 0) return { definition: parts.join("").trim(), definitionStatus: null };
    return {
      definition: null,
      definitionStatus: `ACTIVATION_DEFINITION contains an expression this reader cannot resolve (${unresolved}) — print it from the module or simplify the declaration`,
    };
  }

  if (days && names) {
    return {
      definition: `activated = onboarding_completed, then one of [${names.join(", ")}] on a LATER local day, within ${days[1]} days`,
      definitionStatus: null,
    };
  }
  return { definition: null, definitionStatus: "lib/activation.ts exports neither ACTIVATION_DEFINITION nor ACTIVATION_WINDOW_DAYS + ACTIVATION_LOOP_EVENTS" };
}

/* ── retention arithmetic: the SAME rules lib/retention.ts states ────────── */

const dayIndex = (firstSeen, day) => {
  const a = Date.parse(`${firstSeen}T00:00:00Z`);
  const b = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / DAY_MS);
};

const RETENTION_DAYS = [1, 7, 28, 30];

/**
 * The script runs outside the bundle, so it cannot import lib/retention.ts.
 * The rule that matters — `rate` is null, never 0, on an empty denominator —
 * is restated here and pinned by the guard against the library's own output on
 * a shared fixture, so the two cannot disagree.
 */
export function cohortRetention(rollups, asOfDay) {
  const out = {};
  for (const day of RETENTION_DAYS) {
    let eligible = 0;
    let returned = 0;
    for (const r of rollups) {
      const elapsed = dayIndex(r.firstSeen, asOfDay);
      if (elapsed === null || elapsed < day) continue;
      eligible += 1;
      const offsets = r.activeDays.map((d) => dayIndex(r.firstSeen, d));
      if (offsets.includes(day)) returned += 1;
    }
    out[`d${day}`] = { eligible, returned, rate: eligible === 0 ? null : returned / eligible };
  }
  return out;
}

export function countFunnelChain(events, chain, groupBy) {
  const groups = new Map();
  for (const e of events) {
    if (!chain.includes(e.event)) continue;
    const key = String(e.props?.[groupBy] ?? "unknown");
    const row = groups.get(key) ?? Object.fromEntries(chain.map((s) => [s, 0]));
    row[e.event] += 1;
    groups.set(key, row);
  }
  return [...groups.entries()]
    .map(([key, counts]) => ({ key, stages: chain.map((stage) => ({ stage, count: counts[stage] })) }))
    .sort((a, b) => b.stages[0].count - a.stages[0].count);
}

export function summariseActivation(events, asOf, windowDays) {
  const activated = new Set();
  const eligible = new Set();
  const cutoff = asOf - windowDays * DAY_MS;
  for (const e of events) {
    if (e.event === "activated") activated.add(e.uid);
    if (e.event === "onboarding_completed") {
      const at = e.at ? Date.parse(e.at) : NaN;
      if (Number.isFinite(at) && at <= cutoff) eligible.add(e.uid);
    }
  }
  return { count: activated.size, denominator: eligible.size };
}

/* ── Firestore, on ADC ───────────────────────────────────────────────────── */

const projectProps = (raw) => {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const key of EVENT_PROP_ALLOWLIST) {
    const v = raw[key];
    if (typeof v === "string" || typeof v === "number") out[key] = v;
  }
  return out;
};

async function connect() {
  const { getApps, initializeApp, applicationDefault } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  if (!getApps().length) {
    initializeApp({
      credential: applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT_ID,
    });
  }
  return getFirestore(process.env.FIRESTORE_DATABASE_ID || "(default)");
}

async function fetchRollups(db) {
  const snap = await db.collection(RETENTION_ROLLUP_COLLECTION).limit(MAX_ROLLUPS).get();
  const out = [];
  for (const d of snap.docs) {
    const data = d.data();
    if (typeof data.firstSeen !== "string" || !Array.isArray(data.activeDays)) continue;
    out.push({
      firstSeen: data.firstSeen,
      activeDays: data.activeDays.filter((x) => typeof x === "string"),
      source: typeof data.source === "string" ? data.source : null,
      market: typeof data.market === "string" ? data.market : null,
    });
  }
  return out;
}

async function fetchEvents(db, sinceIso) {
  const since = Date.parse(sinceIso);
  const collect = (docs) => {
    const out = [];
    for (const d of docs) {
      const data = d.data();
      if (typeof data.event !== "string") continue;
      const at = data.at?.toDate ? data.at.toDate().toISOString() : (typeof data.at === "string" ? data.at : null);
      if (at && Date.parse(at) < since) continue;
      out.push({ uid: d.ref.parent.parent?.id ?? "unknown", event: data.event, at, props: projectProps(data.props) });
    }
    return out;
  };
  try {
    const snap = await db.collectionGroup("events").orderBy("at", "desc").limit(MAX_EVENTS).get();
    return { events: collect(snap.docs), mode: "ordered" };
  } catch (error) {
    // A COLLECTION_GROUP-scoped index on `events.at` is not declared in
    // firestore.indexes.json (only `events.event` is). Fall back rather than
    // fail, and SAY SO — a number whose provenance is unclear is worse than a
    // missing one. The index entry to add is in FOLLOW-UPS-N1.md.
    const snap = await db.collectionGroup("events").limit(MAX_EVENTS).get();
    return { events: collect(snap.docs), mode: `unordered fallback (${String(error?.message || error).slice(0, 120)})` };
  }
}

/* ── printing ────────────────────────────────────────────────────────────── */

const rule = (s) => `\n${s}\n${"-".repeat(s.length)}`;

function print(report, args) {
  const lines = [];
  lines.push(`Arbor cohort report — generated ${report.generatedAt}`);
  lines.push(`window: since ${report.since}  ·  as of ${report.asOfDay}  ·  grouped by ${report.groupBy}`);
  lines.push(`scanned: ${report.scanned.rollups} rollups, ${report.scanned.events} events (${report.scanned.mode})`);

  if (args.sections.has("retention")) {
    lines.push(rule("Retention"));
    if (report.scanned.rollups === 0) {
      lines.push("  no rollup documents — the N1-04 writer is not firing, or nothing has been written yet");
    }
    for (const [bucket, b] of Object.entries(report.retention)) {
      lines.push(`  ${bucket.padEnd(4)}  eligible ${String(b.eligible).padStart(5)}  returned ${String(b.returned).padStart(5)}  rate ${formatRate(b.rate, b.eligible)}`);
    }
    lines.push("  (a bucket with eligible = 0 is not answerable yet — that is the correct answer, not 0%)");
  }

  if (args.sections.has("activation")) {
    lines.push(rule("Activation"));
    lines.push(`  activated ${report.activation.count} of ${report.activation.denominator} eligible  ·  ${pct(report.activation.count, report.activation.denominator)}`);
    lines.push(`  definition: ${report.activation.definition ?? "UNAVAILABLE"}`);
    if (report.activation.definitionStatus) lines.push(`  ! ${report.activation.definitionStatus}`);
  }

  if (args.sections.has("funnel")) {
    for (const [name, rows] of Object.entries(report.funnels)) {
      lines.push(rule(`Funnel — ${name}`));
      if (rows.length === 0) lines.push("  no events in the window");
      for (const row of rows) {
        const chain = row.stages.map((s) => `${s.stage} ${s.count}`).join("  →  ");
        const monotonic = row.stages.every((s, i) => i === 0 || s.count <= row.stages[i - 1].count);
        lines.push(`  ${row.key.padEnd(14)} ${chain}${monotonic ? "" : "   ** NOT MONOTONIC **"}`);
      }
    }
  }

  if (args.sections.has("events")) {
    lines.push(rule("Event census"));
    if (report.eventCensus.length === 0) lines.push("  no events in the window");
    for (const row of report.eventCensus) lines.push(`  ${row.stage.padEnd(28)} ${row.count}`);
  }

  return lines.join("\n");
}

/* ── main ────────────────────────────────────────────────────────────────── */

export async function buildReport(db, args, now = new Date()) {
  const [rollups, eventsResult] = await Promise.all([fetchRollups(db), fetchEvents(db, args.since)]);
  const { events, mode } = eventsResult;
  const asOfDay = now.toISOString().slice(0, 10);
  const census = new Map();
  for (const e of events) census.set(e.event, (census.get(e.event) ?? 0) + 1);
  const funnels = {};
  for (const name of args.funnels) {
    const chain = FUNNEL_CHAINS[name];
    if (!chain) continue;
    funnels[name] = countFunnelChain(events, chain, args.groupBy);
  }
  const { definition, definitionStatus } = readActivationDefinition();
  return {
    since: args.since,
    asOfDay,
    groupBy: args.groupBy,
    retention: cohortRetention(rollups, asOfDay),
    activation: { ...summariseActivation(events, now.getTime(), 7), definition, definitionStatus },
    funnels,
    eventCensus: [...census.entries()].map(([stage, count]) => ({ stage, count })).sort((a, b) => b.count - a.count || a.stage.localeCompare(b.stage)),
    scanned: { rollups: rollups.length, events: events.length, mode },
    generatedAt: now.toISOString(),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`cohort-report — the founder's cohort read\n\n  --retention --activation --funnel <${Object.keys(FUNNEL_CHAINS).join("|")}> --events\n  --since <ISO|YYYY-MM-DD>  --group-by source|market  --json\n\nRuns on ADC. Reads retentionRollups + event names only.\n`);
    return;
  }
  let db;
  try {
    db = await connect();
  } catch (error) {
    process.stderr.write(`cohort-report: no Firestore connection (ADC missing?) — ${error?.message || error}\n`);
    process.exitCode = 2;
    return;
  }
  const report = await buildReport(db, args);

  const leaks = scanForbiddenKeys(report);
  if (leaks.length > 0) {
    process.stderr.write(`cohort-report: REFUSING to print — forbidden keys in the report: ${leaks.join(", ")}\n`);
    process.exitCode = 3;
    return;
  }

  process.stdout.write(args.json ? `${JSON.stringify(report, null, 2)}\n` : `${print(report, args)}\n`);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  main().catch((error) => {
    process.stderr.write(`cohort-report: ${error?.stack || error}\n`);
    process.exitCode = 1;
  });
}

export { parseArgs, print, FUNNEL_CHAINS };
