import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";

/* CODEX-8 deploy-path guard.
   Everything under app/public ships verbatim to arborparentingapp.com on the
   next hosting deploy. Marketing pages are brand-facing product claims, so the
   marketing folder is allowlist-only: a page that has not been explicitly
   approved here must NOT be able to ride along into production (the way the
   unvalidated Third-Age senior landing page once did).

   To publish a new marketing page: get the go-live decision first, then add
   the file to the allowlist below in the same PR that adds the page. */

const here = path.dirname(fileURLToPath(import.meta.url));
const marketingDir = path.join(here, "..", "..", "public", "marketing");
const publicDir = path.join(here, "..", "..", "public");

/** Approved deployable files, as paths relative to app/public/marketing (posix separators). */
const APPROVED_MARKETING_FILES = new Set<string>([
  "arbor-de.md",
  "arbor-en.md",
  "arbor-fr.md",
  "arbor-he.md",
  "arbor-il.html",
  "arbor-imagery-v4.css",
  "arbor-immersive-v3.css",
  "arbor-immersive-v3.js",
  "arbor-marketing-landing-page-de.html",
  "arbor-marketing-landing-page-en.html",
  "arbor-marketing-landing-page-fr.html",
  "arbor-marketing-landing-page-he.html",
  "arbor-marketing-landing-page-nl.html",
  "arbor-nl.md",
  "guides-en.html",
  "guides.html",
  "index.html",
  "utm-scheme.md",
  // EN capability/SEO pages (content wave 2)
  "en/ai-for-parents-child-development.html",
  "en/ai-parenting-app-with-memory.html",
  "en/child-development-operating-system.html",
  "en/daily-play-child-development.html",
  "en/personalized-stories-child-development.html",
  "en/professional-handoff-child-development.html",
  "en/sleep-routine-plan-child.html",
  // HE capability/SEO pages (content wave 2)
  "he/ai-lehorim-hitpatchut-hayeled.html",
  "he/aplikatziat-horut-im-zikaron.html",
  "he/maarechet-hafala-hitpatchut-hayeled.html",
  "he/mischak-yomi-hitpatchut-hayeled.html",
  "he/sikum-miktzoi-lehitpatchut-hayeled.html",
  "he/sipurim-ishiyim-lehitpatchut-hayeled.html",
  "he/tochnit-sheina-veshigra-leyeled.html",
]);

/** Recursively list files under dir as posix-style paths relative to dir. */
function listFiles(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const rel = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(full).isDirectory()) out.push(...listFiles(full, rel));
    else out.push(rel);
  }
  return out;
}

describe("marketing deploy-path guard (CODEX-8)", () => {
  const found = listFiles(marketingDir);

  it("app/public/marketing contains only explicitly approved files", () => {
    const unapproved = found.filter((f) => !APPROVED_MARKETING_FILES.has(f));
    expect(
      unapproved,
      `Unapproved file(s) in the hosting deploy path app/public/marketing: ${unapproved.join(", ")}. ` +
        "Marketing pages need an explicit go-live decision — get approval, then add the file to " +
        "APPROVED_MARKETING_FILES in marketingDeployGuard.test.ts.",
    ).toEqual([]);
  });

  it("sanity: the allowlisted marketing pages are actually present", () => {
    // Guards against the scan silently pointing at the wrong directory.
    expect(found).toContain("index.html");
    expect(found.length).toBeGreaterThanOrEqual(20);
  });

  it("no senior / third-age page anywhere under app/public until Guy approves publication (GD-4)", () => {
    const seniorish = listFiles(publicDir).filter((f) => /senior|third[-_]?age|gil[-_]?shlishi/i.test(f));
    expect(
      seniorish,
      "Third Age is plan-only; its pages live in docs/third-age/ as drafts and must not enter the deploy path.",
    ).toEqual([]);
  });
});


describe("immersive landing release integrity", () => {
  it("ships the current experience at the marketing entry point", () => {
    const entry = readFileSync(path.join(marketingDir, "index.html"), "utf8");
    const hebrew = readFileSync(path.join(marketingDir, "arbor-marketing-landing-page-he.html"), "utf8");
    expect(entry).toBe(hebrew);
  });

  it("ships every local image, stylesheet and script referenced by the immersive pages", () => {
    const files = ["arbor-marketing-landing-page-en.html", "arbor-marketing-landing-page-he.html", "arbor-immersive-v3.css", "arbor-imagery-v4.css"];
    for (const file of files) {
      const text = readFileSync(path.join(marketingDir, file), "utf8");
      const references = [...text.matchAll(/(?:src="|href="|url\(['"]?)(\/[^"'\s)]+)/g)];
      for (const match of references) {
        const asset = match[1].split("?")[0];
        if (!/\.(?:html|css|js|png|jpe?g|webp|svg|woff2?)$/.test(asset)) continue;
        expect(existsSync(path.join(publicDir, asset)), `${file}: ${asset}`).toBe(true);
      }
    }
  });

  it("preserves the binary hero payload without truncation or text conversion", () => {
    for (const image of ["hero-child-v5.webp", "family-moment-v6.webp", "play-together-v6.webp", "story-world-v6.webp"]) {
    const bytes = readFileSync(path.join(publicDir, "visuals/marketing", image));
    expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
    expect(bytes.toString("ascii", 8, 12)).toBe("WEBP");
    expect(bytes.readUInt32LE(4) + 8).toBe(bytes.length);
    expect(bytes.length).toBeGreaterThan(10000);
    }
  });
});
