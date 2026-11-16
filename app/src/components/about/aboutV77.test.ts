import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ABOUT_COPY } from "./aboutViewCopy";

/** V77 (N-About-D/M): the figure names the real area, the phone's draft card
 *  says where a fact came from and what a yes does, the phone draws no legend,
 *  and the phone index scrolls the selected area into view. */
const page = readFileSync(new URL("../sections/ChildProfile.tsx", import.meta.url), "utf8");
const answer = readFileSync(new URL("./AboutAnswer.tsx", import.meta.url), "utf8");
const index = readFileSync(new URL("./AboutAreaIndex.tsx", import.meta.url), "utf8");

describe("About · V77 details", () => {
  it("one remembered fact names its area (the placed one, else the words' area)", () => {
    expect(ABOUT_COPY.en.figRememberedUnder(1, "Sleep")).toBe("1 remembered, kept under Sleep");
    expect(ABOUT_COPY.he.figRememberedUnder(1, "שינה")).toContain("שינה");
    expect(page).toMatch(/a\.known\?\.memoryId === nb\.approved\[0\]\.memoryId/);
    // negative control: several remembered facts keep the plain count (no single area)
    expect(page).toMatch(/nb\.approved\.length === 1 \?/);
  });
  it("the phone's draft card: provenance, then what a yes does, dated today", () => {
    expect(ABOUT_COPY.en.phoneWhy(true, "Mornings and routines")).toBe("You said it in Talk with Arbor. A yes keeps it under Mornings and routines, dated today.");
    expect(ABOUT_COPY.en.phoneWhy(false, null)).not.toMatch(/\bI\b|\bme\b/);
    expect(answer).toContain("copy.phoneWhy(fromTalk");
    expect(answer).not.toContain("{source(m)} · {keptWhere}");
  });
  it("the legend is drawn on the desk only; the phone index scrolls the selected tile into view", () => {
    expect(page).toMatch(/\{desk && <TokenLegend/);
    expect(index).toContain("row.scrollBy({ left:");
    // negative control: never scrollIntoView, which also slides the band's clipped box
    expect(index).not.toMatch(/\.scrollIntoView\(/);
  });
});
