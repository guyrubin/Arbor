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
 * a longer word: `PAI/projects/…`, `CoS/decisions/…`, `guyrubin/ROS/blob/…`,
 * `ROS/.claude/…`. "IDEA/", "macOS/", "AREA/" are words, not ROS paths.
 */
const ROS_TREE_PATH = /(?<![A-Za-z0-9_.-])(?:ROS|PAI|CoS|EA|KK|HV|00_System)\//;
/** A Windows user profile, the WSL mount of one, or a ROS checkout under /home. */
const WORKSTATION_PATH = /[A-Za-z]:[\\/]{1,2}Users[\\/]{1,2}|\/mnt\/c\/Users\/|\/home\/[^/\s]+\/ROS\b/;

export const CONTENT_RULES: ContentRule[] = [
  {
    id: "ros-tree-path",
    re: ROS_TREE_PATH,
    why: "cites a path in the private ROS tree or repo; cite an in-repo path or name the source in words",
  },
  {
    id: "workstation-path",
    re: WORKSTATION_PATH,
    why: "an absolute path on a maintainer's machine; use a repo-relative path",
  },
];

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
    ];
    for (const line of clean) {
      expect(scanText("fixture.md", line), line).toEqual([]);
    }
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
