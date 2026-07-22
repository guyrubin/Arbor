import { describe, expect, it } from "vitest";
import { isPublishableContent, type GovernedContentRecord } from "./governance";

const base: GovernedContentRecord = {
  id: "example", version: "1.0.0", ageBands: ["3-6"], domains: ["regulation"],
  locales: ["en", "he"], safetyClass: "general-parenting", reviewStatus: "approved",
  reviewerRole: "clinical-content-reviewer", reviewedAt: "2026-07-01", reviewDueAt: "2027-07-01",
  evidenceRefs: ["internal:parenting-framework"],
};

describe("content publishing gate", () => {
  it("allows only current, bilingual, reviewed records with provenance", () => {
    expect(isPublishableContent(base, new Date("2026-07-22"))).toBe(true);
    expect(isPublishableContent({ ...base, reviewStatus: "draft" }, new Date("2026-07-22"))).toBe(false);
    expect(isPublishableContent({ ...base, locales: ["en"] }, new Date("2026-07-22"))).toBe(false);
    expect(isPublishableContent({ ...base, reviewDueAt: "2026-07-01" }, new Date("2026-07-22"))).toBe(false);
  });
});
