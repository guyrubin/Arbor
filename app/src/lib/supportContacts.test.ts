/**
 * MOB-05 — one support identity on the product domain.
 *
 * Scans every non-test source file under src/ and the three public pages for
 * the retired mailboxes (@arbor.app / @arbor.family). A frozen, shrink-only
 * allowlist carries the ONE file this lane does not own (lib/i18n.ts —
 * cross-lane request filed); the "still needs it" assertion forces the entry
 * out the moment the owner fixes the key. Negative control: the verbatim
 * pre-fix lines still trip the regex.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PRIVACY_EMAIL, SUPPORT_DOMAIN, SUPPORT_EMAIL, mailtoHref } from "./supportContacts";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..");
const PUBLIC = path.join(SRC, "..", "public");

const RETIRED = /@arbor\.(app|family)\b/;

/** Not owned by this lane; cross-lane request filed. Entries may only ever LEAVE this list. */
const PENDING_CROSS_LANE = new Set(["lib/i18n.ts"]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const OLD_LINES = [
  '  "auth.accessFail": "Couldn’t record the request. Please email hello@arbor.app.",',
  '<p>Questions about these Terms: <a href="mailto:support@arbor.family">support@arbor.family</a>.</p>',
  'Open <strong>Settings → Account → Delete account</strong> in the app, or email <a href="mailto:privacy@arbor.family">',
];

describe("the constants", () => {
  it("live on the product domain the stores point at", () => {
    expect(SUPPORT_DOMAIN).toBe("arborparentingapp.com");
    expect(SUPPORT_EMAIL).toBe("support@arborparentingapp.com");
    expect(PRIVACY_EMAIL).toBe("privacy@arborparentingapp.com");
    const fastlane = readFileSync(path.join(SRC, "..", "ios", "App", "fastlane", "metadata", "en-US", "support_url.txt"), "utf8").trim();
    expect(fastlane).toContain(SUPPORT_DOMAIN);
  });

  it("mailtoHref encodes the subject", () => {
    expect(mailtoHref(SUPPORT_EMAIL)).toBe("mailto:support@arborparentingapp.com");
    expect(mailtoHref(PRIVACY_EMAIL, "Delete my account")).toBe("mailto:privacy@arborparentingapp.com?subject=Delete%20my%20account");
  });
});

describe("no retired mailbox anywhere", () => {
  it("negative control: the pre-fix lines trip the scanner", () => {
    for (const line of OLD_LINES) expect(RETIRED.test(line), line).toBe(true);
    expect(RETIRED.test(`mailto:${SUPPORT_EMAIL}`)).toBe(false);
  });

  it("src/**/*.{ts,tsx} (tests excluded) is clean, bar the frozen cross-lane list", () => {
    const offenders = walk(SRC)
      .map((f) => path.relative(SRC, f).split(path.sep).join("/"))
      .filter((rel) => !PENDING_CROSS_LANE.has(rel))
      .filter((rel) => RETIRED.test(readFileSync(path.join(SRC, rel), "utf8")));
    expect(offenders).toEqual([]);
  });

  it("the cross-lane list only shrinks (each entry still carries the pattern — remove it once fixed)", () => {
    for (const rel of PENDING_CROSS_LANE) {
      const src = readFileSync(path.join(SRC, rel), "utf8");
      expect(RETIRED.test(src), `${rel} is clean now — delete it from PENDING_CROSS_LANE so it stays clean`).toBe(true);
    }
  });

  it("public/privacy.html, terms.html, support.html carry only the product-domain mailboxes", () => {
    for (const page of ["privacy.html", "terms.html", "support.html"]) {
      const html = readFileSync(path.join(PUBLIC, page), "utf8");
      expect(RETIRED.test(html), page).toBe(false);
      expect(html).toMatch(/@arborparentingapp\.com/);
    }
  });

  it("support.html names the REAL settings path to account deletion (About section)", () => {
    const html = readFileSync(path.join(PUBLIC, "support.html"), "utf8");
    expect(html).toContain("Settings → About → Delete account");
    expect(html).not.toContain("Settings → Account → Delete account");
  });
});
