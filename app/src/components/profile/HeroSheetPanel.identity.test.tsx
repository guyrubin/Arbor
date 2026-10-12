import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { HeroSheetDocs } from "../../lib/heroSheetStore";

const h = vi.hoisted(() => ({ docs: null as HeroSheetDocs | null }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
vi.mock("../kidmode/hero/useHeroSheet", () => ({ useHeroSheetDocs: () => h.docs }));
vi.mock("../kidmode/hero/buildHeroSheet", () => ({ browserBuilderDeps: vi.fn(), markHeroPoseOk: vi.fn(), redrawHeroPose: vi.fn(), resumeHeroSheet: vi.fn() }));
vi.mock("./BookSheetStrip", () => ({ default: () => null }));
import HeroSheetPanel from "./HeroSheetPanel";
import { heroAvatarHash } from "../../lib/heroSheetContract";

const photoUrl = "data:image/png;base64,UEhPVE8=", comicAvatarUrl = "data:image/png;base64,Q09NSUM=";
const child = { id: "synthetic-child", name: "Synthetic", photoUrl, comicAvatarUrl,
  avatar: { source: "descriptor" as const, style: "soft3d", createdAt: "2026-10-11" } };
const docsFor = (url: string): HeroSheetDocs => {
  const avatarHash = heroAvatarHash(url);
  return {
    meta: { id: "_meta", v: 1, heroId: avatarHash, source: "generated", avatarHash, poses: ["idle"], status: "complete", updatedAt: "now" },
    poses: { idle: { id: "idle", v: 1, pose: "idle", avatarHash, dataUrl: "data:image/webp;base64,POSE", w: 10, h: 20,
      foot: { x: 5, y: 19 }, head: { x: 5, y: 3, r: 2 }, scale: 1, model: "synthetic", keyColour: "green", createdAt: "now" } },
  };
};
describe("parent pose review follows the canonical profile identity", () => {
  it("hides an old photo-slot sheet while the canonical comic hero is selected", () => {
    h.docs = docsFor(photoUrl); expect(renderToStaticMarkup(<HeroSheetPanel child={child} />)).toBe("");
  });
  it("shows the matching canonical sheet for review", () => {
    h.docs = docsFor(comicAvatarUrl); const html = renderToStaticMarkup(<HeroSheetPanel child={child} />);
    expect(html).toContain('data-hero-sheet="review"'); expect(html).toContain("data:image/webp;base64,POSE");
  });
  it("never turns an unapproved raw profile photo into a reviewable hero", () => {
    h.docs = docsFor(photoUrl);
    expect(renderToStaticMarkup(<HeroSheetPanel child={{ id: child.id, name: child.name, photoUrl }} />)).toBe("");
  });
});
