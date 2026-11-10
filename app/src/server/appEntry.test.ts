import { describe, expect, it } from "vitest";
import { verifyAppEntry } from "../../scripts/verify-live-release.mjs";
const sha = "a".repeat(40);
const html = '<html><script type="module" crossorigin src="./assets/main.js"></script></html>';
const javascript = () => new Response('/* app */', { headers: { 'content-type': 'text/javascript' } });

describe("live app entry smoke", () => {
  it("detects the observed 200-HTML fallback for a nested relative module", async () => {
    const fetcher = async () => new Response(html, { headers: { 'content-type': 'text/html' } });
    await expect(verifyAppEntry('https://arbor.test', sha, '/app/', fetcher)).rejects.toThrow('not JavaScript: /app/assets/main.js');
  });
  it("follows the app alias and verifies the root module content type", async () => {
    const fetched: string[] = [];
    const fetcher = async (url: string) => {
      const path = new URL(url).pathname; fetched.push(path);
      if (path === '/app/') return new Response(null, { status: 302, headers: { location: '/' } });
      if (path === '/assets/main.js') return javascript();
      return new Response(html);
    };
    await expect(verifyAppEntry('https://arbor.test', sha, '/app/', fetcher)).resolves.toBe('/assets/main.js');
    expect(fetched).toEqual(['/app/', '/', '/assets/main.js']);
  });
  it("honors a document base and refuses external redirects", async () => {
    const fetcher = async (url: string) => new URL(url).pathname === '/assets/main.js' ? javascript() : new Response('<base href="/">'+html);
    await expect(verifyAppEntry('https://arbor.test', sha, '/app/', fetcher)).resolves.toBe('/assets/main.js');
    await expect(verifyAppEntry('https://arbor.test', sha, '/app/', async () => new Response(null, {status:302,headers:{location:'https://other.test/'}}))).rejects.toThrow('outside Hosting');
  });
  it("bounds redirect loops and rejects missing entry scripts", async () => {
    let calls=0;
    await expect(verifyAppEntry('https://arbor.test', sha, '/app/', async () => { calls++; return new Response(null,{status:302,headers:{location:'/app/'}}); })).rejects.toThrow('HTTP 302');
    expect(calls).toBe(4);
    await expect(verifyAppEntry('https://arbor.test', sha, '/', async () => new Response('<html/>'))).rejects.toThrow('no module script');
  });
});
