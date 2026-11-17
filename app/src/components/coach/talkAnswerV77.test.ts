import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** V77 audit (N-Talk-D/M): the words card shows its heading; the draft carries
 *  a decorative picture in the wide layout only. Re-pinned markup snapshots in
 *  coachAnswerCardsMarkup.test.ts; these are the negative controls. */
const src = readFileSync(new URL("./CoachAnswerCards.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./coachReport.css", import.meta.url), "utf8");

describe("Talk answer · V77 details", () => {
  it("the words card has one visible heading, production's own key", () => {
    expect(src).toContain('<h3 className="coach-report__script-title"><Icon name="forum" size={17} />{t("coach.cards.sayThis")}</h3>');
  });
  it("the picture is decorative and wide-only; never a percentage in the answer's markup", () => {
    const art = src.slice(src.indexOf('<span className="coach-report__art"'), src.indexOf("</span>", src.indexOf('<span className="coach-report__art"')));
    expect(art).toContain('aria-hidden="true"');
    expect(art).toContain('alt=""');
    // negative controls: no inline sizing (the firewall forbids "%" in the answer), hidden outside the wide layout
    expect(art).not.toContain("style=");
    expect(css).toMatch(/\.coach-report__art \{ display: none; \}/);
  });
});
