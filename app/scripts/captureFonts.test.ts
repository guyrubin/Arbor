import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FONT_FAMILIES, SOURCE_CSS_URL, assertFontUrl, chromiumUserAgent, cssFontResources, fontMode, readPublicResource, sha256, sourceFontUrl } from './capture/font-cache.mjs';
import { collectFontSampleCandidates, platformTextFontEvidence, preserveUnacceptedScreenshot, validateFontCache } from './capture/font-runtime.mjs';

const root = path.resolve(__dirname, '../..');
const read = (name: string) => readFileSync(path.join(root, name), 'utf8');
const url = 'https://fonts.gstatic.com/s/heebo/v1/example.woff2';
const css = FONT_FAMILIES.map((family: string) => `@font-face {font-family: '${family}'; src: url(${url}) format('woff2');}`).join('\n');

describe('source-font cache contracts, stubbed fetch only', () => {
  it('uses only the existing exact stylesheet and bounded gstatic WOFF2 resources', () => {
    expect(sourceFontUrl(read('app/src/index.css'))).toBe(SOURCE_CSS_URL);
    expect(() => sourceFontUrl(`@import url('https://example.test/font.css');`)).toThrow('FONT_SOURCE_URL_CHANGED');
    expect(assertFontUrl(url)).toBe(url);
    for (const bad of ['http://fonts.gstatic.com/s/heebo/v1/example.woff2', `${url}?key=secret`, `${url}#x`, url.replace('fonts.gstatic.com', 'fonts.gstatic.com.example.test'), 'https://fonts.gstatic.com/s/heebo/v1/../../private.woff2']) expect(() => assertFontUrl(bad)).toThrow();
    expect(cssFontResources(css).urls).toEqual([url]);
    expect(() => cssFontResources(`${css}\n@import url('${SOURCE_CSS_URL}');`)).toThrow();
    expect(() => cssFontResources(`${css}\na { background: url(${url}); }`)).toThrow();
    expect(fontMode()).toBe('fallback');
    expect(() => fontMode('remote')).toThrow();
  });
  it('never follows a redirect or sends credentials and enforces types and lengths', async () => {
    let options: any;
    const fetcher = async (_url: string, opts: any) => { options = opts; return new Response('wOF2synthetic-test-only', { headers: { 'content-type': 'font/woff2' } }); };
    const result = await readPublicResource(url, chromiumUserAgent('140.0.0.0'), 'woff2', fetcher);
    expect(options).toMatchObject({ redirect: 'manual', credentials: 'omit' });
    expect(Object.keys(options.headers).sort()).toEqual(['Accept', 'Accept-Encoding', 'User-Agent']);
    expect(result.sha256).toBe(sha256(result.bytes));
    await expect(readPublicResource(url, 'test', 'woff2', async () => new Response(null, { status: 302 }))).rejects.toThrow('FONT_FETCH_HTTP_302');
    await expect(readPublicResource(url, 'test', 'woff2', async () => new Response('bad', { headers: { 'content-type': 'text/html' } }))).rejects.toThrow('FONT_CONTENT_TYPE_DENIED');
    await expect(readPublicResource(url, 'test', 'woff2', async () => new Response('bad', { headers: { 'content-type': 'font/woff2' } }))).rejects.toThrow('FONT_BODY_INVALID');
    await expect(readPublicResource(url, 'test', 'woff2', async () => new Response('wOF2', { headers: { 'content-type': 'font/woff2', 'content-length': '9999999' } }))).rejects.toThrow('FONT_SIZE_LIMIT');
  });
  it('validates source and content hashes before serving any cached bytes', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'arbor-font-contract-'));
    const source = Buffer.from(read('app/src/index.css'));
    const resources = [['css', SOURCE_CSS_URL, Buffer.from(css)], ['woff2', url, Buffer.from('wOF2synthetic-test-only')]].map(([kind, url, body]: any[]) => {
      const hash = sha256(body); const file = `${hash}.${kind}`;
      writeFileSync(path.join(dir, file), body);
      return { kind, url, sha256: hash, file, size: body.length };
    });
    const manifest = { schema: 1, mode: 'exact', cssUrl: SOURCE_CSS_URL, sourceCssSha256: sha256(source), resources, userAgent: chromiumUserAgent('140.0.0.0') };
    try {
      writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
      expect(validateFontCache(dir, source).resources.size).toBe(2);
      expect(() => validateFontCache(dir, Buffer.from('different source'))).toThrow('FONT_CACHE_MANIFEST_INVALID');
      writeFileSync(path.join(dir, resources[1].file), 'changed');
      expect(() => validateFontCache(dir, source)).toThrow('FONT_CACHE_HASH_MISMATCH');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('rejects icon-only and fallback glyphs without confusing mixed text/icon parents', () => {
    const icon = { familyName: 'Material Symbols Rounded', isCustomFont: true, glyphCount: 1 };
    const text = { familyName: 'Instrument Sans', isCustomFont: true, glyphCount: 12 };
    expect(platformTextFontEvidence([icon])).toEqual({ fonts: [], custom: false });
    expect(platformTextFontEvidence([text, icon])).toEqual({ fonts: [text], custom: true });
    expect(platformTextFontEvidence([{ ...text, isCustomFont: false }]).custom).toBe(false);
    expect(platformTextFontEvidence([text, { familyName: 'Arial', isCustomFont: false, glyphCount: 3 }]).custom).toBe(false);
    expect(platformTextFontEvidence([{ ...text, glyphCount: 0 }]).custom).toBe(false);
    const sampler = collectFontSampleCandidates.toString();
    expect(sampler).toContain('node.nodeType !== Node.TEXT_NODE');
    expect(sampler).toContain('range.getClientRects()');
    expect(sampler).toContain('if (!ownText) continue');
    expect(sampler).toContain('[role="dialog"][aria-modal="true"]');
    expect(sampler).toContain('[aria-hidden="true"], .msr');
    expect(sampler).not.toMatch(/textContent:|innerHTML|appendChild|setAttribute|style\.[a-z]+\s*=(?!=)/);
  });
  it('samples real modal text but never the inherited font of an icon-only button', () => {
    const box = { width: 200, height: 100, left: 0, top: 0, right: 200, bottom: 100 };
    const scope: any = { tagName: 'DIV', parentElement: null, children: [], getBoundingClientRect: () => box };
    const element = (tagName: string, childNodes: any[], excluded = false): any => ({ tagName, childNodes, parentElement: scope, closest: () => excluded ? {} : null });
    const iconParent = element('BUTTON', [{ nodeType: 1 }]);
    const icon = element('SPAN', [{ nodeType: 3, textContent: 'close' }], true);
    const text = element('SPAN', [{ nodeType: 3, textContent: 'Synthetic modal text' }]);
    const whitespace = element('BUTTON', [{ nodeType: 3, textContent: '  ' }, { nodeType: 1 }]);
    scope.children = [iconParent, icon, text, whitespace]; scope.querySelectorAll = () => scope.children;
    try {
      vi.stubGlobal('document', { querySelectorAll: (selector: string) => selector.startsWith('[role=') ? [scope] : [], createRange: () => ({ selectNodeContents() {}, getClientRects: () => [box] }) });
      vi.stubGlobal('Node', Object.assign(class {}, { TEXT_NODE: 3 })); vi.stubGlobal('innerHeight', 812); vi.stubGlobal('innerWidth', 375);
      vi.stubGlobal('getComputedStyle', () => ({ visibility: 'visible', display: 'block', fontFamily: 'Instrument Sans' }));
      expect(collectFontSampleCandidates()).toEqual([{ selector: 'div:nth-child(1) > span:nth-child(3)', scope: 'modal', ownText: true }]);
      expect(JSON.stringify(collectFontSampleCandidates())).not.toContain('Synthetic modal text');
    } finally { vi.unstubAllGlobals(); }
  });
  it('rejects closed native disclosure contents despite nonzero text ranges, preserving summaries and reopened content', () => {
    const box = { width: 200, height: 100, left: 0, top: 0, right: 200, bottom: 100 };
    const scope: any = { tagName: 'MAIN', parentElement: null, children: [], getBoundingClientRect: () => box };
    const element = (tagName: string, parentElement: any, text = ''): any => ({ tagName, parentElement, children: [], childNodes: text ? [{ nodeType: 3, textContent: text }] : [], closest: () => null,
      contains(el: any) { for (let node = el; node; node = node.parentElement) if (node === this) return true; return false; } });
    const details = element('DETAILS', scope); details.open = false;
    const summary = element('SUMMARY', details, 'Words and details');
    const body = element('P', details, 'Hidden supporting prose');
    const nested = element('DETAILS', details); nested.open = true;
    const nestedSummary = element('SUMMARY', nested, 'Nested summary');
    details.children = [summary, body, nested]; nested.children = [nestedSummary]; scope.children = [details];
    scope.querySelectorAll = () => [details, summary, body, nested, nestedSummary];
    try {
      vi.stubGlobal('document', { querySelectorAll: (selector: string) => selector === 'main' ? [scope] : [], createRange: () => ({ selectNodeContents() {}, getClientRects: () => [box] }) });
      vi.stubGlobal('Node', Object.assign(class {}, { TEXT_NODE: 3 })); vi.stubGlobal('innerHeight', 812); vi.stubGlobal('innerWidth', 375);
      vi.stubGlobal('getComputedStyle', () => ({ visibility: 'visible', display: 'block', fontFamily: 'Instrument Sans' }));
      // Old rectangle/style-only sampling would accept all three text nodes.
      expect([summary, body, nestedSummary].every(el => el.childNodes[0].textContent.trim() && box.width > 0)).toBe(true);
      const closed = collectFontSampleCandidates();
      expect(closed).toHaveLength(1); expect(closed[0].selector).toContain('summary:nth-child(1)');
      details.open = true;
      expect(collectFontSampleCandidates()).toHaveLength(3);
      // Native visibility cannot turn a still-empty CDP font result into proof.
      expect(platformTextFontEvidence([]).custom).toBe(false);
    } finally { vi.unstubAllGlobals(); }
    const runtime = read('app/scripts/capture/font-runtime.mjs');
    expect(runtime).toContain('if (closedDisclosure) continue');
    expect(runtime).toContain('nodePath: candidate.selector');
    expect(runtime).toContain('entry.rendered.some((sample) => !sample.custom)');
  });
  it('keeps rejected pixels separately and never promotes them to accepted font evidence', async () => {
    const writes: any[] = [];
    const entry: any = { shot: 'sample.exact.png', passed: false, failure: 'FONT_RENDERED_GLYPHS_UNPROVEN' };
    await preserveUnacceptedScreenshot({ screenshot: async (options: any) => { writes.push(options); } }, { path: '/tmp/sample.exact.png', fullPage: false }, entry);
    expect(writes).toEqual([{ path: '/tmp/sample.unaccepted.png', fullPage: false }]);
    expect(entry).toMatchObject({ passed: false, diagnosticAccepted: false, diagnosticShot: 'sample.unaccepted.png', diagnosticLabel: 'UNACCEPTED_FONT_OR_SCREENSHOT_EVIDENCE', failure: 'FONT_RENDERED_GLYPHS_UNPROVEN' });
    const failed: any = { passed: false };
    await preserveUnacceptedScreenshot({ screenshot: async () => { throw new Error('private browser exception'); } }, { path: '/tmp/sample.png' }, failed);
    expect(failed).toEqual({ passed: false, diagnosticAccepted: false, diagnosticFailure: 'DIAGNOSTIC_SCREENSHOT_FAILED' });
    const runtime = read('app/scripts/capture/font-runtime.mjs');
    expect(runtime).toContain('await preserveUnacceptedScreenshot(page, options, entry);');
    expect(runtime).toContain('throw new Error(entry.failure)');
    expect(runtime).toContain('entry.rendered.some((sample) => !sample.custom)');
  });
  it('gates downloads to an explicit disposable CI container, never app execution', () => {
    const prep = read('app/scripts/capture/prepare-font-cache.mjs');
    const runtime = read('app/scripts/capture/font-runtime.mjs');
    const docker = read('app/scripts/capture/Dockerfile');
    expect(prep).toContain("process.env.CAPTURE_DISPOSABLE_CI !== 'true'");
    expect(prep).toContain('AbortSignal.timeout(120_000)');
    expect(prep).toContain('64 * 1024 * 1024');
    expect(prep).toContain("!existsSync('/.dockerenv')");
    expect(docker).not.toMatch(/RUN.*prepare-font-cache/);
    expect(docker).not.toMatch(/RUN.*(?:server\.ts|seed-demo|collect-evidence)/);
    expect(runtime).not.toMatch(/\bfetch\s*\(|route\.continue\(|route\.fetch\(/);
    expect(runtime).toContain('CSS.getPlatformFontsForNode');
    expect(runtime).toContain('FONT_RENDERED_GLYPHS_UNPROVEN');
    const workflow = read('.github/workflows/arbor-parent-evidence.yml');
    const fontStep = workflow.split('name: Cache only existing public fonts')[1].split('name: Capture bounded')[0];
    expect(fontStep).toContain('docker create --network bridge');
    expect(fontStep).toContain('--env CAPTURE_DISPOSABLE_CI=true');
    expect(fontStep).toContain('node scripts/capture/prepare-font-cache.mjs');
    expect(fontStep).toContain('docker commit "$fonts" arbor-parent-evidence');
    expect(fontStep).not.toMatch(/server\.ts|run-evidence|seed-demo|docker push|--volume|--mount|secrets\./);
    expect(workflow).toContain('docker create --network none');
  });
});
