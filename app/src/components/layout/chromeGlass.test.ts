import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/* B-DESIGN-03 (chrome) — P7-DESIGN framer decision, 7 Oct (DESIGN-DIRECTION.md
   §Chosen rows 8 + 10): the sticky top bar and the bottom dock are chrome glass
   (paper 80 % + blur 14 px, `.arbor-chrome-glass`), and their icons are the
   300-weight outline, filled when active (Icon `chrome` / `active`). Content
   stays opaque: no other source file may carry the glass class. */

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("B-DESIGN-03 · chrome glass on the sticky top bar and the dock only", () => {
  it("the desktop top bar band is glass, no opaque band fill", () => {
    const header = code(read("components/layout/Topbar.tsx")).match(/<header[\s\S]*?>/)![0];
    expect(header).toContain("arbor-chrome-glass");
    expect(header).not.toMatch(/background:/);
  });

  it("the bottom dock is glass, no bg-white", () => {
    const src = code(read("components/layout/MobileNav.tsx"));
    const nav = src.match(/<nav[\s\S]*?>/)![0];
    expect(nav).toContain("arbor-chrome-glass");
    expect(nav).not.toContain("bg-white");
  });

  it("content stays opaque: the glass CLASS lives in the two chrome files only (the --arbor-chrome-glass token is not a use)", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = path.join(dir, name);
        if (statSync(p).isDirectory()) { if (name !== "node_modules") walk(p); continue; }
        if (!/\.tsx?$/.test(name) || /\.test\./.test(name)) continue;
        if (/(?<![-\w])arbor-chrome-glass\b/.test(code(readFileSync(p, "utf8")))) hits.push(path.relative(SRC, p).split(path.sep).join("/"));
      }
    };
    walk(SRC);
    expect(hits.sort()).toEqual(["components/layout/MobileNav.tsx", "components/layout/Topbar.tsx"]);
  });

  it("dock icons: 300 outline at rest, filled when active (never a hand-set fill)", () => {
    const src = code(read("components/layout/MobileNav.tsx"));
    const bar = src.slice(src.indexOf("<nav"), src.indexOf("</nav>"));
    expect(bar).toContain("<Icon name={place?.icon ?? sec.msIcon} size={emphasized ? 21 : 18} chrome active={on} />");
    expect(bar).toContain('<Icon name="more_horiz" size={18} chrome active={overflowActive} />');
    expect(bar).not.toMatch(/fill=\{/);
  });

  it("top-bar icons: the switcher chevron, the search glyph, the safety ring and the Kid Mode door are chrome icons", () => {
    expect(code(read("components/layout/TopbarKidSwitcher.tsx"))).toMatch(/name="expand_more"\s+size=\{16\}\s+chrome/);
    expect(code(read("components/search/TopbarSearch.tsx"))).toMatch(/name="search"\s+size=\{18\}\s+chrome\s+active=\{open\}/);
    expect(code(read("components/layout/SafetyRing.tsx"))).toContain('<Icon name="support" size={20} chrome active={on} />');
    const kid = code(read("components/layout/KidModeButton.tsx"));
    expect(kid.match(/<Icon name="sports_esports" size=\{1[68]\} chrome \/>/g)).toHaveLength(2);
  });
});
