/**
 * B-SHELL-39 — the describe fields live ON the child doc (no new
 * sub-collection), so the GDPR export carries them with the profile and the
 * child-doc delete erases them. Context items are approved memory events,
 * which the server ledger export/erase already covers.
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { CHILD_SUBCOLLECTIONS, exportChildData } from "./childData";
import type { ChildProfile } from "../types";

vi.mock("./api", () => ({
  api: {
    privacyExport: async () => { throw new Error("offline"); },
    privacyErase: async () => { throw new Error("offline"); },
  },
}));

const child: ChildProfile = {
  id: "synthetic-describe-child", name: "Noa", age: 4, languages: ["English"], schoolContext: "", strengths: ["Funny"], challenges: ["Mornings are hard"],
  focusAreas: [{ id: "f1", words: "Getting dressed", domainId: "body", since: "2026-10-10", source: "describe", confirmedAt: "2026-10-10T09:00:00.000Z" }],
  parentPreferences: [{ id: "p1", words: "Keep ideas short", since: "2026-10-10", source: "describe", confirmedAt: "2026-10-10T09:00:00.000Z" }],
  describedItems: [{ id: "d1", kind: "worry", words: "Mornings are hard", domainId: "body", since: "2026-10-10", source: "describe", confirmedAt: "2026-10-10T09:00:00.000Z" }],
};

describe("B-SHELL-39 — export and erase include the describe fields", () => {
  it("the export carries focusAreas, parentPreferences and describedItems on the profile", async () => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
    const out = await exportChildData(undefined, child);
    expect(out.profile.focusAreas).toEqual(child.focusAreas);
    expect(out.profile.parentPreferences).toEqual(child.parentPreferences);
    expect(out.profile.describedItems).toEqual(child.describedItems);
    vi.unstubAllGlobals();
  });
  it("no describe sub-collection exists to escape the allow-list; the commit writes only the child doc and approved memory", () => {
    expect(CHILD_SUBCOLLECTIONS.some((name) => /describ/i.test(name))).toBe(false);
    const client = readFileSync(new URL("./describeChildClient.ts", import.meta.url), "utf8");
    expect(client).not.toMatch(/useChildCollection|collection\(/);
    expect(client).toContain("/api/memory/");
  });
});
