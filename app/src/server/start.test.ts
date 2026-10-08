import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import type { Server } from "node:http";
import { mountProductionStatic } from "./start";
import { buildPublicGuidePages } from "../../scripts/build-public-guides";
import { HARD_MOMENT_PILOT } from "../content/pilotRelease";
import { publicGuideCards, readPublicGuideQuery } from "../content/publicHardMoments";
import { PUBLIC_WEB_ORIGIN } from "../lib/publicWebOrigin";

const NOW = new Date("2026-10-08T12:00:00Z");
const sourceShell = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const appShell = sourceShell.replace('src="/src/main.tsx"', 'src="./assets/app.js"');

describe("production public-guide fallback", () => {
  let server: Server;
  let origin: string;
  let dist: string;

  beforeAll(async () => {
    dist = mkdtempSync(join(tmpdir(), "arbor-guide-routing-"));
    writeFileSync(join(dist, "index.html"), appShell);
    mkdirSync(join(dist, "assets"));
    writeFileSync(join(dist, "assets/app.js"), "/* executable app entry */");
    buildPublicGuidePages(dist, NOW);
    // A withdrawn preview is absent after a clean build. Its old link must
    // still boot the public app, whose release policy renders unavailable.
    rmSync(join(dist, "guides/tantrum/index.html"));
    const app = express();
    mountProductionStatic(app, dist);
    server = await new Promise<Server>((resolve) => {
      const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test listener");
    origin = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (dist) {
      if (dirname(resolve(dist)) !== resolve(tmpdir()) || !basename(dist).startsWith("arbor-guide-routing-")) throw new Error("Unexpected test directory");
      rmSync(dist, { recursive: true, force: true });
    }
  });

  it.each(["/guides/unknown?lang=he", "/guides/unknown/?lang=en", "/guides/tantrum?lang=he", "/guides/unknown/nested?lang=he"])("boots the public unavailable view at %s", async (pathname) => {
    const response = await fetch(`${origin}${pathname}`);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('<base href="/" />');
    expect(html).toContain("מדריכים לרגעים קשים · Guides for hard moments | Arbor");
    const base = new URL(/<base href="([^"]+)"/.exec(html)![1], response.url);
    const entry = new URL(/src="(\.\/assets\/[^\"]+)"/.exec(html)![1], base);
    expect(entry.pathname).toBe("/assets/app.js");
    const asset = await fetch(entry);
    expect(asset.headers.get("content-type")).toContain("javascript");
    expect(await asset.text()).toBe("/* executable app entry */");
    const page = new URL(response.url);
    const query = readPublicGuideQuery(page.pathname, page.search);
    const available = publicGuideCards(query, NOW, { ...HARD_MOMENT_PILOT, withdrawnIds: ["tantrum"] });
    expect(available.find((card) => card.id === query.id)).toBeUndefined();
  });

  it("keeps the known static guide's own preview metadata ahead of the fallback", async () => {
    const response = await fetch(`${origin}/guides/homework?lang=en`);
    const html = await response.text();
    expect(html).toContain('<base href="/" />');
    expect(html).toContain(`<link rel="canonical" href="${PUBLIC_WEB_ORIGIN}/guides/homework" />`);
    expect(html).not.toContain("מדריכים לרגעים קשים · Guides for hard moments | Arbor");
  });

  it.each(["/", "/other-route", "/guides-extra"])("preserves the ordinary app shell at %s", async (pathname) => {
    expect(await (await fetch(`${origin}${pathname}`)).text()).toBe(appShell);
  });

  it("routes Firebase guide fallbacks before the general app fallback", () => {
    const config = JSON.parse(readFileSync(new URL("../../../firebase.json", import.meta.url), "utf8"));
    const rewrites = config.hosting.rewrites as Array<{ source: string; destination?: string }>;
    const guide = rewrites.findIndex((rule) => rule.source === "/guides/**");
    const general = rewrites.findIndex((rule) => rule.source === "**");
    expect(guide).toBeGreaterThanOrEqual(0);
    expect(guide).toBeLessThan(general);
    expect(rewrites[guide].destination).toBe("/guides/index.html");
    expect(rewrites.find((rule) => rule.source === "/guides")?.destination).toBe("/guides/index.html");
    expect(rewrites[general].destination).toBe("/index.html");
  });
});
