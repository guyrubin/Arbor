// B-INF-09: the carry-over strip on Now holds no text under 12 px (it set its caption and its
// "Not today" at 11.5 px), and the chrome's avatar initial is never under 12 px either.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.join(here, "..", rel), "utf8");

/** Font sizes a source sets below 12 px: Tailwind arbitrary text-[Npx] and inline fontSize N. */
export function sub12Sizes(src: string): string[] {
  const hits: string[] = [];
  for (const m of src.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) if (Number(m[1]) < 12) hits.push(m[0]);
  for (const m of src.matchAll(/fontSize:\s*(\d+(?:\.\d+)?)(?![\d.])/g)) if (Number(m[1]) < 12) hits.push(m[0]);
  return hits;
}

describe("B-INF-09 — no text under 12 px in the carry-over strip", () => {
  const src = read("overview/CarryOverActionAsk.tsx");

  it("CarryOverActionAsk sets no size under 12 px", () => {
    expect(sub12Sizes(src)).toEqual([]);
  });

  it("NEGATIVE CONTROL: the shipped 11.5 px caption, put back into the real source, is caught", () => {
    const shipped = src.replace('className="mt-1 text-xs leading-snug"', 'className="mt-1 text-[11.5px] leading-snug"');
    expect(shipped).not.toBe(src);
    expect(sub12Sizes(shipped)).toEqual(["text-[11.5px]"]);
  });

  it("the avatar initial is floored at 12 px (the strip's 24 px avatar drew a 10 px letter)", () => {
    const avatar = read("ui/Avatar.tsx");
    expect(avatar).toContain("fontSize: Math.max(12, Math.round(size * 0.4))");
    expect(avatar).not.toContain("fontSize: Math.round(size * 0.4) }}");
  });
});
