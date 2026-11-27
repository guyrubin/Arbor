// B-CAREPRO-51 + B-SHELL-42: the sharing/care-team/switcher evidence harness keeps its cells on
// the matrix of record, writes synthetic grants to a loopback sandbox only, and its verdicts
// fail on the defects they exist to catch.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEVICE_VIEWPORTS } from "./capture/release-config.mjs";
import {
  SHARING_CELLS, SWITCHER_CELLS, SYNTHETIC_RECIPIENTS, assertLoopbackBase, boxInside, routeVerdict, switcherVerdict, syntheticGrants,
} from "./capture/sharing-care-contract.mjs";

const scripts = path.dirname(fileURLToPath(import.meta.url));
const runner = readFileSync(path.join(scripts, "sharing-care-browser.mjs"), "utf8");
const cell = (id: string) => DEVICE_VIEWPORTS.find((v) => v.id === id)!;

describe("sharing-care harness · cells", () => {
  it("takes 375/1280 × EN/HE for Sharing and adds the 390 phone box for the switcher, from DEVICE_VIEWPORTS", () => {
    expect(SHARING_CELLS.map((c) => `${c.w}-${c.lang}`)).toEqual(["375-en", "375-he", "1280-en", "1280-he"]);
    expect(SWITCHER_CELLS).toContain(cell("safari-he"));
    expect(SWITCHER_CELLS).toContain(cell("safari-en"));
    for (const c of [...SHARING_CELLS, ...SWITCHER_CELLS]) expect(DEVICE_VIEWPORTS).toContain(c);
  });

  it("restates no viewport size in the runner", () => {
    expect(runner).not.toMatch(/\b(375|390|1280|812|664|800)\b/);
  });
});

describe("sharing-care harness · synthetic, loopback only", () => {
  it("grants go to reserved example.com recipients: a co-parent on the week, a professional on one report", () => {
    const grants = syntheticGrants("child-x", "Name");
    expect(grants.map((g) => g.role)).toEqual(["co_parent", "professional"]);
    expect(Object.values(SYNTHETIC_RECIPIENTS).every((e) => e.endsWith("@example.com"))).toBe(true);
    expect(() => syntheticGrants("", "Name")).toThrow("SHARING_CARE_CHILD_REQUIRED");
  });

  it("refuses any base that is not a loopback http origin", () => {
    expect(assertLoopbackBase("http://127.0.0.1:4805/")).toBe("http://127.0.0.1:4805");
    expect(assertLoopbackBase("http://localhost:3000")).toBe("http://localhost:3000");
    expect(() => assertLoopbackBase("https://arbor.example.com")).toThrow("SHARING_CARE_BASE_NOT_LOOPBACK");
    expect(() => assertLoopbackBase("http://10.0.0.5:4805")).toThrow("SHARING_CARE_BASE_NOT_LOOPBACK");
    expect(() => assertLoopbackBase("not a url")).toThrow("SHARING_CARE_BASE_INVALID");
  });
});

describe("sharing-care harness · verdicts", () => {
  const phone = cell("safari-he");
  const control = (over: Record<string, unknown> = {}) => ({ x: 150, y: 70, width: 186, height: 56, label: "c", hit: true, clipped: false, ...over });
  const list = { x: 138, y: 60, width: 200, height: 268, scrollWidth: 198, clientWidth: 198 };

  it("passes the measured 390 HE list (b6f23ca0: x 138, w 200)", () => {
    expect(switcherVerdict({ list, controls: [control(), control(), control()] }, phone)).toEqual({ pass: true, problems: [] });
  });

  it("fails the pre-b6f23ca0 end-anchored list that hung past the screen edge", () => {
    const off = { ...list, x: 250 };
    const v = switcherVerdict({ list: off, controls: [control({ x: 260 }), control(), control()] }, phone);
    expect(v.pass).toBe(false);
    expect(v.problems).toEqual(expect.arrayContaining(["list leaves the viewport", 'control "c" leaves the viewport']));
  });

  it("fails a covered, short or clipped control and a closed list", () => {
    expect(switcherVerdict({ list, controls: [control({ hit: false }), control({ height: 40 }), control({ clipped: true })] }, phone).problems).toHaveLength(3);
    expect(switcherVerdict({}, phone).pass).toBe(false);
    expect(boxInside({ x: 0, y: 0, width: phone.w, height: 10 }, phone, 16)).toBe(false);
  });

  it("route verdict needs the grants on both the roster and who-sees-what, and no error or overflow", () => {
    const emails = ["a@example.com"];
    const ok = { h1: "h", roster: true, errorState: false, scrollWidth: 375, clientWidth: 375, offscreen: [], rosterEmails: emails, laneEmails: ["Aa@example.comCo-parent"] };
    expect(routeVerdict(ok, emails).pass).toBe(true);
    expect(routeVerdict({ ...ok, errorState: true, roster: false }, emails).pass).toBe(false);
    expect(routeVerdict({ ...ok, scrollWidth: 420 }, emails).pass).toBe(false);
    expect(routeVerdict({ ...ok, laneEmails: [] }, emails).pass).toBe(false);
  });
});
