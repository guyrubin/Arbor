/**
 * M4 — persistence honesty (kids gauntlet, 22 Sep 2026).
 *
 * The hero is stored inline in the child document. Two ways that used to fail
 * quietly, both pinned here:
 *   1. the write patch — `photoUrl` WITHOUT `avatar` metadata is not a hero at
 *      all (resolveHeroUrl returns null), so the two fields travel together;
 *   2. the failed write — ProfileContext.updateChild caught the Firestore error
 *      and returned void, so a lost hero looked saved until the next reload. It
 *      now reports the failure and every caller says so out loud.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ChildProfile } from "../../types";
import { heroPatch, persistHero } from "./heroPersistence";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => readFileSync(path.join(__dirname, "..", ...p), "utf8");

const RESULT = { dataUrl: "data:image/jpeg;base64,AAAA", style: "comichero" as const, source: "descriptor" as const };
const now = () => new Date("2026-09-22T10:00:00.000Z");

describe("heroPatch", () => {
  it("writes the image AND the metadata that makes it a hero", () => {
    expect(heroPatch(RESULT, now)).toEqual({
      photoUrl: RESULT.dataUrl,
      avatar: { style: "comichero", source: "descriptor", createdAt: "2026-09-22T10:00:00.000Z" },
    });
  });

  it("is the same shape the profile drawer already writes", () => {
    const drawer = read("profile", "ProfileEditDrawer.tsx");
    expect(drawer).toContain("photoUrl: photoUrl || \"\"");
    expect(drawer).toContain("setAvatarMeta({ style, source, createdAt: new Date().toISOString() })");
  });
});

describe("persistHero", () => {
  it("reports success when the write lands", async () => {
    const updateChild = vi.fn(async () => true);
    await expect(persistHero("c1", RESULT, { updateChild, now })).resolves.toBe(true);
    expect(updateChild).toHaveBeenCalledWith("c1", heroPatch(RESULT, now));
  });

  it("reports FAILURE when the child-doc write fails", async () => {
    const updateChild = vi.fn(async () => false);
    await expect(persistHero("c1", RESULT, { updateChild, now })).resolves.toBe(false);
  });

  it("treats a legacy void-returning updateChild as success (no behaviour change)", async () => {
    const updateChild = vi.fn(async () => undefined);
    await expect(persistHero("c1", RESULT, { updateChild, now })).resolves.toBe(true);
  });
});

describe("a failed child-doc write is visible to the parent", () => {
  it("ProfileContext.updateChild reports the failure instead of swallowing it", () => {
    const ctx = read("..", "context", "ProfileContext.tsx");
    expect(ctx).toContain("updateChild: (id: string, patch: Partial<ChildProfile>) => Promise<boolean>;");
    expect(ctx).toMatch(/} catch \{[\s\S]{0,400}persisted = false;/);
    expect(ctx).toContain("return persisted;");
    // The local state update still happens — the parent keeps editing what
    // they can see; only the silence is gone.
    expect(ctx).toMatch(/setProfiles\(\(prev\) => prev\.map[\s\S]{0,120}\);\s*\n\s*return persisted;/);
  });

  it("the profile drawer raises an error toast and stays open", () => {
    const drawer = read("profile", "ProfileEditDrawer.tsx");
    expect(drawer).toContain("const persisted = await updateChild(activeChild.id, {");
    expect(drawer).toMatch(/if \(!persisted\) \{\s*\n\s*toast\(t\("elev\.hero\.saveProfile\.failed"\), "error"\);\s*\n\s*return;/);
  });

  it("the Kid Mode hero step raises an error toast and does not hand over on a lost save", () => {
    const step = read("kidmode", "HeroFirstStep.tsx");
    expect(step).toMatch(/const persisted = await persistHero\(childId, result, \{ updateChild \}\);\s*\n\s*if \(!persisted\) \{\s*\n\s*toast\(t\("elev\.hero\.save\.failed"\), "error"\);\s*\n\s*return;/);
    // onEnterKidMode is reached only past that guard.
    expect(step).toMatch(/return;\s*\n\s*\}\s*\n\s*onEnterKidMode\(\);/);
  });

  it("the hero leaves the creator already inside the byte budget", () => {
    const creator = read("profile", "AvatarCreator.tsx");
    expect(creator).toContain('import { fileToThumbnail, shrinkDataUrlToBudget } from "../../lib/image";');
    expect(creator).toMatch(/await shrinkDataUrlToBudget\(draft\.dataUrl\)[\s\S]{0,400}onCreated\(\{ dataUrl,/);
  });
});
