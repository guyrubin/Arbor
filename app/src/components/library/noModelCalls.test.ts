/**
 * B-BOOK-04 — ZERO model calls at read (lane B §6.4 guard 1, lane C §6.1):
 * no source under components/library or lib/library may reach a generation
 * or voice service. Scans every non-test .ts/.tsx (and .css/.json) in both
 * folders for the API generate functions, the generate/TTS routes, browser
 * speech synthesis, network fetches, the kid voice queue, and direct imports
 * of the API / TTS / voice modules. Negative controls prove the scan bites.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isStaticJsonPath } from "../../lib/library/staticJson";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..", "..");
const DIRS = [path.join(SRC, "components", "library"), path.join(SRC, "lib", "library")];

function files(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.(tsx?|css|json)$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

const BANNED: [string, RegExp][] = [
  ["api.generate*", /\bapi\.generate/],
  ["/api/generate", /\/api\/generate/],
  ["/api/tts", /\/api\/tts/],
  ["/api/voice or /api/live", /\/api\/(voice|live)/],
  ["speechSynthesis", /speechSynthesis/],
  ["fetch(", /\bfetch\s*\(/],
  ["kidSay / autoReadPage (the TTS voice queue)", /\b(kidSay|autoReadPage|speakText)\s*\(/],
  ["import of lib/api", /from\s+["'][./]*(lib\/)?api["']/],
  ["import of lib/tts, lib/voice, lib/naturalVoice, lib/heroComics", /from\s+["'][./]*(lib\/)?(tts|voice|naturalVoice|heroComics)["']/],
];

export function offences(code: string): string[] {
  return BANNED.filter(([, re]) => re.test(code)).map(([name]) => name);
}

/** The ONE file allowed a fetch: it reads same-origin static JSON only
 *  (a hero sheet's manifest) and refuses every other path (tested below). */
const FETCH_ALLOWED = "lib/library/staticJson.ts";

describe("the book library makes zero model calls", () => {
  const all = DIRS.flatMap((d) => files(d));

  it("scans a real tree (both folders, the reader and the engine)", () => {
    const rel = all.map((f) => path.relative(SRC, f).split(path.sep).join("/"));
    expect(rel).toContain("components/library/BookReader.tsx");
    expect(rel).toContain("components/library/BookPage.tsx");
    expect(rel).toContain("lib/library/bookPageLayout.ts");
    expect(rel).toContain("lib/library/narration.ts");
  });

  it("no source carries a banned call or import", () => {
    const bad = all.flatMap((f) => {
      const rel = path.relative(SRC, f).split(path.sep).join("/");
      return offences(readFileSync(f, "utf8"))
        .filter((o) => !(rel === FETCH_ALLOWED && o === "fetch("))
        .map((o) => `${rel}: ${o}`);
    });
    expect(bad).toEqual([]);
  });

  it("the one fetch reads only same-origin static JSON under /_dev, /visuals or /audio", () => {
    expect(isStaticJsonPath("/_dev/hero-sheets/dylan-v2/manifest.json")).toBe(true);
    expect(isStaticJsonPath("/visuals/books/x/manifest.json")).toBe(true);
    for (const bad of ["/api/generate.json", "/api/tts", "https://evil.example/x.json", "//evil.example/x.json", "/_dev/../api/x.json", "/_dev/x.js", "/_dev/x.json?y=1"]) {
      expect(isStaticJsonPath(bad), bad).toBe(false);
    }
  });

  it("negative controls: each banned shape is caught", () => {
    expect(offences('await api.generateHeroJourney(x)')).toContain("api.generate*");
    expect(offences('fetch("/api/tts", {})')).toEqual(expect.arrayContaining(["/api/tts", "fetch("]));
    expect(offences("window.speechSynthesis.speak(u)")).toContain("speechSynthesis");
    expect(offences('import { api } from "../../lib/api"')).toContain("import of lib/api");
    expect(offences('import { speakText } from "../../lib/voice"')).toContain("import of lib/tts, lib/voice, lib/naturalVoice, lib/heroComics");
    expect(offences('kidSay(id, "hi", "en")')).toContain("kidSay / autoReadPage (the TTS voice queue)");
    expect(offences('const a = new Audio("/audio/books/x.mp3")')).toEqual([]);
  });
});
