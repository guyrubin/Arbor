import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const source = readFileSync(fileURLToPath(new URL('../../public/sw.js', import.meta.url)), 'utf8');
function worker() {
  const stored = new Map<string, Response>();
  const url = 'https://arbor.test/visuals/same.webp';
  let quota = false;
  const key = (request: Request | string) => typeof request === 'string' ? request : request.url;
  const cache = {
    match: async (request: Request | string) => stored.get(key(request))?.clone(),
    put: async (request: Request | string, response: Response) => {
      if (quota) throw new Error('quota');
      stored.set(key(request), response);
    },
    keys: async () => [...stored.keys()],
    delete: async (request: Request | string) => stored.delete(key(request)),
  };
  const fetcher = vi.fn(async () => new Response('fresh-art'));
  const events = new Map<string, (event: unknown) => void>();
  const self = { location: { origin: 'https://arbor.test' }, addEventListener: (type: string, handler: (event: unknown) => void) => events.set(type, handler) };
  vm.runInNewContext(source, { self, caches: { open: async () => cache }, fetch: fetcher, URL, Response, Promise, console });
  return {
    stored, url, fetcher, failWrites: (value: boolean) => { quota = value; },
    async request(): Promise<Response> {
      let response!: Promise<Response>;
      const work: Promise<unknown>[] = [];
      events.get('fetch')!({ request: new Request(url), respondWith: (result: Promise<Response>) => { response = result; }, waitUntil: (result: Promise<unknown>) => { work.push(result); } });
      const result = await response;
      await Promise.all(work);
      return result;
    },
  };
}
describe('public art refresh ownership', () => {
  it('shares one fetch but supplies independently consumable response bodies', async () => {
    const w = worker();
    const [a, b] = await Promise.all([w.request(), w.request()]);
    expect(w.fetcher).toHaveBeenCalledOnce();
    expect(a).not.toBe(b);
    await expect(Promise.all([a.text(), b.text()])).resolves.toEqual(['fresh-art', 'fresh-art']);
  });
  it('a quota failure cannot mark the old cached bytes as validated', async () => {
    const w = worker(); w.stored.set(w.url, new Response('kept-art')); w.failWrites(true);
    expect(await (await w.request()).text()).toBe('kept-art');
    w.failWrites(false);
    expect(await (await w.request()).text()).toBe('kept-art');
    expect(await (await w.request()).text()).toBe('fresh-art');
    expect(w.fetcher).toHaveBeenCalledTimes(2);
  });
});
