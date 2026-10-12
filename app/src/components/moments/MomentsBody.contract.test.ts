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
const timeline = read("../tabs/TimelineTab.tsx");
const code = body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("F-CHILD-2 Moments body", () => {
  it("three views in one tablist, read from ?view=", () => {
    expect(body).toContain('role="tablist" data-moments-views');
    expect(body).toContain("MOMENTS_VIEWS.map((key, index) =>");
    expect(body).toContain('role="tab"');
    expect(body).toContain('const VIEW_ICONS: Readonly<Record<MomentsView, string>> = { time: "history", places: "home", areas: "grid_view" };');
    expect(body).toContain('parseView(query.get("view"))');
    expect(body).toContain('query.get("area")');
    expect(body).toContain('goToRoute("timeline", {');
  });

  it("the leaf owns the stamps: the body spreads them and never writes its own", () => {
    expect(code).not.toContain("data-module");
    expect(code).not.toContain("data-primary-move");
    expect(body).toContain("<div {...toolbarModule} className=\"moments-toolbar\">");
    expect(body).toContain("<div {...viewModule} role=\"tabpanel\"");
    expect(body).toContain('<button type="button" {...primaryMoveProps} className="moments-keep" onClick={() => openCaptureSheet()}>');
    expect(body.match(/\{\.\.\.primaryMoveProps\}/g)).toHaveLength(1);
    expect(timeline).toContain('const toolbarModule = { "data-module": "moments-toolbar" };');
    expect(timeline).toContain('const viewModule = { "data-module": "moments-view" };');
  });

  it("counts only: no share, no denominator, no progress shape, no verdict colour", () => {
    expect(code).not.toMatch(/%/);
    expect(code).not.toMatch(/\{\w+\}\s*\/\s*\{\w+\}|\bof \{/);
    expect(code).not.toMatch(/ProgressBar|RadialProgress|progressbar|aria-valuenow/);
    expect(code).not.toMatch(/--arbor-(success|danger|warning|error)|text-(green|red)-|bg-(green|red)-/);
    // a blank month is a dash and an sr-only "no record", never a zero grade
    expect(body).toContain('<span aria-hidden="true">—</span><span className="sr-only">{t("companion.portrait.noRecord")}</span>');
    expect(body).toContain('{n > 0 ? (');
    expect(body).toContain('t("companion.moments.areasNote")');
    expect(body).toContain('t("companion.moments.placeNote")');
    expect(css).not.toMatch(/%\s*\)|width:\s*\d+%/);
  });

  it("logical CSS only, and the one directional glyph mirrors once", () => {
    for (const source of [code, css]) {
      expect(source).not.toMatch(/\b(margin|padding|border)-(left|right)\b|(^|[\s;{])(left|right)\s*:|text-align:\s*(left|right)/m);
      expect(source).not.toMatch(/\b(marginLeft|marginRight|paddingLeft|paddingRight|borderLeft|borderRight)\b/);
      expect(source).not.toMatch(/\b(ml|mr|pl|pr|left|right)-\d/);
    }
    const arrows = body.match(/<Icon name="arrow_forward"[^>]*>/g) ?? [];
    expect(arrows.length).toBeGreaterThan(0);
    for (const arrow of arrows) expect(arrow).toContain('className="rtl:-scale-x-100"');
    expect(body).toContain('const forward = he ? "ArrowLeft" : "ArrowRight";');
  });

  it("44 px floor on every control", () => {
    expect(body).toContain('className="moments-view-tab min-h-11"');
    expect(css).toContain(".moments button, .moments-evidence button { min-height: var(--touch-min);");
    expect(css).toMatch(/\.moments-select \{[^}]*min-block-size: var\(--touch-min\)/);
    expect(css).not.toMatch(/min-height:\s*(?:[0-3]?\d|4[0-3])px/);
  });

  it("the evidence sheet is a Sheet below lg and opens Talk only through seedCoach", () => {
    expect(body).toContain("const Surface = compact ? Sheet : Modal;");
    expect(body).toContain('seedCoach({ prompt, source: "child-portrait" })');
    expect(code).not.toMatch(/setActiveTab\("(talk|coach)"\)/);
  });
});
