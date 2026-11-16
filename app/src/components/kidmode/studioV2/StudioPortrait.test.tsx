import React from "react";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const hero = vi.hoisted(() => ({ url: null as string | null }));
vi.mock("../../ui/HeroAvatar", () => ({ useHeroAvatar: () => hero }));
vi.mock("../../ui/ArborMascot", () => ({ ArborMascot: () => <i data-sprout="" /> }));

import { StudioPortrait } from "./StudioPortrait";

describe("StudioPortrait", () => {
  it("shows the child's hero when there is one", () => {
    hero.url = "/hero.webp";
    const html = renderToStaticMarkup(<StudioPortrait className="ring" label="Me" fallback={false} />);
    expect(html).toContain('class="ring"');
    expect(html).toContain('src="/hero.webp"');
    expect(html).not.toContain("data-sprout");
  });
  it("without a hero it shows Sprout only where asked, and otherwise draws no empty ring", () => {
    hero.url = null;
    expect(renderToStaticMarkup(<StudioPortrait className="ring" />)).toContain("data-sprout");
    expect(renderToStaticMarkup(<StudioPortrait className="ring" fallback={false} />)).toBe("");
  });
  it("a world room asks for no fallback, because Sprout already stands beside the hint", () => {
    const world = readFileSync(new URL("./StudioWorld.tsx", import.meta.url), "utf8");
    expect(world).toContain('<StudioPortrait className="studio-v2__medallion" label={copy.hero} fallback={false} />');
    expect(world).toContain("<StudioSprout ");
  });
});
