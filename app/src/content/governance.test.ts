import { describe, expect, it } from "vitest";
import {
  computeContentHash,
  isPublishableContent,
  isRenderableMilestoneMedia,
  type GovernedContentRecord,
  type ReviewableCopy,
} from "./governance";
import type { MilestoneExampleMedia } from "../types";

const NOW = new Date("2026-07-22");

const base: GovernedContentRecord = {
  id: "example", version: "1.0.0", ageBands: ["3-6"], domains: ["regulation"],
  concerns: ["regulation"],
  locales: ["en", "he"], safetyClass: "general-parenting", reviewStatus: "approved",
  reviewerRole: "clinical-content-reviewer", reviewedBy: "Dr. Noa Levi",
  reviewedAt: "2026-07-01", reviewDueAt: "2027-07-01",
  evidenceRefs: ["internal:parenting-framework"],
};

describe("content publishing gate", () => {
  it("allows only current, bilingual, reviewed records with provenance", () => {
    expect(isPublishableContent(base, NOW)).toBe(true);
    expect(isPublishableContent({ ...base, reviewStatus: "draft" }, NOW)).toBe(false);
    expect(isPublishableContent({ ...base, locales: ["en"] }, NOW)).toBe(false);
    expect(isPublishableContent({ ...base, reviewDueAt: "2026-07-01" }, NOW)).toBe(false);
    expect(isPublishableContent({ ...base, evidenceRefs: [] }, NOW)).toBe(false);
  });

  it("CONT-6 — a retired record NEVER publishes", () => {
    expect(isPublishableContent({ ...base, reviewStatus: "retired" }, NOW)).toBe(false);
  });

  it("CONT-1 — approval requires a NAMED reviewer, not just a role", () => {
    expect(isPublishableContent({ ...base, reviewedBy: "" }, NOW)).toBe(false);
    expect(isPublishableContent({ ...base, reviewedBy: "   " }, NOW)).toBe(false);
    // A role string pasted into the person field is not a named reviewer.
    expect(isPublishableContent({ ...base, reviewedBy: "clinical-content-reviewer" }, NOW)).toBe(false);
  });

  it("CONT-1 — reviewedAt must be a real date, not in the future, inside the window", () => {
    expect(isPublishableContent({ ...base, reviewedAt: "TBD" }, NOW)).toBe(false);
    expect(isPublishableContent({ ...base, reviewedAt: "" }, NOW)).toBe(false);
    expect(isPublishableContent({ ...base, reviewedAt: "2026-08-01" }, NOW)).toBe(false); // future
    expect(isPublishableContent({ ...base, reviewedAt: "2027-08-01", reviewDueAt: "2027-07-01" }, NOW)).toBe(false); // after due
  });

  it("CONT-1/CONT-6 — honest metadata is required: >=1 ageBand and >=1 concern", () => {
    expect(isPublishableContent({ ...base, ageBands: [] }, NOW)).toBe(false);
    expect(isPublishableContent({ ...base, concerns: [] }, NOW)).toBe(false);
  });
});

// CONT-1 — the content hash binds the approval stamp to the exact reviewed
// copy; any post-approval edit demotes the record.
const copy: ReviewableCopy = {
  title: { en: "Tantrum", he: "התקף זעם" },
  doNow: { en: "Lower your voice and stay close.", he: "הנמיכו את הקול והישארו קרובים." },
  sayThis: { en: "You're safe. I'm here.", he: "אתם בטוחים. אני כאן." },
  avoid: { en: "Do not reason mid-storm.", he: "אל תנסו לשכנע באמצע הסערה." },
  observe: { en: "Notice what happened just before.", he: "שימו לב מה קרה ממש לפני." },
  escalation: { en: "If anyone may be hurt, move to safety first.", he: "אם מישהו עלול להיפגע, עברו קודם למקום בטוח." },
};

describe("CONT-1 content-hash binding", () => {
  it("computeContentHash is deterministic and sensitive to every field and locale", () => {
    const stamp = computeContentHash(copy);
    expect(stamp).toBe(computeContentHash({ ...copy }));
    expect(computeContentHash({ ...copy, sayThis: { ...copy.sayThis, en: "edited" } })).not.toBe(stamp);
    expect(computeContentHash({ ...copy, sayThis: { ...copy.sayThis, he: "אחר" } })).not.toBe(stamp);
    expect(computeContentHash({ ...copy, escalation: { ...copy.escalation, en: "edited" } })).not.toBe(stamp);
  });

  it("publishes a stamped record whose copy is unchanged", () => {
    const stamped = { ...base, ...copy, contentHash: computeContentHash(copy) };
    expect(isPublishableContent(stamped, NOW)).toBe(true);
  });

  it("mutating sayThis.en after stamping fails publication", () => {
    const stamped = { ...base, ...copy, contentHash: computeContentHash(copy) };
    const edited = { ...stamped, sayThis: { ...stamped.sayThis, en: "Something else entirely." } };
    expect(isPublishableContent(edited, NOW)).toBe(false);
  });

  it("an approved record carrying copy but no stamp fails closed", () => {
    expect(isPublishableContent({ ...base, ...copy }, NOW)).toBe(false);
    expect(isPublishableContent({ ...base, ...copy, contentHash: "deadbeef" }, NOW)).toBe(false);
  });

  it("a partial copy record (some reviewed fields missing) fails closed", () => {
    const partial = { ...base, title: copy.title, sayThis: copy.sayThis, contentHash: computeContentHash(copy) };
    expect(isPublishableContent(partial, NOW)).toBe(false);
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
