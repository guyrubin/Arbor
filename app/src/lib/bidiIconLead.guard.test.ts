/**
 * P1-NEXTLEVEL critic r2 (overview · G0) — an <Icon> never leads a dir="auto"
 * element.
 *
 * <Icon> renders its Material Symbols ligature as TEXT ("check_circle"). The
 * dir="auto" first-strong scan reads that Latin text before the sentence, so a
 * Hebrew line resolves LTR: the icon jumps to the left edge and a Latin name
 * leads the Hebrew sentence ("Dylan נשמר ביומן של"). The fix is a direction
 * from the locale on the line, or dir="auto" on the text span only. This walks
 * every .tsx under src so the shape cannot come back anywhere.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "..");
// An opening tag carrying dir="auto" (attribute values may hold one level of
// nested braces) whose FIRST child is an <Icon>.
const DIR_AUTO_ICON_LEAD =
  /<([a-zA-Z][\w.]*)\b((?:[^>{}]|\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})*?)\bdir="auto"((?:[^>{}]|\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})*?)>\s*<Icon\b/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (f.endsWith(".tsx") && !/\.test\./.test(f)) out.push(p);
  }
  return out;
}

describe("dir=auto never resolves from an icon ligature", () => {
  it("no dir=\"auto\" element in src has an <Icon> as its first child", () => {
    const hits: string[] = [];
    for (const f of walk(SRC)) {
      const src = fs.readFileSync(f, "utf8");
      DIR_AUTO_ICON_LEAD.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = DIR_AUTO_ICON_LEAD.exec(src))) {
        hits.push(`${path.relative(SRC, f)}:${src.slice(0, m.index).split("\n").length}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("the guard pattern still catches the original defect shape", () => {
    const bad = `<p dir="auto" data-testid="x" className="flex">\n  <Icon name="check_circle" size={20} />\n  <span>{t("k")}</span>\n</p>`;
    DIR_AUTO_ICON_LEAD.lastIndex = 0;
    expect(DIR_AUTO_ICON_LEAD.test(bad)).toBe(true);
  });

  it("the capture reply line takes its direction from the reply locale", () => {
    const src = fs.readFileSync(path.resolve(SRC, "components/overview/QuickLogModal.tsx"), "utf8");
    expect(src).toMatch(/<p dir=\{replyLocale === "he" \? "rtl" : "ltr"\} lang=\{replyLocale\} data-testid="quicklog-reply-line1"/);
  });
});
