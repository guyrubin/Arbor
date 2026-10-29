/**
 * B-INF-15 — the public app repo never points into the private ROS tree.
 *
 * This repository is public. A tracked file that cites a path inside the
 * private ROS tree (a domain folder, a ROS repo link) or an absolute path on a
 * maintainer's machine cannot be followed by anyone reading the repo, and it
 * advertises private structure. Every git-tracked text file in the whole repo
 * (docs, source comments, scripts, JSON records) is scanned; binaries are
 * skipped. A hit names the file, the line and the rule.
 *
 * Fix a hit by citing an in-repo path (`app/PRODUCT.md`, `docs/adr/…`) or by
 * naming the source in words ("the Steady Nights v0.1 program document, kept
 * in the private product record"). There is no allow-list beyond this file:
 * the residue only shrinks, and it is zero.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(appDir, "..");
const SELF = "app/scripts/publicRepoGuard.test.ts";

interface ContentRule {
  id: string;
  re: RegExp;
  why: string;
}

/**
 * ROS domain roots (and ROS itself), as a path segment that is not the tail of
 * a longer word, with either separator or URL-encoded: `PAI/projects/…`,
 * `CoS/decisions/…`, `ROS\PAI\…`, `PAI%2Fprojects`, `ROS/.claude/…`; any case
 * of `pai/projects`; a link to the private ROS repo in any case
 * (`github.com/guyrubin/ros`). "IDEA/", "macOS/", "AREA/" are words.
 */
const ROS_TREE_PATH =
  /(?<![A-Za-z0-9_.-])(?:ROS|PAI|CoS|EA|KK|HV|00_System)(?:[\\/]|%2F)|(?<![A-Za-z0-9_.-])[Pp][Aa][Ii](?:[\\/]|%2[Ff])projects\b|github\.com\/[^/\s)]+\/[Rr][Oo][Ss]\b/;
/**
 * The private tree's own shapes, even with the domain root cut off: a dated
 * execution folder (`execution/2026-10-07--…`), the BD folder (`bd/ARBOR-…`),
 * a project folder (`projects/arbor/…`). A cloud path such as
 * `projects/arbor-prod/traces/…` is not one.
 */
const ROS_TREE_SHAPE =
  /(?<![A-Za-z0-9_.-])execution[\\/]20\d\d-\d\d-\d\d--|(?<![A-Za-z0-9_.-])bd[\\/][A-Za-z]|(?<![A-Za-z0-9_.-])projects[\\/]arbor[\\/]/;
/** A Windows user profile, the WSL mount or share of one, or a ROS checkout under /home (either separator). */
const WORKSTATION_PATH = /[A-Za-z]:[\\/]{1,2}Users[\\/]{1,2}|[\\/]mnt[\\/]c[\\/]Users[\\/]|\\\\wsl\$|[\\/]home[\\/][^\\/\s]+[\\/]ROS\b/;
/** BD-45: the BD workspace folder and its two tell-tale data files, as a path or a link. */
const PRIVATE_BD_PATH = /(?:^|[\s/(`"'\[])business-development\/|outreach-drafts[\w-]*\.md|gtm-data-v\d/;

export const CONTENT_RULES: ContentRule[] = [
  {
    id: "ros-tree-path",
    re: ROS_TREE_PATH,
    why: "cites a path in the private ROS tree or repo; cite an in-repo path or name the source in words",
  },
  {
    id: "ros-tree-shape",
    re: ROS_TREE_SHAPE,
    why: "cites a private ROS folder by its shape (dated execution folder, bd/, projects/arbor/); name the source in words",
  },
  {
    id: "workstation-path",
    re: WORKSTATION_PATH,
    why: "an absolute path on a maintainer's machine; use a repo-relative path",
  },
  {
    id: "private-bd",
    re: PRIVATE_BD_PATH,
    why: "private business-development material (strategy, partners, pipeline, unsent outreach) stays out of the public repo",
  },
];

/** BD-45: a tracked file whose own path is private BD material. */
export const isPrivateBdPath = (rel: string): boolean => PRIVATE_BD_PATH.test(rel);

const BINARY_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".icns", ".mp3", ".m4a", ".wav", ".ogg", ".mp4", ".webm",
  ".woff", ".woff2", ".ttf", ".otf", ".pdf", ".zip", ".gz", ".jar", ".keystore", ".wasm", ".riv", ".glb",
]);

const trackedFiles = (): string[] =>
  execFileSync("git", ["ls-files", "-z"], { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
    .split("\0")
    .filter(Boolean);

function readText(rel: string): string | null {
  if (BINARY_EXT.has(path.extname(rel).toLowerCase())) return null;
  let buf: Buffer;
  try {
    buf = readFileSync(path.join(repoRoot, rel));
  } catch {
    return null; // a tracked file deleted in the working tree is not content
  }
  if (buf.subarray(0, 8000).includes(0)) return null;
  return buf.toString("utf8");
}

/** Every rule hit in `text`, as `rel:line [rule] excerpt`. */
export function scanText(rel: string, text: string, rules: ContentRule[] = CONTENT_RULES): string[] {
  const hits: string[] = [];
  text.split("\n").forEach((line, i) => {
    for (const rule of rules) {
      const m = rule.re.exec(line);
      if (m) {
        const start = Math.max(0, m.index - 30);
        hits.push(`${rel}:${i + 1} [${rule.id}] …${line.slice(start, m.index + 60).trim()}…`);
      }
    }
  });
  return hits;
}

describe("B-INF-15 — no tracked file points into the private ROS tree", () => {
  it("the rules catch the residue shapes this repo carried", () => {
    const residue = [
      "program document PAI/projects/arbor/PROGRAM-STEADY-NIGHTS-v0.1.md",
      "as ratified by `CoS/decisions/log.md` on 11 October",
      "[P1](https://github.com/guyrubin/ROS/blob/main/PAI/projects/arbor/packs/P1.md#L22)",
      "The ai-eval-harness skill (ROS/.claude/skills/ai-eval-harness/SKILL.md)",
      "**Author:** EA/PAI review",
      "see 00_System/routing.md",
      "\"C:/Users/someone/ROS/Arbor/app/src/lib/i18n.ts\"",
      "cd C:\\Users\\someone\\ROS\\.workspace\\app",
      "/mnt/c/Users/someone/ROS",
      "/home/someone/ROS/PAI",
      // B-INF-15 round 2: the shapes the critic's probe found missing.
      "Source: execution/2026-10-07--design-direction/option-ab-blend.html",
      "the headline in bd/ARBOR-GTM-PLAN.md",
      "projects/arbor/reference/kid-books-standard.md",
      "arbor/execution/2026-10-01--one-backlog/lane-ASKJB.md",
      "ROS\\PAI\\projects\\arbor\\STATUS.md",
      "\\\\wsl$\\Ubuntu\\home\\someone\\ROS",
      "github.com/guyrubin/ros/blob/main/x.md",
      "pai/projects/arbor/x.md",
      "[link](PAI%2Fprojects%2Farbor)",
      "- `docs/business-development/README.md` - strategic GTM and partnerships v2",
      "[Outreach drafts](outreach-drafts-en-he.md)",
      "[Portable workbook model](gtm-data-v2.json)",
    ];
    for (const line of residue) {
      expect(scanText("fixture.md", line), line).not.toEqual([]);
    }
  });

  it("the rules leave ordinary words and public links alone", () => {
    const clean = [
      "IDEA/notes and AREA/plan and macOS/iOS builds",
      "Release PR: [#111](https://github.com/guyrubin/Arbor/pull/111)",
      "app/src/lib/i18n.ts and docs/adr/0001.md",
      "the ROS decision of 11 October (private record)",
      "/home/runner/work/arbor/arbor/app",
      "KKEA/ and xHV/ are not domain roots",
      "projects/arbor-prod/traces/abc and kbd/shortcut and the execution/ folder",
      "business development is Guy's half; see docs/marketing-domain-israel.md",
    ];
    for (const line of clean) {
      expect(scanText("fixture.md", line), line).toEqual([]);
    }
  });

  it("BD-45: no tracked file sits at a private business-development path", () => {
    expect(isPrivateBdPath("docs/business-development/strategy-he.md")).toBe(true);
    expect(isPrivateBdPath("docs/marketing-domain-israel.md")).toBe(false);
    const offenders = trackedFiles().filter(isPrivateBdPath);
    expect(offenders, `private BD material tracked in the public repo:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("every tracked text file cites only in-repo paths", () => {
    const offenders: string[] = [];
    for (const rel of trackedFiles()) {
      if (rel === SELF) continue;
      const text = readText(rel);
      if (text === null) continue;
      offenders.push(...scanText(rel, text));
    }
    expect(offenders, `private-tree references in the public repo:\n${offenders.join("\n")}`).toEqual([]);
  });
});
