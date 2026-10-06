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
      expect(html).toMatch(/data-identity-name[^>]*min-width:2ch/);
      expect(html).toMatch(/data-identity-age[^>]*white-space:nowrap/);
      expect(html.indexOf("data-identity-name")).toBeLessThan(html.indexOf("data-identity-age"));
    });
  }
  it("the identity wrapper keeps room beside the Demo chip (flex 1 1 auto, min 3.5rem)", () => {
    const src = readFileSync(path.join(here, "TopbarKidSwitcher.tsx"), "utf8");
    expect(src).toContain('<span style={{ flex: "1 1 auto", minWidth: "3.5rem", overflow: "hidden", display: "flex" }}>');
    expect(src).not.toMatch(/flexDirection: "column", minWidth: 0, textAlign: "start"/);
  });
});
