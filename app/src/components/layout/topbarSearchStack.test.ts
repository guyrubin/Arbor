import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("desktop search stays above scrolling content", () => {
  it("lifts the glass header context without clipping its real dropdown", () => {
    const topbar = readFileSync(new URL("./Topbar.tsx", import.meta.url), "utf8");
    const search = readFileSync(new URL("../search/TopbarSearch.tsx", import.meta.url), "utf8");
    const header = topbar.slice(topbar.indexOf("<header"), topbar.indexOf("aria-label="));
    const classes = header.match(/className="([^"]+)"/)?.[1].split(/\s+/) ?? [];
    expect(classes).toEqual(expect.arrayContaining(["arbor-chrome-glass", "relative", "z-30"]));
    expect(classes).not.toContain("overflow-hidden");
    expect(classes).not.toContain("overflow-clip");
    expect(search).toContain('id="topbar-search-results"');
    expect(search).toContain('role="option"');
    // A child-only z-index cannot escape its parent's backdrop-filter context.
    const beforeClasses = classes.filter(value => value !== "relative" && value !== "z-30");
    expect(beforeClasses.includes("relative") && beforeClasses.includes("z-30")).toBe(false);
  });
});
