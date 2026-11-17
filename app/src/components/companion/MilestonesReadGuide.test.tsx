import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: "en", t: (k: string) => k }) }));
import MilestonesReadGuide from "./MilestonesReadGuide";

// V77 boards: the reading key names Arbor suggests only where a suggestion shows.
describe("MilestonesReadGuide — the key follows what the page shows", () => {
  it("with a suggestion on the page, the key names it", () => {
    expect(renderToStaticMarkup(<MilestonesReadGuide suggests />)).toContain('data-testid="ms-read-key-suggests"');
  });
  it("negative control: no suggestion, no key entry", () => {
    expect(renderToStaticMarkup(<MilestonesReadGuide suggests={false} />)).not.toContain("ms-read-key-suggests");
  });
});
