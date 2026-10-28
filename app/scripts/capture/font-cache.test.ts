import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FONT_FAMILIES, FONT_RESOURCE_SHAPES, SOURCE_CSS_URL, assertFontUrl, chromiumUserAgent, cssFontResources, fontResourceShape, readPublicResource, sha256 } from './font-cache.mjs';
import { validateFontCache } from './font-runtime.mjs';

// Both shapes Google Fonts is observed to emit for one family. The kit values are
// synthetic; a real kit id, skey and version share these character classes.
const staticUrl = 'https://fonts.gstatic.com/s/heebo/v28/NGSpv5_NC0k9P_v6ZUCbLRAHxK1EiSysdUmm.woff2';
const kitUrl = 'https://fonts.gstatic.com/l/font?kit=j8_w6_fAw7jrcalD7oKYNX0QfAnPa7L37EdzVhNemtmk&skey=f32d6e63ec16a834&v=v23';

describe('exact font cache: the /l/font kit shape is canonical, everything else stays refused', () => {
  it('classifies the static path and the kit URL and nothing else', () => {
    expect(FONT_RESOURCE_SHAPES).toEqual(['static', 'kit']);
    expect(fontResourceShape(staticUrl)).toBe('static');
    expect(fontResourceShape(kitUrl)).toBe('kit');
    expect(assertFontUrl(kitUrl)).toBe(kitUrl);
    // Key order is not provenance; the key set and value shapes are.
    expect(fontResourceShape('https://fonts.gstatic.com/l/font?v=v23&skey=f32d6e63ec16a834&kit=j8_w6_fAw7jrcalD7oKYNX0QfAnPa7L37EdzVhNemtmk')).toBe('kit');
  });
  it('refuses alternate origins, credentials, fragments, redirect-like paths and unknown query shapes', () => {
    const refused = [
      kitUrl.replace('https://', 'http://'),
      kitUrl.replace('fonts.gstatic.com', 'fonts.gstatic.com.example.test'),
      kitUrl.replace('fonts.gstatic.com', 'fonts.googleapis.com'),
      kitUrl.replace('https://', 'https://user:secret@'),
      `${kitUrl}#fragment`,
      kitUrl.replace('/l/font?', '/l/font/?'),
      kitUrl.replace('/l/font?', '/l/fonts?'),
      kitUrl.replace('/l/font?', '/L/font?'),
      'https://fonts.gstatic.com/l/font',
      'https://fonts.gstatic.com/l/font?kit=j8_w6_fAw7jrcalD7oKYNX0QfAnPa7L37EdzVhNemtmk&skey=f32d6e63ec16a834', // no v (the shape the old test refused)
      `${kitUrl}&extra=1`,
      `${kitUrl}&kit=duplicate_kit_value`,
      kitUrl.replace('skey=f32d6e63ec16a834', 'skey=F32D6E63EC16A834'),
      kitUrl.replace('skey=f32d6e63ec16a834', 'skey=f32d6e63ec16a83'),
      kitUrl.replace('v=v23', 'v=23'),
      kitUrl.replace('v=v23', 'v=v23.1'),
      kitUrl.replace('kit=j8_w6_fAw7jrcalD7oKYNX0QfAnPa7L37EdzVhNemtmk', 'kit=short'),
      kitUrl.replace('kit=j8_w6_fAw7jrcalD7oKYNX0QfAnPa7L37EdzVhNemtmk', 'kit=j8_w6%2FfAw7jrcalD7oKYNX0QfAnPa7L37EdzVhNemtmk'),
      kitUrl.replace('kit=j8_w6_fAw7jrcalD7oKYNX0QfAnPa7L37EdzVhNemtmk', 'kit=../../private'),
      kitUrl.replace('kit=', 'kit=%6a'), // percent-encoding is refused even where it decodes to a valid char
      `${kitUrl}&`,
      kitUrl.replace('&skey=', '&skey&'),
      `${staticUrl}?kit=j8_w6_fAw7jrcalD7oKYNX0QfAnPa7L37EdzVhNemtmk&skey=f32d6e63ec16a834&v=v23`,
      'not a url',
    ];
    for (const raw of refused) {
      expect(fontResourceShape(raw), raw).toBeNull();
      if (raw !== 'not a url') expect(() => assertFontUrl(raw), raw).toThrow('FONT_RESOURCE_URL_DENIED');
    }
  });
  it('still reports a bounded diagnosis without values for a refused kit-like URL and never fetches it', async () => {
    const rejected = 'https://fonts.gstatic.com/l/font?kit=DO_NOT_LOG_VALUE_1&skey=DO_NOT_LOG_2&v=v1&token=DO_NOT_LOG_3';
    const fetcher = vi.fn();
    await expect(readPublicResource(rejected, 'test', 'woff2', fetcher)).rejects.toThrow('FONT_RESOURCE_URL_DENIED');
    expect(fetcher).not.toHaveBeenCalled();
    let failure: any;
    try { assertFontUrl(rejected); } catch (error) { failure = error; }
    expect(failure.fontResource).toEqual({ origin: 'https://fonts.gstatic.com', pathname: '/l/font', queryKeys: ['kit', 'skey', 'v', 'token'], hasCredentials: false, hasFragment: false, canonical: true, urlSha256: sha256(rejected) });
    expect(JSON.stringify(failure.fontResource)).not.toMatch(/DO_NOT_LOG/);
  });
  it('fetches an accepted kit URL exactly as written, once, with the same guarded request shape', async () => {
    const calls: any[] = [];
    const fetcher = async (url: string, opts: any) => { calls.push([url, opts]); return new Response('wOF2synthetic-kit-bytes', { headers: { 'content-type': 'font/woff2' } }); };
    const result = await readPublicResource(kitUrl, chromiumUserAgent('140.0.0.0'), 'woff2', fetcher);
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe(kitUrl);
    expect(calls[0][1]).toMatchObject({ redirect: 'manual', credentials: 'omit' });
    expect(result.sha256).toBe(sha256(Buffer.from('wOF2synthetic-kit-bytes')));
    await expect(readPublicResource(kitUrl, 'test', 'woff2', async () => new Response(null, { status: 302 }))).rejects.toThrow('FONT_FETCH_HTTP_302');
    // A response that resolved at any other URL (a silent redirect) is refused even when its bytes look right.
    const redirected = async () => ({ status: 200, url: staticUrl, headers: new Headers({ 'content-type': 'font/woff2' }), body: (async function* () { yield Buffer.from('wOF2x'); })() });
    await expect(readPublicResource(kitUrl, 'test', 'woff2', redirected as any)).rejects.toThrow('FONT_REDIRECT_DENIED');
  });
  it('accepts a stylesheet mixing static and kit faces and keeps the extra-resource rule', () => {
    const faces = FONT_FAMILIES.map((family: string, index: number) => `@font-face {font-family: '${family}'; src: url(${index % 2 ? kitUrl : staticUrl}) format('woff2');}`).join('\n');
    expect(cssFontResources(faces).urls).toEqual([staticUrl, kitUrl]);
    expect(() => cssFontResources(`${faces}\na { background: url(${kitUrl}&x=1); }`)).toThrow();
    expect(() => cssFontResources(faces.replace(kitUrl, `${kitUrl}&extra=1`))).toThrow('FONT_RESOURCE_URL_DENIED');
  });
  it('records and validates the resource shape in the provenance manifest', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'arbor-font-kit-'));
    const source = Buffer.from('@import url(\'' + SOURCE_CSS_URL + '\');');
    const css = FONT_FAMILIES.map((family: string, index: number) => `@font-face {font-family: '${family}'; src: url(${index % 2 ? kitUrl : staticUrl}) format('woff2');}`).join('\n');
    const resources = ([['css', SOURCE_CSS_URL, Buffer.from(css), undefined], ['woff2', staticUrl, Buffer.from('wOF2static'), 'static'], ['woff2', kitUrl, Buffer.from('wOF2kit'), 'kit']] as const).map(([kind, url, body, shape]) => {
      const hash = sha256(body); const file = `${hash}.${kind}`;
      writeFileSync(path.join(dir, file), body);
      return { kind, url, sha256: hash, file, size: body.length, ...(shape ? { shape } : {}) };
    });
    const manifest = { schema: 1, mode: 'exact', cssUrl: SOURCE_CSS_URL, sourceCssSha256: sha256(source), resources, userAgent: chromiumUserAgent('140.0.0.0') };
    try {
      writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
      const validated = validateFontCache(dir, source);
      expect(validated.resources.get(kitUrl)).toMatchObject({ shape: 'kit', sha256: sha256(Buffer.from('wOF2kit')) });
      expect(validated.resources.get(staticUrl)).toMatchObject({ shape: 'static' });
      // A record that misstates its shape, or omits it, is not provenance.
      writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ ...manifest, resources: resources.map((item) => item.url === kitUrl ? { ...item, shape: 'static' } : item) }));
      expect(() => validateFontCache(dir, source)).toThrow('FONT_CACHE_SHAPE_INVALID');
      writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ ...manifest, resources: resources.map(({ shape, ...item }) => item) }));
      expect(() => validateFontCache(dir, source)).toThrow('FONT_CACHE_SHAPE_INVALID');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('keeps the kit rule in the script that writes the manifest and the one that serves it', () => {
    const { readFileSync } = require('node:fs') as typeof import('node:fs');
    const prep = readFileSync(path.join(__dirname, 'prepare-font-cache.mjs'), 'utf8');
    const runtime = readFileSync(path.join(__dirname, 'font-runtime.mjs'), 'utf8');
    expect(prep).toContain("shape: fontResourceShape(url)");
    expect(runtime).toContain("item.shape !== fontResourceShape(item.url)");
    // Serving stays an exact-URL lookup: a kit URL is matched on its full href, never rewritten.
    expect(runtime).toContain('resources.get(route.request().url())');
  });
});
