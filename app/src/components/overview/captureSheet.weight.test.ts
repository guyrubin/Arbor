/* B-ASKJB-47 — the capture sheet meets the weight rules.
 *
 * The most-used parent sheet (QuickLogModal, with its review step
 * ConfirmCaptureReview) saved on two primary-gradient buttons and printed an
 * 11 px hint, an 11.5 px privacy line, 11 px intensity anchors and 9–10 px
 * review labels. Acceptance: solid accent save buttons, no text under 12 px,
 * contrast ratchet green (lib/tokens.contrast.test.ts covers clay /
 * on-accent), EN + HE 375 (the sweep's weight block, B-INF-06, measures the
 * rendered sheet).
 *
 * Source pins in the house pattern (JournalTab.noShout): the scanner is a pure
 * function over source text, so the pre-fix markup is fed in as a negative
 * control. Shared pieces the sheet renders are pinned at their own source:
 * the AI-disclosure foot (companion-composer-foot, the same class Talk uses)
 * and SayThis' read-aloud/copy controls. The post-save Say-this on the sheet
 * uses the quote presentation (HardMomentNowSheet's), which has no 10 px
 * card title. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(resolve(__dirname, "..", rel), "utf8");
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\s*\}/g, "");

const SHEET = ["overview/QuickLogModal.tsx", "overview/ConfirmCaptureReview.tsx"] as const;

/** Every weight-rule breach in one source: gradients, sub-12 px text, and a
 *  submit button that is not the solid accent fill. */
export function weightBreaches(src: string): string[] {
  const c = code(src);
  const out: string[] = [];
  if (/--arbor-gradient-primary|--gradient-cta|linear-gradient|bg-gradient-/.test(c)) out.push("gradient");
  for (const m of c.matchAll(/text-\[((?:[0-9]|1[01])(?:\.\d+)?)px\]/g)) out.push(`text ${m[1]}px`);
  for (const m of c.matchAll(/fontSize:\s*(\d+(?:\.\d+)?)\b(?!\s*[a-z%])/g)) if (Number(m[1]) < 12) out.push(`fontSize ${m[1]}`);
  for (const m of c.matchAll(/<button\s+type="submit"[^>]*>/g)) {
    const tag = m[0];
    if (!/background:\s*"var\(--arbor-clay\)"/.test(tag)) out.push("submit not solid accent");
    if (!/color:\s*"var\(--arbor-on-accent\)"/.test(tag)) out.push("submit label not on-accent");
    if (/\btext-white\b/.test(tag)) out.push("submit text-white");
    if (!/\bmin-h-11\b/.test(tag)) out.push("submit under 44 px");
  }
  return out;
}

describe("B-ASKJB-47 — the capture sheet's save buttons are solid accent and nothing is under 12 px", () => {
  it("QuickLogModal and ConfirmCaptureReview hold no gradient, no sub-12 px text and a solid accent submit", () => {
    for (const rel of SHEET) expect(weightBreaches(read(rel)), rel).toEqual([]);
  });

  it("both forms of the sheet still have their submit (non-vacuous): two in QuickLogModal, one in the review", () => {
    expect(code(read("overview/QuickLogModal.tsx")).match(/<button\s+type="submit"/g)).toHaveLength(2);
    expect(code(read("overview/ConfirmCaptureReview.tsx")).match(/<button\s+type="submit"/g)).toHaveLength(1);
  });

  it("NEGATIVE CONTROL: the pre-fix markup of the sheet is caught", () => {
    const preFix = [
      '<span className="block text-[11px]" style={{ color: "var(--arbor-muted)" }}>{t("ql.moment.hardHint")}</span>',
      '<p data-testid="quicklog-privacy" className="text-[11.5px] leading-snug">x</p>',
      '<button type="submit" disabled={saving} className="inline-flex min-h-11 w-full" style={{ background: "var(--arbor-gradient-primary)", color: "var(--arbor-on-accent)" }}>',
      '<span className="text-[9px] font-bold">x</span>',
      '<button type="submit" disabled={busy} className="col-span-2 min-h-11 rounded-xl px-3 text-xs font-extrabold text-white sm:col-span-1" style={{ background: "var(--arbor-gradient-primary)" }}>',
    ].join("\n");
    expect(weightBreaches(preFix)).toEqual([
      "gradient",
      "text 11px",
      "text 11.5px",
      "text 9px",
      "submit not solid accent",
      "submit not solid accent",
      "submit label not on-accent",
      "submit text-white",
    ]);
  });

  it("the AI-disclosure line at the sheet's foot (Talk's composer-foot class) is 12 px", () => {
    const css = read("companion/companionComposer.css");
    const rule = css.match(/\.companion-composer-foot\{[^}]*\}/)?.[0] ?? "";
    expect(rule).toMatch(/font-size:12px/);
    expect(code(read("overview/QuickLogModal.tsx"))).toContain("<AiDisclosureLine ");
  });

  it("the sheet's Say-this is the quote presentation; its read-aloud and copy controls are 12 px and 44 px tall", () => {
    const modal = code(read("overview/QuickLogModal.tsx"));
    expect(modal).toMatch(/<SayThis\s+presentation="quote"/);
    const ai = code(read("ui/AiBlock.tsx"));
    const sayThis = ai.slice(ai.indexOf("export function SayThis"), ai.indexOf("export function Checklist"));
    expect(sayThis).toContain('<SpeakButton text={text} lang={lang} className="text-xs min-h-11 px-1" />');
    expect(sayThis).toContain('className="text-xs font-bold inline-flex min-h-11 items-center gap-1 px-1"');
    expect(sayThis).not.toMatch(/text-\[(?:[0-9]|1[01])(?:\.\d+)?px\]/);
  });
});
