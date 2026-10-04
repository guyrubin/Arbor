/**
 * W2-CAREPRO critic round 1 — module gaps survive display:contents wrappers.
 *
 * The data-module stamps wrap each module in `style={{ display: "contents" }}`.
 * A root that spaces its children with `space-y-*` puts the margin on that
 * wrapper — a box that does not render — so the gap vanished and the cards
 * touched (~2 px seams on Appointments, Sharing, Memory). A flex column `gap`
 * reaches contents-promoted children. Also pins the Appointments empty state
 * (the lifecycle sentence, named for the child) and its fixed type scale.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { translate } from "../../lib/i18n";

const read = (f: string) => readFileSync(new URL(f, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const ROOT = /<motion\.div[^>]*className="([^"]*)"/;

/** The route root's class list, or "" when not found. */
const rootClass = (src: string) => ROOT.exec(src)?.[1] ?? "";
const brokenGap = (src: string) =>
  src.includes('display: "contents"') && /\bspace-y-\d/.test(rootClass(src));

describe("Care routes space their modules with a flex gap", () => {
  it("negative control: the pre-change Appointments root is caught", () => {
    const pre = `<motion.div initial={{ opacity: 0 }} className="space-y-6 max-w-[980px]">\n<div data-module="appt-upcoming" style={{ display: "contents" }}>`;
    expect(brokenGap(pre)).toBe(true);
  });

  for (const f of ["./Appointments.tsx", "./TrustedSharing.tsx", "./ChildMemory.tsx"]) {
    it(`${f}: root is a flex column with gap, never space-y over contents wrappers`, () => {
      const src = read(f);
      const cls = rootClass(src);
      expect(cls, "root found").not.toBe("");
      expect(brokenGap(src)).toBe(false);
      expect(cls).toMatch(/\bflex\b/);
      expect(cls).toMatch(/\bflex-col\b/);
      expect(cls).toMatch(/\bgap-\d/);
    });
  }
});

describe("Appointments — empty state teaches the lifecycle; type on the fixed scale", () => {
  const src = read("./Appointments.tsx");
  it("no bracket px font sizes", () => {
    expect(src.match(/text-\[\d+(\.\d+)?px\]/g) ?? []).toEqual([]);
  });
  it("the column is capped (no stretched 936 px phone column)", () => {
    expect(rootClass(src)).toMatch(/max-w-\[720px\]/);
  });
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: the empty state names the child and the prepare-before / keep-after lifecycle`, () => {
      const v = translate(lang, "elev.learnCare.appt.none", { name: "Dylan" });
      expect(v).toContain("Dylan");
      expect(v).not.toMatch(/No appointments scheduled|אין פגישות מתוכננות/);
      expect(v.length).toBeGreaterThan(60);
    });
  }
  it("the empty state is rendered in ink with the child's name", () => {
    expect(src).toContain('data-testid="appt-empty-lifecycle"');
    expect(src).toContain('t("elev.learnCare.appt.none", { name:');
  });
});

describe("Appointments — 'Prepare' means one thing", () => {
  it("the questions list is named for what it holds, EN + HE (the row's Prepare opens Consult)", () => {
    expect(translate("en", "elev.learnCare.appt.prepare")).toBe("Questions for the next visit");
    expect(translate("he", "elev.learnCare.appt.prepare")).toBe("שאלות לביקור הבא");
    for (const lang of ["en", "he"] as const) expect(translate(lang, "elev.learnCare.appt.prepare")).not.toMatch(/^Prepare|^להכין/);
  });
});
