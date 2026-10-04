/**
 * B-CAREPRO-08 — every Plus bullet names something a server gate guards.
 *
 * The Plus list sold "Professional reports and school handoffs" while every
 * packet and all ten PDFs build client-side with no entitlement check
 * (Reports.tsx, AskSpecialist.tsx) — a free parent already had them. The only
 * Care gate is `requirePlusFeature(..., "professionalReports", ...)` on
 * /api/generate-handoff: the AI-drafted School Brief. A claim must map to a
 * PlanLimits key whose Plus value differs from Free, and gate-shaped keys must
 * have their server call site.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { en, he } from "./i18nElevation/planclarity";
import { PLAN_LIMITS, type PlanLimits } from "../server/entitlements";

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");

/** Plus bullet → the PlanLimits key that makes it true. */
const PLUS_CLAIMS: Record<string, keyof PlanLimits> = {
  "elev.plan.plus.1": "coachMessagesPerDay",
  "elev.plan.plus.2": "professionalReports",
  "elev.plan.plus.3": "advancedPlans",
  "elev.plan.plus.4": "maxChildren",
};

/** Where the server enforces each key (a missing entry = client-only). */
const SERVER_ENFORCEMENT: Partial<Record<keyof PlanLimits, { file: string; needle: string }[]>> = {
  professionalReports: [{ file: "server/createApp.ts", needle: 'app.use("/api/generate-handoff", requirePlusFeature(entitlementStore, "professionalReports"' }],
  advancedPlans: [{ file: "server/createApp.ts", needle: 'app.use("/api/generate-plan", requirePlusFeature(entitlementStore, "advancedPlans"' }],
  coachMessagesPerDay: [{ file: "server/aiQuota.ts", needle: "entitlement.limits.coachMessagesPerDay" }],
};

const plusBulletKeys = Object.keys(en).filter((k) => /^elev\.plan\.plus\.\d+$/.test(k)).sort();

describe("B-CAREPRO-08 · every Plus bullet maps to a gate", () => {
  it("the bullet list is real (non-vacuity) and every bullet is mapped", () => {
    expect(plusBulletKeys.length).toBeGreaterThanOrEqual(4);
    for (const k of plusBulletKeys) expect(PLUS_CLAIMS[k], `${k} sells something no gate guards`).toBeTruthy();
  });

  it("each mapped key is a real PlanLimits key where Plus differs from Free", () => {
    for (const [bullet, key] of Object.entries(PLUS_CLAIMS)) {
      expect(key in PLAN_LIMITS.plus, `${bullet} → ${key} is not a PlanLimits key`).toBe(true);
      expect(PLAN_LIMITS.plus[key], `${bullet} → ${key} is not a Plus-over-Free difference`).not.toEqual(PLAN_LIMITS.free[key]);
    }
  });

  it("gate-shaped keys are enforced at their server call site", () => {
    for (const [key, sites] of Object.entries(SERVER_ENFORCEMENT)) {
      for (const site of sites!) expect(read(site.file), `${key} not enforced in ${site.file}`).toContain(site.needle);
    }
    // the Care claim is enforced server-side, specifically
    expect(SERVER_ENFORCEMENT[PLUS_CLAIMS["elev.plan.plus.2"]]).toBeTruthy();
  });

  it("the Care bullet sells the AI-drafted school note, not the free packets and PDFs (EN + HE)", () => {
    expect(en["elev.plan.plus.2"]).toBe("AI-drafted school notes");
    expect(en["elev.plan.plus.2"]).not.toMatch(/report/i);
    expect(he["elev.plan.plus.2"]).not.toContain("דוחות");
    expect(he["elev.plan.plus.2"]).toMatch(/[֐-׿]/);
    // NEGATIVE CONTROL: the pre-change bullet fails the same rule.
    expect("Professional reports and school handoffs").toMatch(/report/i);
  });

  it("the professionalReports paywall body is aligned to the same claim", () => {
    // B-SHELL-11: the body is chosen by paywallModel.paywallBody; the
    // professionalReports trigger still resolves to the school-note line.
    const model = read("components/billing/paywallModel.ts");
    expect(model).toContain('case "professionalReports": return { key: "pw.bodySchoolNotes", source: "planclarity" };');
    const modal = read("components/billing/PaywallModal.tsx");
    expect(modal).toContain('bodyRef.source === "planclarity" ? pc(bodyRef.key)');
    expect(modal).not.toContain('t("pw.bodyReports")');
    expect(en["elev.plan.pw.bodySchoolNotes"]).not.toMatch(/report/i);
    expect(he["elev.plan.pw.bodySchoolNotes"]).toMatch(/[֐-׿]/);
  });
});
