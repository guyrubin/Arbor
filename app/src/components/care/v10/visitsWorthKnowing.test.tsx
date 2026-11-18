/**
 * Design V77 (N-Care-D/M): "Worth knowing at {age}" on Visits — the shared card
 * (components/companion/now10/NowWorthKnowing) bound to today's reviewed Learn
 * pick, leaned toward the visit's subjects. No new developmental sentence: the
 * note is the read's own hook, and nothing renders before the catalogue loads.
 * Synthetic data only.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../../lib/i18n";

const harness = vi.hoisted(() => ({
  locale: "en" as "en" | "he",
  worth: [] as Array<Record<string, unknown>>,
  realWorth: false,
}));

vi.mock("../../../lib/shellSlots", async (orig) => ({ ...(await orig<typeof import("../../../lib/shellSlots")>()), useShellRowEnd: () => {} }));
vi.mock("../../../context/ArborContext", () => ({
  useArbor: () => ({ childProfile: { id: "c1", name: "Synthetic Child", birthDate: new Date(Date.now() - 3.3 * 365.25 * 86400000).toISOString().slice(0, 10) }, setActiveTab: vi.fn(), requestConsultPrefill: vi.fn(), requestLearnRead: vi.fn(), behaviorLogs: [] }),
}));
vi.mock("../../../context/LanguageContext", () => ({
  useLanguage: () => ({ uiLang: harness.locale, t: (k: string, v?: Record<string, string | number>) => translate(harness.locale, k, v) }),
}));
vi.mock("../../../hooks/useChildCollection", () => ({ useChildCollection: () => ({ items: [], loaded: true, upsert: vi.fn(), remove: vi.fn() }) }));
vi.mock("../../companion/now10/NowWorthKnowing", async (orig) => {
  const real = await orig<typeof import("../../companion/now10/NowWorthKnowing")>();
  return {
    ...real,
    default: (props: Record<string, unknown>) => {
      harness.worth.push(props);
      return harness.realWorth ? React.createElement(real.default, props as never) : React.createElement("i", { "data-testid": "worth-probe" });
    },
  };
});

import VisitsComposition from "./VisitsComposition";
import { CARE_WORTH_TOPIC } from "./careV10Copy";
import { milestonesV10Copy } from "../../companion/milestonesV10Copy";
import { LEARN_CARDS } from "../../../learn/learnCards";
import { topicBoost } from "../../../learn/learnLibrary";

const parts = (isTeacher: boolean) => ({
  isTeacher, reviewed: false, isEmpty: false, head: null, audience: null, build: null, bring: null, teacher: null,
  reason: null, visionNote: null, home: null, packet: null, preview: null, share: null,
});
const render = (composition: "desk" | "phone", landing: boolean, teacher = false) => {
  harness.worth = [];
  return renderToStaticMarkup(
    <VisitsComposition composition={composition} parts={parts(teacher)} visit={null} heading={<h1>H</h1>} sublines={null}
      packed={{ moments: 0, milestones: 0, words: 0 }} landing={landing} followUp={null} timeline={null} aside={null} shared={null} nowMs={Date.now()} />,
  );
};

beforeEach(() => { harness.locale = "en"; harness.realWorth = false; });

describe("V77 · Worth knowing on Visits", () => {
  for (const locale of ["en", "he"] as const) {
    it(`${locale}: Visits renders the shared card (desk rail; phone §4 "Note"), kicker "Worth knowing at three", leaned to the visit`, () => {
      harness.locale = locale;
      const kicker = milestonesV10Copy(locale).worthKnowingAt.replace("{age}", milestonesV10Copy(locale).ageWords[3]);
      for (const composition of ["desk", "phone"] as const) {
        const html = render(composition, true);
        expect(html).toContain('data-testid="care-worth-knowing"');
        expect(harness.worth).toHaveLength(1);
        expect(harness.worth[0]).toMatchObject({ kicker, topicText: CARE_WORTH_TOPIC, source: "care-worth-knowing", lang: locale });
      }
      // the phone guide gets its fourth stop back, as drawn
      const phone = render("phone", true);
      expect(phone).toContain('id="care-note"');
      expect(phone).toMatch(/class="gnum[^"]*">4</);
    });
  }

  it("NEGATIVE CONTROL: not on the Teacher brief or #/handoff", () => {
    expect(render("desk", false, true)).not.toContain('data-testid="care-worth-knowing"');
    expect(render("phone", false, false)).not.toContain('data-testid="care-worth-knowing"');
    expect(harness.worth).toHaveLength(0);
  });

  it("NEGATIVE CONTROL: before the catalogue loads, the real card renders nothing (no note, no link)", () => {
    harness.realWorth = true;
    const html = render("desk", true);
    expect(html).toContain('data-testid="care-worth-knowing"');
    expect(html).not.toContain('data-testid="now-worth-knowing"');
    expect(html).not.toContain('data-testid="now-worth-knowing-read"');
  });

  it("the visit topic leans toward reviewed reads that exist (titles and shelves only)", () => {
    const leaned = LEARN_CARDS.filter((c) => topicBoost(c, CARE_WORTH_TOPIC) > 0);
    expect(leaned.length).toBeGreaterThan(0);
    // NEGATIVE CONTROL: no topic, no lean
    expect(LEARN_CARDS.filter((c) => topicBoost(c, null) > 0)).toHaveLength(0);
  });
});
