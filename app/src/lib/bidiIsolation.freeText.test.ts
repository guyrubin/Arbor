/**
 * B-SHELL-28 — a parent's free text never flips on a leading name.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { leadingForeignRun } from "./bidi";
import { FreeText } from "../components/ui/FreeText";

describe("B-SHELL-28 — leadingForeignRun", () => {
  it("an English fact opening with a Hebrew name: the name is the lead", () => {
    expect(leadingForeignRun("דילן is choosing to speak only English at home.")).toEqual({ lead: "דילן", rest: " is choosing to speak only English at home." });
  });
  it("a Hebrew fact opening with a Latin name: the name is the lead", () => {
    expect(leadingForeignRun("Dylan מדבר רק אנגלית בבית.")).toEqual({ lead: "Dylan", rest: " מדבר רק אנגלית בבית." });
  });
  it("one-script text and text opening in its own script → no lead", () => {
    expect(leadingForeignRun("Dylan loves dinosaurs.").lead).toBe("");
    expect(leadingForeignRun("He calls his friend נועה every day.").lead).toBe("");
  });
});

describe("NEXTLEVEL critic r1 — Consult's packet rows and preview lines are isolated text", () => {
  it("every summary-item body and every preview line renders through FreeText", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../components/sections/AskSpecialist.tsx"), "utf8");
    expect(src).toContain("<FreeText text={itemText(it, uiLang)} />");
    expect(src).toContain("value={packetLine(it)}");
    expect(src).toContain("<FreeText text={line.text} />");
    expect(src).not.toMatch(/className="block">\{itemText\(it, uiLang\)\}<\/span>/);
  });
});

describe("B-SHELL-28 — FreeText renders inside a bdi with dir=auto, the name isolated", () => {
  it("'דילן is choosing…' → <bdi dir=auto><bdi>דילן</bdi> is choosing…</bdi>", () => {
    const html = renderToStaticMarkup(React.createElement(FreeText, { text: "דילן is choosing to speak only English at home." }));
    expect(html).toBe('<bdi dir="auto" data-free-text=""><bdi>דילן</bdi> is choosing to speak only English at home.</bdi>');
  });

  it("My Child renders every fact through FreeText; no fact paragraph carries its own dir=auto", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../components/sections/ChildProfile.tsx"), "utf8");
    expect(src).toContain("<FreeText text={toParentWords(latestApproved.fact)} />");
    expect(src).toContain("<FreeText text={toParentWords(m.fact)} />");
    // (B-SHELL-26: chapter 6's `shown.fact` list folded into the remembered
    //  band, which renders <FreeText text={toParentWords(m.fact)} /> above.)
    expect(src).not.toMatch(/>\{shown\.fact\}</);
    expect(src).not.toMatch(/dir="auto"[^>]*>\{toParentWords/);
  });

  it("Today's record card quotes through FreeText", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../components/overview/FromRecordCard.tsx"), "utf8");
    expect(src).toContain("<FreeText text={opener.quote} />");
    // NEXTLEVEL r1: the topic line is the 2-3 word topic (else the plan title), still isolated.
    expect(src).toContain("<FreeText text={topicLine} />");
  });
});

describe("P1-NEXTLEVEL critic r2 — a packet bullet never strands the name at the far edge", () => {
  it("'• {name}, {age}' in Hebrew: the bullet sits outside the name's isolate, the name is its own <bdi>", () => {
    const html = renderToStaticMarkup(React.createElement(FreeText, { text: "• Dylan, 3 שנים ו-2 חודשים. שפות: עברית ואנגלית." }));
    expect(html).toBe('<bdi dir="auto" data-free-text="">• <bdi>Dylan,</bdi> 3 שנים ו-2 חודשים. שפות: עברית ואנגלית.</bdi>');
  });
  it("the English mirror and a plain line are untouched apart from the marker", () => {
    expect(renderToStaticMarkup(React.createElement(FreeText, { text: "• דילן, 3 years 2 months." }))).toBe('<bdi dir="auto" data-free-text="">• <bdi>דילן,</bdi> 3 years 2 months.</bdi>');
    expect(renderToStaticMarkup(React.createElement(FreeText, { text: "Plain line." }))).toBe('<bdi dir="auto" data-free-text="">Plain line.</bdi>');
  });
});
