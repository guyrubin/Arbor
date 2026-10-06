import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ChildIdentity } from "./TopbarKidSwitcher";
import { translate } from "../../lib/i18n";
import type { ChildProfile } from "../../types";

/* P5 r1 pass A8 (design P1-2, r3 P1-1 carried): at 375 the switcher drew no
   name and painted the age under the Demo chip. The identity is ONE line —
   name · age — the name shrinks with an ellipsis but never to zero (min 2ch),
   the wrapper keeps ≥ 3.5rem beside the chip. OWED to a rendered check: the
   sweep's 375 EN/HE switcher rect (name width > 0, no overlap with the chip). */
const here = path.dirname(fileURLToPath(import.meta.url));
const DYLAN = { id: "c1", name: "Dylan", birthDate: "2023-08-01", ageMonths: 38, age: 3 } as unknown as ChildProfile;

describe("TopbarKidSwitcher — name and age on ONE line", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: one row (flex-direction: row), the name can shrink but never to zero, the age never wraps`, () => {
      const html = renderToStaticMarkup(<ChildIdentity child={DYLAN} t={(k, v) => translate(lang, k, v)} />);
      expect(html).toMatch(/data-child-identity="c1"[^>]*flex-direction:row/);
      // P5-LOOP c2 r1: the name keeps priority — never under 4 characters
      expect(html).toMatch(/data-identity-name[^>]*min-width:4ch/);
      // "· age" is ONE nowrap unit that wraps to the clipped 2nd line instead of being cut mid-word
      expect(html).toMatch(/data-child-identity="c1"[^>]*flex-wrap:wrap[^>]*row-gap:24px;height:20px[^>]*overflow:hidden/);
      expect(html).toMatch(/data-age-unit[^>]*class="max-lg:hidden"[^>]*white-space:nowrap/);
      const unit = html.slice(html.indexOf("data-age-unit"));
      expect(unit.indexOf("·")).toBeLessThan(unit.indexOf("data-identity-age"));
      expect(html.indexOf("data-identity-name")).toBeLessThan(html.indexOf("data-identity-age"));
    });
  }
  it("the identity slot grows; the closed trigger carries a 6 px Demo dot, never the text chip (c2 r1)", () => {
    const src = readFileSync(path.join(here, "TopbarKidSwitcher.tsx"), "utf8");
    expect(src).toContain('<span data-identity-slot style={{ flex: "1 1 auto", minWidth: "4ch", overflow: "hidden", display: "flex" }}>');
    expect(src).toContain("{activeChild.demo === true && <DemoDot t={t} />}");
    expect(src).not.toContain("{activeChild.demo === true && <DemoChip t={t} />}");
    expect(src).toMatch(/data-demo-chip="dot"[\s\S]{0,120}aria-label=\{t\("elev\.demo\.chipAria"\)\}/);
    expect(src).toContain('width: "6px", height: "6px"');
    // the family list keeps the full chip
    expect(src).toContain("{p.demo === true && <DemoChip t={t} />}");
    expect(src).not.toMatch(/flexDirection: "column", minWidth: 0, textAlign: "start"/);
  });
});
