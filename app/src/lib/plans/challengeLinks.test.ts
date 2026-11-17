/**
 * N-Challenge-D: with a Challenge plan open, the shell's breadcrumb ends with
 * the plan ("Now › Plans › {plan}"); Plans' home sets no last level.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openChallengeName, readChallengeQuery } from "./challengeLinks";
import { getPattern } from "../library/plans/planBooks";

const dropoff = getPattern("plan-dropoff")!;
const sleep = getPattern("plan-sleep-alone")!;
const running = [{ def: dropoff }];
const q = (s: string) => readChallengeQuery(new URLSearchParams(s));

describe("openChallengeName (the breadcrumb's last level)", () => {
  it("Plans' home names nothing", () => {
    expect(openChallengeName(q(""), running, undefined, "en")).toBeNull();
  });
  it("the plan's page names the plan it shows, in the reader's language", () => {
    expect(openChallengeName(q("challenge=plan-dropoff"), running, undefined, "en")).toBe(dropoff.title.en);
    expect(openChallengeName(q("challenge=plan-dropoff"), running, undefined, "he")).toBe(dropoff.title.he);
    // the list leads with the newest running plan; with none running it names nothing
    expect(openChallengeName(q("challenge=all"), running, undefined, "en")).toBe(dropoff.title.en);
    expect(openChallengeName(q("challenge=all"), [], undefined, "en")).toBeNull();
  });
  it("the composer names the pattern it composes; the parent copy names its plan", () => {
    expect(openChallengeName(q("challenge=plan-sleep-alone"), running, sleep, "en")).toBe(sleep.title.en);
    expect(openChallengeName(q("challenge=plan-dropoff&printout=1"), running, undefined, "en")).toBe(dropoff.title.en);
    expect(openChallengeName(q("challenge=plan-sleep-alone&printout=1"), running, undefined, "en")).toBeNull();
  });
  it("Plans sets the crumb from it (and the hook clears it when Plans unmounts)", () => {
    const src = readFileSync(join(__dirname, "../../components/tabs/PlansTab.tsx"), "utf8");
    expect(src).toMatch(/useShellCrumb\(openChallengeName\(target, running, composerDef, /);
  });
});
