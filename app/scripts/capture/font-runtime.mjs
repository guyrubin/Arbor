/** Optional capture-only seam. Never changes source CSS or contacts the network. */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FONT_CACHE_DIR, FONT_FAMILIES, SOURCE_CSS_URL, assertFontUrl, cssFontResources, sha256 } from './font-cache.mjs';

const sourceFile = fileURLToPath(new URL('../../src/index.css', import.meta.url));
let cached;
const evidence = { mode: 'exact', shots: [], served: [], deniedFontRequests: 0 };
const exact = () => process.env.ARBOR_CAPTURE_FONT_MODE === 'exact';
const normalize = (value) => value.replace(/[^a-z0-9]/gi, '').toLowerCase();
export const SOURCE_FONT_NOTE = 'Source Google text fonts are served from a verified disposable cache. Font-accurate status requires each screenshot’s loaded-face and rendered-glyph evidence; see font evidence and public-resource provenance. Synthetic app data remains separate from production.';

export function validateFontCache(root = FONT_CACHE_DIR, source = readFileSync(sourceFile)) {
  const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  if (manifest.schema !== 1 || manifest.mode !== 'exact' || manifest.cssUrl !== SOURCE_CSS_URL || manifest.sourceCssSha256 !== sha256(source) || !Array.isArray(manifest.resources) || !manifest.resources.length || manifest.resources.length > 129) throw new Error('FONT_CACHE_MANIFEST_INVALID');
  const resources = new Map();
  for (const item of manifest.resources) {
    if (item.kind === 'css') { if (item.url !== SOURCE_CSS_URL) throw new Error('FONT_CACHE_URL_INVALID'); }
    else if (item.kind === 'woff2') assertFontUrl(item.url);
    else throw new Error('FONT_CACHE_TYPE_INVALID');
    if (!/^[a-f0-9]{64}$/.test(item.sha256) || item.file !== `${item.sha256}.${item.kind}` || resources.has(item.url)) throw new Error('FONT_CACHE_FILE_INVALID');
    const body = readFileSync(path.join(root, item.file));
    if (body.length !== item.size || sha256(body) !== item.sha256) throw new Error('FONT_CACHE_HASH_MISMATCH');
    if (item.kind === 'woff2' && body.subarray(0, 4).toString() !== 'wOF2') throw new Error('FONT_CACHE_BODY_INVALID');
    resources.set(item.url, { ...item, body });
  }
  const css = resources.get(SOURCE_CSS_URL);
  if (!css || css.kind !== 'css') throw new Error('FONT_CACHE_CSS_MISSING');
  const { urls } = cssFontResources(css.body.toString());
  if (urls.length + 1 !== resources.size || urls.some((url) => !resources.has(url))) throw new Error('FONT_CACHE_RESOURCE_MISMATCH');
  if (!/^Mozilla\/5\.0 .*HeadlessChrome\/\d+\.\d+\.\d+\.\d+ Safari\/537\.36$/.test(manifest.userAgent ?? '')) throw new Error('FONT_CACHE_UA_INVALID');
  return { manifest, resources };
}
const cache = () => cached ??= validateFontCache();
export function captureFontContextOptions() {
  return exact() ? { userAgent: cache().manifest.userAgent } : {};
}
export function fontEvidencePath() {
  const phase = process.env.ARBOR_CAPTURE_FONT_PHASE;
  if (!['small', 'sweep', 'diagnostics'].includes(phase)) throw new Error('FONT_EVIDENCE_PHASE_INVALID');
  return `/capture-output/font-evidence.${phase}.json`;
}
const save = () => writeFileSync(fontEvidencePath(), JSON.stringify(evidence, null, 2));

export async function installOfflineFonts(context) {
  if (!exact()) return;
  const { manifest, resources } = cache();
  if (context.browser().version() !== manifest.chromiumVersion) throw new Error('FONT_BROWSER_VERSION_MISMATCH');
  // Register AFTER other context routes. Serve only the exact observed URL;
  // never rewrite a stylesheet, select another font, fetch or follow redirects.
  await context.route((url) => ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'].includes(url.origin), async (route) => {
    const resource = resources.get(route.request().url());
    if (!resource || route.request().method() !== 'GET') {
      evidence.deniedFontRequests++; save();
      return route.abort();
    }
    if (!evidence.served.some((entry) => entry.url === resource.url)) evidence.served.push({ url: resource.url, sha256: resource.sha256, size: resource.size });
    save();
    return route.fulfill({ status: 200, body: resource.body, headers: resource.responseHeaders });
  });
}

/** Screenshot wrapper used by both context-creating paths of the canonical sweep
 * and the small/supplemental capture. A failed font check refuses that shot; it
 * never silently labels fallback pixels as exact-font evidence. */
export async function captureScreenshot(page, options) {
  if (!exact()) return page.screenshot(options);
  const entry = { shot: path.basename(options.path), passed: false, checkedAt: new Date().toISOString(), rendered: [] };
  let session;
  try {
    const state = await page.evaluate(async () => {
      await Promise.race([document.fonts.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('FONT_READY_TIMEOUT')), 15_000))]);
      return { finalHash: location.hash, lang: document.documentElement.lang, status: document.fonts.status,
        faces: [...document.fonts].map((font) => ({ family: font.family, style: font.style, weight: font.weight, status: font.status })) };
    });
    Object.assign(entry, state);
    if (state.status !== 'loaded' || state.faces.some((face) => face.status === 'error') || !state.faces.some((face) => face.status === 'loaded' && FONT_FAMILIES.includes(face.family.replaceAll('"', '').replaceAll("'", '')))) throw new Error('FONT_FACE_NOT_LOADED');
    session = await page.context().newCDPSession(page);
    await session.send('DOM.enable'); await session.send('CSS.enable');
    const { root } = await session.send('DOM.getDocument');
    const seen = new Set();
    // Actual rendered glyph families, not merely CSS font-family declarations.
    for (const selector of ['[role=dialog][aria-modal=true] h2, [role=dialog][aria-modal=true] h3, [role=dialog][aria-modal=true] p, [role=dialog][aria-modal=true] button', '.companion-conversation:not([hidden]) h3, .companion-conversation:not([hidden]) p', 'main h1, main h2, main h3, main p']) {
      const { nodeIds } = await session.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector });
      for (const nodeId of nodeIds.slice(0, 12)) {
        if (seen.has(nodeId)) continue; seen.add(nodeId);
        const { computedStyle } = await session.send('CSS.getComputedStyleForNode', { nodeId });
        const requested = computedStyle.find((style) => style.name === 'font-family')?.value ?? '';
        const expectsWebFont = FONT_FAMILIES.some((family) => normalize(requested).includes(normalize(family)));
        if (!expectsWebFont) continue;
        const { fonts } = await session.send('CSS.getPlatformFontsForNode', { nodeId });
        if (!fonts.some((font) => font.glyphCount > 0)) continue;
        const custom = fonts.some((font) => font.isCustomFont && font.glyphCount > 0 && FONT_FAMILIES.some((family) => normalize(font.familyName).startsWith(normalize(family))));
        entry.rendered.push({ requested, fonts, custom });
      }
    }
    if (!entry.rendered.length || entry.rendered.some((sample) => !sample.custom)) throw new Error('FONT_RENDERED_GLYPHS_UNPROVEN');
    if (evidence.deniedFontRequests) throw new Error('FONT_UNCACHED_REQUEST');
    const screenshot = await page.screenshot(options);
    entry.passed = true;
    return screenshot;
  } catch (error) {
    entry.failure = /^FONT_[A-Z_]+$/.test(error?.message ?? '') ? error.message : 'FONT_OR_SCREENSHOT_CHECK_FAILED';
    throw new Error(entry.failure);
  } finally {
    if (session) await session.detach().catch(() => {});
    evidence.shots.push(entry); save();
  }
}
