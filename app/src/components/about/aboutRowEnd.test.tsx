import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ABOUT_COPY } from "./aboutViewCopy";
import { ShellRowEndView } from "../layout/ShellRowEnd";

/** V77 (N-About-D): About sets the pill row's end to "<day> · nothing is
 *  remembered without your approval", in both languages (Hebrew flagged for
 *  native review in aboutViewCopy). */
const src = readFileSync(new URL("../sections/ChildProfile.tsx", import.meta.url), "utf8");
const MON_16_NOV_1740 = new Date(2026, 10, 16, 17, 40);
const strip = (s: string) => s.replace(/[⁦-⁩]/g, "").replace(/<[^>]+>/g, "");
const view = (lang: "en" | "he", end: Parameters<typeof ShellRowEndView>[0]["end"]) =>
  strip(renderToStaticMarkup(<ShellRowEndView now={MON_16_NOV_1740} uiLang={lang} end={end} />));

describe("About · the pill row's end", () => {
  it("About sets the suffix from its own copy module (both languages)", () => {
    expect(src).toContain("useShellRowEnd({ suffix: copy.rowEndSuffix });");
    expect(ABOUT_COPY.he.rowEndSuffix).not.toMatch(/[a-z]/i);
  });
  it("EN: Monday 16 November · nothing is remembered without your approval", () => {
    expect(view("en", { suffix: ABOUT_COPY.en.rowEndSuffix })).toContain("Monday 16 November · nothing is remembered without your approval");
  });
  it("HE: the day, then the Hebrew sentence", () => {
    const he = view("he", { suffix: ABOUT_COPY.he.rowEndSuffix });
    expect(he).toContain(ABOUT_COPY.he.rowEndSuffix);
    expect(he).not.toContain("17:40");
  });
  it("negative control: with no row end set, the shell shows the day and the time", () => {
    const plain = view("en", null);
    expect(plain).toContain("Monday 16 November · 17:40");
    expect(plain).not.toContain(ABOUT_COPY.en.rowEndSuffix);
  });
});
