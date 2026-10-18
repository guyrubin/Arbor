import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashQuery } from "./routes";
import { closeNoticeDetail, noticeMilestoneId, openNoticeDetail, openNoticeMoment, readNoticeTarget } from "./noticeNavigation";

describe("Notice object navigation", () => {
  const page = { location: { hash: "#/journal?shelf=words", href: "https://arbor.test/#/journal?shelf=words" }, history: { state: null, replaceState: vi.fn() }, dispatchEvent: vi.fn() };
  beforeEach(() => {
    vi.clearAllMocks();
    page.location.hash = "#/journal?shelf=words";
    vi.stubGlobal("window", page);
    vi.stubGlobal("HashChangeEvent", class { type: string; constructor(type: string) { this.type = type; } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("opens the same object with a child guard and exact originating shelf", () => {
    openNoticeDetail("child-a", "milestone-a", { editEvidence: true });
    expect(page.location.hash).toContain("/development?");
    const query = hashQuery(`#${page.location.hash}`);
    expect(readNoticeTarget(query, "child-a")).toEqual({ childId: "child-a", milestoneId: "milestone-a" });
    expect(query.get("return")).toBe("#/journal?shelf=words");
    expect(query.get("evidence")).toBe("edit");
  });

  it("never opens a different child's matching catalogue id after a child switch", () => {
    const query = new URLSearchParams({ child: "child-a", notice: "shared-catalogue-id" });
    expect(readNoticeTarget(query, "child-b")).toBeNull();
    expect(readNoticeTarget(new URLSearchParams({ notice: "shared-catalogue-id" }), "child-a")).toBeNull();
  });

  it("closes to an exact in-app origin and refuses an external or malformed return", () => {
    closeNoticeDetail(new URLSearchParams({ return: "#/timeline?view=areas&area=talking" }));
    expect(page.history.replaceState).toHaveBeenLastCalledWith(null, "", "#/timeline?view=areas&area=talking");
    for (const value of ["https://other.test/", "javascript:alert(1)", "#/unknown", "#/development?notice=a&child=child-a"]) {
      closeNoticeDetail(new URLSearchParams({ return: value }));
      expect(page.history.replaceState).toHaveBeenLastCalledWith(null, "", "#/development");
    }
    expect(page.dispatchEvent).toHaveBeenCalled();
  });

  it("maps only actual milestone or keepsake identities, retaining punctuation in ids", () => {
    expect(noticeMilestoneId("milestones", "milestones:custom:a")).toBe("custom:a");
    expect(noticeMilestoneId("keepsakes", "keepsakes:ms-18")).toBe("ms-18");
    expect(noticeMilestoneId("behaviorLogs", "behaviorLogs:ms-18")).toBeNull();
    expect(noticeMilestoneId("milestones", "keepsakes:ms-18")).toBeNull();
    expect(noticeMilestoneId("milestones", "milestones:")).toBeNull();
  });

  it("focuses a separate evidence record without creating an observed event", () => {
    openNoticeMoment("child-a", "keepsakes:milestone-a");
    const query = hashQuery(`#${page.location.hash}`);
    expect(page.location.hash).toContain("/timeline?");
    expect(query.get("child")).toBe("child-a");
    expect(query.get("observation")).toBe("keepsakes:milestone-a");
    expect(query.has("month")).toBe(false);
  });
});
