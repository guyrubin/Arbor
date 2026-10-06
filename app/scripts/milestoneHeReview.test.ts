/**
 * B-LOOP-02 — the native Hebrew review pack (scripts/milestone-he-review.mts).
 *  EXPORT: one row per catalogue id, the nine text columns filled, BOM first
 *          (Excel opens the Hebrew intact).
 *  IMPORT: always against TEMP copies of the dictionary and milestoneData.ts
 *          (never the real files): one fix changes exactly one key; a gap or
 *          a reviewer_ok = 0 row leaves the flag at "ai-first-pass"; a
 *          complete signed review flips it; bad fixes are refused.
 *  The Science note key `ms.heReview.note` exists while unreviewed.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ALL_MILESTONES, MILESTONE_HE_REVIEW } from "../src/lib/milestoneData";
import { HE_MILESTONE_TEXT } from "../src/lib/i18nElevation/milestoneCatalogue";
import { translate } from "../src/lib/i18n";
import { PRACTICES } from "../src/content/practices";
import {
  BOM, COLUMNS, DEFAULT_CATALOGUE, DEFAULT_DATA, buildExportCsv, buildReviewRows, exportFileName, main, parseCsv, runExport, runImport, type ReviewRow,
  DEFAULT_PRACTICES, PRACTICE_COLUMNS, buildPracticeExportCsv, buildPracticeReviewRows, practicesExportFileName, runPracticesExport, runPracticesImport, type PracticeReviewRow,
} from "./milestone-he-review.mts";

let tmp: string;
let catalogue: string;
let data: string;
const realCatalogue = fs.readFileSync(DEFAULT_CATALOGUE, "utf8");
const realData = fs.readFileSync(DEFAULT_DATA, "utf8");

const freshCopies = () => {
  fs.writeFileSync(catalogue, realCatalogue, "utf8");
  fs.writeFileSync(data, realData, "utf8");
};
const csvOf = (rows: ReviewRow[]) => buildExportCsv(rows);
const signedRows = (patch: (r: ReviewRow) => ReviewRow = (r) => r) => buildReviewRows().map((r) => patch({ ...r, reviewer_ok: "1" }));

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "he-review-"));
  catalogue = path.join(tmp, "milestoneCatalogue.ts");
  data = path.join(tmp, "milestoneData.ts");
});
afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  // the real files were never touched
  expect(fs.readFileSync(DEFAULT_CATALOGUE, "utf8")).toBe(realCatalogue);
  expect(fs.readFileSync(DEFAULT_DATA, "utf8")).toBe(realData);
});

describe("B-LOOP-02 — export", () => {
  it("one row per catalogue id, header = the twelve columns, the nine text columns filled", () => {
    const rows = parseCsv(buildExportCsv());
    expect(rows[0]).toEqual([...COLUMNS]);
    const body = rows.slice(1);
    expect(body.map((r) => r[0])).toEqual(ALL_MILESTONES.map((m) => m.id));
    for (const r of body) {
      expect(r, r[0]).toHaveLength(12);
      for (let i = 0; i < 9; i += 1) expect(r[i].trim().length, `${r[0]} column ${COLUMNS[i]}`).toBeGreaterThan(0);
      expect(r.slice(9)).toEqual(["", "", ""]);
    }
  });

  it("EN comes from milestoneData, HE from the dictionary, shelf from the resolver", () => {
    const first = buildReviewRows()[0];
    const m = ALL_MILESTONES[0];
    expect(first.en_title).toBe(m.title);
    expect(first.he_title).toBe(HE_MILESTONE_TEXT[m.id][0]);
    expect(first.he_looks).toBe(HE_MILESTONE_TEXT[m.id][2]);
    expect(first.shelf).toBe("play");
    expect(buildReviewRows().find((r) => r.id === "asha-feed-9m")?.shelf).toBe("food");
  });

  it("UTF-8 WITH BOM, CRLF rows (Excel), and the Hebrew survives the round trip", () => {
    const csv = buildExportCsv();
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.includes("\r\n")).toBe(true);
    const out = runExport(tmp, new Date("2026-10-06T12:00:00Z"));
    expect(path.basename(out.file)).toBe(exportFileName(new Date("2026-10-06T12:00:00Z")));
    expect(path.basename(out.file)).toBe("HE-REVIEW-2026-10-06.csv");
    const bytes = fs.readFileSync(out.file);
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(parseCsv(bytes.toString("utf8"))[1][4]).toBe(HE_MILESTONE_TEXT[ALL_MILESTONES[0].id][0]);
    expect(out.rows).toBe(ALL_MILESTONES.length);
  });
});

describe("B-LOOP-02 — import (temp copies only)", () => {
  it("a fixture with one fix changes exactly one key and leaves the flag (the rest is unsigned)", () => {
    freshCopies();
    const rows = buildReviewRows().map((r) => (r.id === "cdc-2m-1" ? { ...r, reviewer_fix: "title=נרגע/ת כשמחבקים" } : r));
    const res = runImport(csvOf(rows), { catalogue, data });
    expect(res.changed).toEqual(["ms.item.cdc-2m-1.title"]);
    expect(res.refused).toEqual([]);
    const before = realCatalogue.split(/\r?\n/);
    const after = fs.readFileSync(catalogue, "utf8").split(/\r?\n/);
    expect(after.length).toBe(before.length);
    const diff = after.map((l, i) => (l === before[i] ? null : i)).filter((i) => i !== null);
    expect(diff).toHaveLength(1);
    expect(after[diff[0] as number]).toContain('"נרגע/ת כשמחבקים"');
    expect(after[diff[0] as number]).toContain(JSON.stringify(HE_MILESTONE_TEXT["cdc-2m-1"][1]));
    expect(res.flag).toBe("ai-first-pass");
    expect(fs.readFileSync(data, "utf8")).toBe(realData);
  });

  it("one reviewer_ok = 0 with no fix leaves the flag at ai-first-pass and names the gap", () => {
    freshCopies();
    const rows = signedRows((r) => (r.id === "cdc-9m-4" ? { ...r, reviewer_ok: "0" } : r));
    const res = runImport(csvOf(rows), { catalogue, data });
    expect(res.gaps).toEqual(["cdc-9m-4"]);
    expect(res.flag).toBe("ai-first-pass");
    expect(fs.readFileSync(data, "utf8")).toContain('= "ai-first-pass";');
  });

  it("every row signed (ok = 1 or a fix) flips the flag in the data file — and only there", () => {
    freshCopies();
    const rows = signedRows((r) => (r.id === "cdc-2m-2" ? { ...r, reviewer_ok: "", reviewer_fix: "looks=חיוך אמיתי שמופנה אליכם." } : r));
    const res = runImport(csvOf(rows), { catalogue, data });
    expect(res.gaps).toEqual([]);
    expect(res.changed).toEqual(["ms.item.cdc-2m-2.looks"]);
    expect(res.flag).toBe("native-reviewed");
    expect(fs.readFileSync(data, "utf8")).toContain('MILESTONE_HE_REVIEW: "ai-first-pass" | "native-reviewed" = "native-reviewed";');
  });

  it("refuses a fix with Latin letters, a verdict word, a stale base text or no field prefix — and then never flips", () => {
    freshCopies();
    const rows = signedRows((r) => {
      if (r.id === "cdc-4m-1") return { ...r, reviewer_fix: "title=Smiles" };
      if (r.id === "cdc-4m-2") return { ...r, reviewer_fix: "desc=מצחקק/ת בקצב שלו/ה" };
      if (r.id === "cdc-4m-3") return { ...r, he_title: "טקסט ישן", reviewer_fix: "title=שיחה של צלילים" };
      if (r.id === "cdc-4m-4") return { ...r, reviewer_fix: "מפנה את הראש" };
      return r;
    });
    const res = runImport(csvOf(rows), { catalogue, data });
    expect(res.changed).toEqual([]);
    expect(res.refused.map((x) => x.split(":")[0]).sort()).toEqual(["cdc-4m-4", "ms.item.cdc-4m-1.title", "ms.item.cdc-4m-2.desc", "ms.item.cdc-4m-3.title"]);
    expect(res.flag).toBe("ai-first-pass");
    expect(fs.readFileSync(catalogue, "utf8")).toBe(realCatalogue);
  });

  it("the Science note key ms.heReview.note still exists while the catalogue is unreviewed", () => {
    expect(MILESTONE_HE_REVIEW).toBe("ai-first-pass");
    expect(translate("en", "ms.heReview.note")).not.toBe("ms.heReview.note");
    expect(translate("he", "ms.heReview.note")).not.toBe("ms.heReview.note");
  });
});

describe("B-LOOP-02 — CLI", () => {
  it("--help prints usage; --practices without a mode and an unknown mode exit 2", () => {
    expect(main(["--help"])).toBe(0);
    expect(main(["--practices"])).toBe(2);
    expect(main(["--practices", "nope"])).toBe(2);
    expect(main(["nope"])).toBe(2);
  });
});

/**
 * B-LOOP-08 — the practices mode: one row per practice (EN + HE do/say), and
 * fixes applied into a TEMP copy of content/practices.ts by id + field.
 */
describe("B-LOOP-08 — practices export", () => {
  it("one row per practice, header = the eleven columns, the eight text columns filled, BOM + CRLF", () => {
    const csv = buildPracticeExportCsv();
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv.includes("\r\n")).toBe(true);
    const rows = parseCsv(csv);
    expect(rows[0]).toEqual([...PRACTICE_COLUMNS]);
    const body = rows.slice(1);
    expect(body.map((r) => r[0])).toEqual(PRACTICES.map((p) => p.id));
    // B-LOOP-08 follow-up: one per catalogue row + the shelf-level set (milestoneId "—").
    expect(body).toHaveLength(PRACTICES.length);
    expect(body.filter((r) => r[1] !== "—")).toHaveLength(ALL_MILESTONES.length);
    const shelfLevel = body.filter((r) => r[1] === "—");
    expect(shelfLevel.map((r) => r[0])).toEqual(PRACTICES.filter((p) => p.milestoneId === null).map((p) => p.id));
    expect(new Set(shelfLevel.map((r) => r[2]))).toEqual(new Set(["sleep", "family"]));
    for (const r of body) {
      expect(r, r[0]).toHaveLength(11);
      for (let i = 0; i < 8; i += 1) expect(r[i].trim().length, `${r[0]} ${PRACTICE_COLUMNS[i]}`).toBeGreaterThan(0);
      expect(r.slice(8)).toEqual(["", "", ""]);
    }
    const first = buildPracticeReviewRows()[0];
    expect(first.he_say).toBe(PRACTICES[0].say.he);
    expect(first.shelf).toBe(PRACTICES[0].shelf);
  });

  it("runPracticesExport writes HE-REVIEW-PRACTICES-<date>.csv with the Hebrew intact", () => {
    const out = runPracticesExport(tmp, new Date("2026-10-06T12:00:00Z"));
    expect(path.basename(out.file)).toBe("HE-REVIEW-PRACTICES-2026-10-06.csv");
    expect(path.basename(out.file)).toBe(practicesExportFileName(new Date("2026-10-06T12:00:00Z")));
    const bytes = fs.readFileSync(out.file);
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(parseCsv(bytes.toString("utf8"))[1][7]).toBe(PRACTICES[0].say.he);
    expect(out.rows).toBe(PRACTICES.length);
  });
});

describe("B-LOOP-08 — practices import (temp copy only)", () => {
  const realPractices = fs.readFileSync(DEFAULT_PRACTICES, "utf8");
  const practicesCopy = () => {
    const file = path.join(tmp, "practices.ts");
    fs.writeFileSync(file, realPractices, "utf8");
    return file;
  };
  const prows = (patch: (r: PracticeReviewRow) => PracticeReviewRow = (r) => r) => buildPracticeReviewRows().map(patch);

  it("one say= fix changes exactly one line (the say line of that practice); the rest is listed as unsigned", () => {
    const file = practicesCopy();
    const rows = prows((r) => (r.id === "pr-cdc-2m-4" ? { ...r, reviewer_fix: "say=בום גדול! זאת הייתה הדלת. אני כאן." } : r));
    const res = runPracticesImport(buildPracticeExportCsv(rows), { practices: file });
    expect(res.changed).toEqual(["pr-cdc-2m-4.say.he"]);
    expect(res.refused).toEqual([]);
    expect(res.gaps).toHaveLength(PRACTICES.length - 1);
    const before = realPractices.split(/\r?\n/);
    const after = fs.readFileSync(file, "utf8").split(/\r?\n/);
    expect(after.length).toBe(before.length);
    const diff = after.map((l, i) => (l === before[i] ? null : i)).filter((i) => i !== null);
    expect(diff).toHaveLength(1);
    expect(after[diff[0] as number]).toMatch(/^ {4}say: L\(/);
    expect(after[diff[0] as number]).toContain('"בום גדול! זאת הייתה הדלת. אני כאן."');
    expect(after[diff[0] as number]).toContain(JSON.stringify(PRACTICES.find((p) => p.id === "pr-cdc-2m-4")!.say.en));
  });

  it("a Hebrew-prefixed עשו= fix lands on the do line; every row signed leaves no gap", () => {
    const file = practicesCopy();
    const rows = prows((r) => ({ ...r, reviewer_ok: "1", ...(r.id === "pr-cdc-4m-3" ? { reviewer_fix: "עשו=החזיקו את התינוק/ת פנים מול פנים. השמיעו צליל קצר וחכו לתשובה." } : {}) }));
    const res = runPracticesImport(buildPracticeExportCsv(rows), { practices: file });
    expect(res.changed).toEqual(["pr-cdc-4m-3.do.he"]);
    expect(res.gaps).toEqual([]);
    expect(fs.readFileSync(file, "utf8")).toContain('"החזיקו את התינוק/ת פנים מול פנים. השמיעו צליל קצר וחכו לתשובה."');
  });

  it("refuses Latin letters, a verdict word, a practice banned word, an over-cap say, a stale base text and a missing prefix — and writes nothing", () => {
    const file = practicesCopy();
    const rows = prows((r) => {
      if (r.id === "pr-cdc-6m-3") return { ...r, reviewer_fix: "say=Your turn" };
      if (r.id === "pr-cdc-6m-4") return { ...r, reviewer_fix: "say=זה תקין לגמרי" };
      if (r.id === "pr-cdc-9m-4") return { ...r, reviewer_fix: "do=צריך ללמד אותו מילים" };
      if (r.id === "pr-cdc-9m-5") return { ...r, reviewer_fix: `say=${"מילה ".repeat(16).trim()}` };
      if (r.id === "pr-cdc-12m-2") return { ...r, he_say: "טקסט ישן", reviewer_fix: "say=ביי סבתא!" };
      if (r.id === "pr-cdc-12m-3") return { ...r, reviewer_fix: "הנה אבא" };
      return r;
    });
    const res = runPracticesImport(buildPracticeExportCsv(rows), { practices: file });
    expect(res.changed).toEqual([]);
    expect(res.refused.map((x) => x.split(":")[0]).sort()).toEqual([
      "pr-cdc-12m-2.say.he", "pr-cdc-12m-3", "pr-cdc-6m-3.say.he", "pr-cdc-6m-4.say.he", "pr-cdc-9m-4.do.he", "pr-cdc-9m-5.say.he",
    ]);
    expect(fs.readFileSync(file, "utf8")).toBe(realPractices);
  });

  it("follow-up: a fix on a SHELF-LEVEL practice (milestoneId —) lands on its SP block's say line", () => {
    const file = practicesCopy();
    const rows = prows((r) => (r.id === "pr-sleep-03" ? { ...r, reviewer_fix: "say=מחשיכים את האור. עוד מעט לישון." } : r));
    const res = runPracticesImport(buildPracticeExportCsv(rows), { practices: file });
    expect(res.changed).toEqual(["pr-sleep-03.say.he"]);
    expect(res.refused).toEqual([]);
    const after = fs.readFileSync(file, "utf8").split(/\r?\n/);
    const at = after.findIndex((l) => l.includes('"מחשיכים את האור. עוד מעט לישון."'));
    expect(after[at]).toMatch(/^ {4}say: L\(/);
    expect(after.slice(0, at).reverse().find((l) => /^ {2}S?P\(/.test(l))).toMatch(/^ {2}SP\("pr-sleep-03",/);
  });

  it("the real practices file is never touched by the suite", () => {
    expect(fs.readFileSync(DEFAULT_PRACTICES, "utf8")).toBe(realPractices);
  });

  it("CLI: --practices export writes the pack to --out", () => {
    expect(main(["--practices", "export", "--out", tmp])).toBe(0);
    expect(fs.readdirSync(tmp).some((f) => /^HE-REVIEW-PRACTICES-\d{4}-\d{2}-\d{2}\.csv$/.test(f))).toBe(true);
  });
});
