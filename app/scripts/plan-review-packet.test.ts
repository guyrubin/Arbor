/**
 * B-GA-37 — the committed review packets are exactly what the generator
 * renders from the pattern definitions (a content change without a packet
 * regeneration fails here, so a signed hash can never silently drift); every
 * visible string of a pattern is in its packet with its hash; the packet hash
 * changes when any one string changes; synthetic names only.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { contentHash, packetFiles, packetHash, renderPacket, visibleStrings } from "./plan-review-packet";
import { authoredPatterns } from "../src/lib/library/plans/planBooks";

const ROOT = resolve(__dirname, "../..");

describe("the review packets", () => {
  it("are committed and exactly match the generator (run `npm run plans:packet` after any content change)", () => {
    for (const f of packetFiles()) {
      const abs = resolve(ROOT, f.path);
      expect(existsSync(abs), `${f.path} missing — run npm run plans:packet`).toBe(true);
      expect(readFileSync(abs, "utf8"), `${f.path} is stale — run npm run plans:packet`).toBe(f.content);
    }
  });

  it("list every visible string of the pattern with its hash, in both languages, and the packet hash is bound to the strings", () => {
    for (const def of authoredPatterns()) {
      for (const lang of ["en", "he"] as const) {
        const rows = visibleStrings(def, lang);
        const packet = renderPacket(def, lang);
        expect(rows.length, `${def.id} ${lang}`).toBeGreaterThan(30);
        for (const r of rows) expect(packet, `${def.id} ${lang}: ${r.where}`).toContain(`\`${contentHash(r.text)}\``);
        for (const m of def.menu) expect(packet).toContain(`\`${m.id}\``);
        for (const w of def.watchFor) expect(packet).toContain(w.text[lang]);
        expect(packet).toContain(`Packet hash: \`${packetHash(def, lang)}\``);
        expect(packet).not.toMatch(/\b(Noa|Guy|Rubin)\b/); // synthetic placeholders only: {name} stays a placeholder
      }
    }
  });

  it("the packet hash changes when one string changes (the signature cannot survive an edit)", () => {
    const def = authoredPatterns()[0];
    const edited = { ...def, parentWords: { ...def.parentWords, en: def.parentWords.en + " (edited)" } };
    expect(packetHash(edited, "en")).not.toBe(packetHash(def, "en"));
    expect(packetHash(edited, "he")).toBe(packetHash(def, "he"));
  });
});
