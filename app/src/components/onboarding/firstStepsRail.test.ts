/**
 * B-TODAY-07 — FirstStepsRail sends the first capture to the moment sheet on
 * Today, not to the Behaviors incident form.
 *
 * The rail ordered avatar → coach → capture → comic, and the capture step's
 * `tab: "behaviors"` left Today for a 7-field incident form while the capture
 * bar on the same screen opened the one-field moment sheet. Source guard with
 * the pre-fix STEPS row as the negative control.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.join(here, rel), "utf8").replace(/\r\n/g, "\n");
const rail = read("FirstStepsRail.tsx");
const overview = read("../tabs/OverviewTab.tsx");
const steps = rail.slice(rail.indexOf("const STEPS"), rail.indexOf("export interface FirstStepsRailState"));

/** The pre-fix capture row, verbatim — the negative control. */
const PRE_FIX_CAPTURE = `{ id: "capture", labelKey: "elev.rail.step.capture", tab: "behaviors", tone: "sky", Glyph: Camera },`;

describe("B-TODAY-07 · rail order and capture target", () => {
  it("found the STEPS table (guard stays honest)", () => {
    expect(steps).toContain('id: "capture"');
    expect(steps).toContain('id: "comic"');
  });

  it("negative control: the pre-fix capture row targeted the behaviors tab", () => {
    expect(/tab: "behaviors"/.test(PRE_FIX_CAPTURE)).toBe(true);
    expect(rail.includes(PRE_FIX_CAPTURE)).toBe(false);
  });

  it("no step in STEPS targets the behaviors tab", () => {
    expect(steps).not.toMatch(/tab: "behaviors"/);
  });

  it("order is capture → coach → avatar → comic", () => {
    const order = [...steps.matchAll(/\{ id: "(\w+)"/g)].map((m) => m[1]);
    expect(order).toEqual(["capture", "coach", "avatar", "comic"]);
  });

  it("capture opens in place through onCapture; the labels keep their elev.rail.step.* keys", () => {
    expect(rail).toContain("if (tab === null) onCapture();");
    expect(steps).toContain('labelKey: "elev.rail.step.capture"');
  });

  it("Today passes the capture bar's own opener (text sheet), so the route stays #/overview", () => {
    expect(overview).toContain('<FirstStepsRail onCapture={() => { setQuickLogMode("text"); setQuickLogOpen(true); }} />');
  });
});
