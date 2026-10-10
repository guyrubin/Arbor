import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { foldText } from "./journalFilters";
import { normalizeSearchText as legacyNormalizeSearchText } from "./searchIndex";
import { normalizeSearchText } from "./searchNormalize";

describe("B-SHELL-37 · import-free shared normalization", () => {
  it("keeps the global and Journal exports as the same helper", () => {
    expect(legacyNormalizeSearchText).toBe(normalizeSearchText);
    expect(foldText).toBe(normalizeSearchText);
  });

  it.each([
    ["  Calm Morning  ", "calm morning"],
    ["Café Déjà", "cafe deja"],
    ["Cafe\u0301 De\u0301ja\u0300", "cafe deja"],
    ["ך ם ן ף ץ", "כ מ נ פ צ"],
    ["שָׁלוֹם", "שלומ"],
    ["שָׁל֑וֹם", "שלומ"],
    ["", ""],
    [" \t\n ", ""],
    ["\u05B0\u05B7\u0301", ""],
    ["Calm  Morning!", "calm  morning!"],
    ["שָׁלוֹם־עוֹלָם", "שלומ־עולמ"],
    ["\u05BE \u05C0 \u05C3 \u05C6 \u05F3 \u05F4", "\u05BE \u05C0 \u05C3 \u05C6 \u05F3 \u05F4"],
    ["C++ #1 @home 👩‍👩‍👦 ❤️", "c++ #1 @home 👩‍👩‍👦 ❤️"],
    ["ש\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7", "ש"],
  ])("normalizes %j to %j and is idempotent", (text, expected) => {
    expect(normalizeSearchText(text)).toBe(expected);
    expect(normalizeSearchText(normalizeSearchText(text))).toBe(expected);
  });

  it.each([
    ["א־ב", "אב"],
    ["א׀ב", "אב"],
    ["א׃ב", "אב"],
    ["א׆ב", "אב"],
    ["ג׳", "ג"],
    ["C++", "C"],
    ["👩‍👩‍👦", "👩👩👦"],
    ["が", "か"],
    ["कि", "क"],
    ["كَ", "ك"],
  ])("does not erase meaningful symbols or other-script marks in %j", (text, different) => {
    expect(normalizeSearchText(text)).not.toBe(normalizeSearchText(different));
    expect(normalizeSearchText(normalizeSearchText(text))).toBe(normalizeSearchText(text));
  });

  it("has no static imports, re-exported dependencies, require calls or dynamic imports", () => {
    const source = readFileSync(new URL("./searchNormalize.ts", import.meta.url), "utf8");
    const ast = ts.createSourceFile("searchNormalize.ts", source, ts.ScriptTarget.Latest, true);
    const references: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node) || ts.isImportTypeNode(node) ||
        (ts.isExportDeclaration(node) && node.moduleSpecifier) ||
        (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === "require")))) {
        references.push(node.getText(ast));
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
    expect(references, "the shared helper must never pull catalogues or child data into eager consumers").toEqual([]);
  });

  it("both local filters import the helper directly, never the global index", () => {
    for (const file of ["./journalFilters.ts", "../learn/learnLibrary.ts"]) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(source).toMatch(/import \{ normalizeSearchText \} from "(?:\.\/|\.\.\/lib\/)searchNormalize"/);
      expect(source).not.toContain("searchIndex");
    }
  });
});
