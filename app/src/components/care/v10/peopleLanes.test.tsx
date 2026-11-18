/**
 * Design V77 (N-People-D/M) — who sees what. The demo seed models no shares,
 * so the populated view is pinned here with synthetic grants (invented
 * addresses on example.com). With no live share, production's empty state
 * stands: no figure, no lanes.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ShareGrant } from "../../../types";
import { careCopy } from "./careV10Copy";
import PeopleLanes, { grantColumns, peopleLanes } from "./PeopleLanes";

const harness = vi.hoisted(() => ({ locale: "en" as "en" | "he" }));
vi.mock("../../../context/LanguageContext", async () => {
  const { translate } = await import("../../../lib/i18n");
  return { useLanguage: () => ({ uiLang: harness.locale, t: (k: string, v?: Record<string, string | number>) => translate(harness.locale, k, v) }) };
});
import PeopleScene from "./PeopleScene";

const DAY = 86_400_000;
const NOW = Date.parse("2026-11-16T12:00:00Z");
const grant = (over: Partial<ShareGrant>): ShareGrant => ({
  id: "g", ownerUid: "u", ownerEmail: null, childId: "c", childName: null, recipientEmail: "someone@example.com",
  role: "viewer", scopes: [], createdAt: new Date(NOW - DAY).toISOString(), expiresAt: null, revokedAt: null, ...over,
});
const coParent = grant({ id: "co", recipientEmail: "yoav@example.com", role: "co_parent", accessMode: "family_workspace", acceptedAt: new Date(NOW - 9 * DAY).toISOString(), createdAt: new Date(NOW - 10 * DAY).toISOString() });
const invited = grant({ id: "inv", recipientEmail: "ruth@example.com", role: "co_parent", accessMode: "family_workspace", createdAt: new Date(NOW - 3 * DAY).toISOString() });
const week = grant({ id: "wk", recipientEmail: "reader@example.com", scopes: ["weekly_insight", "story_timeline"], createdAt: new Date(NOW - 2 * DAY).toISOString() });
const role = (g: ShareGrant) => (g.role === "co_parent" ? "Co-parent" : "Viewer");

describe("V77 · who sees what", () => {
  it("each grant's columns come from what it carries: the family workspace, the week, a custom share, a visit page", () => {
    expect([...grantColumns(coParent)]).toEqual(["activity", "moments"]);
    expect([...grantColumns(week)]).toEqual(["week"]);
    expect([...grantColumns(grant({ scopes: ["milestones"] }))]).toEqual(["custom"]);
    expect([...grantColumns(grant({ scopes: ["report_slp"] }))]).toEqual(["visit"]);
    expect([...grantColumns(grant({ scopes: [] }))]).toEqual([]);
  });

  it("you first; then shares oldest first; joined is solid, an invite not yet accepted is an outline; placeholders only for what nobody carries", () => {
    const c = careCopy("en").people;
    const lanes = peopleLanes([week, invited, coParent], c, role);
    expect(lanes.map((l) => [l.kind, l.id])).toEqual([["you", "you"], ["grant", "co"], ["grant", "inv"], ["grant", "wk"], ["placeholder", "placeholder-visit"]]);
    expect(lanes[1].cells).toMatchObject({ activity: "see", moments: "see", week: null });
    expect(lanes[1].sub).toBe(`Co-parent · ${c.joined}`);
    expect(lanes[2].cells).toMatchObject({ activity: "open", moments: "open" });
    expect(lanes[2].sub).toBe(`Co-parent · ${c.invited}`);
    expect(lanes[3].cells.week).toBe("see");
    expect(lanes[4].cells.visit).toBe("none");
    // NEGATIVE CONTROL: with no week share, the week placeholder appears (dashed).
    const noWeek = peopleLanes([coParent], c, role);
    expect(noWeek.map((l) => l.id)).toContain("placeholder-week");
    expect(noWeek.find((l) => l.id === "placeholder-week")!.cells.week).toBe("none");
  });

  for (const locale of ["en", "he"] as const) {
    it(`${locale}: desktop is a real table (column and row headers); phone a list with one chip per thing; every mark is named`, () => {
      const c = careCopy(locale).people;
      const lanes = peopleLanes([coParent, invited, week], c, role);
      const desk = renderToStaticMarkup(<PeopleLanes composition="desk" lanes={lanes} copy={c} childName="Dylan" />);
      expect(desk).toContain(`<caption class="sr-only">${c.lanesLabel("Dylan")}</caption>`);
      expect((desk.match(/<th scope="col">/g) ?? []).length).toBe(5);
      expect((desk.match(/<th scope="row">/g) ?? []).length).toBe(lanes.length);
      expect(desk).toContain(`aria-label="${c.seesNow}"`);
      expect(desk).toContain(`aria-label="${c.invited}"`);
      expect(desk).toContain(`aria-label="${c.wouldSee}"`);
      // an address keeps its own direction inside a Hebrew page
      expect(desk).toContain('<bdi dir="ltr">yoav@example.com</bdi>');
      const phone = renderToStaticMarkup(<PeopleLanes composition="phone" lanes={lanes} copy={c} childName="Dylan" />);
      expect((phone.match(/data-testid="people-lane"/g) ?? []).length).toBe(lanes.length);
      expect(phone).toContain(`data-col="week" data-cell="see"`);
      expect(phone).toContain(`data-col="activity" data-cell="open"`);
      if (locale === "he") for (const t of [c.joined, c.invited, c.seesNow, c.wouldSee, c.careTeam, c.weekNobody]) expect(t).not.toMatch(/[A-Za-z]/);
    });

    it(`${locale}: the scene counts adults (you plus each live share) and carries the lanes; with no share, production's empty state — no figure, no lanes`, () => {
      harness.locale = locale;
      const c = careCopy(locale).people;
      const lanes = <PeopleLanes composition="desk" lanes={peopleLanes([coParent, week], c, role)} copy={c} childName="Dylan" />;
      const shared = renderToStaticMarkup(<PeopleScene composition="desk" title="T" sub="S" liveCount={2} loading={false} childName="Dylan">{lanes}</PeopleScene>);
      expect(shared).toContain("<b>3</b>");
      expect(shared).toContain(c.adultsSee("Dylan").replace(/'/g, "&#x27;"));
      expect(shared).toContain('data-testid="people-lanes"');
      const none = renderToStaticMarkup(<PeopleScene composition="desk" title="T" sub="S" liveCount={0} loading={false} childName="Dylan">{lanes}</PeopleScene>);
      expect(none).not.toContain('data-testid="people-lanes"');
      expect(none).toContain(c.stopWhoNone);
      const loading = renderToStaticMarkup(<PeopleScene composition="desk" title="T" sub="S" liveCount={2} loading childName="Dylan">{lanes}</PeopleScene>);
      expect(loading).not.toContain('data-testid="people-lanes"');
    });
  }
});
