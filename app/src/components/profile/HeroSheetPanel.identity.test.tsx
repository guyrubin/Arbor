import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { HeroSheetDocs } from "../../lib/heroSheetStore";

const h = vi.hoisted(() => ({ docs: null as HeroSheetDocs | null }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
vi.mock("../kidmode/hero/useHeroSheet", () => ({ useHeroSheetDocs: () => h.docs }));
vi.mock("../kidmode/hero/buildHeroSheet", () => ({ browserBuilderDeps: vi.fn(), markHeroPoseOk: vi.fn(), redrawHeroPose: vi.fn(), resumeHeroSheet: vi.fn() }));
vi.mock("./BookSheetStrip", () => ({ default: () => <i data-strip="" /> }));
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
    h.docs = docsFor(photoUrl);
    const html = renderToStaticMarkup(<HeroSheetPanel child={child} />);
    expect(html).not.toContain("data-hero-sheet"); expect(html).not.toContain("data:image/webp;base64,POSE");
  });
  it("B-BOOK-69: before the new hero's game sheet exists, the book's old/new line still stands (for the CURRENT hero)", () => {
    h.docs = docsFor(photoUrl); // the stored game sheet belongs to another (earlier) picture
    expect(renderToStaticMarkup(<HeroSheetPanel child={child} />)).toContain('data-strip=""');
    h.docs = null; // no game sheet at all yet
    expect(renderToStaticMarkup(<HeroSheetPanel child={child} />)).toContain('data-strip=""');
  });
  it("shows the matching canonical sheet for review", () => {
    h.docs = docsFor(comicAvatarUrl); const html = renderToStaticMarkup(<HeroSheetPanel child={child} />);
    expect(html).toContain('data-hero-sheet="review"'); expect(html).toContain("data:image/webp;base64,POSE");
  });
  it("never turns an unapproved raw profile photo into a reviewable hero", () => {
    h.docs = docsFor(photoUrl);
    expect(renderToStaticMarkup(<HeroSheetPanel child={{ id: child.id, name: child.name, photoUrl }} />)).toBe("");
  });
  it("B-BOOK-69: while the new hero learns to move, the book's line shows under the building line", () => {
    const docs = docsFor(comicAvatarUrl); h.docs = { ...docs, meta: { ...docs.meta, status: "building" } };
    const html = renderToStaticMarkup(<HeroSheetPanel child={child} />);
    expect(html).toContain('data-hero-sheet="building"'); expect(html).toContain('data-strip=""');
  });
});
