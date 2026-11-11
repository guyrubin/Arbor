/**
 * 11 Nov 2026 regression: Hosting answers a hashed /assets/ file that a newer
 * release removed with the SPA shell (200 text/html, cached immutable). The
 * worker cached that page under the script's URL and served it cache-first,
 * so the lazy screen could never load in that browser profile. The worker now
 * turns that answer into a 404 and never stores or serves it.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(fileURLToPath(new URL("../../public/sw.js", import.meta.url)), "utf8");
const ORIGIN = "https://arbor.test";
const html = () => new Response("<!doctype html><html></html>", { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
const js = () => new Response("export default 1;", { status: 200, headers: { "content-type": "text/javascript; charset=utf-8" } });

function worker(network: (url: string) => Response) {
  const stored = new Map<string, Response>();
  const key = (request: Request | string) => typeof request === "string" ? new URL(request, ORIGIN).href : request.url;
  const cache = {
    match: async (request: Request | string) => stored.get(key(request))?.clone(),
    put: async (request: Request | string, response: Response) => { stored.set(key(request), response); },
    keys: async () => [...stored.keys()],
    delete: async (request: Request | string) => stored.delete(key(request)),
    addAll: async () => {},
  };
  const caches = { open: async () => cache, match: cache.match, keys: async () => [], delete: async () => true };
  const fetcher = vi.fn(async (request: Request) => network(request.url));
  const events = new Map<string, (event: unknown) => void>();
  const self = { location: { origin: ORIGIN }, addEventListener: (type: string, handler: (event: unknown) => void) => events.set(type, handler) };
  vm.runInNewContext(source, { self, caches, fetch: fetcher, URL, Response, Promise, console });
  return {
    stored, fetcher,
    async get(path: string): Promise<Response> {
      let response!: Promise<Response>;
      const work: Promise<unknown>[] = [];
      events.get("fetch")!({ request: new Request(ORIGIN + path), respondWith: (r: Promise<Response>) => { response = r; }, waitUntil: (w: Promise<unknown>) => { work.push(w); } });
      const result = await response;
      await Promise.all(work);
      return result;
    },
  };
}

describe("sw.js — a removed release chunk is a 404, never the app shell", () => {
  it("answers 404 for an /assets/ request that Hosting filled with HTML, and keeps nothing", async () => {
    const w = worker(() => html());
    const res = await w.get("/assets/FamilyTopicSheet-_h70ZUHZ.js");
    expect(res.status).toBe(404);
    expect(w.stored.size).toBe(0);
  });

  it("asks the network again on the next request instead of replaying a poisoned entry", async () => {
    const w = worker(() => js());
    w.stored.set(`${ORIGIN}/assets/CoachTab-WcNfv40N.js`, html());
    const res = await w.get("/assets/CoachTab-WcNfv40N.js");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("export default 1;");
    expect(w.fetcher).toHaveBeenCalledTimes(1);
    expect(w.stored.get(`${ORIGIN}/assets/CoachTab-WcNfv40N.js`)?.headers.get("content-type")).toMatch(/javascript/);
  });

  it("still caches and serves a real asset cache-first", async () => {
    const w = worker(() => js());
    expect((await w.get("/assets/NowView-abc123.js")).status).toBe(200);
    expect(w.stored.has(`${ORIGIN}/assets/NowView-abc123.js`)).toBe(true);
    expect((await w.get("/assets/NowView-abc123.js")).status).toBe(200);
    expect(w.fetcher).toHaveBeenCalledTimes(1);
  });

  it("leaves HTML outside /assets/ alone (public pages keep their cache)", async () => {
    const w = worker(() => html());
    const res = await w.get("/privacy.html");
    expect(res.status).toBe(200);
    expect(w.stored.has(`${ORIGIN}/privacy.html`)).toBe(true);
  });
});
