/**
 * rendered-sweep.mjs — the rendered regression sweep (THE backlog operating model v2, item C)
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * ONE command renders every parent/kid route of the RUNNING sandbox and writes evidence to
 * files, so the validator and the critics read JSON + PNGs instead of driving a browser pane.
 *
 *   node scripts/rendered-sweep.mjs --out <dir> [--base http://localhost:4805] [--routes a,b]
 *        [--diff <prev sweep.json>] [--no-shots] [--no-api-cache] [--runs 1]  (npm run sweep -- …)
 *        [--seed demo|day0] [--states | --no-states]   (v2, below; --routes also takes "shell")
 *
 * Routes = every `route:` in SURFACE_CONTRACTS (src/lib/surfaceContract.ts); the run aborts
 * (exit 1) if that set differs from ROUTE_IDS (src/lib/routes.ts). Each route is a FULL LOAD
 * `${base}/?cb=<n>#/<route>` in three cells: 375×812 EN · 375×812 HE · 1280×800 EN, one
 * isolated browser context per cell type; locale (arbor.uiLang + arbor.aiLang) and a CLOSED
 * kid mode (arbor.kidmode.active) are written to localStorage BEFORE load; animations and
 * transitions are disabled and prefers-reduced-motion = reduce. Never starts a server:
 * exit 2 when the base URL is not HTTP 200 within 60 s. Determinism: one unrecorded warm-up
 * load; Vite's HMR socket is held silent; GET /api reads are cached per run (429 = wait out
 * the 30/min limiter, retry); a cell that fails to mount is retried once (firstAttempt kept).
 *
 * Per cell (sweep.json → cells[]): route · viewport · lang · finalHash · mounted · errorBoundary
 * · h1 · htmlLang · dir · modules (top-level data-module names, DOM order) · moduleCount ·
 * demotedModules · primaryMove {id,x,y,w,h} · pctStrings (+pctCount) · latinChromeHE
 * (+latinChromeHECount; HE only; allow-list "Arbor" + seeded child name; icon ligatures out) ·
 * sub44AboveFold {tag,text,w,h,y,inMain} (+sub44Count; inMain=false = shell chrome) ·
 * consoleErrors (429s counted apart as rateLimited) · overflow {scrollWidth,clientWidth} ·
 * apiRequests (/api calls, "(cache)" marked — the model-spend evidence) · loadMs · shot.
 * totals = routes · cells · mounted · consoleErrorCells · pctCells · latinHECells · sub44Cells ·
 * overflowCells. Stdout: one `SWEEP …` line; `--diff` adds `DIFF changed=<n> cells` + one line
 * per changed field; `--runs 2` re-runs (run2/ subdir, no shots) and prints STABLE | UNSTABLE <n>.
 *
 * How the critics use it: the validator diffs the wave's sweep against the previous baseline
 * (`--diff`), reads totals for the laws (pct = clinical firewall, latinHE = both locales,
 * sub44 = touch targets, overflow = containment) and opens shots/<route>.<WxH>.<lang>.png for
 * the fold. Exit 0 whatever the findings; the numbers are the verdict input, not the verdict.
 *
 * v2 — SEEDED STATES (critics failed screens three rounds running because v1 only ever saw
 * day-0/empty records):
 *   --seed demo|day0 (default demo). demo = the sanitized demo family (src/demo/demoFamily.ts)
 *     in EVERY context: the sweep reads the bundle once from GET /sandbox/demo-family.json
 *     (written by `npm run seed:demo -- --apply`; exit 1 with the command when absent) and
 *     serves that same body to every page, so the hydrator (lib/demoFamilyHydrate.ts) seeds
 *     before first render without racing its 1.5 s timeout. day0 = the bundle has no child →
 *     the hydrator no-ops → today's empty record. `seed` (+ `seedBundle`) at the top level,
 *     `seed` + `seedHydrated` (the demo family is in the page: the hydrator's marker matches
 *     the bundle; always false with day0) per cell; totals.seedHydratedCells.
 *   --states / --no-states (default on with demo, off with day0). After a route's base cell
 *     (`state: "base"`), its named STATES (the STATES table below) render as extra cells with
 *     `state: "<name>"` and shots/<route>.<WxH>.<lang>.<state>.png. Each state runs in its OWN
 *     throwaway browser context (fresh hydration), selector-first with EN/HE text fallbacks
 *     from lib/i18n.ts, inside a 15 s budget; one that cannot be reached records
 *     {state, reached:false, reason} and the run goes on. Non-route surfaces (Settings, Your
 *     data, paywall, search, More sheet, Kid Mode door) render from #/overview as route
 *     "shell" (`--routes` accepts "shell"). States never leave lasting data: see each entry's
 *     `writes` (recorded per cell) — the one local write (capture) is undone in-page and
 *     verified, and server-writing taps (memory approve, share grant, checkout) are never made.
 *   Fold gate: primaryMove.aboveFold = y + min(h, 56) <= viewport height; stampHeight =
 *     primaryMove.h (critics assert the stamp sits on one control: h <= 120).
 *   Totals: cells/mounted count BASE cells (backward compatible); the law totals (consoleErr,
 *     pct, latinHE, sub44, overflow) count base + reached state cells; + stateCells,
 *     statesUnreached. `--runs 2` prints STABLE | UNSTABLE <n> for base cells and
 *     STATE-STABLE | STATE-UNSTABLE <n> for state cells; `--diff` keys cells by
 *     route+viewport+lang(+state), so a v1 sweep.json diffs against v2 base cells.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_DIR = path.resolve(APP_DIR, "..");

const VIEWPORTS = [
  { w: 375, h: 812, lang: "en" },
  { w: 375, h: 812, lang: "he" },
  { w: 1280, h: 800, lang: "en" },
];
const READY_SELECTOR = "main h1, [data-module], [data-primary-move]";
const READY_BUDGET_MS = 20_000;
const QUIET_MS = 500;
const SERVER_BUDGET_MS = 60_000;
const STATE_BUDGET_MS = 15_000;
const SHELL = "shell";

/* ── args ─────────────────────────────────────────────────────────────────── */
function parseArgs(argv) {
  const out = { base: "http://localhost:4805", shots: true, apiCache: true, runs: 1, routes: null, diff: null, out: null, seed: "demo", states: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) fail(`missing value for ${a}`);
      return v;
    };
    if (a === "--out") out.out = next();
    else if (a === "--base") out.base = next().replace(/\/+$/, "");
    else if (a === "--routes") out.routes = next().split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--diff") out.diff = next();
    else if (a === "--no-shots") out.shots = false;
    else if (a === "--no-api-cache") out.apiCache = false;
    else if (a === "--runs") out.runs = Math.max(1, Number.parseInt(next(), 10) || 1);
    else if (a === "--seed") {
      out.seed = next();
      if (!["demo", "day0"].includes(out.seed)) fail(`--seed must be demo or day0 (got ${out.seed})`);
    } else if (a === "--states") out.states = true;
    else if (a === "--no-states") out.states = false;
    else fail(`unknown argument ${a}`);
  }
  if (out.states === null) out.states = out.seed === "demo";
  if (!out.out) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    out.out = path.join(REPO_DIR, "sweeps", stamp);
  }
  out.out = path.resolve(out.out);
  return out;
}

function fail(msg, code = 1) {
  console.error(`SWEEP ERROR: ${msg}`);
  process.exit(code);
}

/* ── routes: SURFACE_CONTRACTS, cross-checked against ROUTE_IDS ───────────── */
async function loadRoutes() {
  const contractFile = path.join(APP_DIR, "src", "lib", "surfaceContract.ts");
  const routesFile = path.join(APP_DIR, "src", "lib", "routes.ts");
  let contractRoutes;
  let routeIds;
  try {
    // Real module evaluation (both files only `import type`, so nothing else loads).
    const { tsImport } = await import("tsx/esm/api");
    const sc = await tsImport(pathToFileURL(contractFile).href, import.meta.url);
    const rt = await tsImport(pathToFileURL(routesFile).href, import.meta.url);
    contractRoutes = sc.SURFACE_CONTRACTS.map((c) => c.route);
    routeIds = [...rt.ROUTE_IDS];
  } catch (err) {
    // Fallback: literal parse. Same cross-check applies, so a parse drift still fails loudly.
    console.error(`SWEEP WARN: tsx import failed (${err?.message ?? err}); parsing literals`);
    const sc = readFileSync(contractFile, "utf8");
    contractRoutes = [...sc.matchAll(/^\s*route:\s*"([a-z0-9-]+)"/gm)].map((m) => m[1]);
    const rt = readFileSync(routesFile, "utf8");
    const block = rt.slice(rt.indexOf("export const ROUTE_IDS"), rt.indexOf("] as const"));
    routeIds = [...block.replace(/\/\/.*$/gm, "").matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]);
  }
  const a = new Set(contractRoutes);
  const b = new Set(routeIds);
  const onlyContract = [...a].filter((r) => !b.has(r));
  const onlyIds = [...b].filter((r) => !a.has(r));
  if (contractRoutes.length !== routeIds.length || a.size !== contractRoutes.length || onlyContract.length || onlyIds.length) {
    fail(
      `SURFACE_CONTRACTS (${contractRoutes.length}, ${a.size} unique) disagrees with ROUTE_IDS (${routeIds.length}); ` +
        `only in contracts: [${onlyContract}] · only in ROUTE_IDS: [${onlyIds}]`,
    );
  }
  return contractRoutes;
}

function seededChildName() {
  try {
    const src = readFileSync(path.join(APP_DIR, "src", "initialData.ts"), "utf8");
    return src.match(/defaultChildProfile[\s\S]{0,200}?name:\s*"([^"]+)"/)?.[1] ?? null;
  } catch {
    return null;
  }
}

function gitSha() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: APP_DIR, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

async function waitForServer(base) {
  const deadline = Date.now() + SERVER_BUDGET_MS;
  let last = "no response";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/`, { signal: AbortSignal.timeout(5000) });
      if (res.status === 200) return;
      last = `HTTP ${res.status}`;
    } catch (err) {
      last = err?.cause?.code ?? err?.message ?? String(err);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  fail(`server ${base} unreachable after ${SERVER_BUDGET_MS / 1000}s (${last})`, 2);
}

/* ── seed: the demo-family bundle the sandbox serves (B-DIST-01) ─────────────── */
const DEMO_BUNDLE_PATH = "/sandbox/demo-family.json";
const DEMO_MARKER_KEY = "arbor.demoFamily.seeded"; // lib/demoFamilyHydrate.ts DEMO_FAMILY_MARKER

async function loadSeed(base, seed) {
  if (seed === "day0") return { seed, body: null, info: null };
  let res;
  try {
    res = await fetch(`${base}${DEMO_BUNDLE_PATH}`, { signal: AbortSignal.timeout(10_000), headers: { Accept: "application/json" } });
  } catch (err) {
    fail(`--seed demo: ${base}${DEMO_BUNDLE_PATH} unreachable (${err?.message ?? err})`);
  }
  const body = await res.text();
  let bundle = null;
  try { bundle = JSON.parse(body); } catch { /* reported below */ }
  if (res.status !== 200 || !bundle?.child?.id || bundle.child.demo !== true || !bundle.collections) {
    fail(
      `--seed demo needs the demo-family bundle, but ${base}${DEMO_BUNDLE_PATH} answered HTTP ${res.status}` +
        `${bundle ? "" : " (not JSON)"}. Seed it once from Arbor/app: \`npm run seed:demo -- --apply\` ` +
        "(sandbox only, writes app/.data/demo-family.json), or sweep the empty record with --seed day0.",
    );
  }
  const info = {
    version: String(bundle.version),
    seededAt: String(bundle.seededAt),
    lang: bundle.lang ?? null,
    childId: bundle.child.id,
    childName: bundle.child.name ?? null,
    marker: `${String(bundle.version)}@${String(bundle.seededAt)}`,
  };
  return { seed, body, info, bundle };
}

/** Every context: demo = the SAME bundle body to every page (no 1.5 s hydrator race);
 *  day0 = a body with no child (not a 404, which would log a console error in every cell),
 *  so the hydrator returns "none" and the record stays empty. */
async function applySeed(context, seedCtx) {
  await context.route((u) => u.pathname === DEMO_BUNDLE_PATH, (route) =>
    seedCtx.body
      ? route.fulfill({ status: 200, contentType: "application/json", body: seedCtx.body, headers: { "cache-control": "no-store" } })
      : route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ sweep: "day0" }) }),
  );
}

/** EN/HE text fallbacks come from the app's own dictionaries (lib/i18n.ts → translate). */
async function loadTranslate() {
  try {
    const { tsImport } = await import("tsx/esm/api");
    const mod = await tsImport(pathToFileURL(path.join(APP_DIR, "src", "lib", "i18n.ts")).href, import.meta.url);
    return (lang, key) => {
      const s = mod.translate(lang, key);
      return s && s !== key ? s : null;
    };
  } catch (err) {
    console.error(`SWEEP WARN: i18n import failed (${err?.message ?? err}); states run selector-only`);
    return () => null;
  }
}

async function launchBrowser() {
  const { chromium } = await import("playwright");
  const errors = [];
  for (const channel of ["msedge", "chrome", undefined]) {
    try {
      const browser = await chromium.launch({ channel, headless: true });
      return { browser, channel: channel ?? "chromium (bundled)" };
    } catch (err) {
      errors.push(`${channel ?? "bundled"}: ${String(err?.message ?? err).split("\n")[0]}`);
    }
  }
  fail(`no browser could launch — ${errors.join(" | ")}. Run \`npx playwright install chromium\`.`);
}

/* ── in-page: storage + motion (runs before any app script, every load) ───── */
function initScript({ lang }) {
  try {
    localStorage.setItem("arbor.uiLang", lang);
    localStorage.setItem("arbor.aiLang", lang);
    // kidModeGate.serializeKidModeState({ open: false }) — parses to CLOSED → parent register.
    localStorage.setItem("arbor.kidmode.active", JSON.stringify({ open: false }));
  } catch {
    /* storage unavailable — the record's htmlLang will show it */
  }
  const css =
    "*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;" +
    "animation-iteration-count:1!important;transition-duration:0s!important;transition-delay:0s!important;" +
    "scroll-behavior:auto!important;caret-color:transparent!important}";
  const inject = () => {
    if (document.getElementById("__sweep_still")) return;
    const s = document.createElement("style");
    s.id = "__sweep_still";
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", inject, { once: true });
  else inject();
}

/* ── in-page: the per-cell record ────────────────────────────────────────── */
function collect({ lang, allowLatin }) {
  const vh = window.innerHeight;
  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "HEAD", "TITLE", "META", "LINK"]);
  const boxOf = (el) => {
    // display:contents has no box — measure its rendered descendants instead.
    let cur = el;
    while (cur && cur.nodeType === 1 && getComputedStyle(cur).display === "contents") cur = cur.parentElement;
    return cur;
  };
  const visible = (el) => {
    const box = boxOf(el);
    if (!box || !box.isConnected) return false;
    if (typeof box.checkVisibility === "function") {
      return box.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    }
    const cs = getComputedStyle(box);
    return cs.display !== "none" && cs.visibility !== "hidden" && cs.opacity !== "0";
  };
  const rectOf = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width || r.height || getComputedStyle(el).display !== "contents") return r;
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const c of el.children) {
      const cr = rectOf(c);
      if (!cr.width && !cr.height) continue;
      x1 = Math.min(x1, cr.left); y1 = Math.min(y1, cr.top);
      x2 = Math.max(x2, cr.right); y2 = Math.max(y2, cr.bottom);
    }
    return x1 === Infinity ? r : { left: x1, top: y1, width: x2 - x1, height: y2 - y1, right: x2, bottom: y2 };
  };
  const clip = (s, n) => {
    const t = (s || "").replace(/\s+/g, " ").trim();
    return t.length > n ? `${t.slice(0, n - 1)}…` : t;
  };
  // Deepest visible element whose text matches (React splits `{n}%` into several text nodes,
  // so text-node matching would miss it; the deepest element containing the whole match won't).
  const deepest = (test, exclude) => {
    const hits = [];
    for (const el of document.body.querySelectorAll("*")) {
      if (SKIP.has(el.tagName) || el.closest("script,style,noscript,template")) continue;
      const text = el.textContent || "";
      if (!test(text)) continue;
      let childHit = false;
      for (const c of el.children) if (test(c.textContent || "")) { childHit = true; break; }
      if (childHit) continue;
      if (exclude && exclude(el)) continue;
      if (!visible(el)) continue;
      hits.push(clip(text, 80));
    }
    return hits;
  };

  const root = document.getElementById("root") || document.body;
  const main = document.querySelector("main");
  const scope = main || root;
  const hasText = (scope.innerText || "").trim().length > 0;
  const errorBoundary =
    !!scope.querySelector('[role="alert"] button') && !scope.querySelector("h1, [data-module], [data-primary-move]");
  const h1El = document.querySelector("main h1") || document.querySelector("h1");

  const moduleEls = [...document.querySelectorAll("[data-module]")].filter(
    (el) => !el.parentElement || !el.parentElement.closest("[data-module]"),
  );
  const modules = moduleEls.map((el) => el.getAttribute("data-module"));
  const demotedModules = moduleEls.filter((el) => el.hasAttribute("data-module-demoted")).map((el) => el.getAttribute("data-module"));

  const pmEl = document.querySelector("[data-primary-move]");
  let primaryMove = null;
  if (pmEl) {
    const r = rectOf(pmEl);
    primaryMove = {
      id: pmEl.getAttribute("data-primary-move"),
      x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
    };
    // v2 fold gate: the stamp's first 56 px (one control's height) must be on screen.
    primaryMove.aboveFold = primaryMove.y + Math.min(primaryMove.h, 56) <= vh;
  }

  const pctStrings = deepest((t) => /\d\s?%/.test(t));

  let latinChromeHE = null;
  if (lang === "he") {
    // Letter boundaries, not \b: "Dylan5" (name glued to the age) must still drop the name.
    const allow = new RegExp(`(?<![A-Za-z])(?:${allowLatin.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![A-Za-z])`, "gi");
    // FSI…PDI (U+2068…U+2069) is how the app isolates interpolated user data (child/parent
    // names, profile fields) inside localized strings — data, not chrome.
    const strip = (t) =>
      t.replace(/⁨[^⁩]*⁩/g, " ")
        .replace(/https?:\/\/\S+|www\.\S+|[\w.+-]+@[\w-]+\.[\w.]+|[\w-]+\.(?:com|org|net|io|app)\b/gi, " ")
        .replace(allow, " ");
    // Icon-font ligatures ("chevron_left" in Material Symbols) render as glyphs, not words.
    const iconFont = (el) => /material (symbols|icons)/i.test(getComputedStyle(el).fontFamily);
    latinChromeHE = deepest(
      (t) => /[A-Za-z]{3,}/.test(strip(t)),
      (el) => !!el.closest('[lang^="en"], [dir="ltr"]') || iconFont(el),
    );
  }

  const sub44 = [];
  const interactive = document.querySelectorAll(
    'button, a[href], [role="button"], input:not([type="hidden"]), select, textarea, [tabindex="0"]',
  );
  for (const el of interactive) {
    if (el.closest('[aria-hidden="true"], [inert]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) continue; // visually-hidden (sr-only) control
    if (r.top >= vh || r.bottom <= 0) continue;
    if (r.width >= 44 && r.height >= 44) continue;
    if (!visible(el)) continue;
    sub44.push({
      tag: el.tagName.toLowerCase(),
      text: clip(el.innerText || el.getAttribute("aria-label") || el.getAttribute("title") || el.value || "", 40),
      w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.top),
      inMain: !!(main && main.contains(el)), // false = shell chrome (topbar, nav), true = the surface
    });
  }

  const de = document.documentElement;
  return {
    finalHash: location.hash,
    mounted: !!main && hasText && !errorBoundary,
    errorBoundary,
    h1: h1El ? clip(h1El.textContent, 200) : null,
    htmlLang: de.lang || null,
    dir: de.dir || getComputedStyle(de).direction || null,
    modules,
    moduleCount: modules.length,
    demotedModules,
    primaryMove,
    stampHeight: primaryMove ? primaryMove.h : null,
    pctStrings: pctStrings.slice(0, 50),
    pctCount: pctStrings.length,
    latinChromeHE: latinChromeHE ? latinChromeHE.slice(0, 20) : null,
    latinChromeHECount: latinChromeHE ? latinChromeHE.length : null,
    sub44AboveFold: sub44,
    sub44Count: sub44.length,
    overflow: { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth },
  };
}

/* ── v2: named states ─────────────────────────────────────────────────────── */
let SEED = null; // { seed, body, info } — set once in main()

/** A state whose precondition is absent (no pending fact, visit is past…): recorded, not retried. */
class Unreached extends Error {}
const skip = (reason) => { throw new Unreached(reason); };

function stateHelpers(page, vp, tr) {
  const asList = (s) => [].concat(s).filter(Boolean);
  const h = {
    page,
    lang: vp.lang,
    vp,
    /** The app's own string for `key` in this cell's language (null when unknown). */
    tr: (key) => tr(vp.lang, key),
    /** First VISIBLE match among selectors/locators, polled until `timeout`. */
    async first(cands, timeout = 5_000) {
      const deadline = Date.now() + timeout;
      for (;;) {
        for (const c of asList(cands)) {
          const loc = typeof c === "string" ? page.locator(c) : c;
          const n = await loc.count().catch(() => 0);
          for (let i = 0; i < n; i++) {
            const el = loc.nth(i);
            if (await el.isVisible().catch(() => false)) return el;
          }
        }
        if (Date.now() > deadline) return null;
        await page.waitForTimeout(150);
      }
    },
    /** Selector-first; then the localized label as a button name, then as exact text. */
    async click(selectors, texts, what) {
      const labels = asList(texts);
      const cands = [...asList(selectors), ...labels.flatMap((t) => [page.getByRole("button", { name: t }), page.getByText(t, { exact: true })])];
      const el = await h.first(cands);
      if (!el) skip(`${what} not found (${asList(selectors).join(" | ")}${labels.length ? ` | text ${labels.map((t) => JSON.stringify(t)).join(" / ")}` : ""})`);
      await el.click({ timeout: 5_000 });
      return el;
    },
    async need(cands, what, timeout = 8_000) {
      const el = await h.first(cands, timeout);
      // Retryable (plain Error): a slow answer or a dropped load gets one fresh context.
      if (!el) throw new Error(`${what} did not render`);
      return el;
    },
    async has(cands, timeout = 1_500) {
      return !!(await h.first(cands, timeout));
    },
    /** Scroll an element to the top of its scroller, clear of the sticky top bar. */
    async top(el) {
      await el.evaluate((e) => { e.style.scrollMarginTop = "96px"; e.scrollIntoView({ block: "start" }); });
      await page.waitForTimeout(200);
    },
    skip,
  };
  return h;
}

const ASK_Q = {
  en: "He melts down when we leave the playground",
  he: "הוא מתפרק כשאנחנו עוזבים את גן השעשועים",
};
const CAPTURE_TEXT = { en: "Stacked the cups by himself and laughed", he: "בנה מגדל כוסות לבד וצחק" };
const SHELL_SEARCH = { en: "bedtime", he: "שינה" };
const SHARE_EMAIL = "other.parent@example.com"; // never sent: the grant button is never tapped

/** Sum of every per-child behaviour-log list in local storage (the capture write's home). */
const momentCount = (page) =>
  page.evaluate(() => {
    let n = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("arbor.behaviorLogs.")) continue;
      try { const v = JSON.parse(localStorage.getItem(k) || "[]"); if (Array.isArray(v)) n += v.length; } catch { /* skip */ }
    }
    return n;
  });

/** Coach: send the fixture question and wait for the four-block answer (mock provider). */
async function askAnswered(h) {
  const box = await h.need("[data-primary-move=ask] textarea", "the Ask composer");
  await box.fill(ASK_Q[h.lang]);
  await h.click("[data-testid=coach-send]", [], "the send button");
  const cards = await h.need("[data-testid=coach-answer-cards]", "the four-block answer (read · Try this · Say this · More)", 12_000);
  await h.need("[data-testid=coach-answer-more]", "the More block of the answer");
  return cards;
}

/** Consult step 1 → choose the pediatrician (the first audience). */
async function consultPediatrician(h) {
  await h.click("[data-module=consult-packet] [role=radio] >> nth=0", [], "the Pediatrician audience");
}

/** Settings modal, from the shell's own door (375: More sheet; 1280: account popover). */
async function openSettings(h) {
  const anchor = "[role=dialog] [data-testid=settings-data-row]";
  if (h.vp.w < 768) {
    await h.click("nav button[aria-expanded]", [h.tr("nav.short.more")], "the More tab");
    await h.click("[role=dialog] button:has(.msr:text-is('settings')), [role=dialog] button[aria-label='Settings']", [], "the Settings door in the More sheet");
  } else {
    await h.click(`aside button[aria-label="${h.tr("nav.popover.more") ?? "More"}"], nav ~ div button[aria-haspopup], button[aria-label="${h.tr("nav.popover.more") ?? "More"}"]`, [], "the account popover");
    await h.click("[role=menuitem]:has(.msr:text-is('settings'))", [], "the Settings menu item");
  }
  return h.need(anchor, "the Settings modal");
}

/**
 * THE STATES TABLE. route → [{ name, run(h), from?, only?(vp), writes? }].
 *  run returns { name?, via?, undo? } (name overrides for a runtime-chosen state; undo runs
 *  after the shot). `writes` is recorded on the cell: what the state touches and why that
 *  leaves nothing behind. Every state runs in a throwaway context.
 */
const STATES = {
  coach: [
    {
      name: "answered",
      writes: "POST /api/chat (mock fixture, zero model calls); the thread lives only in this state's throwaway context",
      run: async (h) => { await h.top(await askAnswered(h)); },
    },
    {
      name: "more-open",
      writes: "POST /api/chat (mock fixture, zero model calls); the thread lives only in this state's throwaway context",
      run: async (h) => {
        await askAnswered(h);
        const more = await h.need("[data-testid=coach-answer-more]", "the More block");
        await more.locator("button").first().click({ timeout: 5_000 });
        await h.need('[data-testid=coach-answer-more] button[aria-expanded="true"]', "the open More disclosure");
        await h.top(more);
      },
    },
    {
      name: "tone-sheet",
      run: async (h) => {
        await h.click("[data-testid=coach-tone]", [], "the tone door");
        await h.need("[data-testid=tone-sheet]", `the tone sheet (${h.tr("coach.tone.title")})`);
      },
    },
  ],
  overview: [
    {
      name: "capture-reply",
      writes: "one text moment in the local record; the reply's Undo removes it after the shot (cell.undone = moment count back to before)",
      run: async (h) => {
        const before = await momentCount(h.page);
        await h.click("main [data-capture-tile=text]", [], "the Text capture tile");
        const input = await h.need("[role=dialog] #quick-log-moment, [role=dialog] input[type=text], [role=dialog] textarea", "the capture sheet");
        await input.fill(CAPTURE_TEXT[h.lang]);
        await h.click("[role=dialog] button[type=submit]", [], "the Save moment button");
        await h.need("[data-testid=quicklog-reply-undo]", "the capture reply (echo · next move · Undo)");
        return {
          undo: async () => {
            await h.page.locator("[data-testid=quicklog-reply-undo]").first().click({ timeout: 5_000 });
            await h.page.waitForTimeout(600);
            return (await momentCount(h.page)) === before;
          },
        };
      },
    },
    {
      name: "hard-moment",
      run: async (h) => {
        await h.click("main [data-capture-tile=hard-moment]", [], "the Hard moment tile");
        await h.need("[role=dialog]", "the Hard moment sheet");
      },
    },
  ],
  plans: [
    {
      name: "active-plan",
      run: async (h) => {
        const card = await h.first("[data-testid=plan-track-card], [data-module=plans-active]", 5_000);
        if (!card) skip("no active plan in the seeded record");
        await h.top(card);
      },
    },
    {
      name: "weekly-checkin",
      run: async (h) => {
        const check = await h.first("[data-testid=plan-weekly-check]", 3_000);
        if (!check) skip("the weekly check-in is not due for the seeded plan (PlanTrackCard renders it only when due)");
        await h.top(check);
      },
    },
  ],
  behaviors: [
    {
      name: "guides",
      run: async (h) => {
        const door = await h.click("[data-testid=hard-moments-door]", [], "the All guides door");
        await h.page.waitForTimeout(300);
        if ((await door.getAttribute("aria-expanded").catch(() => null)) === "false") skip("the All guides door did not open");
        await h.top(await h.need("[data-testid=hard-moments-section]", "the guide shelf"));
      },
    },
  ],
  journal: [
    {
      name: "search",
      run: async (h) => {
        const word = SEED?.info ? journalWord(SEED.bundle) : null;
        if (!word) skip("no seeded moment text to search for");
        await (await h.need("[data-testid=journal-search]", "the journal search")).fill(word);
        await h.page.waitForTimeout(500);
        return { via: `query "${word}"` };
      },
    },
    {
      name: "hard-filter",
      run: async (h) => {
        await h.click("[data-testid=journal-filter-hard]", [], "the Hard moments filter");
        await h.page.waitForTimeout(300);
      },
    },
  ],
  consult: [
    {
      name: "step2",
      run: async (h) => {
        await consultPediatrician(h);
        const step2 = await h.need("[data-module=consult-packet] h2:has-text('2')", "step 2 (What changed)");
        await h.top(step2);
      },
    },
    {
      name: "step3",
      run: async (h) => {
        await consultPediatrician(h);
        await h.click("[data-testid=consult-build]", [], "Build the one-page summary");
        await h.need("[data-module=consult-packet] h2:has-text('3')", "step 3 (What leaves)");
        await h.top(await h.need("[data-module=consult-packet] h2:has-text('3')", "step 3"));
      },
    },
    {
      name: "preview-open",
      run: async (h) => {
        await consultPediatrician(h);
        await h.click("[data-testid=consult-build]", [], "Build the one-page summary");
        const label = h.tr("elev.carehonesty.consult.preview.toggle");
        const summary = await h.need(
          [
            "[data-module=consult-packet] details:has(.msr:text-is('visibility')) > summary",
            ...(label ? [h.page.locator("[data-module=consult-packet] summary", { hasText: label })] : []),
          ],
          "the Preview exactly what leaves disclosure",
        );
        await summary.click({ timeout: 5_000 });
        await h.page.waitForTimeout(300);
        await h.top(summary);
      },
    },
  ],
  appointments: [
    {
      name: "upcoming-row",
      run: async (h) => {
        // Upcoming rows render inside [data-module=appt-upcoming]; an empty Upcoming shows the
        // profession chips instead. The demo family's one visit is in the past → past-visit.
        if (!(await h.has("[data-testid=appt-empty-professions]", 2_000))) {
          await h.top(await h.need("[data-module=appt-upcoming] > *", "the Upcoming section with its visit row"));
          return { name: "upcoming-row" };
        }
        await h.click("[data-module-disclosure=appointments-more] > summary", [h.tr("elev.learnCare.appt.more.title")], "Past visits and what to ask");
        const past = await h.need("[data-module=appt-past] > *", "the past visit row");
        await h.top(past);
        return { name: "past-visit" };
      },
    },
    {
      name: "prepare",
      run: async (h) => {
        const door = await h.first("[data-testid=appt-prepare]", 2_000);
        if (!door) skip("no Prepare door: it renders only on an upcoming visit within 14 days");
        await h.top(door);
      },
    },
  ],
  memory: [
    {
      name: "pending-group",
      run: async (h) => {
        const approve = await h.first("[data-primary-move=approve-memory-fact]", 5_000);
        if (!approve) skip("no pending fact on the server memory ledger");
        const group = approve.locator("xpath=ancestor::*[.//h2][1]");
        const heading = group.locator("h2").first();
        await h.top((await heading.count()) ? heading : approve);
      },
    },
    {
      name: "after-approve",
      run: async () =>
        skip("not rendered by design: approving writes the server memory ledger and has no undo (Forget marks the fact deleted, not pending), so two runs would differ"),
    },
  ],
  sharing: [
    {
      name: "preview",
      writes: "types a placeholder address into the week card (no request; the grant button is never tapped)",
      run: async (h) => {
        await (await h.need("[data-testid=share-week-email]", "the week card's email field")).fill(SHARE_EMAIL);
        await h.top(await h.need("[data-testid=share-week-preview]", "the recipient week preview"));
      },
    },
  ],
  "school-brief": [
    {
      name: "draft",
      run: async (h) => { await h.top(await h.need("[data-module=brief-draft]", "the brief draft")); },
    },
  ],
  [SHELL]: [
    {
      name: "settings",
      from: "overview",
      run: async (h) => { await openSettings(h); },
    },
    {
      name: "settings-your-data",
      from: "overview",
      run: async (h) => {
        await openSettings(h);
        await h.click("[data-testid=settings-open-your-data]", [], "the Your data door");
        await h.need("[data-testid=your-data-sheet]", "the Your data sheet");
      },
    },
    {
      name: "paywall",
      from: "overview",
      // The sandbox is Plus/beta_unenforced and Settings' upgrade buttons start CHECKOUT
      // (useCheckout.startCheckout), not the paywall — never tapped. This context instead
      // reads a free, enforced entitlement (one child) and opens the paywall from the
      // shell's own door: kid switcher → Add child → See Arbor Plus.
      setup: async (context) => {
        await context.route(/\/api\/entitlement(\?|$)/, (route) =>
          route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              plan: "free", limits: { coachMessagesPerDay: 5, maxChildren: 1, professionalReports: false, advancedPlans: false, coParentSeats: 0 },
              source: "sweep_free_override", enforced: true, usage: { coachMessagesToday: 0 }, status: "active",
              provider: null, currentPeriodEnd: null, willRenew: null, isAdmin: false, cohort: "family",
            }),
          }),
        );
      },
      run: async (h) => {
        await h.click("button[aria-haspopup=listbox]", [], "the child switcher");
        await h.click([], [h.tr("ac.add")], "the Add child row");
        await h.click([], [h.tr("elev.storeshell.ac.seePlus")], "See Arbor Plus");
        await h.need("[data-testid=paywall-cta]", "the paywall");
        return { via: "child switcher → Add child → See Arbor Plus (entitlement read as free/enforced in this context only)" };
      },
    },
    {
      name: "search",
      from: "overview",
      run: async (h) => {
        const label = h.tr("top.search") ?? "Search";
        await h.click([`header button[aria-label="${label}"]`, "input[role=combobox][type=search]"], [], "the search door");
        let input = await h.first("[role=dialog] input", 3_000);
        if (!input) {
          await h.page.evaluate(() => window.dispatchEvent(new CustomEvent("arbor:search:open")));
          input = await h.need("[role=dialog] input", "the search modal");
        }
        await input.fill(SHELL_SEARCH[h.lang]);
        await h.page.waitForTimeout(500);
      },
    },
    {
      name: "more-sheet",
      from: "overview",
      only: (vp) => vp.w < 768,
      run: async (h) => {
        await h.click("nav button[aria-expanded]", [h.tr("nav.short.more")], "the More tab");
        await h.need("[role=dialog]", "the More sheet");
      },
    },
    {
      name: "kid-door",
      from: "overview",
      run: async (h) => {
        const k = h.tr("aria.kidMode") ?? "Kid Mode";
        const kl = h.tr("aria.launchKidMode") ?? "Launch Kid Mode";
        await h.click([`button[aria-label^="${kl}"]`, `button[aria-label^="${k}"]`], [], "the Kid Mode door");
        await h.need("[role=dialog]", "the Kid Mode door sheet");
      },
    },
  ],
};

/** A searchable word from the seeded moments: the longest word of the first moment's text (`trigger`). */
function journalWord(bundle) {
  const logs = bundle?.collections?.behaviorLogs;
  if (!Array.isArray(logs)) return null;
  for (const l of logs) {
    const words = String(l?.trigger ?? l?.notes ?? "").split(/[^\p{L}]+/u).filter((w) => w.length >= 4);
    if (words.length) return words.sort((a, b) => b.length - a.length || a.localeCompare(b))[0].toLowerCase();
  }
  return null;
}

const statesFor = (route, vp) => (STATES[route] ?? []).filter((s) => !s.only || s.only(vp));

/* ── one route in one context ────────────────────────────────────────────── */
let cbCounter = Date.now();
/**
 * One cell. `run` (optional) = { state, seedCtx, tr }: after the route is ready the state's
 * script drives the page (15 s budget), the record + shot are taken, then its undo runs.
 * `loadRoute` is the hash actually loaded (shell states load #/overview).
 */
async function visit(context, base, route, vp, allowLatin, shotPath, run = null) {
  const loadRoute = run?.state.from ?? route;
  const page = await context.newPage();
  const errors = new Set();
  const api = [];
  let inflight = 0;
  let lastNet = Date.now();
  const norm = (s) => String(s).replace(/([?&])cb=\d+/g, "$1cb=N").split("\n")[0].slice(0, 300);
  let rateLimited = 0;
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = norm(m.text());
    // A 429 is the local /api limiter (30/min/IP) reacting to the sweep's own traffic — an
    // instrument artefact, counted apart so consoleErrors stays an app signal.
    if (/status of 429\b/.test(text)) rateLimited++;
    else errors.add(text);
  });
  page.on("pageerror", (e) => errors.add(norm(`pageerror: ${e?.message ?? e}`)));
  page.on("request", () => { inflight++; lastNet = Date.now(); });
  const done = (req) => {
    inflight = Math.max(0, inflight - 1); lastNet = Date.now();
    try {
      const u = new URL(req.url());
      if (u.pathname.startsWith("/api/")) api.push(`${req.method()} ${u.pathname}${API_FROM_CACHE.has(req) ? " (cache)" : ""}`);
    } catch { /* non-URL */ }
  };
  page.on("requestfinished", done);
  page.on("requestfailed", done);

  const t0 = Date.now();
  let readyTimedOut = false;
  let retried = false;
  let navError = null;
  try {
    try {
      await page.goto(`${base}/?cb=${++cbCounter}#/${loadRoute}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    } catch {
      retried = true; // a cold Vite transform can outlast one load; one retry, then record the failure
      await page.goto(`${base}/?cb=${++cbCounter}#/${loadRoute}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    }
    let deadline = Date.now() + READY_BUDGET_MS;
    let present = false;
    while (Date.now() < deadline) {
      // A read held for the /api limiter window extends the budget instead of failing the cell.
      if (limiterHoldUntil > Date.now()) deadline = Math.max(deadline, limiterHoldUntil + READY_BUDGET_MS);
      if (!present) present = await page.locator(READY_SELECTOR).count().then((n) => n > 0, () => false);
      if (present && inflight === 0 && Date.now() - lastNet >= QUIET_MS) break;
      await page.waitForTimeout(100);
    }
    readyTimedOut = !(present && inflight === 0 && Date.now() - lastNet >= QUIET_MS);
  } catch (err) {
    navError = String(err?.message ?? err).split("\n")[0];
    readyTimedOut = true;
  }
  const loadMs = Date.now() - t0;

  const seedHydrated = await page
    .evaluate((k) => { try { return localStorage.getItem(k); } catch { return null; } }, DEMO_MARKER_KEY)
    .then((v) => v, () => null);
  const seedFields = SEED;
  const seedRec = seedFields
    ? { seed: seedFields.seed, seedHydrated: seedFields.info ? seedHydrated === seedFields.info.marker : seedHydrated !== null }
    : {};

  // ── the named state (v2) ──────────────────────────────────────────────────
  let stateRec = {};
  let undo = null;
  if (run) {
    const { state, tr } = run;
    const h = stateHelpers(page, vp, tr);
    let stateName = state.name;
    const tState = Date.now();
    try {
      if (readyTimedOut && !(await page.locator(READY_SELECTOR).count().catch(() => 0))) throw new Error(`route did not mount (${navError ?? "ready timeout"})`);
      let timer;
      const out = await Promise.race([
        state.run(h),
        new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`state budget ${STATE_BUDGET_MS / 1000}s exceeded`)), STATE_BUDGET_MS); }),
      ]).finally(() => clearTimeout(timer));
      if (out?.name) stateName = out.name;
      undo = out?.undo ?? null;
      // Settle: the state's own requests finish and the page is quiet before the record.
      const settle = Date.now() + 8_000;
      while (Date.now() < settle && !(inflight === 0 && Date.now() - lastNet >= QUIET_MS)) await page.waitForTimeout(100);
      stateRec = { state: stateName, reached: true, stateMs: Date.now() - tState, ...(state.writes ? { writes: state.writes } : {}), ...(out?.via ? { via: out.via } : {}) };
    } catch (err) {
      // The page's own first error says WHY (e.g. the sandbox's hourly AI quota) — keep it.
      const firstErr = [...errors][0];
      const reason = `${String(err?.message ?? err).split("\n")[0].slice(0, 300)}${firstErr ? ` · page: ${firstErr.slice(0, 160)}` : ""}`;
      await page.close();
      return {
        route, viewport: `${vp.w}x${vp.h}`, lang: vp.lang, ...seedRec,
        state: state.name, reached: false, reason, retryable: !(err instanceof Unreached),
        consoleErrors: [...errors], rateLimited, apiRequests: api.sort(), loadMs, shot: null,
      };
    }
  } else {
    stateRec = { state: "base" };
  }

  let rec;
  try {
    rec = await page.evaluate(collect, { lang: vp.lang, allowLatin });
  } catch (err) {
    rec = { mounted: false, collectError: String(err?.message ?? err).split("\n")[0] };
  }
  let shot = null;
  const shotFile = typeof shotPath === "function" ? shotPath(stateRec.state) : shotPath;
  if (shotFile) {
    try {
      await page.screenshot({ path: shotFile, fullPage: false, animations: "disabled", caret: "hide" });
      shot = path.relative(path.dirname(path.dirname(shotFile)), shotFile).split(path.sep).join("/");
    } catch { shot = null; }
  }
  if (undo) {
    // The state wrote something local (capture): take it back in-page and say whether the
    // record is exactly as before. A failed undo is evidence, never a crash.
    try {
      stateRec.undone = await undo();
    } catch (err) {
      stateRec.undone = false;
      stateRec.undoError = String(err?.message ?? err).split("\n")[0].slice(0, 200);
    }
  }
  await page.close();
  return {
    route,
    viewport: `${vp.w}x${vp.h}`,
    lang: vp.lang,
    ...seedRec,
    ...stateRec,
    ...rec,
    consoleErrors: [...errors],
    rateLimited,
    apiRequests: api.sort(),
    loadMs,
    readyTimedOut,
    ...(retried ? { retried } : {}),
    ...(navError ? { navError } : {}),
    shot,
  };
}

/* ── determinism guards (per context) ─────────────────────────────────────── */
// Vite's HMR socket would push a concurrent builder's edits into a page mid-measure (stale
// lazy modules, "must be used within a Provider" crashes). Answer it with a silent mock
// socket: the client believes it is connected and never hot-swaps. Each FULL load still
// fetches the current files, which is the point of the sweep.
async function holdHmrSocket(context) {
  if (typeof context.routeWebSocket !== "function") return;
  await context.routeWebSocket(() => true, () => { /* never connectToServer() */ });
}

// The sandbox /api limiter allows 30 requests/min/IP and every page asks ~5–10 reads, so an
// uncached sweep turns half its cells into 429-degraded renders (Memory loses its pending
// module, Growth its record) that differ run to run. So: successful GET /api reads are cached
// for the run (shared by its three contexts — the server reads no Accept-Language), a 429 on
// an uncached read waits out the limiter window once and retries, and writes pass straight
// through. Every cell therefore renders against the same server reads. --no-api-cache = off.
const API_FROM_CACHE = new WeakSet();
const AI_READ_POSTS = /^\/api\/(todays-focus|digest)$/;
let limiterHoldUntil = 0;
async function cacheApiReads(context, cache) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await context.route(/\/api\//, async (route) => {
    const req = route.request();
    // v2: the two generation READS every Today load POSTs (no handler writes: api.ts
    // /todays-focus, /digest) are cached per run by exact body like a GET. Without this one
    // sweep spends the sandbox's per-uid hourly AI quota (aiQuota.ts, 80/h — mock calls
    // count too) and every later cell renders "didn't load" plus a starved Ask.
    const aiRead = req.method() === "POST" && AI_READ_POSTS.test(new URL(req.url()).pathname);
    if (req.method() !== "GET" && !aiRead) return route.continue();
    const key = `${aiRead ? `POST ${req.postData() ?? ""} ` : ""}${req.url().replace(/([?&])cb=\d+/g, "$1cb=N")}`;
    const hit = cache.get(key);
    if (hit) {
      API_FROM_CACHE.add(req);
      return route.fulfill({ status: hit.status, headers: hit.headers, body: hit.body });
    }
    try {
      if (limiterHoldUntil > Date.now()) await sleep(limiterHoldUntil - Date.now());
      let resp = await route.fetch();
      // The hourly AI quota's 429 (X-AI-Quota-Limit, Retry-After in minutes) is not the
      // 30/min IP limiter: waiting it out is not possible inside a cell — pass it through.
      if (resp.status() === 429 && resp.headers()["x-ai-quota-limit"]) return route.fulfill({ response: resp });
      if (resp.status() === 429) {
        const h = resp.headers();
        const resetS = Number(h["ratelimit-reset"] ?? h["retry-after"] ?? 60);
        const waitMs = Math.min(65, Math.max(1, Number.isFinite(resetS) ? resetS : 60) + 1) * 1000;
        limiterHoldUntil = Math.max(limiterHoldUntil, Date.now() + waitMs);
        await sleep(limiterHoldUntil - Date.now());
        resp = await route.fetch();
      }
      if (resp.status() === 200) cache.set(key, { status: 200, headers: resp.headers(), body: await resp.body() });
      return route.fulfill({ response: resp });
    } catch {
      return route.abort().catch(() => {});
    }
  });
}

/* ── warm-up: the first load of a Vite dev server compiles the module graph (≈60 s cold);
   absorb it once, unrecorded, so no cell's loadMs or mount verdict carries it. ──────────── */
async function warmUp(browser, base) {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: "block" });
  const page = await context.newPage();
  const t0 = Date.now();
  try {
    await page.goto(`${base}/?cb=${++cbCounter}#/overview`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.waitForSelector(READY_SELECTOR, { timeout: 120_000 });
  } catch (err) {
    console.error(`sweep: warm-up did not reach ready (${String(err?.message ?? err).split("\n")[0]})`);
  }
  await context.close();
  return Date.now() - t0;
}

/* ── one full sweep ──────────────────────────────────────────────────────── */
async function newSweepContext(browser, vp, opts, apiCache, setup = null) {
  const context = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    locale: vp.lang === "he" ? "he-IL" : "en-US",
    timezoneId: "Asia/Jerusalem",
    serviceWorkers: "block",
  });
  await context.addInitScript(initScript, { lang: vp.lang });
  await holdHmrSocket(context);
  if (opts.apiCache) await cacheApiReads(context, apiCache);
  await applySeed(context, SEED);
  // Registered last = matched first (Playwright): a state's own overrides beat the cache.
  if (setup) await setup(context);
  return context;
}

/** One state cell in its own throwaway context; one fresh retry unless the precondition is absent. */
async function stateCell(browser, opts, apiCache, route, vp, state, allowLatin, shotPath, tr) {
  const once = async () => {
    const context = await newSweepContext(browser, vp, opts, apiCache, state.setup ?? null);
    try {
      return await visit(context, opts.base, route, vp, allowLatin, shotPath, { state, tr });
    } finally {
      await context.close();
    }
  };
  let cell = await once();
  if ((cell.reached === false && cell.retryable) || (cell.reached && !cell.mounted)) {
    const first = { reached: cell.reached, reason: cell.reason ?? null, mounted: cell.mounted ?? false };
    cell = { ...(await once()), firstAttempt: first };
  }
  return cell;
}

async function sweep(browser, opts, routes, outDir, withShots, allowLatin, tr) {
  mkdirSync(outDir, { recursive: true });
  if (withShots) mkdirSync(path.join(outDir, "shots"), { recursive: true });
  const startedAt = new Date().toISOString();
  const sha = gitSha(); // the dev server serves the working tree; HEAD can move mid-run
  const cells = [];
  const apiCache = new Map(); // one per run: run 2 re-reads the server
  const pageRoutes = routes.filter((r) => r !== SHELL);
  for (const vp of VIEWPORTS) {
    const context = await newSweepContext(browser, vp, opts, apiCache);
    for (const route of routes) {
      if (route !== SHELL) {
        const shotPath = withShots ? path.join(outDir, "shots", `${route}.${vp.w}x${vp.h}.${vp.lang}.png`) : null;
        let cell = await visit(context, opts.base, route, vp, allowLatin, shotPath);
        if (!cell.mounted || cell.readyTimedOut) {
          // One fresh retry: a dev server under a concurrent builder's edits (or a browser
          // short of memory) can drop one load; a route that is really broken fails twice.
          const first = { mounted: cell.mounted, loadMs: cell.loadMs, readyTimedOut: cell.readyTimedOut, consoleErrors: cell.consoleErrors };
          cell = { ...(await visit(context, opts.base, route, vp, allowLatin, shotPath)), firstAttempt: first };
        }
        cells.push(cell);
      }
      if (!opts.states) continue;
      for (const state of statesFor(route, vp)) {
        const shotFor = withShots ? (name) => path.join(outDir, "shots", `${route}.${vp.w}x${vp.h}.${vp.lang}.${name}.png`) : null;
        cells.push(await stateCell(browser, opts, apiCache, route, vp, state, allowLatin, shotFor, tr));
      }
    }
    await context.close();
  }
  const isBase = (c) => (c.state ?? "base") === "base";
  const reached = cells.filter((c) => isBase(c) || c.reached);
  const baseCells = cells.filter(isBase);
  const count = (list, fn) => list.filter(fn).length;
  const doc = {
    runId: path.basename(outDir),
    base: opts.base,
    sha,
    ...(gitSha() !== sha ? { shaEnd: gitSha() } : {}),
    seed: SEED.seed,
    ...(SEED.info ? { seedBundle: SEED.info } : {}),
    states: opts.states,
    startedAt,
    finishedAt: new Date().toISOString(),
    totals: {
      routes: pageRoutes.length,
      cells: baseCells.length,
      mounted: count(baseCells, (c) => c.mounted),
      // The law totals read every rendered cell: base + reached states.
      consoleErrorCells: count(reached, (c) => c.consoleErrors.length > 0),
      pctCells: count(reached, (c) => (c.pctCount ?? 0) > 0),
      latinHECells: count(reached, (c) => (c.latinChromeHECount ?? 0) > 0),
      sub44Cells: count(reached, (c) => (c.sub44Count ?? 0) > 0),
      overflowCells: count(reached, (c) => c.overflow && c.overflow.scrollWidth > c.overflow.clientWidth),
      rateLimitedCells: count(cells, (c) => (c.rateLimited ?? 0) > 0),
      retriedCells: count(cells, (c) => !!c.firstAttempt),
      seedHydratedCells: count(reached, (c) => c.seedHydrated === true),
      stateCells: count(cells, (c) => !isBase(c) && c.reached),
      statesUnreached: count(cells, (c) => !isBase(c) && !c.reached),
      stateUndoFailed: count(cells, (c) => c.undone === false),
    },
    cells,
  };
  writeFileSync(path.join(outDir, "sweep.json"), JSON.stringify(doc, null, 2));
  return doc;
}

function summaryLine(doc, outDir) {
  const t = doc.totals;
  // "routes" = routes mounted in EVERY cell / routes swept.
  const byRoute = new Map();
  for (const c of doc.cells) {
    if ((c.state ?? "base") !== "base") continue;
    byRoute.set(c.route, (byRoute.get(c.route) ?? true) && !!c.mounted);
  }
  const mountedRoutes = [...byRoute.values()].filter(Boolean).length;
  return (
    `SWEEP sha=${doc.sha.slice(0, 7)} routes=${mountedRoutes}/${t.routes} cells=${t.cells} ` +
    `consoleErr=${t.consoleErrorCells} pct=${t.pctCells} latinHE=${t.latinHECells} sub44=${t.sub44Cells} ` +
    `overflow=${t.overflowCells} seed=${doc.seed ?? "day0"} stateCells=${t.stateCells ?? 0} ` +
    `statesUnreached=${t.statesUnreached ?? 0} out=${outDir}`
  );
}

/* ── diff (same fields for --diff and --runs) ────────────────────────────── */
// scope: "all" (--diff) · "base" · "state" (--runs reports the two apart). A v1 cell has no
// `state` and keys as base, so a v1 sweep.json diffs against v2 base cells.
function diffSweeps(prev, next, scope = "all") {
  const stateOf = (c) => c.state ?? "base";
  const inScope = (c) => scope === "all" || (scope === "base") === (stateOf(c) === "base");
  const key = (c) => `${c.route} ${c.viewport} ${c.lang}${stateOf(c) === "base" ? "" : ` ${stateOf(c)}`}`;
  const prevMap = new Map(prev.cells.filter(inScope).map((c) => [key(c), c]));
  const nextMap = new Map(next.cells.filter(inScope).map((c) => [key(c), c]));
  const lines = [];
  const changedCells = new Set();
  const vhOf = (c) => Number(String(c.viewport).split("x")[1]);
  const fields = [
    ["reached", (c) => (stateOf(c) === "base" ? null : !!c.reached)],
    ["mounted", (c) => !!c.mounted],
    ["h1", (c) => c.h1 ?? null],
    ["modules", (c) => [...new Set(c.modules ?? [])].sort().join(",")],
    ["primaryMove.id", (c) => c.primaryMove?.id ?? null],
    ["primaryMove.aboveFold", (c) => (c.primaryMove ? c.primaryMove.aboveFold ?? c.primaryMove.y <= vhOf(c) : null)],
    ["pctStrings", (c) => c.pctCount ?? (c.pctStrings ?? []).length],
    ["latinChromeHE", (c) => c.latinChromeHECount ?? (c.latinChromeHE ? c.latinChromeHE.length : null)],
    ["sub44AboveFold", (c) => c.sub44Count ?? (c.sub44AboveFold ?? []).length],
    ["consoleErrors", (c) => (c.consoleErrors ?? []).length],
  ];
  for (const k of new Set([...prevMap.keys(), ...nextMap.keys()])) {
    const a = prevMap.get(k);
    const b = nextMap.get(k);
    if (!a || !b) {
      lines.push(`${k}: cell ${a ? "present" : "absent"} -> ${b ? "present" : "absent"}`);
      changedCells.add(k);
      continue;
    }
    for (const [name, get] of fields) {
      const va = get(a);
      const vb = get(b);
      if (JSON.stringify(va) === JSON.stringify(vb)) continue;
      const show = (v) => (name === "primaryMove.aboveFold" && v !== null ? (v ? "above-fold" : `below-fold`) : JSON.stringify(v));
      const extra = name === "primaryMove.aboveFold" ? ` (y ${a.primaryMove?.y} -> ${b.primaryMove?.y})` : "";
      lines.push(`${k}: ${name} ${show(va)} -> ${show(vb)}${extra}`);
      changedCells.add(k);
    }
  }
  return { changed: changedCells.size, lines };
}

/* ── main ────────────────────────────────────────────────────────────────── */
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  let routes = await loadRoutes();
  if (opts.routes) {
    const unknown = opts.routes.filter((r) => r !== SHELL && !routes.includes(r));
    if (unknown.length) fail(`unknown route ids: ${unknown.join(",")}`);
    routes = routes.filter((r) => opts.routes.includes(r));
    if (opts.states && opts.routes.includes(SHELL)) routes.push(SHELL);
  } else if (opts.states) {
    routes.push(SHELL); // the non-route surfaces, rendered from #/overview
  }
  let prevDoc = null;
  if (opts.diff) {
    if (!existsSync(opts.diff)) fail(`--diff file not found: ${opts.diff}`);
    prevDoc = JSON.parse(readFileSync(opts.diff, "utf8"));
    // --routes narrows the comparison too; otherwise every unswept route reads as "absent".
    if (opts.routes) prevDoc = { ...prevDoc, cells: prevDoc.cells.filter((c) => routes.includes(c.route)) };
  }
  await waitForServer(opts.base);
  SEED = await loadSeed(opts.base, opts.seed);
  const allowLatin = [...new Set(["Arbor", seededChildName(), SEED.info?.childName].filter(Boolean))];
  const tr = opts.states ? await loadTranslate() : () => null;
  const { browser, channel } = await launchBrowser();
  const warmMs = await warmUp(browser, opts.base);
  const pageRoutes = routes.filter((r) => r !== SHELL);
  const stateCount = opts.states ? VIEWPORTS.reduce((n, vp) => n + routes.reduce((m, r) => m + statesFor(r, vp).length, 0), 0) : 0;
  console.error(
    `sweep: browser=${channel} warm-up=${warmMs}ms seed=${SEED.seed}${SEED.info ? ` (${SEED.info.marker})` : ""} ` +
      `routes=${pageRoutes.length} cells/run=${pageRoutes.length * VIEWPORTS.length} stateCells/run=${stateCount}`,
  );
  const docs = [];
  try {
    for (let r = 1; r <= opts.runs; r++) {
      const dir = r === 1 ? opts.out : path.join(opts.out, `run${r}`);
      const doc = await sweep(browser, opts, routes, dir, opts.shots && r === 1, allowLatin, tr);
      doc.browser = channel;
      writeFileSync(path.join(dir, "sweep.json"), JSON.stringify(doc, null, 2));
      docs.push(doc);
      console.log(summaryLine(doc, dir));
    }
  } finally {
    await browser.close();
  }
  if (prevDoc) {
    const d = diffSweeps(prevDoc, docs[0]);
    console.log(`DIFF changed=${d.changed} cells`);
    for (const l of d.lines) console.log(l);
  }
  if (docs.length > 1) {
    const report = (scope, okWord, badWord) => {
      const all = [];
      for (let r = 1; r < docs.length; r++) {
        const d = diffSweeps(docs[0], docs[r], scope);
        for (const l of d.lines) all.push(`run1->run${r + 1} ${l}`);
      }
      if (all.length === 0) console.log(okWord);
      else {
        console.log(`${badWord} ${all.length}`);
        for (const l of all) console.log(l);
      }
    };
    report("base", "STABLE", "UNSTABLE");
    if (opts.states) report("state", "STATE-STABLE", "STATE-UNSTABLE");
  }
}

main().catch((err) => fail(err?.stack ?? String(err)));
