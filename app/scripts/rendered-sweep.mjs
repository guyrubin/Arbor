/**
 * rendered-sweep.mjs — the rendered regression sweep (THE backlog operating model v2, item C)
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * ONE command renders every parent/kid route of the RUNNING sandbox and writes evidence to
 * files, so the validator and the critics read JSON + PNGs instead of driving a browser pane.
 *
 *   node scripts/rendered-sweep.mjs --out <dir> [--base http://localhost:4805] [--routes a,b]
 *        [--diff <prev sweep.json>] [--no-shots] [--no-api-cache] [--runs 1]  (npm run sweep -- …)
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

/* ── args ─────────────────────────────────────────────────────────────────── */
function parseArgs(argv) {
  const out = { base: "http://localhost:4805", shots: true, apiCache: true, runs: 1, routes: null, diff: null, out: null };
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
    else fail(`unknown argument ${a}`);
  }
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
    pctStrings: pctStrings.slice(0, 50),
    pctCount: pctStrings.length,
    latinChromeHE: latinChromeHE ? latinChromeHE.slice(0, 20) : null,
    latinChromeHECount: latinChromeHE ? latinChromeHE.length : null,
    sub44AboveFold: sub44,
    sub44Count: sub44.length,
    overflow: { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth },
  };
}

/* ── one route in one context ────────────────────────────────────────────── */
let cbCounter = Date.now();
async function visit(context, base, route, vp, allowLatin, shotPath) {
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
      await page.goto(`${base}/?cb=${++cbCounter}#/${route}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    } catch {
      retried = true; // a cold Vite transform can outlast one load; one retry, then record the failure
      await page.goto(`${base}/?cb=${++cbCounter}#/${route}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
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

  let rec;
  try {
    rec = await page.evaluate(collect, { lang: vp.lang, allowLatin });
  } catch (err) {
    rec = { mounted: false, collectError: String(err?.message ?? err).split("\n")[0] };
  }
  let shot = null;
  if (shotPath) {
    try {
      await page.screenshot({ path: shotPath, fullPage: false, animations: "disabled", caret: "hide" });
      shot = path.relative(path.dirname(path.dirname(shotPath)), shotPath).split(path.sep).join("/");
    } catch { shot = null; }
  }
  await page.close();
  return {
    route,
    viewport: `${vp.w}x${vp.h}`,
    lang: vp.lang,
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
let limiterHoldUntil = 0;
async function cacheApiReads(context, cache) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await context.route(/\/api\//, async (route) => {
    const req = route.request();
    if (req.method() !== "GET") return route.continue();
    const key = req.url().replace(/([?&])cb=\d+/g, "$1cb=N");
    const hit = cache.get(key);
    if (hit) {
      API_FROM_CACHE.add(req);
      return route.fulfill({ status: hit.status, headers: hit.headers, body: hit.body });
    }
    try {
      if (limiterHoldUntil > Date.now()) await sleep(limiterHoldUntil - Date.now());
      let resp = await route.fetch();
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
async function sweep(browser, opts, routes, outDir, withShots, allowLatin) {
  mkdirSync(outDir, { recursive: true });
  if (withShots) mkdirSync(path.join(outDir, "shots"), { recursive: true });
  const startedAt = new Date().toISOString();
  const sha = gitSha(); // the dev server serves the working tree; HEAD can move mid-run
  const cells = [];
  const apiCache = new Map(); // one per run: run 2 re-reads the server
  for (const vp of VIEWPORTS) {
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
    for (const route of routes) {
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
    await context.close();
  }
  const count = (fn) => cells.filter(fn).length;
  const doc = {
    runId: path.basename(outDir),
    base: opts.base,
    sha,
    ...(gitSha() !== sha ? { shaEnd: gitSha() } : {}),
    startedAt,
    finishedAt: new Date().toISOString(),
    totals: {
      routes: routes.length,
      cells: cells.length,
      mounted: count((c) => c.mounted),
      consoleErrorCells: count((c) => c.consoleErrors.length > 0),
      pctCells: count((c) => (c.pctCount ?? 0) > 0),
      latinHECells: count((c) => (c.latinChromeHECount ?? 0) > 0),
      sub44Cells: count((c) => (c.sub44Count ?? 0) > 0),
      overflowCells: count((c) => c.overflow && c.overflow.scrollWidth > c.overflow.clientWidth),
      rateLimitedCells: count((c) => (c.rateLimited ?? 0) > 0),
      retriedCells: count((c) => !!c.firstAttempt),
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
  for (const c of doc.cells) byRoute.set(c.route, (byRoute.get(c.route) ?? true) && !!c.mounted);
  const mountedRoutes = [...byRoute.values()].filter(Boolean).length;
  return (
    `SWEEP sha=${doc.sha.slice(0, 7)} routes=${mountedRoutes}/${t.routes} cells=${t.cells} ` +
    `consoleErr=${t.consoleErrorCells} pct=${t.pctCells} latinHE=${t.latinHECells} sub44=${t.sub44Cells} ` +
    `overflow=${t.overflowCells} out=${outDir}`
  );
}

/* ── diff (same fields for --diff and --runs) ────────────────────────────── */
function diffSweeps(prev, next) {
  const key = (c) => `${c.route} ${c.viewport} ${c.lang}`;
  const prevMap = new Map(prev.cells.map((c) => [key(c), c]));
  const nextMap = new Map(next.cells.map((c) => [key(c), c]));
  const lines = [];
  const changedCells = new Set();
  const vhOf = (c) => Number(String(c.viewport).split("x")[1]);
  const fields = [
    ["mounted", (c) => !!c.mounted],
    ["h1", (c) => c.h1 ?? null],
    ["modules", (c) => [...new Set(c.modules ?? [])].sort().join(",")],
    ["primaryMove.id", (c) => c.primaryMove?.id ?? null],
    ["primaryMove.aboveFold", (c) => (c.primaryMove ? c.primaryMove.y <= vhOf(c) : null)],
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
    const unknown = opts.routes.filter((r) => !routes.includes(r));
    if (unknown.length) fail(`unknown route ids: ${unknown.join(",")}`);
    routes = routes.filter((r) => opts.routes.includes(r));
  }
  let prevDoc = null;
  if (opts.diff) {
    if (!existsSync(opts.diff)) fail(`--diff file not found: ${opts.diff}`);
    prevDoc = JSON.parse(readFileSync(opts.diff, "utf8"));
    // --routes narrows the comparison too; otherwise every unswept route reads as "absent".
    if (opts.routes) prevDoc = { ...prevDoc, cells: prevDoc.cells.filter((c) => routes.includes(c.route)) };
  }
  const allowLatin = ["Arbor", seededChildName()].filter(Boolean);

  await waitForServer(opts.base);
  const { browser, channel } = await launchBrowser();
  const warmMs = await warmUp(browser, opts.base);
  console.error(`sweep: browser=${channel} warm-up=${warmMs}ms routes=${routes.length} cells/run=${routes.length * VIEWPORTS.length}`);
  const docs = [];
  try {
    for (let r = 1; r <= opts.runs; r++) {
      const dir = r === 1 ? opts.out : path.join(opts.out, `run${r}`);
      const doc = await sweep(browser, opts, routes, dir, opts.shots && r === 1, allowLatin);
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
    const all = [];
    for (let r = 1; r < docs.length; r++) {
      const d = diffSweeps(docs[0], docs[r]);
      for (const l of d.lines) all.push(`run1->run${r + 1} ${l}`);
    }
    if (all.length === 0) console.log("STABLE");
    else {
      console.log(`UNSTABLE ${all.length}`);
      for (const l of all) console.log(l);
    }
  }
}

main().catch((err) => fail(err?.stack ?? String(err)));
