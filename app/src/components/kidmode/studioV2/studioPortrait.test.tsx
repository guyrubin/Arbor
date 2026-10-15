import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ child: {} as Record<string, unknown> }));
vi.mock("../../../context/ArborContext", () => ({ useArbor: () => ({ childProfile: state.child }) }));
vi.mock("../../../hooks/useKidTheme", () => ({ useKidTheme: () => "film3d" }));
vi.mock("../../ui/ArborMascot", () => ({ ArborMascot: () => <span data-mascot="sprout" /> }));

import { StudioPortalArt, StudioPortrait } from "./StudioHome";

describe("Studio portrait composition", () => {
  beforeEach(() => { state.child = { id: "first", name: "Test child" }; });

  it("never composites a raw profile photo into a portal", () => {
    state.child.photoUrl = "https://private.example/raw-photo.jpg";
    const portal = renderToStaticMarkup(<StudioPortalArt worldId="playbank" personalized />);
    expect(portal).not.toContain("raw-photo");
    expect(portal).not.toContain("data-mascot");
    expect(renderToStaticMarkup(<StudioPortrait />)).toContain('data-mascot="sprout"');
  });

  it("uses the approved portrait for both the central hero and every personalized portal", () => {
    state.child.photoUrl = "data:image/png;base64,approvedA";
    state.child.avatar = { source: "descriptor" };
    expect(renderToStaticMarkup(<StudioPortrait />)).toContain("approvedA");
    for (const worldId of ["playbank", "stories", "studio", "feelings"] as const) {
      expect(renderToStaticMarkup(<StudioPortalArt worldId={worldId} personalized />)).toContain("approvedA");
    }
    expect(renderToStaticMarkup(<StudioPortalArt worldId="playbank" />)).not.toContain("approvedA");
  });

  it("resolves a switched child's current identity without retaining the previous portrait", () => {
    state.child.comicAvatarUrl = "https://example.test/approved-a.png";
    expect(renderToStaticMarkup(<StudioPortalArt worldId="stories" personalized />)).toContain("approved-a");
    state.child = { id: "second", comicAvatarUrl: "https://example.test/approved-b.png" };
    const html = renderToStaticMarkup(<StudioPortalArt worldId="stories" personalized />);
    expect(html).toContain("approved-b");
    expect(html).not.toContain("approved-a");
  });
});
