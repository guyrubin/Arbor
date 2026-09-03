/**
 * W1 guard — the retired bundle id never returns to the native projects.
 *
 * The ratified store identity is com.arborparenting.app (Decision #6a). Cap
 * sync only rewrites the generated capacitor.config.json copies — it never
 * touches build.gradle, strings.xml, the Xcode project, or fastlane — so a
 * regenerated or reverted native file can silently reintroduce the old
 * app.arbor.family id and split the store listing. This guard greps every
 * git-tracked file under app/android, app/ios and app/capacitor.config.ts
 * (tracked files only, so build output and CocoaPods artifacts are ignored).
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const RETIRED_BUNDLE_ID = "app.arbor.family";
const RATIFIED_BUNDLE_ID = "com.arborparenting.app";

const trackedNativeFiles = (): string[] =>
  execFileSync("git", ["ls-files", "-z", "android", "ios", "capacitor.config.ts"], {
    cwd: appDir,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);

describe("W1 — retired bundle id is gone from the native projects", () => {
  it(`no tracked native file mentions ${RETIRED_BUNDLE_ID}`, () => {
    const offenders: string[] = [];
    for (const rel of trackedNativeFiles()) {
      const src = readFileSync(path.join(appDir, rel), "utf8");
      src.split("\n").forEach((line, i) => {
        // Matches the id in dotted form and as a java package path segment.
        if (line.includes(RETIRED_BUNDLE_ID) || line.includes("app/arbor/family")) {
          offenders.push(`${rel}:${i + 1}`);
        }
      });
    }
    expect(
      offenders,
      `retired bundle id "${RETIRED_BUNDLE_ID}" found — replace with ${RATIFIED_BUNDLE_ID}:\n${offenders.join("\n")}`
    ).toEqual([]);
  });

  it("the ratified id is wired into the files cap sync never touches", () => {
    const mustCarryId = [
      "android/app/build.gradle",
      "android/app/src/main/res/values/strings.xml",
      "ios/App/App.xcodeproj/project.pbxproj",
      "capacitor.config.ts",
    ];
    for (const rel of mustCarryId) {
      const src = readFileSync(path.join(appDir, rel), "utf8");
      expect(src, `${rel} must carry ${RATIFIED_BUNDLE_ID}`).toContain(RATIFIED_BUNDLE_ID);
    }
  });
});
