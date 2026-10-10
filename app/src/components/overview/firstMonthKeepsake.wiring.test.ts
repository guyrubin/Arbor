import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { translate } from "../../lib/i18n";
import type { LifecycleMoment } from "../../lib/lifecycle";

vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ setActiveTab: vi.fn(), childProfile: { id: "child-a", name: "Noa" }, behaviorLogs: [] }) }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: "en", t: (key: string, vars?: Record<string, string | number>) => translate("en", key, vars) }) }));
vi.mock("../ui/ShareButton", () => ({ ShareButton: () => null }));
import LifecycleMomentCard from "./LifecycleMomentCard";

const source = fs.readFileSync(path.resolve(__dirname, "LifecycleMomentCard.tsx"), "utf8");
const base = { kind: "first-month", ageMonths: 36, counts: { total: 8, week: 3, noticed: 2 } } as LifecycleMoment;
const render = (moment: LifecycleMoment) => renderToStaticMarkup(React.createElement(LifecycleMomentCard, { moment, childName: "Noa", onDismiss() {}, async onSaveInterests() {}, onCapture() {} }));

describe("B-ASKJB-37 retires only the first-month lifecycle variant", () => {
  it("renders no first-month card, counts, share or upsell", () => {
    expect(render(base)).toBe("");
    expect(source).not.toMatch(/buildFirstMonthKeepsake|l4-month-lines|l4-keepsake-share|elev\.l4\.plus/);
  });
  for (const kind of ["birthday", "age-band", "first-week", "welcome-back", "day-one", "interest-ask", "first-moment"] as const) {
    it(`retains the ${kind} variant`, () => {
      expect(render({ ...base, kind })).toContain(`data-lifecycle-kind="${kind}"`);
    });
  }
  it("negative control: a removed null guard would re-enable the retired variant", () => {
    const guard = /if \(moment\.kind === "first-month"\) return null;/;
    expect(source).toMatch(guard);
    expect(source.replace(guard, "")).not.toMatch(guard);
  });
});
