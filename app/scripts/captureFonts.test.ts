import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FONT_FAMILIES, SOURCE_CSS_URL, assertFontUrl, chromiumUserAgent, cssFontResources, fontMode, readPublicResource, sha256, sourceFontUrl } from './capture/font-cache.mjs';
import { validateFontCache } from './capture/font-runtime.mjs';

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
