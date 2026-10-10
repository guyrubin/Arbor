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

/** Runs in the page, without DOM/style changes. Ancestors whose only glyphs
 * belong to an icon child are not text samples. Return selectors, never text. */
export function collectFontSampleCandidates() {
  const samples = [], seen = new Set();
  for (const scopeSelector of ['[role="dialog"][aria-modal="true"]', '.companion-conversation:not([hidden])', 'main']) {
    for (const scope of [...document.querySelectorAll(scopeSelector)].slice(0, 4)) {
      const bounds = scope.getBoundingClientRect();
      if (!bounds.width || !bounds.height) continue;
      let count = 0;
      for (const el of [...scope.querySelectorAll('*')].slice(0, 600)) {
        if (seen.has(el) || el.closest('[hidden], [aria-hidden="true"], .msr, .material-symbols-rounded, svg')) continue;
        // Native details hides its content without a hidden attribute or a
        // display:none computed style on each descendant. Range geometry can
        // still be present there, but no text glyphs are painted. Only the
        // FIRST direct summary remains visible, and every closed ancestor counts.
        let closedDisclosure = false;
        for (let ancestor = el; ancestor; ancestor = ancestor.parentElement) {
          if (ancestor.tagName !== 'DETAILS' || ancestor.open) continue;
          const summary = [...ancestor.children].find(child => child.tagName === 'SUMMARY');
          if (!summary?.contains(el)) { closedDisclosure = true; break; }
        }
        if (closedDisclosure) continue;
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none' || /Material Symbols|Material Icons/i.test(style.fontFamily)) continue;
        const ownText = [...el.childNodes].some(node => {
          if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) return false;
          const range = document.createRange(); range.selectNodeContents(node);
          return [...range.getClientRects()].some(rect => rect.width > 0 && rect.height > 0 && rect.bottom > Math.max(0, bounds.top) && rect.top < Math.min(innerHeight, bounds.bottom) && rect.right > Math.max(0, bounds.left) && rect.left < Math.min(innerWidth, bounds.right));
        });
        if (!ownText) continue;
        const parts = [];
        for (let current = el; current && parts.length < 50; current = current.parentElement) {
          const index = current.parentElement ? [...current.parentElement.children].indexOf(current) + 1 : 1;
          parts.unshift(`${current.tagName.toLowerCase()}:nth-child(${index})`);
        }
        seen.add(el); samples.push({ selector: parts.join(' > '), scope: scopeSelector.startsWith('[role') ? 'modal' : scopeSelector === 'main' ? 'main' : 'conversation', ownText: true });
        if (++count === 12 || samples.length === 48) break;
      }
      if (samples.length === 48) return samples;
    }
  }
  return samples;
}

export function platformTextFontEvidence(fonts) {
  const textFonts = fonts.filter(font => font.glyphCount > 0 && !/^material(?:symbols|icons)/.test(normalize(font.familyName)));
  return { fonts: textFonts, custom: textFonts.length > 0 && textFonts.every(font => font.isCustomFont === true && FONT_FAMILIES.some(family => normalize(font.familyName).startsWith(normalize(family)))) };
}

/** Preserve pixels after rejection without creating an accepted exact shot. */
export async function preserveUnacceptedScreenshot(page, options, entry) {
  const parts = path.parse(options.path);
  const file = path.join(parts.dir, `${parts.name.replace(/\.exact$/, '')}.unaccepted${parts.ext || '.png'}`);
  entry.diagnosticAccepted = false;
  try {
    await page.screenshot({ ...options, path: file });
    entry.diagnosticShot = path.basename(file);
    entry.diagnosticLabel = 'UNACCEPTED_FONT_OR_SCREENSHOT_EVIDENCE';
  } catch { entry.diagnosticFailure = 'DIAGNOSTIC_SCREENSHOT_FAILED'; }
}

/** Screenshot wrapper used by both context-creating paths of the canonical sweep
 * and the small/supplemental capture. A failed font check rejects acceptance but
 * preserves separately named diagnostic pixels; fallback is never labeled exact. */
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
    const candidates = await page.evaluate(collectFontSampleCandidates);
    entry.sampleMethod = 'visible-own-text-nodes-native-disclosures';
    for (const candidate of candidates) {
      const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector: candidate.selector });
      if (!nodeId || candidate.ownText !== true) continue;
      const { computedStyle } = await session.send('CSS.getComputedStyleForNode', { nodeId });
      const requested = computedStyle.find(style => style.name === 'font-family')?.value ?? '';
      if (!FONT_FAMILIES.some(family => normalize(requested).includes(normalize(family)))) continue;
      const { fonts } = await session.send('CSS.getPlatformFontsForNode', { nodeId });
      const proof = platformTextFontEvidence(fonts);
      entry.rendered.push({ requested, ...proof, scope: candidate.scope, ownText: true, nodePath: candidate.selector });
    }
    if (!entry.rendered.length || entry.rendered.some((sample) => !sample.custom)) throw new Error('FONT_RENDERED_GLYPHS_UNPROVEN');
    if (evidence.deniedFontRequests) throw new Error('FONT_UNCACHED_REQUEST');
    const screenshot = await page.screenshot(options);
    entry.passed = true;
    return screenshot;
  } catch (error) {
    entry.failure = /^FONT_[A-Z_]+$/.test(error?.message ?? '') ? error.message : 'FONT_OR_SCREENSHOT_CHECK_FAILED';
    await preserveUnacceptedScreenshot(page, options, entry);
    throw new Error(entry.failure);
  } finally {
    if (session) await session.detach().catch(() => {});
    evidence.shots.push(entry); save();
  }
}
