import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPublicGuidePages, renderPublicGuidePreview } from "./build-public-guides";

const shell = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("public guide social previews", () => {
  it("escapes titles and URLs, replaces the app's generic metadata, and keeps the app entry", () => {
    const html = renderPublicGuidePreview(shell, 'Words <here> & "there"', "https://arborparentingapp.com/guides/waiting");
    expect(html).toContain('<meta property="og:title" content="Words &lt;here&gt; &amp; &quot;there&quot;" />');
    expect(html).toContain('<meta property="og:url" content="https://arborparentingapp.com/guides/waiting" />');
    expect(html).toContain('rel="canonical"');
    expect(html).toContain('src="/src/main.tsx"');
    expect(html).toContain("2026-12-03");
    expect(html).toContain("Pilot availability is checked when you open the guide.");
    expect(html).not.toContain('<title>Arbor — your child');
  });

  it("fails the build if the source metadata changes instead of publishing a misleading preview", () => {
    expect(() => renderPublicGuidePreview("<html><head></head></html>", "Guide", "https://arborparentingapp.com/guides")).toThrow();
  });

  it("resolves relative production assets from the root on nested guide routes", () => {
    const builtShell = shell.replace('src="/src/main.tsx"', 'src="./assets/app.js"');
    const html = renderPublicGuidePreview(builtShell, "Guide", "https://arborparentingapp.com/guides/tantrum");
    const base = /<base href="([^"]+)"/.exec(html)?.[1];
    expect(base).toBeDefined();
    expect(new URL("./assets/app.js", new URL(base!, "https://arborparentingapp.com/guides/tantrum/")).pathname).toBe("/assets/app.js");
  });

  it("generates directory index files Firebase Hosting can serve for all original 25 guides", () => {
    const dist = mkdtempSync(join(tmpdir(), "arbor-public-guide-build-"));
    writeFileSync(join(dist, "index.html"), shell);
    expect(buildPublicGuidePages(dist, new Date("2026-10-08"))).toBe(26);
    const html = readFileSync(join(dist, "guides/tantrum/index.html"), "utf8");
    expect(html).toContain("התקף זעם · Tantrum | Arbor");
    expect(html).not.toContain("Lower your voice, reduce words");
    expect(html).not.toContain("I&#39;m here. We can pause.");
  });

  it("generates no individual pilot previews after release expiry", () => {
    const dist = mkdtempSync(join(tmpdir(), "arbor-public-guide-expired-"));
    writeFileSync(join(dist, "index.html"), shell);
    expect(buildPublicGuidePages(dist, new Date("2026-12-03"))).toBe(1);
  });
});
