import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { DOMAIN_IDS } from "./domains/registry";
import { SHELF_IDS } from "./shelves/registry";
import { DOMAIN_ART, EMPTY_ART, SHELF_ART, allParentArtFiles } from "./parentArt";

const publicDir = path.resolve(__dirname, "../../public");
const provenance = path.resolve(__dirname, "../../../docs/design/parent-art-v2.json");

describe("parent art (P7-DESIGN illustrations)", () => {
  it("covers every shelf and every domain", () => {
    expect(Object.keys(SHELF_ART).sort()).toEqual([...SHELF_IDS].sort());
    expect(Object.keys(DOMAIN_ART).sort()).toEqual([...DOMAIN_IDS].sort());
    expect(DOMAIN_ART.body.src).not.toBe(SHELF_ART.food.src);
    expect(DOMAIN_ART.body.src).not.toBe(SHELF_ART.sleep.src);
  });

  it("every referenced file exists on disk, as WebP, under 160 KB", () => {
    const files = allParentArtFiles();
    expect(files.length).toBeGreaterThanOrEqual(2 * (SHELF_IDS.length + Object.keys(EMPTY_ART).length));
    const missing = files.filter((f) => !existsSync(path.join(publicDir, f.slice(1))));
    expect(missing).toEqual([]);
    for (const f of files) {
      expect(f.endsWith(".webp")).toBe(true);
      expect(statSync(path.join(publicDir, f.slice(1))).size).toBeLessThan(160 * 1024);
    }
  });

  it("the matcher is not vacuous: a made-up path is reported missing", () => {
    expect(existsSync(path.join(publicDir, "visuals/parent/v2/area-nope-480.webp"))).toBe(false);
  });

  it("every shipped picture has a provenance entry with its prompt", () => {
    const record = JSON.parse(readFileSync(provenance, "utf8")) as { model: string; assets: { file: string; prompt: string }[] };
    expect(record.model).toBe("Built-in image generation (model identifier not exposed)");
    const recorded = new Set(record.assets.map((a) => a.file));
    const stems = new Set(allParentArtFiles().map((f) => path.basename(f).replace(/-(480|960)\.webp$/, "")));
    for (const stem of stems) expect(recorded.has(stem)).toBe(true);
    for (const a of record.assets) expect(a.prompt.length).toBeGreaterThan(80);
  });
});
