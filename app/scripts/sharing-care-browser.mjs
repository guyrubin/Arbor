/**
 * sharing-care-browser.mjs — B-CAREPRO-51 + B-SHELL-42 rendered evidence against a RUNNING
 * local sandbox (it never starts one, like rendered-sweep.mjs).
 *
 *   npm run seed:demo -- --apply      # the synthetic two-child demo family
 *   (start the sandbox: MODEL_PROVIDER=mock MEMORY_ADAPTER=local REQUIRE_AUTH=false PORT=4805 …)
 *   node scripts/sharing-care-browser.mjs --out <dir> [--base http://127.0.0.1:4805]
 *
 * Per Sharing cell (release phone + desktop × EN/HE, scripts/capture/sharing-care-contract.mjs): every live
 * grant on the demo child is revoked, then two synthetic grants are written through POST
 * /api/shares (a co-parent on the week, a professional on one visit report). #/sharing and
 * #/care-team must render with both on the roster and in who-sees-what, no error state and no
 * horizontal overflow. The professional row's Revoke is tapped: the row leaves, the co-parent
 * stays, GET /api/shares no longer lists it, history carries its revokedAt, and the recipient
 * packet route refuses it. Per switcher cell (+ the Safari phone box): the open child list and
 *  every control in it are measured against the viewport.
 *
 * Writes only to the loopback sandbox's in-memory share store (base must be loopback).
 * Screenshots + results.json go to --out. Exit 1 on any failed check.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';
import { BASE } from './capture/config.mjs';
import {
  SHARING_CELLS, SHARING_ROUTES, SWITCHER_CELLS, assertLoopbackBase, routeVerdict, switcherVerdict, syntheticGrants,
} from './capture/sharing-care-contract.mjs';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const base = assertLoopbackBase(arg('--base', BASE));
const outArg = arg('--out');
if (!outArg) { console.error('usage: node scripts/sharing-care-browser.mjs --out <dir> [--base <loopback origin>]'); process.exit(2); }
const out = path.resolve(outArg);
await mkdir(out, { recursive: true });

const api = async (method, p, body) => {
  const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await r.json(); } catch { /* not json */ }
  return { status: r.status, json };
};
const bundleRes = await fetch(`${base}/sandbox/demo-family.json`);
if (!bundleRes.ok) { console.error('No demo family: run `npm run seed:demo -- --apply`, then start the sandbox.'); process.exit(2); }
const bundleText = await bundleRes.text();
const bundle = JSON.parse(bundleText);
const childId = bundle.child.id;
const childName = bundle.child.name;

async function resetGrants() {
  const live = await api('GET', `/api/shares?childId=${encodeURIComponent(childId)}`);
  for (const g of live.json?.shares ?? []) await api('DELETE', `/api/shares/${encodeURIComponent(g.id)}`);
}

function initScript({ lang }) {
  localStorage.setItem('arbor.uiLang', lang);
  localStorage.setItem('arbor.aiLang', lang);
  localStorage.setItem('arbor.kidmode.active', JSON.stringify({ open: false }));
  const still = () => { const s = document.createElement('style'); s.textContent = '*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important}'; document.head.appendChild(s); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', still, { once: true }); else still();
}

async function openPage(browser, cell, route) {
  const context = await browser.newContext({ viewport: { width: cell.w, height: cell.h }, deviceScaleFactor: 1, reducedMotion: 'reduce', serviceWorkers: 'block', permissions: [] });
  await context.addInitScript(initScript, { lang: cell.lang });
  // The hydrator reads the same bundle the sweep serves (no race with its timeout).
  await context.route(/\/sandbox\/demo-family\.json/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: bundleText }));
  // Loopback only: anything else is refused, so the run cannot reach an outside host.
  await context.route((url) => !url.origin.startsWith(base), (r) => r.abort());
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => consoleErrors.push(e.message.slice(0, 200)));
  await page.goto(`${base}/?cb=${Date.now()}#/${route}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction(() => localStorage.getItem('arbor.activeChildId') && document.querySelector('h1'), null, { timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  return { context, page, consoleErrors };
}

const measureRoute = (page) => page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const clippedByAncestor = (el) => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const ox = getComputedStyle(a).overflowX; if (ox !== 'visible') return true; } return false; };
  const main = document.querySelector('main') || document.body;
  const offscreen = [];
  for (const el of main.querySelectorAll('*')) {
    if (!visible(el) || clippedByAncestor(el) || el.closest('.sr-only')) continue;
    const r = el.getBoundingClientRect();
    if (r.left < -1 || r.right > vw + 1) offscreen.push(`${el.tagName.toLowerCase()}${el.dataset.testid ? `[${el.dataset.testid}]` : ''} ${Math.round(r.left)}..${Math.round(r.right)}`);
  }
  const roster = document.querySelector('[data-module=sharing-roster]');
  return {
    h1: document.querySelector('h1')?.textContent?.trim() ?? null,
    htmlLang: document.documentElement.lang, dir: document.documentElement.dir,
    errorState: !!main.querySelector('[role=alert] button') && !roster,
    roster: !!roster,
    rosterEmails: roster ? [...roster.querySelectorAll('[id^="share-row-"] h3')].map((h) => h.textContent.trim()) : [],
    laneEmails: [...document.querySelectorAll('[data-testid=people-lane][data-lane=grant]')].map((l) => l.textContent),
    scrollWidth: document.documentElement.scrollWidth, clientWidth: vw,
    offscreen: offscreen.slice(0, 10),
  };
});

async function shot(page, selector, file) {
  const el = selector ? page.locator(selector).first() : null;
  if (el && await el.count()) await el.evaluate((n) => n.scrollIntoView({ block: 'start' }));
  else await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(out, file) });
  return path.join(out, file);
}

const results = { base, childId, sharing: [], switcher: [] };
let failed = false;
const browser = await chromium.launch();
try {
  for (const cell of SHARING_CELLS) {
    await resetGrants();
    const grants = {};
    for (const g of syntheticGrants(childId, childName)) {
      const { key, ...body } = g;
      const res = await api('POST', '/api/shares', body);
      if (res.status !== 200) throw new Error(`grant ${key} refused: ${res.status}`);
      grants[key] = res.json;
    }
    const emails = Object.values(grants).map((g) => g.recipientEmail);
    for (const route of SHARING_ROUTES) {
      const { context, page, consoleErrors } = await openPage(browser, cell, route);
      try {
        await page.waitForSelector('[data-module=sharing-roster] [id^="share-row-"], [role=alert]', { timeout: 30_000 });
        const measure = await measureRoute(page);
        const verdict = routeVerdict(measure, emails);
        const shots = [
          await shot(page, null, `${route}.${cell.id}.top.png`),
          await shot(page, '[data-testid=people-lanes]', `${route}.${cell.id}.lanes.png`),
          await shot(page, '#people-roster', `${route}.${cell.id}.roster.png`),
        ];
        const rec = { route, cell: cell.id, viewport: `${cell.w}x${cell.h}`, lang: cell.lang, step: 'render', ...verdict, measure, consoleErrors, shots };
        results.sharing.push(rec);
        if (!verdict.pass) failed = true;
        console.log(`${verdict.pass ? 'PASS' : 'FAIL'} render ${route} ${cell.id}${verdict.pass ? '' : ` — ${verdict.problems.join('; ')}`}`);

        if (route === 'care-team') {
          const pro = grants.professional;
          await page.locator(`[id="share-row-${pro.id}"] button`).first().click();
          await page.waitForSelector(`[id="share-row-${pro.id}"]`, { state: 'detached', timeout: 15_000 });
          // The revoke reloads the roster; wait for it to settle back on the remaining grant.
          await page.waitForSelector(`[id="share-row-${grants.coParent.id}"]`, { timeout: 15_000 }).catch(() => {});
          const after = await measureRoute(page);
          const live = await api('GET', `/api/shares?childId=${encodeURIComponent(childId)}`);
          const history = await api('GET', `/api/shares?childId=${encodeURIComponent(childId)}&history=1`);
          const packet = await api('GET', `/api/shared/${encodeURIComponent(pro.id)}/packet`);
          const problems = [];
          if (after.rosterEmails.includes(pro.recipientEmail)) problems.push('revoked grant still on the roster');
          if (after.laneEmails.some((t) => t.includes(pro.recipientEmail))) problems.push('revoked grant still in who-sees-what');
          if (!after.rosterEmails.includes(grants.coParent.recipientEmail)) problems.push('co-parent left the roster with the revoke');
          if ((live.json?.shares ?? []).some((g) => g.id === pro.id)) problems.push('GET /api/shares still lists the revoked grant');
          if (!(history.json?.shares ?? []).find((g) => g.id === pro.id)?.revokedAt) problems.push('history lacks revokedAt');
          if (packet.status < 400) problems.push(`recipient packet answered ${packet.status}`);
          const revokeShot = await shot(page, '#people-roster', `${route}.${cell.id}.after-revoke.png`);
          const rr = { route, cell: cell.id, viewport: `${cell.w}x${cell.h}`, lang: cell.lang, step: 'revoke', pass: problems.length === 0, problems, packetStatus: packet.status, packetError: packet.json?.error ?? null, shots: [revokeShot] };
          results.sharing.push(rr);
          if (!rr.pass) failed = true;
          console.log(`${rr.pass ? 'PASS' : 'FAIL'} revoke ${cell.id} (packet ${packet.status})${rr.pass ? '' : ` — ${problems.join('; ')}`}`);
        }
      } finally { await context.close(); }
    }
  }
  await resetGrants();

  for (const cell of SWITCHER_CELLS) {
    const { context, page } = await openPage(browser, cell, 'overview');
    try {
      const chip = page.locator('button[aria-haspopup=listbox]:visible').first();
      await chip.click();
      await page.waitForSelector('[data-testid=switcher-list]', { timeout: 10_000 });
      const measure = await page.evaluate(() => {
        const list = document.querySelector('[data-testid=switcher-list]');
        const box = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x * 10) / 10, y: Math.round(r.y * 10) / 10, width: Math.round(r.width * 10) / 10, height: Math.round(r.height * 10) / 10 }; };
        const chipEl = list.parentElement.querySelector('button[aria-haspopup=listbox]');
        const controls = [...list.querySelectorAll('[role=option], button')].filter((el, i, all) => !all.some((o) => o !== el && o.contains(el))).map((el) => {
          const b = box(el);
          const hitEl = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
          const texts = [...el.querySelectorAll('*')].filter((n) => n.children.length === 0 && n.textContent.trim());
          return { ...b, label: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40), hit: !!hitEl && el.contains(hitEl), clipped: texts.some((n) => n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).overflow !== 'visible') };
        });
        return { list: { ...box(list), scrollWidth: list.scrollWidth, clientWidth: list.clientWidth }, chip: chipEl ? box(chipEl) : null, controls, dir: document.documentElement.dir };
      });
      const verdict = switcherVerdict(measure, cell);
      await page.screenshot({ path: path.join(out, `switcher.${cell.id}.png`) });
      results.switcher.push({ cell: cell.id, viewport: `${cell.w}x${cell.h}`, lang: cell.lang, ...verdict, measure, shot: path.join(out, `switcher.${cell.id}.png`) });
      if (!verdict.pass) failed = true;
      const l = measure.list;
      console.log(`${verdict.pass ? 'PASS' : 'FAIL'} switcher ${cell.id} list x=${l.x} y=${l.y} w=${l.width} h=${l.height} (right ${Math.round((l.x + l.width) * 10) / 10} of ${cell.w})${verdict.pass ? '' : ` — ${verdict.problems.join('; ')}`}`);
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  await writeFile(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
}
console.log(`${failed ? 'FAIL' : 'PASS'} sharing-care · ${path.join(out, 'results.json')}`);
process.exit(failed ? 1 : 0);
