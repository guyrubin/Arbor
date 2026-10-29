/**
 * Wave 4 — a closed conversation carries no stamp.
 *
 * A conversation opened once and closed stays mounted, hidden (CompanionWorkspace
 * keeps the thread, the draft, the composer's photos and the voice proposals), and
 * its `data-primary-move="ask"` and `data-module` stamps stayed in the page beside
 * it: the one-primary-move law and the sweep counted them (the 2b sweep caught the
 * same pattern for the coach workspace's idle mount). CoachTab now spreads
 * `hiddenStamps(embedded && !visible)` after each of its stamps.
 *
 * CoachTab is too large to mount here, so the check is its own source, parsed:
 * every element that carries a stamp spreads `unstamped` AFTER the stamp (so the
 * spread wins), `unstamped` is exactly `hiddenStamps(embedded && !visible)`, and
 * the workspace hands CoachTab `visible`. The attributes those elements end up
 * with are rendered for real, closed and open. Negative control: the pre-change
 * element (no spread) still renders its stamp when closed.
 */
import React from "react";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hiddenStamps, SURFACE_STAMP_ATTRIBUTES } from "../../lib/surfaceContract";

const COACH_SRC = readFileSync(new URL("./CoachTab.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const WORKSPACE_SRC = readFileSync(new URL("../companion/CompanionWorkspace.tsx", import.meta.url), "utf8");

type Stamped = { tag: string; stamp: string; value: string; spreadAfter: boolean };
function stampedElements(source: string): Stamped[] {
  const file = ts.createSourceFile("CoachTab.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: Stamped[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const props = node.attributes.properties;
      props.forEach((prop, index) => {
        if (!ts.isJsxAttribute(prop)) return;
        const name = prop.name.getText(file);
        if (!(SURFACE_STAMP_ATTRIBUTES as readonly string[]).includes(name)) return;
        const value = prop.initializer && ts.isStringLiteral(prop.initializer) ? prop.initializer.text : "";
        const spreadAfter = props.slice(index + 1).some((later) => ts.isJsxSpreadAttribute(later) && later.expression.getText(file) === "unstamped");
        out.push({ tag: node.tagName.getText(file), stamp: name, value, spreadAfter });
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out;
}

describe("wave 4 · a closed conversation carries no stamp", () => {
  it("every stamp in CoachTab is followed by the hidden-stamps spread", () => {
    const stamped = stampedElements(COACH_SRC);
    expect(stamped.map((s) => `${s.stamp}=${s.value}`).sort()).toEqual([
      "data-module=coach-history", "data-module=coach-orientation", "data-module=coach-thread", "data-primary-move=ask",
    ]);
    for (const s of stamped) expect(s.spreadAfter, `${s.stamp}="${s.value}" needs {...unstamped} after it`).toBe(true);
    expect(COACH_SRC).toContain("const unstamped = hiddenStamps(embedded && !visible);");
    // The workspace keeps the conversation mounted when closed and says so through `visible`.
    expect(WORKSPACE_SRC).toContain("<CoachTab key={childProfile.id} embedded visible={visible} />");
    expect(WORKSPACE_SRC).toMatch(/hidden=\{!visible\}/);
  });

  it("closed, the stamped elements render without a stamp; open, with it", () => {
    for (const s of stampedElements(COACH_SRC)) {
      const element = (hidden: boolean) => renderToStaticMarkup(React.createElement(s.tag, { [s.stamp]: s.value, ...hiddenStamps(hidden) }));
      expect(element(true), `${s.stamp}="${s.value}" closed`).not.toContain(s.stamp);
      expect(element(false), `${s.stamp}="${s.value}" open`).toContain(`${s.stamp}="${s.value}"`);
    }
  });

  it("the embedded page route is untouched: a standalone CoachTab is never unstamped", () => {
    // `embedded && !visible`: only the hidden conversation panel drops its stamps.
    expect(hiddenStamps(false)).toEqual({});
    expect(Object.keys(hiddenStamps(true)).sort()).toEqual([...SURFACE_STAMP_ATTRIBUTES].sort());
  });

  it("negative control: the pre-change element keeps its stamp when closed", () => {
    const before = 'function X() { return <section\n  data-primary-move="ask"\n  className="pt-3" />; }';
    const [stamped] = stampedElements(before);
    expect(stamped.spreadAfter).toBe(false);
    expect(renderToStaticMarkup(React.createElement("section", { "data-primary-move": "ask" }))).toContain('data-primary-move="ask"');
  });
});
