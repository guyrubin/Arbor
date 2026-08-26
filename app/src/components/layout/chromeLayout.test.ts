/**
 * Shell-chrome layout guards (visual-audit follow-ups).
 *
 * UC-8a — wide-desktop topbar title starvation.
 *   The topbar was a `flex-1 min-w-0` title zone against a `flex-shrink-0`
 *   control band. With the AI rail open on a 1920 desktop the band claimed
 *   ~740px of an 880px header and the page title collapsed to "T…" / "One …"
 *   (EN and HE). The band must therefore be shrinkable, the title must own a
 *   real minimum, and the shrinking must be paid for by ONE designated control
 *   (search) rather than by squeezing controls out of reach.
 *
 * UC-8b — sticky sub-tab row leaving a live sliver above it.
 *   <main> is the scroll container and carries a top padding, so the
 *   `sticky top-0` tablist parked one padding-height below the scrollport top;
 *   content scrolled through the gap and was clipped by the opaque band. The
 *   row cancels the inset with --arbor-main-pt, whose value must keep matching
 *   <main>'s Tailwind padding — that is what this test pins.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const topbar = readFileSync(path.join(here, "Topbar.tsx"), "utf8");
const shell = readFileSync(path.join(here, "Shell.tsx"), "utf8");
const indexCss = readFileSync(path.join(here, "..", "..", "index.css"), "utf8");

describe("UC-8a — the topbar title always gets usable width", () => {
  const bandMatch = topbar.match(/<div className="flex min-w-0 ([a-z-]+) items-center gap-2\.5">/);

  it("the right control band is found by the guard (guard stays honest)", () => {
    expect(bandMatch, "topbar right control band not found — update this guard").toBeTruthy();
  });

  it("the control band can shrink", () => {
    expect(bandMatch![1]).not.toBe("flex-shrink-0");
    expect(bandMatch![1]).toMatch(/^shrink$/);
  });

  it("the title zone declares a minimum inline size", () => {
    const titleZone = topbar.slice(topbar.lastIndexOf("Left zone"), topbar.lastIndexOf("Right zone"));
    expect(titleZone).toMatch(/minInlineSize:\s*"[^"]+"/);
    expect(titleZone).toContain("flex-1");
  });

  it("search is the only control that gives up width", () => {
    const band = topbar.slice(topbar.lastIndexOf("Right zone"));
    // the search box shrinks, with a floor
    expect(band).toMatch(/flex:\s*"0 1 \d+px"/);
    expect(band).toMatch(/minInlineSize:\s*"[\d.]+rem"/);
    // …and every other control in the band keeps its intrinsic size, so no
    // control can be squeezed to unreachable.
    for (const control of ["KidModeButton", "TopbarBell", "TopbarKidSwitcher"]) {
      const idx = band.indexOf(`<${control}`);
      expect(idx, `${control} not found in the topbar control band`).toBeGreaterThan(-1);
      const wrapper = band.slice(Math.max(0, idx - 220), idx);
      expect(
        /flex-shrink-0|flex-none/.test(wrapper),
        `${control} sits in a shrinkable wrapper — it can be squeezed narrower than its content`,
      ).toBe(true);
    }
    // the rail toggle carries its own flex-shrink-0 on the button element
    expect(topbar).toMatch(/2xl:inline-flex[^"]*flex-shrink-0/);
  });
});

describe("UC-8b — the sticky sub-tab row is flush with the scrollport", () => {
  const stickyRow = shell.slice(shell.indexOf('role="tablist"') - 400, shell.indexOf('role="tablist"') + 1400);

  it("cancels the scrollport top inset instead of using a bare top-0", () => {
    expect(stickyRow).toContain("sticky");
    expect(stickyRow).not.toMatch(/className="sticky top-0/);
    expect(stickyRow).toMatch(/top:\s*"calc\(-1 \* var\(--arbor-main-pt\)\)"/);
    expect(stickyRow).toMatch(/marginBlockStart:\s*"calc\(-1 \* var\(--arbor-main-pt\)\)"/);
    // …and pads the band back out so the pills do not move at rest.
    expect(stickyRow).toMatch(/paddingBlockStart:\s*"calc\(var\(--arbor-main-pt\)[^"]*\)"/);
  });

  it("--arbor-main-pt matches <main>'s actual Tailwind top padding", () => {
    // F-02 added ref={mainRef} before className — match the tag, not an exact prop order.
    const mainClass = shell.match(/<main [^>]*className="(arbor-parent[^"]+)"/)?.[1];
    expect(mainClass, "<main> className not found — update this guard").toBeTruthy();

    // Tailwind spacing scale: n → n * 0.25rem.
    const base = mainClass!.match(/(?:^|\s)py-(\d+)/)?.[1] ?? mainClass!.match(/(?:^|\s)pt-(\d+)/)?.[1];
    const md = mainClass!.match(/\smd:py-(\d+)/)?.[1] ?? mainClass!.match(/\smd:pt-(\d+)/)?.[1];
    expect(base, "no base top padding found on <main>").toBeTruthy();
    expect(md, "no md: top padding found on <main>").toBeTruthy();

    const declared = [...indexCss.matchAll(/--arbor-main-pt:\s*([\d.]+)rem/g)].map((m) => Number(m[1]));
    expect(declared.length, "--arbor-main-pt must be declared for both breakpoints").toBe(2);
    expect(declared[0]).toBeCloseTo(Number(base) * 0.25, 5);
    expect(declared[1]).toBeCloseTo(Number(md) * 0.25, 5);
    // the md override must sit in a min-width:768px media query (Tailwind's md)
    expect(indexCss).toMatch(/@media \(min-width: 768px\)[\s\S]{0,160}--arbor-main-pt/);
  });
});
