import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * JRNL-2 / CARE-4 regression guard — mojibake (double-encoded UTF-8) in source.
 *
 * Shipped bug: two Hebrew literals were stored as UTF-8 bytes re-read as
 * Latin-1 ("רגע חדש" became a run of '×' + Latin-1 garbage) and rendered
 * literally to every Hebrew user on the Journal compose card and the Academy
 * header. Because every UTF-8 byte pair of a Hebrew letter starts with 0xD7,
 * Latin-1-decoded Hebrew always shows up as U+00D7 ('×', the multiplication
 * sign) immediately followed by a character in the U+0080–U+00FF range.
 *
 * Legitimate uses of '×' (e.g. "3×4 grid", "2× speed") are followed by ASCII,
 * so this signature has no false positives. If this test goes red, a file was
 * saved through a Latin-1/CP1252 round-trip — fix the encoding, don't relax
 * the guard. (The signature is built from char codes so this file can never
 * trip itself.)
 */

const MOJIBAKE_SIGNATURE = new RegExp(
  String.fromCharCode(0xd7) + "[" + String.fromCharCode(0x80) + "-" + String.fromCharCode(0xff) + "]",
);

const SRC_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const TEXT_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".html", ".json", ".md", ".txt", ".svg"]);

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(full, out);
    } else if (TEXT_EXT.has(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

describe("source encoding guard (mojibake)", () => {
  it("no source file contains the double-encoded-Hebrew byte signature", () => {
    const offenders: string[] = [];
    for (const file of collectSourceFiles(SRC_ROOT)) {
      const text = readFileSync(file, "utf8");
      if (MOJIBAKE_SIGNATURE.test(text)) {
        const line = text.split("\n").findIndex((l) => MOJIBAKE_SIGNATURE.test(l)) + 1;
        offenders.push(`${path.relative(SRC_ROOT, file)}:${line}`);
      }
    }
    expect(offenders, `mojibake (UTF-8 read as Latin-1) found in:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("the signature itself detects a known mojibake sample", () => {
    // "רגע" (UTF-8 bytes) decoded as Latin-1 — reconstructed from char codes.
    const sample = [0xd7, 0xa8, 0xd7, 0x92, 0xd7, 0xa2].map((c) => String.fromCharCode(c)).join("");
    expect(MOJIBAKE_SIGNATURE.test(sample)).toBe(true);
    // Legitimate multiplication-sign usage stays clean.
    expect(MOJIBAKE_SIGNATURE.test("a 3×4 grid at 2× speed")).toBe(false);
  });
});
