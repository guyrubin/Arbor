import { describe, expect, it } from "vitest";
import { isPublishableContent, isRenderableMilestoneMedia, type GovernedContentRecord } from "./governance";
import type { MilestoneExampleMedia } from "../types";

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

// UND-7 (AR-CAP-08/AR-CONT-07) — the governed milestone example-media gate
// mirrors the AR-CONT-01 pattern above and FAILS CLOSED: missing reviewer or
// rightsRef (or any absent/blank/unknown field) never renders.
const media: MilestoneExampleMedia = {
  kind: "illustration",
  src: "/media/milestones/example.svg",
  alt: "A toddler stacking two blocks on a rug",
  credit: "Arbor illustration team",
  rightsRef: "rights:arbor-2026-0001",
  reviewer: "clinical-content-reviewer",
  reviewedAt: "2026-07-01",
  locale: "en",
};

describe("milestone example-media gate (fail-closed)", () => {
  it("renders only a fully governed record", () => {
    expect(isRenderableMilestoneMedia(media)).toBe(true);
    expect(isRenderableMilestoneMedia({ ...media, kind: "video", locale: "he" })).toBe(true);
  });

  it("never renders without a named reviewer", () => {
    expect(isRenderableMilestoneMedia({ ...media, reviewer: "" })).toBe(false);
    expect(isRenderableMilestoneMedia({ ...media, reviewer: "   " })).toBe(false);
    expect(isRenderableMilestoneMedia({ ...media, reviewer: undefined as unknown as string })).toBe(false);
  });

  it("never renders without a rights reference", () => {
    expect(isRenderableMilestoneMedia({ ...media, rightsRef: "" })).toBe(false);
    expect(isRenderableMilestoneMedia({ ...media, rightsRef: "  " })).toBe(false);
    expect(isRenderableMilestoneMedia({ ...media, rightsRef: undefined as unknown as string })).toBe(false);
  });

  it("fails closed on absent or malformed records", () => {
    expect(isRenderableMilestoneMedia(undefined)).toBe(false);
    expect(isRenderableMilestoneMedia(null)).toBe(false);
    expect(isRenderableMilestoneMedia({ ...media, kind: "gif" as never })).toBe(false);
    expect(isRenderableMilestoneMedia({ ...media, src: "" })).toBe(false);
    expect(isRenderableMilestoneMedia({ ...media, alt: "" })).toBe(false);
    expect(isRenderableMilestoneMedia({ ...media, credit: "" })).toBe(false);
    expect(isRenderableMilestoneMedia({ ...media, reviewedAt: "" })).toBe(false);
    expect(isRenderableMilestoneMedia({ ...media, locale: "fr" as never })).toBe(false);
  });
});
