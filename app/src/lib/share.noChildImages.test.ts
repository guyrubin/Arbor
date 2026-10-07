/**
 * B-SHELL-29 — grep pin: parent-side child content leaves ONLY as text.
 *
 *  · No component outside the kid register (components/kidmode/) calls the
 *    branded-card pipeline (`shareCard(`, `renderShareCard(`,
 *    `shareImageFile(`) or imports a VALUE from lib/shareCard — a
 *    `import type { ShareCardOpts }` (the words a ShareButton sends) is fine.
 *    The invite card is the one parent surface allowed a link, and it carries
 *    no child content (its link is the referral link, nothing else).
 *  · ShareButton (every parent "Send to…" mount) goes through the ONE send
 *    sheet and never through shareCard / a referral code.
 *  · The invite card renders once, on the weekly letter, not in Settings.
 *  · The card footer names the live domain, never "arbor.app".
 *  · index.html carries title + description + og tags, and no og:image until
 *    B-INF-07's file exists (never a broken preview).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "..");
const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}
const rel = (p: string) => path.relative(SRC, p).split(path.sep).join("/");
const PARENT = walk(path.join(SRC, "components")).filter((p) => !rel(p).startsWith("components/kidmode/"));
const read = (r: string) => strip(fs.readFileSync(path.join(SRC, r), "utf8"));

const IMAGE_SHARE = /\b(shareCard|renderShareCard|shareImageFile)\s*\(/;
const VALUE_IMPORT_SHARECARD = /import\s+(?!type\b)[^;]*from\s+["'][^"']*lib\/shareCard["']/;

describe("B-SHELL-29 · no parent-side component sends a child image", () => {
  it("the scan sees the parent tree", () => {
    expect(PARENT.map(rel)).toContain("components/ui/ShareButton.tsx");
    expect(PARENT.map(rel)).toContain("components/referral/InviteCard.tsx");
  });
  it("0 parent components call the branded-card pipeline or import a value from lib/shareCard", () => {
    const hits = PARENT.filter((p) => {
      const code = strip(fs.readFileSync(p, "utf8"));
      return IMAGE_SHARE.test(code) || VALUE_IMPORT_SHARECARD.test(code);
    }).map(rel);
    expect(hits).toEqual([]);
  });
  it("ShareButton opens the send sheet; no shareCard, no referral code, no attribution", () => {
    const code = read("components/ui/ShareButton.tsx");
    expect(code).toContain("<SendSheet");
    // the type-only import of ShareCardOpts (lib/shareCard) is allowed; no call, no referral, no attribution
    expect(code.replace(/^import[^;]*;\s*$/gm, "")).not.toMatch(/\bshareCard\b|referralCode|resolveRefCode|loadAttribution/);
  });
  it("the hard-moment words and the said page open the same sheet", () => {
    expect(read("components/behaviors/HardMomentWords.tsx")).toContain("<SendSheet");
    expect(read("components/growth/SaidPage.tsx")).toContain("<SendButton");
  });
  it("NEGATIVE CONTROL — the pre-change ShareButton shape trips the scan", () => {
    expect(IMAGE_SHARE.test("const res = await shareCard({ artifact, surface, opts })")).toBe(true);
    expect(VALUE_IMPORT_SHARECARD.test('import { renderShareCard } from "../../lib/shareCard";')).toBe(true);
    expect(VALUE_IMPORT_SHARECARD.test('import type { ShareCardOpts } from "../../lib/shareCard";')).toBe(false);
  });
});

describe("B-SHELL-29 · the invite card", () => {
  it("renders once, at the bottom of the weekly letter (inside its module), and not in Settings", () => {
    const weekly = read("components/tabs/WeeklyTab.tsx");
    expect(weekly.match(/<InviteCard \/>/g)).toHaveLength(1);
    const recap = weekly.indexOf('data-module="weekly-recap"');
    const invite = weekly.indexOf('data-testid="weekly-invite"');
    expect(invite).toBeGreaterThan(weekly.indexOf("<WhatWorkedCard", recap));
    expect(weekly.slice(invite, weekly.indexOf("</section>", invite))).toContain('t("elev.words.invite.title")');
    const mounts = PARENT.filter((p) => /<InviteCard\b/.test(strip(fs.readFileSync(p, "utf8")))).map(rel);
    expect(mounts).toEqual(["components/tabs/WeeklyTab.tsx"]);
  });
  it("follows the document direction (no row-reverse in Hebrew)", () => {
    expect(read("components/referral/InviteCard.tsx")).not.toMatch(/row-reverse/);
  });
  it("the card footer names the live domain", () => {
    const card = read("lib/shareCard.ts");
    expect(card).toContain('"arborparentingapp.com"');
    expect(card).not.toMatch(/"arbor\.app"/);
  });
});

describe("B-SHELL-29 · index.html preview tags", () => {
  const html = fs.readFileSync(path.resolve(SRC, "..", "index.html"), "utf8");
  const live = html.replace(/<!--[\s\S]*?-->/g, "");
  it("title, description and og title/description/url are set", () => {
    expect(live).toMatch(/<title>[^<]{8,}<\/title>/);
    expect(live).toMatch(/<meta name="description" content="[^"]{20,}"/);
    for (const p of ["og:title", "og:description", "og:url", "og:type"]) expect(live).toContain(`property="${p}"`);
    expect(live).toContain('content="https://arborparentingapp.com/"');
  });
  it("no og:image until B-INF-07's file exists (the path is documented in a comment)", () => {
    const file = path.resolve(SRC, "..", "public", "og", "arbor-invite-1200x630.png");
    if (!fs.existsSync(file)) expect(live).not.toContain("og:image");
    expect(html).toContain("/og/arbor-invite-1200x630.png");
  });
});
