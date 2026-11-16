import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * F-CHILD-2 — Moments (#/timeline) source contract. The route's stamps come
 * from the leaf (TimelineTab); the body is counts only, logical CSS only and
 * keeps every control on the 44 px floor.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.resolve(here, rel), "utf8").replace(/\r\n/g, "\n");
const body = read("MomentsBody.tsx");
const css = read("moments.css");
const mychild = read("mychild.css");
const areas = read("v10/MomentsAreas.tsx");
const timeline = read("../tabs/TimelineTab.tsx");
const code = body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("F-CHILD-2 Moments body", () => {
  it("three views in one tablist, read from ?view=", () => {
    // v10: the views are the stage's segmented switch (.vseg), still one tablist.
    expect(body).toContain('role="tablist" data-moments-views');
    expect(body).toContain('className="vseg"');
    expect(body).toContain("MOMENTS_VIEWS.map((key, index) =>");
    expect(body).toContain('role="tab"');
    // v4 re-pin: the default depends on whether the link names an area, a month or an observation.
    expect(body).toContain('parseView(query.get("view"), !!(area || month || query.get("observation")))');
    expect(body).toContain('query.get("area")');
    expect(body).toContain('goToRoute("timeline", {');
  });

  it("v4: which moments are in view is one group of toggles read from ?kind=, each kind with a door to its full page", () => {
    expect(body).toContain('role="group" data-moments-kinds');
    expect(body).toContain('className={kind === key ? "kchip on" : "kchip"}');
    expect(body).toContain("MOMENTS_KINDS.map(key =>");
    expect(body).toContain("aria-pressed={kind === key}");
    expect(body).toContain('parseKind(query.get("kind"))');
    expect(body).toContain('kind: target.kind === "all" ? undefined : target.kind');
    expect(body).toContain('onClick={() => setActiveTab("behaviors")}');
    expect(body).toContain('onClick={() => setActiveTab("language")}');
    // The range stays a capability, with the panel (its head, or the areas
    // legend), never in the toolbar.
    const toolbar = body.slice(body.indexOf("<div {...toolbarModule}"), body.indexOf("{panel}"));
    expect(toolbar).not.toContain("moments-range");
    expect(toolbar).not.toContain("{rangeControl}");
    expect(body).toContain('<div className="moments-range" ref={rangeRef}>');
    const panel = body.slice(body.indexOf("const panel = ("), body.indexOf("const stage = ("));
    expect(panel.match(/\{rangeControl\}/g)).toHaveLength(2);
  });

  it("the leaf owns the stamps: the body spreads them and never writes its own", () => {
    expect(code).not.toContain("data-module");
    expect(code).not.toContain("data-primary-move");
    expect(body).toContain('<div {...toolbarModule} className="mstack mtools">');
    expect(body).toContain("<div {...viewModule} role=\"tabpanel\"");
    // v10: capture lives in the shell's dock; the move is choosing a view.
    expect(body).toContain('<div {...primaryMoveProps} role="tablist" data-moments-views');
    expect(body.match(/\{\.\.\.primaryMoveProps\}/g)).toHaveLength(1);
    expect(code).not.toContain("openCaptureSheet()");
    for (const section of ["kinds", "newest", "shelves"]) expect(body).toContain(`{...sectionModules.${section}}`);
    expect(timeline).toContain('const primaryMove = { "data-primary-move": moments ? "choose-moments-view" : "open-shelf" };');
    expect(timeline).toContain('const toolbarModule = { "data-module": "moments-toolbar" };');
    expect(timeline).toContain('const viewModule = { "data-module": "moments-view" };');
  });

  it("counts only: no share, no denominator, no progress shape, no verdict colour", () => {
    expect(code).not.toMatch(/%/);
    expect(code).not.toMatch(/\{\w+\}\s*\/\s*\{\w+\}|\bof \{/);
    expect(code).not.toMatch(/ProgressBar|RadialProgress|progressbar|aria-valuenow/);
    expect(code).not.toMatch(/--arbor-(success|danger|warning|error)|text-(green|red)-|bg-(green|red)-/);
    // a blank month is a dash and an sr-only "no record", never a zero grade
    expect(areas).toContain('<span className="ncnt" aria-hidden="true">–</span>');
    expect(areas).toContain('<span className="sr-only">{labels.noRecord}</span>');
    expect(areas).toContain("return n > 0 ? (");
    // v10: a month is a fixed-scale pile (one token per moment, capped; the
    // number always printed), never normalised against another area or month.
    expect(areas).toContain("Math.min(n, TOKEN_CAP)");
    expect(areas).toContain('<span className="ncnt has arbor-num" aria-hidden="true">{n}</span>');
    for (const source of [code, areas]) expect(source).not.toMatch(/Math\.max\(\s*\.\.\.\s*row\.counts|\/\s*max\b|%/);
    expect(body).toContain('t("companion.moments.areasNote")');
    expect(body).toContain('t("companion.moments.placeNote")');
    expect(css).not.toMatch(/%\s*\)|width:\s*\d+%/);
    expect(mychild).not.toMatch(/--arbor-(success|danger|warning|error)/);
  });

  it("logical CSS only, and the one directional glyph mirrors once", () => {
    for (const source of [code, css, mychild, areas]) {
      expect(source).not.toMatch(/\b(margin|padding|border)-(left|right)\b|(^|[\s;{])(left|right)\s*:|text-align:\s*(left|right)/m);
      expect(source).not.toMatch(/\b(marginLeft|marginRight|paddingLeft|paddingRight|borderLeft|borderRight)\b/);
      expect(source).not.toMatch(/\b(ml|mr|pl|pr|left|right)-\d/);
    }
    const arrows = body.match(/<Icon name="(arrow_forward|chevron_right)"[^>]*>/g) ?? [];
    expect(arrows.length).toBeGreaterThan(0);
    for (const arrow of arrows) expect(arrow).toContain('className="rtl:-scale-x-100"');
    expect(body).toContain('const forward = he ? "ArrowLeft" : "ArrowRight";');
  });

  it("44 px floor on every control", () => {
    // v10: the view switch, the kind chips, the month cells and the ledges.
    expect(mychild).toMatch(/\.ds-mychild \.vseg button \{[^}]*min-height: var\(--touch-min, 44px\)/);
    expect(mychild).toMatch(/\.ds-mychild \.kchip \{[^}]*min-height: var\(--touch-min, 44px\)/);
    expect(mychild).toMatch(/\.ds-mychild \.mcell \{[^}]*min-height: var\(--touch-min, 44px\)/);
    expect(mychild).toMatch(/\.ds-mychild button\.ldg \{[^}]*min-height: var\(--touch-min, 44px\)/);
    expect(css).toContain(".moments button, .moments-evidence button { min-height: var(--touch-min);");
    expect(css).toMatch(/\.moments-select \{[^}]*min-block-size: var\(--touch-min\)/);
    expect(css).not.toMatch(/min-height:\s*(?:[0-3]?\d|4[0-3])px/);
  });

  it("the range menu is keyboard-complete: focus enters, arrows rove, Escape returns to the chip", () => {
    expect(body).toContain('role="menu" id={menuId}');
    expect(body).toContain("onKeyDown={onMenuKey}");
    expect(body).toContain("onKeyDown={onChipKey}");
    expect(body).toContain("rangeItemRefs.current[Math.max(0, MOMENTS_RANGES.indexOf(range))]?.focus();");
    expect(code).toMatch(/event\.key === "ArrowDown"/);
    expect(code).toMatch(/event\.key === "ArrowUp"/);
    expect(code).toMatch(/event\.key === "Home" \? 0 : event\.key === "End" \? last/);
    expect(body).toContain('if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeMenu(true); return; }');
    expect(body).toContain("if (refocus) rangeChipRef.current?.focus();");
    expect(body).toContain("tabIndex={range === option ? 0 : -1}");
    expect(body).toContain("onClick={() => { setRange(option); closeMenu(true); }}");
  });

  it("counts only the parent's kept record; the evidence sheet frosts the page behind it", () => {
    expect(body).toContain("o.childId === childProfile.id && isMomentRecord(o)");
    expect(body).toContain("<Surface open={!!selected} onClose={() => closeSelection()} scrimBlur title=");
  });

  it("the evidence sheet is a Sheet below lg and opens Talk only through seedCoach", () => {
    expect(body).toContain("const Surface = compact ? Sheet : Modal;");
    expect(body).toContain('seedCoach({ prompt, source: "child-portrait" })');
    expect(code).not.toMatch(/setActiveTab\("(talk|coach)"\)/);
  });
});
