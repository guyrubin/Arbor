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
 * Flags: --retention --activation --funnel <name> --events --households
 *        --since <ISO|YYYY-MM-DD> --group-by source|market --json
 *        --include-internal
 *
 * B-GROWTH-43: `--households` prints one line per group — families that
 * started in the window → the offer each redeemed (`offerRedemptions/{uid}`)
 * → activated → paying / lapsed (`entitlements/{uid}`, reduced to booleans
 * on read). Mirrors server/cohortMetrics.ts summariseHouseholds; the guard
 * runs both on one fixture.
 *
 * BD-25: `--contract` prints the metric contract (lib/metricContract.ts):
 * D7 first value, W4 (a value action on day 22–28), D30 paying, each as
 * numerator of a MATURED all-start denominator, per source and per offer;
 * Gate A's two halves; and every missing-data line, every time.
 * With no section flag, every section prints.
 *
 * B-MEAS-01: families whose rollup carries `cohort: "internal"` (founder,
 * comped testers, `@example.com` release-smoke accounts — tagged server-side
 * via /entitlement, never by email in the rollup) are EXCLUDED from every
 * number by default, with their events, and the excluded count is printed.
 * `--include-internal` puts them back.
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
  // B-MEAS-02: the pilot's primary metric (server/cohortMetrics.ts summariseLoop).
  loop: ["today_action_accepted", "today_action_outcome", "loop_continued"],
};

/* ── flags ───────────────────────────────────────────────────────────────── */

function parseArgs(argv) {
  const out = { funnels: [], sections: new Set(), json: false, since: null, groupBy: "source", includeInternal: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--retention") out.sections.add("retention");
    else if (a === "--activation") out.sections.add("activation");
    else if (a === "--events") out.sections.add("events");
    else if (a === "--households") out.sections.add("households");
    else if (a === "--contract") out.sections.add("contract");
    else if (a === "--funnel") { out.sections.add("funnel"); out.funnels.push(argv[++i]); }
    else if (a === "--since") out.since = argv[++i];
    else if (a === "--group-by") out.groupBy = argv[++i] === "market" ? "market" : "source";
    else if (a === "--json") out.json = true;
    else if (a === "--include-internal") out.includeInternal = true;
    else if (a === "--help" || a === "-h") out.help = true;
  }
  if (out.sections.size === 0) {
    out.sections = new Set(["retention", "activation", "funnel", "events", "households", "contract"]);
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

/** B-MEAS-01: drop internal families (and their events) unless asked not to.
 *  Mirrors server/cohortMetrics.ts `excludeInternal`; the guard runs both. */
export function excludeInternal(rollups, events, includeInternal = false) {
  // B-DIST-01: the demo family (cohort "demo") is never a family — out even with --include-internal.
  const dropped = new Set();
  const kept = [];
  let demoExcluded = 0;
  for (const r of rollups) {
    if (r.cohort === "demo" || (!includeInternal && r.cohort === "internal")) {
      if (r.cohort === "demo") demoExcluded += 1;
      if (r.uid) dropped.add(r.uid);
    } else kept.push(r);
  }
  return { rollups: kept, events: events.filter((e) => !dropped.has(e.uid)), excluded: rollups.length - kept.length, demoExcluded };
}

/** B-MEAS-02 — ISO-8601 week key (YYYY-Www), UTC. Mirrors cohortMetrics.isoWeekOf. */
export function isoWeekOf(iso) {
  const ms = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  const day = (d.getUTCDay() + 6) % 7;
  const thursday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3));
  const year = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(((thursday.getTime() - jan4.getTime()) / DAY_MS - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** B-MEAS-02 — per family per ISO week: completed = emitted loop_continued;
 *  eligible = active (any event). share null on 0 eligible. Mirrors
 *  cohortMetrics.summariseLoop (the parity guard runs both on one fixture). */
export function summariseLoop(events) {
  const active = new Map();
  const done = new Map();
  for (const e of events) {
    const week = isoWeekOf(e.at);
    if (!week) continue;
    if (!active.has(week)) active.set(week, new Set());
    active.get(week).add(e.uid);
    if (e.event === "loop_continued") {
      if (!done.has(week)) done.set(week, new Set());
      done.get(week).add(e.uid);
    }
  }
  const weeks = [...active.keys()].sort().map((week) => {
    const eligible = active.get(week).size;
    const completed = done.get(week)?.size ?? 0;
    return { week, completed, eligible, share: eligible > 0 ? completed / eligible : null };
  });
  const completed = weeks.reduce((n, w) => n + w.completed, 0);
  const eligible = weeks.reduce((n, w) => n + w.eligible, 0);
  return { weeks, completed, eligible, share: eligible > 0 ? completed / eligible : null };
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

/* ── B-GROWTH-43: the household line (mirrors server/cohortMetrics.ts) ───── */

/** lib/offers.ts OFFER_IDS, restated (pinned by the guard). */
export const OFFER_IDS = ["referral_month", "founding_family"];
export const OFFER_REDEMPTIONS_COLLECTION = "offerRedemptions";
const BILLED_PROVIDERS = new Set(["stripe", "app_store", "play_store"]);

/** server/entitlements.ts recordStillEntitles, restated. */
function recordStillEntitles(record, now) {
  if (record.plan === "free") return true;
  if (record.status === "expired") return false;
  if (record.currentPeriodEnd && record.willRenew === false && record.status !== "in_trial") {
    const end = Date.parse(record.currentPeriodEnd);
    if (Number.isFinite(end) && end < now) return false;
  }
  return true;
}

/** Mirrors cohortMetrics.billingStateOf: a billing record reduced to three booleans. */
export function billingStateOf(record, now = Date.now()) {
  const billed = !!record?.provider && BILLED_PROVIDERS.has(record.provider);
  if (!record || !billed) return { billed: false, paying: false, lapsed: false };
  const entitles = record.plan !== "free" && recordStillEntitles(record, now);
  return { billed, paying: entitles && record.status !== "in_trial", lapsed: !entitles };
}

/* BD-37 — lib/acquisitionChannel.ts restated (the guard runs both on one table). */
export const ACQUISITION_CHANNELS = ["practitioner", "centre", "presenter", "sponsor", "studio", "founding", "referral", "content", "search", "store", "direct", "other"];
const SELF_NAMED_CHANNELS = new Set(["practitioner", "centre", "presenter", "sponsor", "studio", "founding", "referral", "direct"]);
const CONTENT_SOURCES = new Set(["instagram", "tiktok", "youtube", "facebook", "whatsapp", "telegram", "creator", "pr", "newsletter", "landing", "qr"]);
const CONTENT_HOST = /(^|\.)(instagram\.com|facebook\.com|fb\.com|tiktok\.com|youtube\.com|youtu\.be|whatsapp\.com|wa\.me|t\.me|telegram\.org|linkedin\.com|lnkd\.in|t\.co|x\.com|twitter\.com|reddit\.com|pinterest\.com)$/;
const SEARCH_HOST = /(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|search\.yahoo\.com|yahoo\.com|ecosia\.org|yandex\.[a-z.]+|baidu\.com|search\.brave\.com)$/;
const STORE_SOURCES = new Set(["appstore", "playstore", "apps.apple.com", "play.google.com"]);

export function channelOfSource(source) {
  const s = String(source ?? "").trim().toLowerCase();
  if (!s) return "other";
  if (SELF_NAMED_CHANNELS.has(s)) return s;
  if (CONTENT_SOURCES.has(s) || CONTENT_HOST.test(s)) return "content";
  if (STORE_SOURCES.has(s)) return "store";
  if (SEARCH_HOST.test(s)) return "search";
  return "other";
}

/** Mirrors cohortMetrics.householdGroupKey. */
export const householdGroupKey = (r, groupBy) => (groupBy === "channel" ? channelOfSource(r.source) : String(r[groupBy] ?? "unknown"));

/** Mirrors cohortMetrics.summariseHouseholds. */
export function summariseHouseholds(rollups, events, offers, billing, groupBy, startedSince = null) {
  const activated = new Set(events.filter((e) => e.event === "activated").map((e) => e.uid));
  const offerOf = new Map((offers ?? []).map((o) => [o.uid, o.offerId]));
  const billingOf = new Map((billing ?? []).map((b) => [b.uid, b]));
  const groups = new Map();
  const seen = new Set();
  for (const r of rollups) {
    if (!r.uid || seen.has(r.uid)) continue;
    if (startedSince && r.firstSeen < startedSince) continue;
    seen.add(r.uid);
    const key = householdGroupKey(r, groupBy);
    const line = groups.get(key) ?? {
      key,
      households: 0,
      offers: [...OFFER_IDS, "none"].map((offer) => ({ offer, households: 0 })),
      activated: 0,
      paying: 0,
      lapsed: 0,
    };
    line.households += 1;
    const offer = offerOf.get(r.uid);
    const slot = line.offers.find((o) => o.offer === (offer && OFFER_IDS.includes(offer) ? offer : "none"));
    if (slot) slot.households += 1;
    if (activated.has(r.uid)) line.activated += 1;
    const b = billingOf.get(r.uid);
    if (b?.paying) line.paying += 1;
    if (b?.lapsed) line.lapsed += 1;
    groups.set(key, line);
  }
  return {
    lines: [...groups.values()].sort((a, b) => b.households - a.households || a.key.localeCompare(b.key)),
    offersRead: offers !== null,
    billingRead: billing !== null,
  };
}

/* ── BD-25: the metric contract (mirrors server/cohortMetrics.ts) ────────── */

/** lib/metricContract.ts, restated; the guard pins every constant. */
export const METRIC_CONTRACT_VERSION = "bd25-2026-10-28";
export const MATURITY_DAYS = { d7: 7, w4: 28, d30: 30 };
export const W4_DAYS = { from: 22, to: 28 };
export const VALUE_EVENTS = ["capture_saved", "today_action_accepted", "today_action_outcome", "keep_this", "plan_approved"];
export const GATE_A = { activatedMaturedW4: 50, fullPricePayers: 10 };
export const MEASURE_DEFINITIONS = {
  d7: "D7 first value: households activated (lib/activation.ts definition) among households whose access began at least 7 days ago",
  w4: "W4: households with a value action (" + VALUE_EVENTS.join(", ") + ") on day 22 to 28 after access, among households whose access began at least 28 days ago",
  d30: "D30 paying: households paying from a store record at read time (not a comp, not a store trial) among households whose access began at least 30 days ago",
  offer: "offer: the one offer a household redeemed (lib/offers.ts); a referral past the referrer's cap still counts, the family got its month",
  renewal: "renewal: an actual second charge",
};
export const STANDING_MISSING_DATA = [
  "renewal (second charge): the entitlement record keeps no charge history; needs the billing export",
  "full price: price, discount and refund are not in the entitlement record; full-price payers here are store payers with no offer, to reconcile against receipts",
  "household: one account per household; co-parent accounts in one family count twice",
];

const dayKeyOfIso = (at) => {
  const ms = Date.parse(at);
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : null;
};

/** Mirrors cohortMetrics.summariseMetricContract. */
export function summariseMetricContract(input) {
  const { rollups, events, offers, billing, groupBy, asOfDay } = input;
  const activated = new Set(events.filter((e) => e.event === "activated").map((e) => e.uid));
  const valueDays = new Map();
  for (const e of events) {
    if (!VALUE_EVENTS.includes(e.event) || !e.at) continue;
    const d = dayKeyOfIso(e.at);
    if (d) valueDays.set(e.uid, [...(valueDays.get(e.uid) ?? []), d]);
  }
  const offerOf = new Map((offers ?? []).map((o) => [o.uid, OFFER_IDS.includes(o.offerId) ? o.offerId : "none"]));
  const billingOf = new Map((billing ?? []).map((b) => [b.uid, b]));
  const households = [];
  const seen = new Set();
  for (const r of rollups) {
    if (!r.uid || seen.has(r.uid)) continue;
    if (input.startedSince && r.firstSeen < input.startedSince) continue;
    const age = dayIndex(r.firstSeen, asOfDay);
    if (age === null) continue;
    seen.add(r.uid);
    households.push({ uid: r.uid, group: householdGroupKey(r, groupBy), channel: channelOfSource(r.source), offer: offerOf.get(r.uid) ?? "none", age, firstSeen: r.firstSeen });
  }
  const row = (key, hs) => {
    const d7 = { n: 0, of: 0 };
    const w4 = { n: 0, of: 0 };
    const d30 = { n: 0, of: 0 };
    for (const h of hs) {
      if (h.age >= MATURITY_DAYS.d7) {
        d7.of += 1;
        if (activated.has(h.uid)) d7.n += 1;
      }
      if (h.age >= MATURITY_DAYS.w4) {
        w4.of += 1;
        const inWeek4 = (valueDays.get(h.uid) ?? []).some((d) => {
          const i = dayIndex(h.firstSeen, d);
          return i !== null && i >= W4_DAYS.from && i <= W4_DAYS.to;
        });
        if (inWeek4) w4.n += 1;
      }
      if (h.age >= MATURITY_DAYS.d30) {
        d30.of += 1;
        if (billingOf.get(h.uid)?.paying) d30.n += 1;
      }
    }
    return { key, starts: hs.length, d7, w4, d30Paying: billing === null ? null : d30 };
  };
  const split = (by, order) => {
    const groups = new Map();
    for (const k of order ?? []) groups.set(k, []);
    for (const h of households) groups.set(by(h), [...(groups.get(by(h)) ?? []), h]);
    const rows = [...groups.entries()].map(([k, hs]) => row(k, hs));
    return order ? rows : rows.sort((a, b) => b.starts - a.starts || a.key.localeCompare(b.key));
  };
  const activatedMaturedW4 = households.filter((h) => h.age >= MATURITY_DAYS.w4 && activated.has(h.uid)).length;
  const fullPricePayers = billing === null || offers === null
    ? null
    : households.filter((h) => h.offer === "none" && billingOf.get(h.uid)?.paying).length;
  const missing = [...STANDING_MISSING_DATA];
  if (offers === null) missing.push("offers: the redemption records were not read; the offer split and full-price payers are unknown");
  if (billing === null) missing.push("billing: the entitlement records were not read; D30 paying and full-price payers are unknown");
  if (input.eventsTruncated) missing.push("events: the scan hit its ceiling; activation and W4 counts may be low");
  return {
    version: METRIC_CONTRACT_VERSION,
    asOfDay,
    definitions: { ...MEASURE_DEFINITIONS },
    overall: row("all", households),
    byGroup: split((h) => h.group),
    byOffer: split((h) => h.offer, [...OFFER_IDS, "none"]),
    byChannel: split((h) => h.channel, ACQUISITION_CHANNELS).filter((r) => r.starts > 0),
    gateA: {
      activatedMaturedW4: { n: activatedMaturedW4, required: GATE_A.activatedMaturedW4 },
      fullPricePayers: { n: fullPricePayers, required: GATE_A.fullPricePayers },
      met: fullPricePayers === null ? null : activatedMaturedW4 >= GATE_A.activatedMaturedW4 && fullPricePayers >= GATE_A.fullPricePayers,
    },
    missing,
  };
}

/** "n of m · x%", and "not answerable yet" on an empty denominator (the second printing law). */
const fraction = (f) => (f === null ? "unknown (not read)" : `${f.n} of ${f.of}  ·  ${pct(f.n, f.of)}`);

async function fetchOfferRedemptions(db) {
  const snap = await db.collection(OFFER_REDEMPTIONS_COLLECTION).limit(MAX_ROLLUPS).get();
  return snap.docs.flatMap((d) => (typeof d.data().offerId === "string" ? [{ uid: d.id, offerId: d.data().offerId }] : []));
}

async function fetchBillingStates(db, now) {
  const snap = await db.collection("entitlements").limit(MAX_ROLLUPS).get();
  return snap.docs.map((d) => ({ uid: d.id, ...billingStateOf(d.data(), now) }));
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
      uid: typeof d.id === "string" ? d.id : undefined,
      cohort: data.cohort === "internal" ? "internal" : data.cohort === "demo" ? "demo" : "family",
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
  if (report.internal) {
    lines.push(report.internal.included
      ? "internal included (--include-internal): founder, comped and smoke accounts are IN these numbers"
      : `internal excluded: ${report.internal.excluded}`);
  }

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
    if (report.loop) {
      lines.push(rule("Loop — families who continued from a reported outcome, per ISO week"));
      if (report.loop.weeks.length === 0) lines.push("  no active families in the window — not answerable yet");
      for (const w of report.loop.weeks) {
        lines.push(`  ${w.week}  completed ${String(w.completed).padStart(4)} of ${String(w.eligible).padStart(4)} eligible  ·  ${pct(w.completed, w.eligible)}`);
      }
      lines.push(`  all weeks: completed ${report.loop.completed} of ${report.loop.eligible} family-weeks  ·  ${pct(report.loop.completed, report.loop.eligible)}`);
    }
  }

  if (args.sections.has("households") && report.households) {
    const h = report.households;
    lines.push(rule("Households by acquisition channel — started in the window → offer → activated → paying"));
    if (!h.offersRead) lines.push("  ! offer redemptions not read — the offer columns are unknown, not zero");
    if (!h.billingRead) lines.push("  ! billing records not read — paying and lapsed are unknown, not zero");
    if (h.lines.length === 0) lines.push("  no family started in the window — not answerable yet");
    for (const l of h.lines) {
      const offers = l.offers.map((o) => `${o.offer} ${o.households}`).join(", ");
      lines.push(`  ${l.key.padEnd(14)} started ${l.households}  ·  offer [${offers}]  →  activated ${l.activated} of ${l.households}  →  paying ${l.paying} of ${l.households}  ·  lapsed ${l.lapsed}`);
    }
    lines.push("  (lapsed = a store record that no longer entitles: expired, refunded, an unpaid store trial or a moved subscription; net paid needs the billing export)");
  }

  if (args.sections.has("contract") && report.contract) {
    const c = report.contract;
    lines.push(rule(`Metric contract (${c.version}) — matured all-start denominators, as of ${c.asOfDay}`));
    for (const key of ["d7", "w4", "d30"]) lines.push(`  ${c.definitions[key]}`);
    const printRow = (r) => lines.push(`  ${r.key.padEnd(16)} starts ${String(r.starts).padStart(4)}  ·  D7 ${fraction(r.d7)}  ·  W4 ${fraction(r.w4)}  ·  D30 paying ${fraction(r.d30Paying)}`);
    printRow(c.overall);
    lines.push(`  by ${report.groupBy ?? "source"}:`);
    for (const r of c.byGroup) printRow(r);
    lines.push("  by offer:");
    for (const r of c.byOffer) printRow(r);
    lines.push("  by acquisition channel:");
    for (const r of c.byChannel ?? []) printRow(r);
    const g = c.gateA;
    lines.push(`  Gate A: activated with matured W4 ${g.activatedMaturedW4.n} of ${g.activatedMaturedW4.required} needed  ·  full-price payers ${g.fullPricePayers.n ?? "unknown"} of ${g.fullPricePayers.required} needed  ·  ${g.met === null ? "not answerable yet" : g.met ? "MET" : "not met"}`);
    lines.push("  missing data:");
    for (const m of c.missing) lines.push(`    - ${m}`);
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
  const [allRollups, eventsResult, offerDocs, billingDocs] = await Promise.all([
    fetchRollups(db),
    fetchEvents(db, args.since),
    fetchOfferRedemptions(db).catch(() => null),
    fetchBillingStates(db, now.getTime()).catch(() => null),
  ]);
  const { mode } = eventsResult;
  const includeInternal = args.includeInternal === true;
  const { rollups, events, excluded } = excludeInternal(allRollups, eventsResult.events, includeInternal);
  const asOfDay = now.toISOString().slice(0, 10);
  const census = new Map();
  for (const e of events) census.set(e.event, (census.get(e.event) ?? 0) + 1);
  const funnels = {};
  for (const name of args.funnels) {
    const chain = FUNNEL_CHAINS[name];
    if (!chain) continue;
    funnels[name] = countFunnelChain(events, chain, args.groupBy);
  }
  const loop = args.funnels.includes("loop") ? summariseLoop(events) : undefined;
  const { definition, definitionStatus } = readActivationDefinition();
  return {
    since: args.since,
    asOfDay,
    groupBy: args.groupBy,
    retention: cohortRetention(rollups, asOfDay),
    activation: { ...summariseActivation(events, now.getTime(), 7), definition, definitionStatus },
    funnels,
    ...(loop ? { loop } : {}),
    households: summariseHouseholds(rollups, events, offerDocs, billingDocs, "channel", Number.isFinite(Date.parse(args.since)) ? new Date(args.since).toISOString().slice(0, 10) : null),
    contract: summariseMetricContract({
      rollups,
      events,
      offers: offerDocs,
      billing: billingDocs,
      groupBy: args.groupBy,
      asOfDay,
      startedSince: Number.isFinite(Date.parse(args.since)) ? new Date(args.since).toISOString().slice(0, 10) : null,
      eventsTruncated: eventsResult.events.length >= MAX_EVENTS,
    }),
    eventCensus: [...census.entries()].map(([stage, count]) => ({ stage, count })).sort((a, b) => b.count - a.count || a.stage.localeCompare(b.stage)),
    scanned: { rollups: rollups.length, events: events.length, mode },
    internal: { excluded, included: includeInternal },
    generatedAt: now.toISOString(),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`cohort-report — the founder's cohort read\n\n  --retention --activation --funnel <${Object.keys(FUNNEL_CHAINS).join("|")}> --events --households --contract\n  --since <ISO|YYYY-MM-DD>  --group-by source|market  --json  --include-internal\n\nRuns on ADC. Reads retentionRollups + event names only. Internal (founder/comped/smoke) families are excluded unless --include-internal.\n`);
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
