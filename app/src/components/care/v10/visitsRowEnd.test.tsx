/**
 * Design V77 (N-Care-D, N-Brief-D): on #/consult and #/school-brief the shell's
 * pill row ends with the day and time, then "Add appointment" — the same action
 * as section 4's head (which the board also draws). #/handoff sets nothing.
 * Synthetic data only.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../../lib/i18n";
import type { ShellRowEnd } from "../../../lib/shellSlots";

const harness = vi.hoisted(() => ({
  locale: "en" as "en" | "he",
  rowEnds: [] as Array<ShellRowEnd | null | undefined>,
  setActiveTab: vi.fn(),
}));

vi.mock("../../../lib/shellSlots", async (orig) => ({
  ...(await orig<typeof import("../../../lib/shellSlots")>()),
  useShellRowEnd: (end: ShellRowEnd | null | undefined) => { harness.rowEnds.push(end); },
}));
vi.mock("../../../context/ArborContext", () => ({
  useArbor: () => ({ childProfile: { id: "c1", name: "Synthetic Child" }, setActiveTab: harness.setActiveTab, requestConsultPrefill: vi.fn() }),
}));
vi.mock("../../../context/LanguageContext", () => ({
  useLanguage: () => ({ uiLang: harness.locale, t: (k: string, v?: Record<string, string | number>) => translate(harness.locale, k, v) }),
}));
vi.mock("../../../hooks/useChildCollection", () => ({
  useChildCollection: () => ({ items: [], loaded: true, upsert: vi.fn(), remove: vi.fn() }),
}));

import VisitsComposition from "./VisitsComposition";
import { ShellRowEndView } from "../../layout/ShellRowEnd";

const MON_16_NOV_1740 = new Date(2026, 10, 16, 17, 40);
const parts = (isTeacher: boolean) => ({
  isTeacher, reviewed: false, isEmpty: false, head: null, audience: null, build: null, bring: null, teacher: null,
  reason: null, visionNote: null, home: null, packet: null, preview: null, share: null,
});
function rowEndFor(landing: boolean, teacher: boolean): ShellRowEnd | null | undefined {
  harness.rowEnds = [];
  renderToStaticMarkup(
    <VisitsComposition composition="desk" parts={parts(teacher)} visit={null} heading={<h1>H</h1>} sublines={null}
      packed={{ moments: 0, milestones: 0, words: 0 }} landing={landing} followUp={null} timeline={null} aside={null} shared={null} nowMs={MON_16_NOV_1740.getTime()} />,
  );
  return harness.rowEnds.at(-1);
}
const strip = (s: string) => s.replace(/[⁦-⁩]/g, "").replace(/<[^>]+>/g, "");

beforeEach(() => { harness.locale = "en"; harness.setActiveTab.mockReset(); });

describe("V77 · Visits and the Teacher brief end the pill row with Add appointment", () => {
  for (const locale of ["en", "he"] as const) {
    it(`${locale}: #/consult and #/school-brief set the action; the shell draws it after the day and time`, () => {
      harness.locale = locale;
      const label = translate(locale, "elev.careNet.appt.add");
      for (const [landing, teacher] of [[true, false], [false, true]] as const) {
        const end = rowEndFor(landing, teacher);
        expect(end?.action?.label).toBe(label);
        expect(end?.action?.icon).toBe("add");
        const html = renderToStaticMarkup(<ShellRowEndView now={MON_16_NOV_1740} uiLang={locale} end={end ?? null} />);
        const text = strip(html);
        // the day and time stay; the action follows them
        expect(text).toContain("17:40");
        expect(text.indexOf("17:40")).toBeLessThan(text.indexOf(label));
        expect(html).toMatch(/<button[^>]*data-testid="care-row-add-appointment"/);
      }
    });
  }

  it("the action is the existing add-appointment one (Appointments with its form open)", () => {
    const end = rowEndFor(true, false);
    end?.action?.onClick();
    expect(harness.setActiveTab).toHaveBeenCalledWith("appointments");
  });

  it("NEGATIVE CONTROL: #/handoff sets no row end, and with none the shell draws no button", () => {
    expect(rowEndFor(false, false)).toBeNull();
    const html = renderToStaticMarkup(<ShellRowEndView now={MON_16_NOV_1740} uiLang="en" end={null} />);
    expect(html).not.toContain("care-row-add-appointment");
    expect(strip(html)).not.toContain(translate("en", "elev.careNet.appt.add"));
  });
});
