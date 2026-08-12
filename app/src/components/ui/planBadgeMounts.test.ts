/**
 * Masterplan 3.6 — PlanBadge W5 mounts. The badge component itself is pinned
 * by PlanBadge.test.ts; these are render-scan guards that the two W5 mount
 * points actually carry it (a built-but-unmounted badge is the exact defect
 * class the masterplan triages).
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC_ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");

describe("SettingsModal — plan rows carry the badge", () => {
  const src = read("components/layout/SettingsModal.tsx");

  it("imports the shared PlanBadge (no hand-rolled chip)", () => {
    expect(src).toMatch(/import \{ PlanBadge \} from "\.\.\/ui\/PlanBadge"/);
  });

  it("mounts plan=\"plus\" and plan=\"family\" badges", () => {
    expect(src).toContain('<PlanBadge plan="plus" />');
    expect(src).toContain('<PlanBadge plan="family" />');
  });
});

describe("AddChildModal — the at-limit state names its gate", () => {
  const src = read("components/profile/AddChildModal.tsx");

  it("imports the shared PlanBadge", () => {
    expect(src).toMatch(/import \{ PlanBadge \} from "\.\.\/ui\/PlanBadge"/);
  });

  it("mounts the feature-resolved badge (maxChildren → plus, pinned server-side)", () => {
    expect(src).toContain('<PlanBadge feature="maxChildren" />');
  });

  it("the badge sits inside the at-limit branch, before the wizard renders", () => {
    const limitBranch = src.slice(src.indexOf("if (atChildLimit)"), src.indexOf("ac.titleStep"));
    expect(limitBranch).toContain('<PlanBadge feature="maxChildren" />');
  });
});
