/**
 * W2 guard — every icon path the web shell declares actually ships (S4).
 *
 * The broken class: manifest srcs pointed OUTSIDE public/ ("../icons/…"),
 * index.html linked a phantom /icon.svg, and the push SW named
 * /arbor-icon-*.png that never existed — all invisible because the SPA
 * rewrite 404-masks every missing asset with index.html. This guard scans
 * the declaring surfaces themselves (index.html, manifest.webmanifest,
 * firebase-messaging-sw.js, pushTokens.ts webpush block) and asserts each
 * referenced path resolves to a real file under public/, so a renamed or
 * dropped icon fails in CI instead of degrading installs silently.
 *
 * It also pins the manifest honest: declared type/sizes must match the
 * file's actual magic bytes and IHDR dimensions, no combined
 * "any maskable" purpose (splash renders the full-bleed tile otherwise),
 * and theme/background colors must equal index.html's theme-color
 * (#fbfaf7, --arbor-paper) so the install splash matches the app.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const publicDir = path.join(appDir, "public");

const PAPER = "#fbfaf7";
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const read = (rel: string) => readFileSync(path.join(appDir, rel), "utf8");

/** Collect every icon-ish path each surface declares, tagged with its origin. */
const declaredIconPaths = (): Array<{ origin: string; src: string }> => {
  const found: Array<{ origin: string; src: string }> = [];

  const indexHtml = read("index.html");
  for (const m of indexHtml.matchAll(
    /<link[^>]*rel="(?:icon|apple-touch-icon|mask-icon|shortcut icon)"[^>]*href="([^"]+)"/g
  )) {
    found.push({ origin: "index.html", src: m[1] });
  }

  const manifest = JSON.parse(read("public/manifest.webmanifest")) as {
    icons: Array<{ src: string }>;
  };
  for (const icon of manifest.icons) {
    found.push({ origin: "manifest.webmanifest", src: icon.src });
  }

  for (const rel of ["public/firebase-messaging-sw.js", "src/server/pushTokens.ts"]) {
    for (const m of read(rel).matchAll(/\b(?:icon|badge):\s*"([^"]+)"/g)) {
      found.push({ origin: rel, src: m[1] });
    }
  }

  return found;
};

describe("W2 — declared web icons exist under public/ (404-mask killer)", () => {
  it("collects icon declarations from every surface (scan is not silently empty)", () => {
    const byOrigin = new Set(declaredIconPaths().map((p) => p.origin));
    // If a refactor moves/renames a surface, the scan must be re-anchored, not skipped.
    for (const origin of [
      "index.html",
      "manifest.webmanifest",
      "public/firebase-messaging-sw.js",
      "src/server/pushTokens.ts",
    ]) {
      expect(Array.from(byOrigin), `no icon declarations found in ${origin}`).toContain(origin);
    }
  });

  it("every referenced icon path is root-absolute and resolves to a real file in public/", () => {
    const missing: string[] = [];
    for (const { origin, src } of declaredIconPaths()) {
      if (!src.startsWith("/") || src.includes("..")) {
        missing.push(`${origin} → "${src}" (must be a root-absolute path inside public/)`);
        continue;
      }
      if (!existsSync(path.join(publicDir, src.slice(1)))) {
        missing.push(`${origin} → "${src}" (no such file under public/)`);
      }
    }
    expect(
      missing,
      `icon references that would 404 in production (SPA rewrite masks these):\n${missing.join("\n")}`
    ).toEqual([]);
  });

  it("manifest icons are honest: real PNG bytes, matching sizes, no combined 'any maskable'", () => {
    const manifest = JSON.parse(read("public/manifest.webmanifest")) as {
      icons: Array<{ src: string; type: string; sizes: string; purpose?: string }>;
    };
    expect(manifest.icons.length).toBeGreaterThan(0);
    for (const icon of manifest.icons) {
      const buf = readFileSync(path.join(publicDir, icon.src.slice(1)));
      expect(icon.type, `${icon.src}: declared type`).toBe("image/png");
      expect(buf.subarray(0, 8).equals(PNG_MAGIC), `${icon.src}: file is not PNG data`).toBe(true);
      const actual = `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`;
      expect(actual, `${icon.src}: IHDR dimensions vs declared sizes`).toBe(icon.sizes);
      expect(icon.purpose ?? "any", `${icon.src}: purpose must be a single value`).toMatch(
        /^(any|maskable|monochrome)$/
      );
    }
    const purposes = new Set(manifest.icons.map((i) => i.purpose ?? "any"));
    expect(Array.from(purposes), "a dedicated padded maskable set must exist").toContain("maskable");
  });

  it(`manifest theme/background match index.html theme-color (${PAPER})`, () => {
    const manifest = JSON.parse(read("public/manifest.webmanifest")) as {
      theme_color: string;
      background_color: string;
    };
    const meta = read("index.html").match(/<meta name="theme-color" content="([^"]+)"/);
    expect(meta?.[1], "index.html theme-color meta").toBe(PAPER);
    expect(manifest.theme_color).toBe(PAPER);
    expect(manifest.background_color).toBe(PAPER);
  });
});
