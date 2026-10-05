/**
 * proof-sneak.mjs — B-GAME-12a/12b: a REAL-MOTION proof run of Sneak & Freeze.
 * ─────────────────────────────────────────────────────────────────────────────
 * Plays the flagged proof game in a visible-timing headless Chromium (rAF runs,
 * unlike a hidden preview pane) with REAL mouse input on the stage, saves PNG
 * frames at the moments that decide the first-sight verdict, and measures what
 * a recording would show: fps, the time from the hand-over to the first statue
 * (L1 and L2), touch-to-motion, round and sitting durations, tags per policy,
 * console errors, failed requests, audio counters, and a DOM scan (digits,
 * emoji, Latin in Hebrew, overflow, broken images, geometry).
 *
 *   node scripts/proof-sneak.mjs [--base http://localhost:4807] [--out <dir>]
 *        [--cells 375x812-en,375x812-he,1920x1080-en,1920x1080-he,375x667-en]
 *        [--no-policies] [--no-sitting] [--no-firstfun]
 *        [--notes <file.json>]   critic notes (an array of strings) -> REPORT.md
 *        [--rewrite]             only re-write REPORT.md from <out>/report.json (+ notes)
 *
 * Never starts a server (exit 2 when the base is not HTTP 200 within 60 s).
 * One browser, one context, one page at a time (low-memory machine); every
 * context is closed before the next opens.
 *
 * Policies (mouse.down / mouse.up on the stage):
 *   A "good player"   waits while the hero DEMONSTRATES (B-GAME-07e; the first
 *                     sitting on a fresh device), then holds while the cat's
 *                     `data-watcher` is counting (or wears the sunglasses while
 *                     looking), releases on anything else; plays a FULL sitting
 *                     (three tags), forces ONE catch in the second round (holds
 *                     through a look), then Play again and a SECOND full sitting
 *                     (B-GAME-12b: two endings, to prove the pictures differ).
 *                     The 375x667 cell plays one sitting (first frame + ending).
 *   first fun         age 3 (L1, track A) and age 6 (L2, track B) via the
 *                     local proof visit: the demonstration, then policy A until
 *                     the first statue verdict (time from the hand-over).
 *   B "never lets go" holds for 60 s.            (375x812 EN only)
 *   C "does nothing"  no input for 60 s.         (375x812 EN only)
 *
 * Frames: <out>/<WxH>-<lang>-<moment>.png, moments = first, demo-press,
 * demo-statue, midrun, statue, caught, tag-burst, tag, holdup, ending, again,
 * ending2 (and caught2 / tag-burst2 ... in the second sitting when seen).
 * report.json + REPORT.md beside them. The frames show the owner's son's
 * likeness: the output folder must keep `*.png` out of git (proof/.gitignore).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_DIR = path.resolve(APP_DIR, "..");

function parseArgs(argv) {
  const out = { base: "http://localhost:4807", out: null, cells: null, policies: true, sitting: true, firstfun: true, notes: null, rewrite: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--base") out.base = String(next()).replace(/\/+$/, "");
    else if (a === "--out") out.out = next();
    else if (a === "--cells") out.cells = String(next()).split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--no-policies") out.policies = false;
    else if (a === "--no-sitting") out.sitting = false;
    else if (a === "--no-firstfun") out.firstfun = false;
    else if (a === "--notes") out.notes = next();
    else if (a === "--rewrite") out.rewrite = true;
    else { console.error(`proof-sneak: unknown argument ${a}`); process.exit(1); }
  }
  if (!out.out) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    out.out = path.join(REPO_DIR, "..", "PAI", "projects", "arbor", "execution", "2026-10-06--kids-games", "proof", stamp);
  }
  out.out = path.resolve(out.out);
  return out;
}

const ALL_CELLS = [
  { id: "375x812-en", w: 375, h: 812, dsf: 2, lang: "en", sittings: 2 },
  { id: "375x812-he", w: 375, h: 812, dsf: 2, lang: "he", sittings: 2 },
  { id: "1920x1080-en", w: 1920, h: 1080, dsf: 1, lang: "en", sittings: 2 },
  { id: "1920x1080-he", w: 1920, h: 1080, dsf: 1, lang: "he", sittings: 2 },
  { id: "375x667-en", w: 375, h: 667, dsf: 2, lang: "en", sittings: 1 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(base) {
  const t0 = Date.now();
  let last = "";
  while (Date.now() - t0 < 60_000) {
    try {
      const res = await fetch(`${base}/`, { signal: AbortSignal.timeout(5000) });
      if (res.status === 200) return;
      last = `HTTP ${res.status}`;
    } catch (err) { last = String(err?.message ?? err); }
    await sleep(1000);
  }
  console.error(`proof-sneak: ${base} unreachable (${last})`);
  process.exit(2);
}

async function launchBrowser() {
  const { chromium } = await import("playwright");
  const errors = [];
  for (const channel of ["msedge", "chrome", undefined]) {
    try {
      const browser = await chromium.launch({ channel, headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
      return { browser, channel: channel ?? "chromium (bundled)" };
    } catch (err) {
      errors.push(`${channel ?? "bundled"}: ${String(err?.message ?? err).split("\n")[0]}`);
    }
  }
  console.error(`proof-sneak: no browser could launch — ${errors.join(" | ")}`);
  process.exit(1);
}

/* ── in-page: storage + instruments (before any app script, every load) ──── */
function initScript({ lang }) {
  try {
    localStorage.setItem("arbor.flags.sneakFreeze", "1");
    localStorage.setItem("arbor.kidmode.active", JSON.stringify({ open: true, view: "arcade", worldId: "sneak" }));
    localStorage.setItem("arbor.uiLang", lang);
    localStorage.setItem("arbor.aiLang", lang);
  } catch { /* reported by the mount check */ }
  const P = (window.__proof = { mountAt: null, frames: [], log: [], latencies: [], firstMoveAt: null, last: null });
  const snap = () => {
    const stage = document.querySelector("[data-sneak-stage]");
    const hero = document.querySelector("[data-hero-at]");
    const fig = document.querySelector("[data-hero-figure]");
    const w = document.querySelector("[data-watcher]");
    return {
      phase: stage?.getAttribute("data-sneak-phase") ?? (document.querySelector("[data-sneak-ending]") ? "ending" : null),
      demo: stage?.getAttribute("data-sneak-demo") ?? null,
      watcher: w?.getAttribute("data-watcher") ?? null,
      at: hero ? Number(hero.getAttribute("data-hero-at")) : null,
      pose: fig?.getAttribute("data-hero-figure") ?? null,
    };
  };
  window.__proofSnap = snap;
  const heroTransform = () => {
    const hero = document.querySelector("[data-hero-at]");
    const body = hero?.querySelector("[data-hero-figure] > div > div");
    return hero ? `${getComputedStyle(hero).transform}|${body ? getComputedStyle(body).transform : ""}` : null;
  };
  const tick = (now) => {
    P.frames.push(now);
    if (P.frames.length > 40000) P.frames.splice(0, 10000);
    if (P.mountAt === null && document.querySelector("[data-sneak-stage] [data-hero-at]")) P.mountAt = now;
    const s = snap();
    const key = `${s.phase}|${s.demo}|${s.watcher}|${s.at}|${s.pose}`;
    if (key !== P.last) { P.last = key; P.log.push({ t: now, ...s }); if (P.log.length > 40000) P.log.splice(0, 10000); }
    if (P.firstMoveAt === null && P.mountAt !== null && s.at !== null && s.at > 0) P.firstMoveAt = now;
    if (P.pending) {
      const tr = heroTransform();
      if (tr !== P.pending.tr) { P.latencies.push({ ms: Math.round(now - P.pending.t0), phase: P.pending.phase }); P.pending = null; }
      else if (now - P.pending.t0 > 1500) { P.latencies.push({ ms: null, phase: P.pending.phase }); P.pending = null; }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.addEventListener("pointerdown", (e) => {
    const s = snap();
    // A press that should move the hero: the cat counts (or the demo, which hands over and lurches).
    if ((s.watcher === "counting" && s.phase === "counting") || s.phase === "intro") P.pending = { t0: e.timeStamp, tr: heroTransform(), phase: s.phase };
  }, true);
}

/* ── in-page: DOM scan of the game ───────────────────────────────────────── */
function domScan({ lang }) {
  const root = document.querySelector("[data-kid-mode-layer][role=dialog]") || document.body;
  const visible = (el) => {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return false;
      if (cs.clipPath === "inset(50%)") return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const unseenIcon = (el) => !!el.closest("[aria-hidden='true']");
  const texts = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const raw = n.textContent ?? "";
    const t = raw.replace(/[⁦-⁩‎‏]/g, "").trim();
    if (!t || !n.parentElement || !visible(n.parentElement) || unseenIcon(n.parentElement)) continue;
    texts.push(t);
  }
  const labels = [...root.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label")).filter(Boolean);
  const alts = [...root.querySelectorAll("img[alt]")].map((e) => e.getAttribute("alt")).filter(Boolean);
  const all = [...texts, ...labels, ...alts];
  const digits = all.filter((t) => /[0-9٠-٩۰-۹]/.test(t));
  const emoji = all.filter((t) => /\p{Extended_Pictographic}/u.test(t));
  // Latin in Hebrew: the child's own name is isolated (U+2066..2069) — not a leak.
  const unisolated = (t) => t.replace(/[⁦⁧⁨][^⁩]*⁩/g, "");
  const rawTexts = [];
  const w2 = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w2.nextNode(); n; n = w2.nextNode()) if (n.parentElement && visible(n.parentElement) && !unseenIcon(n.parentElement) && (n.textContent ?? "").trim()) rawTexts.push(n.textContent);
  const latinInHe = lang === "he" ? [...rawTexts, ...labels, ...alts].map(unisolated).filter((t) => /[A-Za-z]/.test(t)) : [];
  const broken = [...root.querySelectorAll("img")].filter((i) => visible(i) && i.complete && i.naturalWidth === 0).map((i) => i.getAttribute("src")?.slice(0, 80));
  const de = document.documentElement;
  const overflow = { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, x: de.scrollWidth > de.clientWidth + 1 };
  const endingStack = document.querySelector("[data-sneak-ending-stack]");
  const scrolls = endingStack ? endingStack.scrollHeight > endingStack.clientHeight + 1 : false;
  const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
  const shown = (sel) => [...document.querySelectorAll(sel)].find((e) => getComputedStyle(e).opacity !== "0");
  const geometry = {
    viewport: { w: innerWidth, h: innerHeight },
    bar: rect(document.querySelector("[data-kid-bar-title]")?.parentElement),
    stage: rect(document.querySelector("[data-sneak-stage]")),
    heroSprite: rect(shown("[data-hero-pose]")),
    heroPose: shown("[data-hero-pose]")?.getAttribute("data-hero-pose") ?? null,
    heroShadow: rect(document.querySelector("[data-hero-shadow]")),
    carry: rect(document.querySelector("[data-hero-carry]")),
    watcherSprite: rect(shown("[data-watcher-slot]")),
    watcherSlot: shown("[data-watcher-slot]")?.getAttribute("data-watcher-slot") ?? null,
    covers: Object.fromEntries([...document.querySelectorAll("[data-cover]")].map((e) => [e.getAttribute("data-cover"), rect(e)])),
    photo: rect(document.querySelector("[data-sneak-photo]")),
    prizes: rect(document.querySelector("[data-sneak-prizes]")),
    toys: rect(document.querySelector("[data-sneak-ending-toys]")),
    endingScrolls: scrolls,
  };
  const picture = document.querySelector("[data-statue-picture]");
  return { texts, labels, digits, emoji, latinInHe, broken, overflow, geometry, pictureHash: picture ? hashString(picture.getAttribute("src") ?? "") : null, htmlLang: de.lang, dir: de.dir };
  function hashString(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i += 7) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return `${s.length}:${h.toString(16)}`; }
}

/* ── one context ─────────────────────────────────────────────────────────── */
async function openGame(browser, base, cell, query = "") {
  const context = await browser.newContext({
    viewport: { width: cell.w, height: cell.h },
    deviceScaleFactor: cell.dsf,
    locale: cell.lang === "he" ? "he-IL" : "en-US",
    timezoneId: "Asia/Jerusalem",
    serviceWorkers: "block",
    hasTouch: false,
  });
  await context.addInitScript(initScript, { lang: cell.lang });
  if (typeof context.routeWebSocket === "function") await context.routeWebSocket(() => true, () => {});
  // The sandbox has no demo-family bundle: answer the hydrator with "no child" (as the
  // rendered sweep's day0 does) instead of a 404 that is not the game's.
  await context.route((u) => u.pathname === "/sandbox/demo-family.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ proof: "day0" }) }));
  const page = await context.newPage();
  const errors = [];
  const failed = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 300)); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${String(e?.message ?? e).slice(0, 300)}`));
  page.on("requestfailed", (r) => failed.push({ url: r.url().replace(base, ""), why: r.failure()?.errorText ?? "failed" }));
  page.on("response", (r) => { if (r.status() >= 400) failed.push({ url: r.url().replace(base, ""), status: r.status() }); });
  const t0 = Date.now();
  await page.goto(`${base}/?cb=${Date.now()}${query}`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.waitForSelector("[data-sneak-stage] [data-hero-at]", { state: "attached", timeout: 120_000 });
  // Every image of the scene decoded (the proof art preloads before mount).
  await page.waitForFunction(() => [...document.querySelectorAll("[data-sneak-stage] img")].every((i) => i.complete), null, { timeout: 30_000 }).catch(() => {});
  return { context, page, errors, failed, loadMs: Date.now() - t0 };
}

async function shot(page, out, cell, moment, shots) {
  const file = path.join(out, `${cell.id}-${moment}.png`);
  await page.screenshot({ path: file });
  shots[moment] = path.basename(file);
}

const snapOf = (page) => page.evaluate(() => {
  const s = window.__proofSnap();
  const ending = document.querySelector("[data-sneak-ending]");
  return { ...s, ending: !!ending, toys: document.querySelector("[data-sneak-ending-toys]")?.getAttribute("data-sneak-ending-toys") ?? null, picture: !!document.querySelector("[data-statue-picture]"), rules: window.__sneakDebug?.rules?.() ?? null, hand: document.querySelector("[data-sneak-hand-mode]")?.getAttribute("data-sneak-hand-mode") ?? null };
});

/** Policy A on the open page until the ending (or `until` says stop). */
async function playA(page, out, cell, shots, scans, { suffix = "", forceCatch = true, until = null } = {}) {
  const stage = await page.locator("[data-sneak-stage]").boundingBox();
  const cx = stage.x + stage.width * 0.5;
  const cy = stage.y + stage.height * 0.55;
  await page.mouse.move(cx, cy);
  let down = false;
  const set = async (want) => {
    if (want === down) return;
    down = want;
    if (want) await page.mouse.down(); else await page.mouse.up();
  };
  const seen = new Set();
  const take = async (m) => { if (!out) return; const k = `${m}${suffix}`; await shot(page, out, cell, k, shots); scans[k] = await page.evaluate(domScan, { lang: cell.lang }); };
  let caughtDone = !forceCatch;
  const t0 = Date.now();
  while (Date.now() - t0 < 600_000) {
    const s = await snapOf(page);
    if (s.ending) break;
    if (until && until(s)) break;
    // The demonstration plays out untouched (a touch would take over at once).
    if (s.phase === "intro") {
      await set(false);
      if (!seen.has("demo-press") && s.demo === "count" && (s.at ?? 0) > 0) { seen.add("demo-press"); await take("demo-press"); }
      else if (!seen.has("demo-statue") && s.demo === "statue") { seen.add("demo-statue"); await sleep(350); await take("demo-statue"); }
      await sleep(20);
      continue;
    }
    const round = s.rules?.round ?? 0;
    const forcing = !caughtDone && round >= 1;
    // The cat cannot see: counting with its paws over its eyes, or wearing the sunglasses.
    const free = s.watcher === "counting" || s.watcher === "sunglasses";
    if (s.pose === "oops" && !caughtDone) {
      caughtDone = true;
      await set(false);
      if (!seen.has("caught")) { seen.add("caught"); await take("caught"); }
      continue;
    }
    if (s.phase === "tagged" && !seen.has(`tag-burst-${s.rules?.tags}`)) {
      seen.add(`tag-burst-${s.rules?.tags}`);
      await set(false);
      // The burst lasts 900 ms: the first tag of the sitting is framed at once.
      if (!seen.has("tag-burst")) { seen.add("tag-burst"); await take("tag-burst"); }
    }
    await set(forcing ? s.phase !== "verdict" || s.pose !== "oops" : free);
    if (!seen.has("midrun") && s.at !== null && s.at >= 0.45 && s.at <= 0.65 && (s.pose === "tiptoe" || s.pose === "dash")) {
      seen.add("midrun");
      await take("midrun");
    } else if (!seen.has("statue") && s.phase === "verdict" && (s.pose === "freeze-a" || s.pose === "freeze-b")) {
      seen.add("statue");
      await sleep(500);
      await take("statue");
    } else if (!seen.has("tag") && s.phase === "tagged" && s.pose === "cheer" && seen.has("tag-burst")) {
      seen.add("tag");
      await sleep(250);
      await take("tag");
    } else if (!seen.has("holdup") && s.phase === "tagged" && s.pose === "hold-up") {
      seen.add("holdup");
      await sleep(250);
      await take("holdup");
    }
    await sleep(20);
  }
  await set(false);
}

async function endingShot(page, out, cell, shots, scans, moment) {
  await page.waitForFunction(() => document.querySelector("[data-sneak-ending-toys]")?.getAttribute("data-sneak-ending-toys") === "ready", null, { timeout: 20_000 }).catch(() => {});
  await sleep(900);
  const endingAt = await page.evaluate(() => performance.now());
  await shot(page, out, cell, moment, shots);
  scans[moment] = await page.evaluate(domScan, { lang: cell.lang });
  return endingAt;
}

/* ── policy A: one or two full sittings ──────────────────────────────────── */
async function sittingA(browser, base, out, cell) {
  const { context, page, errors, failed, loadMs } = await openGame(browser, base, cell);
  const shots = {};
  const scans = {};
  await sleep(250);
  await shot(page, out, cell, "first", shots);
  scans.first = await page.evaluate(domScan, { lang: cell.lang });
  await playA(page, out, cell, shots, scans);
  const endingAt = await endingShot(page, out, cell, shots, scans, "ending");
  const audio = await page.evaluate(() => window.__sneakDebug?.audio?.() ?? null);
  const grab = () => page.evaluate(() => ({ mountAt: window.__proof.mountAt, firstMoveAt: window.__proof.firstMoveAt, log: window.__proof.log, latencies: window.__proof.latencies, frames: window.__proof.frames }));
  const proof = await grab();
  const sittings = [metricsOf(proof, proof.mountAt, endingAt)];
  let again = null;
  if (cell.sittings > 1) {
    const btn = page.locator("[data-kid-finish-again]");
    if (await btn.count()) {
      const clickAt = await page.evaluate(() => performance.now());
      await btn.first().click();
      await page.waitForSelector("[data-sneak-stage] [data-hero-at]", { state: "attached", timeout: 10_000 }).catch(() => {});
      await sleep(300);
      await shot(page, out, cell, "again", shots);
      scans.again = await page.evaluate(domScan, { lang: cell.lang });
      again = await snapOf(page);
      await playA(page, out, cell, shots, scans, { suffix: "2" });
      const endingAt2 = await endingShot(page, out, cell, shots, scans, "ending2");
      const proof2 = await grab();
      sittings.push(metricsOf(proof2, clickAt, endingAt2));
    }
  }
  const audioEnd = await page.evaluate(() => window.__sneakDebug?.audio?.() ?? null);
  await context.close();
  const pictures = [scans.ending?.pictureHash ?? null, scans.ending2?.pictureHash ?? null];
  return { cell: cell.id, loadMs, shots, scans, audio: audioEnd ?? audio, errors, failed, again, pictures, sittings, metrics: sittings[0] };
}

function metricsOf(proof, fromAt, endingAt) {
  const { firstMoveAt, latencies, frames } = proof;
  const log = proof.log.filter((e) => e.t >= fromAt && e.t <= endingAt);
  // fps: the best and worst 5-s windows during play.
  const play = frames.filter((t) => t >= fromAt && t <= endingAt);
  let fpsMin = null;
  let fpsMax = null;
  for (let a = fromAt + 2000; a + 5000 <= endingAt; a += 5000) {
    const n = play.filter((t) => t >= a && t < a + 5000).length / 5;
    fpsMin = fpsMin === null ? n : Math.min(fpsMin, n);
    fpsMax = fpsMax === null ? n : Math.max(fpsMax, n);
  }
  // The demonstration, the hand-over (the first chant) and the first statue verdict.
  const demoStart = log.find((e) => e.phase === "intro")?.t ?? null;
  const control = log.find((e) => e.phase === "counting")?.t ?? null;
  const statue = control === null ? null : log.find((e) => e.t >= control && e.phase === "verdict" && (e.pose === "freeze-a" || e.pose === "freeze-b"))?.t ?? null;
  // Rounds: a tag closes a round; the next starts at the following "ready".
  const tags = [];
  let roundStart = fromAt;
  const rounds = [];
  let prevPhase = null;
  for (const e of log) {
    if (e.phase === "tagged" && prevPhase !== "tagged") { tags.push(e.t); rounds.push(Math.round(e.t - roundStart)); }
    if (e.phase === "ready" && prevPhase !== "ready") roundStart = e.t;
    prevPhase = e.phase;
  }
  const gaps = [];
  for (let i = 1; i < log.length; i++) {
    const dt = log[i].t - log[i - 1].t;
    if (dt > 1500) gaps.push({ at: Math.round(log[i - 1].t - fromAt), ms: Math.round(dt), phase: log[i - 1].phase, watcher: log[i - 1].watcher, pose: log[i - 1].pose });
  }
  const lat = latencies.filter((l) => typeof l.ms === "number").map((l) => l.ms).sort((a, b) => a - b);
  return {
    fps: { min5s: fpsMin, max5s: fpsMax },
    firstMoveMs: firstMoveAt && fromAt ? Math.max(0, Math.round(firstMoveAt - fromAt)) : null,
    demoMs: demoStart !== null && control !== null ? Math.round(control - demoStart) : null,
    controlToFirstStatueMs: control !== null && statue !== null ? Math.round(statue - control) : null,
    startToFirstCountMs: control !== null ? Math.round(control - fromAt) : null,
    touchToMotionMs: { n: lat.length, median: lat.length ? lat[Math.floor(lat.length / 2)] : null, max: lat.length ? lat[lat.length - 1] : null, misses: latencies.filter((l) => l.ms === null).length },
    roundsMs: rounds,
    sittingMs: fromAt ? Math.round(endingAt - fromAt) : null,
    tagsIn60s: tags.filter((t) => t - fromAt <= 60_000).length,
    tags: tags.length,
    gapsOver1500ms: gaps,
  };
}

/* ── first fun: L1 (age 3) and L2 (age 6), the demo then the first statue ── */
async function firstFun(browser, base, cell, age) {
  const { context, page, errors, failed } = await openGame(browser, base, cell, `&proof=sneak&lang=${cell.lang}&age=${age}`);
  await playA(page, null, cell, {}, {}, { forceCatch: false, until: (s) => s.phase === "verdict" && (s.pose === "freeze-a" || s.pose === "freeze-b") }).catch((e) => errors.push(String(e)));
  await sleep(200);
  const r = await page.evaluate(() => ({ rules: window.__sneakDebug?.rules?.() ?? null, log: window.__proof.log, mountAt: window.__proof.mountAt }));
  await context.close();
  const demoStart = r.log.find((e) => e.phase === "intro")?.t ?? null;
  const control = r.log.find((e) => e.phase === "counting")?.t ?? null;
  const statue = control === null ? null : r.log.find((e) => e.t >= control && e.phase === "verdict" && (e.pose === "freeze-a" || e.pose === "freeze-b"))?.t ?? null;
  return { age, level: r.rules?.level ?? null, track: r.rules?.track ?? null, demoMs: demoStart !== null && control !== null ? Math.round(control - demoStart) : null, controlToFirstStatueMs: control !== null && statue !== null ? Math.round(statue - control) : null, errors, failed };
}

/* ── policies B and C: 60 s each ─────────────────────────────────────────── */
async function policy(browser, base, cell, kind) {
  const { context, page, errors, failed } = await openGame(browser, base, cell);
  const stage = await page.locator("[data-sneak-stage]").boundingBox();
  await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height * 0.55);
  if (kind === "B") await page.mouse.down();
  await sleep(60_000);
  const r = await page.evaluate(() => window.__sneakDebug?.rules?.() ?? null);
  const s = await snapOf(page);
  if (kind === "B") await page.mouse.up();
  await context.close();
  return { policy: kind, cell: cell.id, tags: r?.tags ?? null, round: r?.round ?? null, pos: r?.pos ?? null, phase: s.phase, errors, failed };
}

/* ── report ──────────────────────────────────────────────────────────────── */
function reportMd(rep, notes) {
  const L = [];
  const s1 = (x) => (x === null || x === undefined ? "—" : (x / 1000).toFixed(1));
  L.push(`# Sneak & Freeze — real-motion proof run`, "", `Run ${rep.startedAt} · ${rep.base} · ${rep.browser}`, "");
  L.push("## Sittings (policy A)", "");
  L.push("| cell · sitting | fps (5 s min/max) | demo (s) | first count after start (s) | hand-over → first statue (s) | touch→motion (median/max) | rounds (s) | sitting (s) | tags | errors | failed req | audio |");
  L.push("|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const c of rep.sittings) {
    (c.sittings ?? [c.metrics]).forEach((m, i) => {
      L.push(`| ${c.cell} · ${i + 1} | ${m.fps.min5s}/${m.fps.max5s} | ${s1(m.demoMs)} | ${s1(m.startToFirstCountMs)} | ${s1(m.controlToFirstStatueMs)} | ${m.touchToMotionMs.median}/${m.touchToMotionMs.max} ms (n=${m.touchToMotionMs.n}, misses ${m.touchToMotionMs.misses}) | ${m.roundsMs.map((x) => (x / 1000).toFixed(1)).join(", ")} | ${s1(m.sittingMs)} | ${m.tags} | ${i === 0 ? c.errors.length : "″"} | ${i === 0 ? c.failed.length : "″"} | ${i === 0 && c.audio ? `${c.audio.context}, decoded ${c.audio.decoded}, played ${c.audio.played}/${c.audio.asked}` : "″"} |`);
    });
  }
  L.push("", "Two endings in a row (picture data hash; must differ):", "");
  for (const c of rep.sittings) if (c.pictures?.[1]) L.push(`- ${c.cell}: ${c.pictures[0]} vs ${c.pictures[1]} → ${c.pictures[0] !== c.pictures[1] ? "DIFFERENT" : "SAME"}`);
  L.push("", "## First fun (fresh device: the demonstration, then policy A)", "");
  for (const f of rep.firstFun ?? []) L.push(`- age ${f.age} (L${f.level}, track ${f.track}): demo ${s1(f.demoMs)} s, hand-over → first statue ${s1(f.controlToFirstStatueMs)} s, errors ${f.errors.length}, failed ${f.failed.length}`);
  L.push("", "## Policies (60 s)", "");
  for (const p of rep.policies) L.push(`- ${p.policy} at ${p.cell}: tags ${p.tags}, round ${p.round}, pos ${p.pos}, phase ${p.phase}, errors ${p.errors.length}, failed ${p.failed.length}`);
  L.push("", "## DOM scan (all moments)", "");
  for (const c of rep.sittings) {
    const sc = Object.values(c.scans);
    const dig = [...new Set(sc.flatMap((s) => s.digits))];
    const emo = [...new Set(sc.flatMap((s) => s.emoji))];
    const lat = [...new Set(sc.flatMap((s) => s.latinInHe))];
    const txt = [...new Set(sc.flatMap((s) => s.texts))];
    const ovf = sc.some((s) => s.overflow.x);
    const scrolls = Object.entries(c.scans).filter(([, s]) => s.geometry.endingScrolls).map(([k]) => k);
    const brk = [...new Set(sc.flatMap((s) => s.broken))];
    L.push(`- ${c.cell}: digits ${JSON.stringify(dig)} · emoji ${JSON.stringify(emo)} · latin-in-HE ${JSON.stringify(lat)} · overflow ${ovf} · ending scrolls ${JSON.stringify(scrolls)} · broken ${JSON.stringify(brk)} · visible text ${JSON.stringify(txt)}`);
  }
  L.push("", "## Ending geometry", "");
  for (const c of rep.sittings) {
    for (const k of ["ending", "ending2"]) {
      const g = c.scans[k]?.geometry;
      if (!g?.photo) continue;
      L.push(`- ${c.cell} ${k}: picture ${g.photo.w}x${g.photo.h} = ${Math.round((g.photo.w / g.viewport.w) * 100)} % of the width, ${Math.round((g.photo.h / g.viewport.h) * 100)} % of the height; toys bottom ${g.toys ? g.toys.y + g.toys.h : "—"} of ${g.viewport.h}; scrolls ${g.endingScrolls}`);
    }
  }
  L.push("", "## Silences > 1.5 s (no state change)", "");
  for (const c of rep.sittings) (c.sittings ?? [c.metrics]).forEach((m, i) => L.push(`- ${c.cell} · ${i + 1}: ${m.gapsOver1500ms.map((g) => `${(g.at / 1000).toFixed(1)}s ${g.phase}/${g.watcher}/${g.pose} ${g.ms}ms`).join("; ") || "none"}`));
  if (notes?.length) {
    L.push("", "## Critic notes (frames viewed)", "");
    for (const n of notes) L.push(`- ${n}`);
  }
  return L.join("\n") + "\n";
}

function readNotes(file) {
  if (!file) return null;
  try { const v = JSON.parse(readFileSync(path.resolve(file), "utf8")); return Array.isArray(v) ? v.map(String) : null; } catch { return null; }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  mkdirSync(args.out, { recursive: true });
  const notes = readNotes(args.notes);
  if (args.rewrite) {
    const rep = JSON.parse(readFileSync(path.join(args.out, "report.json"), "utf8"));
    writeFileSync(path.join(args.out, "REPORT.md"), reportMd(rep, notes));
    console.log(`proof-sneak: REPORT.md re-written -> ${args.out}`);
    return;
  }
  await waitForServer(args.base);
  const cells = args.cells ? ALL_CELLS.filter((c) => args.cells.includes(c.id)) : ALL_CELLS;
  const { browser, channel } = await launchBrowser();
  const rep = { startedAt: new Date().toISOString(), base: args.base, browser: channel, out: args.out, sittings: [], firstFun: [], policies: [] };
  const save = () => writeFileSync(path.join(args.out, "report.json"), JSON.stringify(rep, (k, v) => (k === "frames" || k === "log" ? undefined : v), 2));
  try {
    // Warm the dev server's module graph once (unrecorded).
    { const w = await openGame(browser, args.base, cells[0]).catch(() => null); if (w) await w.context.close(); }
    if (args.sitting) {
      for (const cell of cells) {
        console.log(`proof-sneak: sitting ${cell.id}`);
        const r = await sittingA(browser, args.base, args.out, cell);
        rep.sittings.push(r);
        save();
        console.log(`proof-sneak: ${cell.id} ${JSON.stringify(r.sittings.map((m) => ({ ...m, gapsOver1500ms: m.gapsOver1500ms.length })))} pictures=${JSON.stringify(r.pictures)} audio=${JSON.stringify(r.audio)} errors=${r.errors.length} failed=${r.failed.length}`);
      }
    }
    if (args.firstfun) {
      for (const age of [3, 6]) {
        const r = await firstFun(browser, args.base, ALL_CELLS[0], age);
        rep.firstFun.push(r);
        save();
        console.log(`proof-sneak: first fun age ${age} ${JSON.stringify({ ...r, errors: r.errors.length, failed: r.failed.length })}`);
      }
    }
    if (args.policies) {
      const cell = ALL_CELLS[0];
      for (const k of ["B", "C"]) {
        console.log(`proof-sneak: policy ${k}`);
        const r = await policy(browser, args.base, cell, k);
        rep.policies.push(r);
        save();
        console.log(`proof-sneak: policy ${k} ${JSON.stringify({ tags: r.tags, round: r.round, pos: r.pos, phase: r.phase })}`);
      }
    }
  } finally {
    await browser.close();
  }
  save();
  writeFileSync(path.join(args.out, existsSync(path.join(args.out, "REPORT.md")) ? "REPORT.auto.md" : "REPORT.md"), reportMd(rep, notes));
  console.log(`proof-sneak: done -> ${args.out}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
