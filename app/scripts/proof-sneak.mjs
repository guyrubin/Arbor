/**
 * proof-sneak.mjs — B-GAME-12a: a REAL-MOTION proof run of Sneak & Freeze.
 * ─────────────────────────────────────────────────────────────────────────────
 * Plays the flagged proof game in a visible-timing headless Chromium (rAF runs,
 * unlike a hidden preview pane) with REAL mouse input on the stage, saves PNG
 * frames at the moments that decide the first-sight verdict, and measures what
 * a recording would show: fps, first movement, touch-to-motion, round and
 * sitting durations, tags per policy, console errors, failed requests, audio
 * counters, and a DOM scan (digits, emoji, visible text, overflow, broken images).
 *
 *   node scripts/proof-sneak.mjs [--base http://localhost:4807] [--out <dir>]
 *        [--cells 375x812-en,375x812-he,1920x1080-en,1920x1080-he] [--no-policies]
 *
 * Never starts a server (exit 2 when the base is not HTTP 200 within 60 s).
 * One browser, one context, one page at a time (low-memory machine); every
 * context is closed before the next opens.
 *
 * Policies (mouse.down / mouse.up on the stage centre):
 *   A "good player"   hold while the cat's `data-watcher` is counting (or wears
 *                     the sunglasses while looking), release on anything else;
 *                     plays a FULL sitting (three tags), forces ONE catch in the
 *                     second round (holds through a look), then Play again.
 *   B "never lets go" holds for 60 s.            (375x812 EN only)
 *   C "does nothing"  no input for 60 s.         (375x812 EN only)
 *
 * Frames: <out>/<WxH>-<lang>-<moment>.png, moments = first, midrun, statue,
 * caught, tag, holdup, ending, again. report.json + REPORT.md beside them.
 * The frames show the owner's son's likeness: the output folder must keep
 * `*.png` out of git (proof/.gitignore).
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_DIR = path.resolve(APP_DIR, "..");

function parseArgs(argv) {
  const out = { base: "http://localhost:4807", out: null, cells: null, policies: true, sitting: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--base") out.base = String(next()).replace(/\/+$/, "");
    else if (a === "--out") out.out = next();
    else if (a === "--cells") out.cells = String(next()).split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--no-policies") out.policies = false;
    else if (a === "--no-sitting") out.sitting = false;
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
  { id: "375x812-en", w: 375, h: 812, dsf: 2, lang: "en" },
  { id: "375x812-he", w: 375, h: 812, dsf: 2, lang: "he" },
  { id: "1920x1080-en", w: 1920, h: 1080, dsf: 1, lang: "en" },
  { id: "1920x1080-he", w: 1920, h: 1080, dsf: 1, lang: "he" },
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
    if (P.frames.length > 20000) P.frames.splice(0, 5000);
    if (P.mountAt === null && document.querySelector("[data-sneak-stage] [data-hero-at]")) P.mountAt = now;
    const s = snap();
    const key = `${s.phase}|${s.watcher}|${s.at}|${s.pose}`;
    if (key !== P.last) { P.last = key; P.log.push({ t: now, ...s }); if (P.log.length > 20000) P.log.splice(0, 5000); }
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
    // A press that should move the hero: the cat counts (or the intro's count).
    if (s.watcher === "counting" && (s.phase === "counting" || s.phase === "intro")) P.pending = { t0: e.timeStamp, tr: heroTransform(), phase: s.phase };
  }, true);
}

/* ── in-page: DOM scan of the game ───────────────────────────────────────── */
function domScan({ lang }) {
  const root = document.querySelector("[data-kid-mode-layer][role=dialog]") || document.body;
  const visible = (el) => {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const texts = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent.replace(/[⁦-⁩‎‏]/g, "").trim();
    if (!t || !n.parentElement || !visible(n.parentElement)) continue;
    texts.push(t);
  }
  const labels = [...root.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label")).filter(Boolean);
  const alts = [...root.querySelectorAll("img[alt]")].map((e) => e.getAttribute("alt")).filter(Boolean);
  const all = [...texts, ...labels, ...alts];
  const digits = all.filter((t) => /[0-9٠-٩۰-۹]/.test(t));
  const emoji = all.filter((t) => /\p{Extended_Pictographic}/u.test(t));
  const latinInHe = lang === "he" ? texts.concat(labels, alts).filter((t) => /[A-Za-z]/.test(t)) : [];
  const broken = [...root.querySelectorAll("img")].filter((i) => visible(i) && i.complete && i.naturalWidth === 0).map((i) => i.getAttribute("src")?.slice(0, 80));
  const de = document.documentElement;
  const overflow = { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, x: de.scrollWidth > de.clientWidth + 1 };
  const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
  const shown = (sel) => [...document.querySelectorAll(sel)].find((e) => getComputedStyle(e).opacity !== "0");
  const geometry = {
    viewport: { w: innerWidth, h: innerHeight },
    bar: rect(document.querySelector("[data-kid-bar-title]")?.parentElement),
    stage: rect(document.querySelector("[data-sneak-stage]")),
    heroSprite: rect(shown("[data-hero-pose]")),
    heroPose: shown("[data-hero-pose]")?.getAttribute("data-hero-pose") ?? null,
    heroShadow: rect(document.querySelector("[data-hero-shadow]")),
    watcherSprite: rect(shown("[data-watcher-slot]")),
    watcherSlot: shown("[data-watcher-slot]")?.getAttribute("data-watcher-slot") ?? null,
    covers: Object.fromEntries([...document.querySelectorAll("[data-cover]")].map((e) => [e.getAttribute("data-cover"), rect(e)])),
  };
  return { texts, labels, digits, emoji, latinInHe, broken, overflow, geometry, htmlLang: de.lang, dir: de.dir };
}

/* ── one context ─────────────────────────────────────────────────────────── */
async function openGame(browser, base, cell) {
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
  await page.goto(`${base}/?cb=${Date.now()}`, { waitUntil: "domcontentloaded", timeout: 180_000 });
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
  return { ...s, ending: !!ending, toys: document.querySelector("[data-sneak-ending-toys]")?.getAttribute("data-sneak-ending-toys") ?? null, picture: !!document.querySelector("[data-statue-picture]"), rules: window.__sneakDebug?.rules?.() ?? null };
});

/* ── policy A: a full sitting ────────────────────────────────────────────── */
async function sittingA(browser, base, out, cell) {
  const { context, page, errors, failed, loadMs } = await openGame(browser, base, cell);
  const shots = {};
  const scans = {};
  const stage = await page.locator("[data-sneak-stage]").boundingBox();
  const cx = stage.x + stage.width * 0.5;
  const cy = stage.y + stage.height * 0.55;
  await page.mouse.move(cx, cy);
  await sleep(250);
  await shot(page, out, cell, "first", shots);
  scans.first = await page.evaluate(domScan, { lang: cell.lang });
  let down = false;
  const set = async (want) => {
    if (want === down) return;
    down = want;
    if (want) await page.mouse.down(); else await page.mouse.up();
  };
  const seen = new Set();
  let caughtDone = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 600_000) {
    const s = await snapOf(page);
    if (s.ending) break;
    const round = s.rules?.round ?? 0;
    const forceCatch = !caughtDone && round >= 1;
    // The cat cannot see: counting with its paws over its eyes, or wearing the sunglasses.
    const free = s.watcher === "counting" || s.watcher === "sunglasses";
    await set(forceCatch ? s.phase !== "verdict" || s.pose !== "oops" ? true : false : free);
    if (s.pose === "oops" && !caughtDone) {
      caughtDone = true;
      await set(false);
      await sleep(90);
      if (!seen.has("caught")) { seen.add("caught"); await shot(page, out, cell, "caught", shots); scans.caught = await page.evaluate(domScan, { lang: cell.lang }); }
      continue;
    }
    if (!seen.has("midrun") && s.at !== null && s.at >= 0.45 && s.at <= 0.65 && (s.pose === "tiptoe" || s.pose === "dash")) {
      seen.add("midrun");
      await shot(page, out, cell, "midrun", shots);
      scans.midrun = await page.evaluate(domScan, { lang: cell.lang });
    } else if (!seen.has("statue") && s.phase === "verdict" && (s.pose === "freeze-a" || s.pose === "freeze-b")) {
      seen.add("statue");
      await sleep(160);
      await shot(page, out, cell, "statue", shots);
      scans.statue = await page.evaluate(domScan, { lang: cell.lang });
    } else if (!seen.has("tag") && s.phase === "tagged" && s.pose === "cheer") {
      seen.add("tag");
      await sleep(160);
      await shot(page, out, cell, "tag", shots);
      scans.tag = await page.evaluate(domScan, { lang: cell.lang });
    } else if (!seen.has("holdup") && s.phase === "tagged" && s.pose === "hold-up") {
      seen.add("holdup");
      await sleep(250);
      await shot(page, out, cell, "holdup", shots);
      scans.holdup = await page.evaluate(domScan, { lang: cell.lang });
    }
    await sleep(25);
  }
  await set(false);
  // The ending: the picture, then the toys.
  await page.waitForFunction(() => document.querySelector("[data-sneak-ending-toys]")?.getAttribute("data-sneak-ending-toys") === "ready", null, { timeout: 20_000 }).catch(() => {});
  await sleep(400);
  const endingAt = await page.evaluate(() => performance.now());
  await shot(page, out, cell, "ending", shots);
  scans.ending = await page.evaluate(domScan, { lang: cell.lang });
  const audio = await page.evaluate(() => window.__sneakDebug?.audio?.() ?? null);
  const proof = await page.evaluate(() => ({ mountAt: window.__proof.mountAt, firstMoveAt: window.__proof.firstMoveAt, log: window.__proof.log, latencies: window.__proof.latencies, frames: window.__proof.frames }));
  // Play again: the second sitting's first frame.
  let again = null;
  const btn = page.locator("[data-kid-finish-again]");
  if (await btn.count()) {
    await btn.first().click();
    await page.waitForSelector("[data-sneak-stage] [data-hero-at]", { state: "attached", timeout: 10_000 }).catch(() => {});
    await sleep(300);
    await shot(page, out, cell, "again", shots);
    scans.again = await page.evaluate(domScan, { lang: cell.lang });
    again = await snapOf(page);
  }
  await context.close();
  return { cell: cell.id, loadMs, shots, scans, audio, errors, failed, again, metrics: metricsOf(proof, endingAt) };
}

function metricsOf(proof, endingAt) {
  const { mountAt, firstMoveAt, log, latencies, frames } = proof;
  // fps: the best and worst 5-s windows during play (mount -> ending).
  const play = frames.filter((t) => t >= (mountAt ?? 0) && t <= endingAt);
  let fpsMin = null;
  let fpsMax = null;
  for (let a = (mountAt ?? 0) + 2000; a + 5000 <= endingAt; a += 5000) {
    const n = play.filter((t) => t >= a && t < a + 5000).length / 5;
    fpsMin = fpsMin === null ? n : Math.min(fpsMin, n);
    fpsMax = fpsMax === null ? n : Math.max(fpsMax, n);
  }
  // Rounds: a tag closes a round; the next starts at the following "ready".
  const tags = [];
  let roundStart = mountAt;
  const rounds = [];
  let prevPhase = null;
  for (const e of log) {
    if (e.phase === "tagged" && prevPhase !== "tagged") { tags.push(e.t); rounds.push(Math.round(e.t - roundStart)); }
    if (e.phase === "ready" && prevPhase !== "ready") roundStart = e.t;
    prevPhase = e.phase;
  }
  // Silences: the longest stretch with no logged change after a phase began (> 1.5 s noted).
  const gaps = [];
  for (let i = 1; i < log.length; i++) {
    const dt = log[i].t - log[i - 1].t;
    if (dt > 1500) gaps.push({ at: Math.round(log[i - 1].t - mountAt), ms: Math.round(dt), phase: log[i - 1].phase, watcher: log[i - 1].watcher, pose: log[i - 1].pose });
  }
  const lat = latencies.map((l) => l.ms).filter((v) => typeof v === "number").sort((a, b) => a - b);
  // Pose pops: a pose change at the same progress (feet must not move) is fine; we record changes.
  return {
    fps: { min5s: fpsMin, max5s: fpsMax },
    firstMoveMs: firstMoveAt && mountAt ? Math.round(firstMoveAt - mountAt) : null,
    touchToMotionMs: { n: lat.length, median: lat.length ? lat[Math.floor(lat.length / 2)] : null, max: lat.length ? lat[lat.length - 1] : null, misses: latencies.filter((l) => l.ms === null).length },
    roundsMs: rounds,
    sittingMs: mountAt ? Math.round(endingAt - mountAt) : null,
    tagsIn60s: tags.filter((t) => t - mountAt <= 60_000).length,
    tags: tags.length,
    gapsOver1500ms: gaps,
  };
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
function reportMd(rep) {
  const L = [];
  L.push(`# Sneak & Freeze — real-motion proof run`, "", `Run ${rep.startedAt} · ${rep.base} · ${rep.browser}`, "");
  L.push("| cell | fps (5 s min/max) | first move | touch→motion (median/max) | rounds (s) | sitting (s) | tags ≤60 s | errors | failed req | audio |");
  L.push("|---|---|---|---|---|---|---|---|---|---|");
  for (const c of rep.sittings) {
    const m = c.metrics;
    L.push(`| ${c.cell} | ${m.fps.min5s}/${m.fps.max5s} | ${m.firstMoveMs} ms | ${m.touchToMotionMs.median}/${m.touchToMotionMs.max} ms (n=${m.touchToMotionMs.n}) | ${m.roundsMs.map((x) => (x / 1000).toFixed(1)).join(", ")} | ${m.sittingMs ? (m.sittingMs / 1000).toFixed(1) : "—"} | ${m.tagsIn60s} | ${c.errors.length} | ${c.failed.length} | ${c.audio ? `${c.audio.context}, decoded ${c.audio.decoded}, played ${c.audio.played}/${c.audio.asked}` : "—"} |`);
  }
  L.push("", "Policies (60 s):", "");
  for (const p of rep.policies) L.push(`- ${p.policy} at ${p.cell}: tags ${p.tags}, round ${p.round}, pos ${p.pos}, phase ${p.phase}, errors ${p.errors.length}, failed ${p.failed.length}`);
  L.push("", "DOM scan (all moments):", "");
  for (const c of rep.sittings) {
    const sc = Object.values(c.scans);
    const dig = [...new Set(sc.flatMap((s) => s.digits))];
    const emo = [...new Set(sc.flatMap((s) => s.emoji))];
    const lat = [...new Set(sc.flatMap((s) => s.latinInHe))];
    const txt = [...new Set(sc.flatMap((s) => s.texts))];
    const ovf = sc.some((s) => s.overflow.x);
    const brk = [...new Set(sc.flatMap((s) => s.broken))];
    L.push(`- ${c.cell}: digits ${JSON.stringify(dig)} · emoji ${JSON.stringify(emo)} · latin-in-HE ${JSON.stringify(lat)} · overflow ${ovf} · broken ${JSON.stringify(brk)} · visible text ${JSON.stringify(txt)}`);
  }
  L.push("", "Silences > 1.5 s (no state change):", "");
  for (const c of rep.sittings) L.push(`- ${c.cell}: ${c.metrics.gapsOver1500ms.map((g) => `${(g.at / 1000).toFixed(1)}s ${g.phase}/${g.watcher}/${g.pose} ${g.ms}ms`).join("; ") || "none"}`);
  return L.join("\n") + "\n";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  mkdirSync(args.out, { recursive: true });
  await waitForServer(args.base);
  const cells = args.cells ? ALL_CELLS.filter((c) => args.cells.includes(c.id)) : ALL_CELLS;
  const { browser, channel } = await launchBrowser();
  const rep = { startedAt: new Date().toISOString(), base: args.base, browser: channel, out: args.out, sittings: [], policies: [] };
  try {
    // Warm the dev server's module graph once (unrecorded).
    { const w = await openGame(browser, args.base, cells[0]).catch(() => null); if (w) await w.context.close(); }
    if (args.sitting) {
      for (const cell of cells) {
        console.log(`proof-sneak: sitting ${cell.id}`);
        const r = await sittingA(browser, args.base, args.out, cell);
        rep.sittings.push(r);
        writeFileSync(path.join(args.out, "report.json"), JSON.stringify(rep, null, 2));
        console.log(`proof-sneak: ${cell.id} ${JSON.stringify({ ...r.metrics, gapsOver1500ms: r.metrics.gapsOver1500ms.length })} audio=${JSON.stringify(r.audio)} errors=${r.errors.length} failed=${r.failed.length}`);
      }
    }
    if (args.policies) {
      const cell = ALL_CELLS[0];
      for (const k of ["B", "C"]) {
        console.log(`proof-sneak: policy ${k}`);
        const r = await policy(browser, args.base, cell, k);
        rep.policies.push(r);
        console.log(`proof-sneak: policy ${k} ${JSON.stringify({ tags: r.tags, round: r.round, pos: r.pos, phase: r.phase })}`);
      }
    }
  } finally {
    await browser.close();
  }
  for (const s of rep.sittings) delete s.metrics.frames;
  writeFileSync(path.join(args.out, "report.json"), JSON.stringify(rep, null, 2));
  if (!existsSync(path.join(args.out, "REPORT.md"))) writeFileSync(path.join(args.out, "REPORT.md"), reportMd(rep));
  else writeFileSync(path.join(args.out, "REPORT.auto.md"), reportMd(rep));
  console.log(`proof-sneak: done -> ${args.out}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
