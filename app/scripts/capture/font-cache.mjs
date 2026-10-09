/** Exact public-resource contracts. No request is made when this module is imported. */
import { createHash } from 'node:crypto';
export const FONT_CACHE_DIR = '/capture/font-cache';
export const SOURCE_CSS_URL = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,300..700,0..100&family=Nunito:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=Heebo:wght@400;500;600;700;800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=IBM+Plex+Sans+Hebrew:wght@400;500;600;700&family=Frank+Ruhl+Libre:wght@300..900&family=Instrument+Serif:ital@0;1&display=swap';
export const FONT_FAMILIES = Object.freeze(['Fraunces', 'Nunito', 'Heebo', 'Instrument Sans', 'IBM Plex Sans Hebrew', 'Frank Ruhl Libre', 'Instrument Serif']);
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const fontMode = (mode = 'fallback') => {
  if (!['exact', 'fallback'].includes(mode)) throw new Error('FONT_MODE_INVALID');
  return mode;
};
export function sourceFontUrl(source) {
  const imports = [...source.matchAll(/@import\s+url\(\s*['"]([^'"]+)['"]\s*\)\s*;/g)].map((m) => m[1]);
  if (imports.length !== 1 || imports[0] !== SOURCE_CSS_URL) throw new Error('FONT_SOURCE_URL_CHANGED');
  return SOURCE_CSS_URL;
}
export function assertFontUrl(raw) {
  const url = new URL(raw);
  if (url.origin !== 'https://fonts.gstatic.com' || url.username || url.password || url.search || url.hash || raw !== url.href || !/^\/s\/[a-z0-9]+\/v\d+\/[a-zA-Z0-9_-]+\.woff2$/.test(url.pathname)) throw new Error('FONT_RESOURCE_URL_DENIED');
  return raw;
}
export function cssFontResources(css) {
  if (/@import\b/i.test(css)) throw new Error('FONT_NESTED_IMPORT_DENIED');
  const faces = [...css.matchAll(/@font-face\s*\{([^}]+)\}/g)].map((match) => {
    const family = /font-family:\s*['"]([^'"]+)['"]/.exec(match[1])?.[1];
    if (!FONT_FAMILIES.includes(family)) throw new Error('FONT_FAMILY_CHANGED');
    const urls = [...match[1].matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g)].map((m) => assertFontUrl(m[1]));
    if (urls.length !== 1 || !/format\(['"]woff2['"]\)/.test(match[1])) throw new Error('FONT_FORMAT_DENIED');
    return { family, url: urls[0], descriptors: match[1].trim() };
  });
  if (!faces.length || FONT_FAMILIES.some((family) => !faces.some((face) => face.family === family))) throw new Error('FONT_FAMILY_MISSING');
  const allUrls = [...css.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g)].map((m) => m[1]);
  if (allUrls.length !== faces.length || allUrls.some((url) => !faces.some((face) => face.url === url))) throw new Error('FONT_EXTRA_RESOURCE_DENIED');
  const urls = [...new Set(faces.map((face) => face.url))];
  if (urls.length > 128) throw new Error('FONT_RESOURCE_LIMIT');
  return { faces, urls };
}
export function chromiumUserAgent(version) {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(version)) throw new Error('FONT_BROWSER_VERSION_INVALID');
  return `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/${version} Safari/537.36`;
}
export async function readPublicResource(url, userAgent, kind, fetcher = fetch, signal) {
  if (kind === 'css') { if (url !== SOURCE_CSS_URL) throw new Error('FONT_STYLESHEET_DENIED'); }
  else if (kind === 'woff2') assertFontUrl(url);
  else throw new Error('FONT_RESOURCE_TYPE_DENIED');
  const response = await fetcher(url, {
    redirect: 'manual', credentials: 'omit', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000),
    headers: { 'User-Agent': userAgent, Accept: kind === 'css' ? 'text/css' : 'font/woff2', 'Accept-Encoding': 'identity' },
  });
  if (response.status !== 200) throw new Error(`FONT_FETCH_HTTP_${response.status}`);
  if (response.url && response.url !== url) throw new Error('FONT_REDIRECT_DENIED');
  const contentType = response.headers.get('content-type') ?? '';
  if (!(kind === 'css' ? /^text\/css(?:;|$)/ : /^(font\/woff2|application\/font-woff2)(?:;|$)/).test(contentType)) throw new Error('FONT_CONTENT_TYPE_DENIED');
  const limit = kind === 'css' ? 512 * 1024 : 2 * 1024 * 1024;
  if (Number(response.headers.get('content-length') ?? 0) > limit) throw new Error('FONT_SIZE_LIMIT');
  const parts = [];
  let size = 0;
  for await (const part of response.body) {
    size += part.length;
    if (size > limit) throw new Error('FONT_SIZE_LIMIT');
    parts.push(part);
  }
  const bytes = Buffer.concat(parts);
  if (!size || (kind === 'woff2' && bytes.subarray(0, 4).toString() !== 'wOF2')) throw new Error('FONT_BODY_INVALID');
  return { bytes, contentType, size, sha256: sha256(bytes), retrievedAt: new Date().toISOString(), responseHeaders: {
    'content-type': contentType,
    'access-control-allow-origin': response.headers.get('access-control-allow-origin') ?? '',
  } };
}
