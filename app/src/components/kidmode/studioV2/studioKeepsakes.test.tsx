import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ items: [] as any[] }));
vi.mock("../../../context/ArborContext", () => ({ useArbor: () => ({ childProfile: { id: "kid", age: 6, languages: ["English"] } }) }));
vi.mock("../../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: "en" }) }));
vi.mock("../rewards/useKidSouvenirs", () => ({ useKidSouvenirs: () => ({ items: h.items, loaded: true, isCurrent: () => true }) }));
vi.mock("../rewards/KidSouvenir", () => ({ KidFinishMoment: ({ refId }: { refId: string }) => <span data-finish={refId} />, KidSouvenirSticker: ({ refId }: { refId: string }) => <span data-earned={refId} /> }));
vi.mock("./StudioHome", () => ({ StudioPortrait: () => null, StudioSky: () => <div data-sky="" />, StudioPortalArt: () => <img alt="" src="neutral-library.webp" /> }));
vi.mock("../../../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "owner" } }) }));
vi.mock("../../../hooks/useKidTheme", () => ({ useKidTheme: () => "film3d" }));
vi.mock("../useChildLibraryBooks", () => ({ useChildLibraryBooks: () => [] }));
vi.mock("../LibraryBookCover", () => ({ LibraryBookCover: () => null }));
vi.mock("../../ui/ArborMascot", () => ({ ArborMascot: () => null }));
vi.mock("./studioProgress", async original => ({ ...await original<typeof import("./studioProgress")>(), useStudioQuestProgress: () => ({ steps: ["spot", "pillows", "lights", "pause"], choices: {}, completed: true, loaded: true }) }));
import { StudioQuest } from "./StudioQuest";
import { StudioWorld } from "./StudioWorld";
import { souvenirToAward, souvenirStrip, QUEST_SOUVENIR_REF } from "../rewards/kidSouvenirs";
import { StudioCollection } from "./StudioCollection";
const render = () => renderToStaticMarkup(<StudioCollection onActivity={() => {}} onBooks={() => {}} onHome={() => {}} />);
describe("Sky collection shell", () => {
  it("shows only the actual owned puzzle keepsake and shared sky, without an inner Home control", () => {
    h.items = [{ id: "world:puzzle", kind: "world", refId: "puzzle", earnedAt: "2026-10-13T09:00:00Z" }];
    const html = render();
    expect(html).toContain('class="studio-v2 studio-keepsakes"');
    expect(html).toContain("data-sky");
    expect(html.match(/data-earned=/g)).toHaveLength(1);
    expect(html).toContain('data-earned="puzzle"');
    expect(html).not.toContain("My sky");
    expect(html).toContain("My books");
  });
  it("does not invent silhouettes or owned rows for an empty collection", () => { h.items = []; expect(render()).not.toContain("data-earned"); });
});

function nodes(value: any): any[] { return Array.isArray(value) ? value.flatMap(nodes) : value && typeof value === "object" ? [value, ...nodes(value.props?.children)] : []; }
describe("quest is a distinct completion", () => {
  it("awards the quest reference, preserves it in collection, and leaves Calm Builder unearned", () => {
    const quest = souvenirToAward([], "world", QUEST_SOUVENIR_REF, new Date("2026-10-13"))!;
    expect(quest.refId).not.toBe("calm-builder");
    expect(souvenirStrip([quest])).toEqual([quest]);
    h.items = [quest];
    expect(renderToStaticMarkup(<StudioQuest onHome={() => {}} />)).toContain('data-finish="kid-quest"');
    const world = renderToStaticMarkup(<StudioWorld worldId="feelings" onActivity={() => {}} onBooks={() => {}} />);
    expect(world).toContain('data-kept="false"');
    expect(world).not.toContain('data-kept="true"');
    expect(souvenirToAward([quest], "world", "calm-builder", new Date())).not.toBeNull();
  });
  it("opens the optional quest from its correctly named collection card, never the game", () => {
    h.items = [souvenirToAward([], "world", QUEST_SOUVENIR_REF, new Date())!];
    const onQuest = vi.fn(), onActivity = vi.fn(), onBooks = vi.fn();
    const tree = StudioCollection({ onQuest, onActivity, onBooks, onHome: vi.fn() });
    const card = nodes(tree).find(n => n.type === "button" && nodes(n.props.children).some(c => c.type === "span" && c.props.children === "A cozy corner"));
    expect(card).toBeDefined(); card.props.onClick();
    expect(onQuest).toHaveBeenCalledTimes(1); expect(onActivity).not.toHaveBeenCalled(); expect(onBooks).not.toHaveBeenCalled();
    expect(render()).toContain("A cozy corner");
  });
});
