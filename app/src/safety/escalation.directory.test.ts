/* B-CAREPRO-45 — the safety list is complete: Israel's Ministry of Welfare
 * hotline 118 and one child-protection line per supported country, in the
 * same one-tap directory style as the existing lines, labelled EN + HE, and
 * present in the coach's abuse escalation copy. */
import { describe, expect, it } from "vitest";
import {
  CHILD_PROTECTION_HELPLINE_IDS,
  EMERGENCY_HELPLINE_IDS,
  HELPLINE_DIRECTORY,
  dangerLineFor,
  escalationCategories,
  helplineOrderFor,
} from "./escalation";
import { en, he } from "../lib/i18nElevation/safety";

const entry = (id: string) => HELPLINE_DIRECTORY.find((h) => h.id === id);

describe("B-CAREPRO-45 — the helpline directory", () => {
  it("Israel carries 118 (Ministry of Welfare, family violence and children at risk)", () => {
    expect(entry("il_welfare")).toEqual({ id: "il_welfare", region: "il", number: "118", tel: "118" });
  });

  it("every supported country has exactly one child-protection line, in its own region", () => {
    const regions = [...new Set(HELPLINE_DIRECTORY.map((h) => h.region))].filter((r) => r !== "eu");
    expect(Object.keys(CHILD_PROTECTION_HELPLINE_IDS).sort()).toEqual(regions.sort());
    for (const [region, id] of Object.entries(CHILD_PROTECTION_HELPLINE_IDS)) {
      const e = entry(id);
      expect(e, id).toBeTruthy();
      expect(e!.region).toBe(region);
      expect(EMERGENCY_HELPLINE_IDS.has(id)).toBe(false);
    }
    expect(entry("nl_veiligthuis")?.number).toBe("0800-2000");
    expect(entry("us_childhelp")?.number).toBe("1-800-422-4453");
    expect(entry("be_1712")?.number).toBe("1712");
  });

  it("same one-tap style: a dialable tel (digits and +), a label EN + HE", () => {
    for (const h of HELPLINE_DIRECTORY) {
      expect(h.tel, h.id).toMatch(/^\+?\d+$/);
      expect(en[`elev.safety.helpline.${h.id}`], h.id).toBeTruthy();
      expect(he[`elev.safety.helpline.${h.id}`], h.id).toBeTruthy();
    }
  });

  it("every directory number appears in the escalation copy (the two shapes cannot drift)", () => {
    const all = escalationCategories.map((c) => c.resources).join("\n");
    for (const h of HELPLINE_DIRECTORY) expect(all, h.id).toContain(h.number);
    const abuse = escalationCategories.find((c) => c.category === "abuse_or_unsafe_home")!.resources;
    expect(abuse).toMatch(/Israel — Ministry of Welfare hotline .*\*\*118\*\*/);
  });

  it("the crisis card's second call is unchanged: the talk line of each region still leads", () => {
    const talk = (hint: string) => {
      const order = helplineOrderFor(hint);
      const primary = HELPLINE_DIRECTORY.find((h) => h.region === order[0])!;
      return { primary: primary.id, danger: dangerLineFor(order, primary) };
    };
    expect(talk("he").primary).toBe("il_eran");
    expect(talk("nl").primary).toBe("nl_113");
    expect(talk("en-US").primary).toBe("us_988");
  });
});
