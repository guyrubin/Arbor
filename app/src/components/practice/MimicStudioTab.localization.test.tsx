import React, { type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { translate, type UiLang } from "../../lib/i18n";
import { MIMIC_PACKS } from "../../practice/content";
import { localizedMimicPacks } from "../../practice/mimicContent";

// Offline hook harness: exercise the real tab's render and event handlers with
// synthetic records. No browser, permission prompt, speech, model or file save.
const harness = vi.hoisted(() => ({
  locale: "en" as UiLang, kid: false, cursor: 0, state: [] as unknown[],
  items: [] as { packId: string; promptId: string; rating: number }[],
  upsert: vi.fn(), track: vi.fn(), activity: vi.fn(), save: vi.fn(), camera: vi.fn(), timer: vi.fn(),
}));
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual,
    useState: (initial: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.state)) harness.state[index] = initial;
      return [harness.state[index], (next: unknown) => {
        harness.state[index] = typeof next === "function" ? next(harness.state[index]) : next;
      }];
    },
    useMemo: (factory: () => unknown) => factory(),
    useEffect: () => {},
    useRef: (current: unknown) => ({ current }),
    useSyncExternalStore: () => harness.kid,
  };
});
vi.mock("motion/react", () => ({ motion: { span: ({ children }: { children: ReactNode }) => <span>{children}</span> } }));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ childProfile: { id: "synthetic-child", name: "Noa" } }) }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: harness.locale, t: (key: string, vars?: Record<string, string | number>) => translate(harness.locale, key, vars) }) }));
vi.mock("../../practice/usePracticeData", () => ({ usePracticeData: () => ({ mimic: { items: harness.items, upsert: harness.upsert } }) }));
vi.mock("../../lib/analytics", () => ({ track: harness.track }));
vi.mock("../../lib/kidModeGate", () => ({ noteKidActivity: harness.activity, subscribeKidMode: vi.fn(), isKidModeActive: () => harness.kid }));
vi.mock("../../lib/heroAvatarCanvas", () => ({ downloadPracticeStampCanvas: harness.save }));
vi.mock("../ui/HeroAvatar", () => ({ useHeroAvatar: () => ({ url: "data:image/png;base64,synthetic" }) }));
vi.mock("../ui/Icon", () => ({ Icon: () => null }));
vi.mock("../ui/kit", () => ({ cardCls: "card" }));
vi.mock("../ui/playkit", () => ({
  RegisterShell: ({ children, title, subtitle }: any) => <main><h1>{title}</h1><p>{subtitle}</p>{children}</main>,
  PlayPanel: ({ children }: any) => <div>{children}</div>,
  PlayButton: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
  ProgressPips: ({ total, current }: any) => <span data-pips={`${current}/${total}`} />,
  Celebrate: ({ title, subtitle, children }: any) => <aside><h2>{title}</h2><p>{subtitle}</p>{children}</aside>,
}));
vi.mock("../kidmode/game/GameShell", () => ({ GameShell: ({ children, title, instruction }: any) => <main><h1>{title}</h1><p>{instruction}</p>{children}</main> }));
vi.mock("../kidmode/rewards/KidSouvenir", () => ({ KidFinishMoment: () => null }));
vi.mock("../ui/SpeakButton", () => ({ SpeakButton: ({ text, lang }: any) => <button data-speak={text} lang={lang} /> }));
vi.mock("./MimicMatch", () => ({ default: () => <section data-face-match="parent" /> }));
import MimicStudioTab from "./MimicStudioTab";

function elements(node: unknown): ReactElement<any>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as ReactElement<any>;
  return [element, ...elements(element.props.children)];
}
function view(lang: UiLang, packId = MIMIC_PACKS[0].id, promptIdx = 0, won: string | null = null) {
  harness.locale = lang;
  harness.state[0] = packId; harness.state[1] = promptIdx; harness.state[7] = won;
  harness.cursor = 0;
  const tree = MimicStudioTab();
  return { tree, nodes: elements(tree), html: renderToStaticMarkup(tree) };
}
const escaped = (text: string) => renderToStaticMarkup(<>{text}</>);
const textOf = (node: ReactElement<any>) => renderToStaticMarkup(<>{node.props.children}</>);

beforeEach(() => {
  vi.clearAllMocks(); harness.state = []; harness.items = []; harness.kid = false;
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-10T00:00:00Z"));
  vi.stubGlobal("window", { setTimeout: harness.timer });
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: harness.camera } });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("Mimic content reaches every display path", () => {
  it.each(["en", "he"] as const)("renders all packs, every round, focus and the existing read-aloud input in %s", (lang) => {
    const packs = localizedMimicPacks((key) => translate(lang, key));
    for (const pack of packs) for (const [i, prompt] of pack.prompts.entries()) {
      const { nodes, html } = view(lang, pack.id, i);
      for (const card of packs) for (const value of [card.title, card.blurb]) expect(html).toContain(escaped(value));
      for (const value of [prompt.title, prompt.instruction, prompt.focus]) expect(html).toContain(escaped(value));
      expect(html).toContain(escaped(translate(lang, "elev.play.mimic.round", { pack: `${pack.emoji} ${pack.title}`, current: i + 1, total: 6 })));
      expect(nodes.find((node) => node.props.text)?.props).toMatchObject({ text: `${prompt.title}. ${prompt.instruction}`, lang });
      if (lang === "he") {
        for (const english of MIMIC_PACKS) {
          expect(html).not.toContain(escaped(english.title));
          expect(html).not.toContain(escaped(english.blurb));
        }
      }
    }
    expect(harness.camera).not.toHaveBeenCalled();
    expect(harness.save).not.toHaveBeenCalled();
    expect(harness.upsert).not.toHaveBeenCalled();
  });

  it.each(["en", "he"] as const)("uses localized pack titles in completion, the next-pack action and parent stamp in %s", (lang) => {
    const packs = localizedMimicPacks((key) => translate(lang, key));
    for (const pack of packs) {
      const { nodes, html } = view(lang, pack.id, 5, pack.id);
      const next = packs.find((candidate) => candidate.id !== pack.id)!;
      expect(html).toContain(escaped(translate(lang, "elev.play.mimic.packComplete.sub", { name: "Noa", pack: pack.title })));
      expect(html).toContain(escaped(translate(lang, "elev.play.mimic.playPack", { pack: next.title })));
      const save = nodes.find((node) => node.props.onClick && textOf(node) === escaped(translate(lang, "elev.mimic.stamp.save")))!;
      save.props.onClick();
      expect(harness.save).toHaveBeenLastCalledWith({
        imageUrl: "data:image/png;base64,synthetic", name: "Noa",
        eyebrow: translate(lang, "elev.mimic.stamp.eyebrow"),
        headline: translate(lang, "elev.mimic.stamp.headline", { pack: pack.title }),
        sub: translate(lang, "elev.mimic.stamp.sub", { name: "Noa", count: 6 }),
      });
    }
  });

  it.each(["en", "he"] as const)("preserves numeric ratings, IDs, timestamps and once-per-pack completion in %s", (lang) => {
    for (const [rating, key] of [[1, "tried"], [2, "close"], [3, "nailed"]] as const) {
      harness.items = MIMIC_PACKS[0].prompts.slice(0, 5).map((p) => ({ packId: "animal-sounds", promptId: p.id, rating: 1 }));
      const { nodes } = view(lang, "animal-sounds", 5);
      const button = nodes.find((node) => node.props.onClick && textOf(node) === escaped(translate(lang, `elev.play.mimic.${key}`)))!;
      button.props.onClick();
      expect(harness.upsert).toHaveBeenLastCalledWith({ id: `mm-${Date.now()}`, packId: "animal-sounds", promptId: "owl", rating, timestamp: "2026-10-10T00:00:00.000Z" });
      expect(harness.track).toHaveBeenLastCalledWith("mimic_round", { pack: "animal-sounds", prompt: "owl", rating });
      expect(harness.state[6]).toEqual(new Set(["animal-sounds"]));
      expect(harness.state[7]).toBe(rating === 1 ? "animal-sounds" : null);
      expect(harness.timer).toHaveBeenLastCalledWith(expect.any(Function), 900);
      harness.timer.mock.calls.at(-1)![0]();
      expect(harness.state[1]).toBe(0);
    }
  });

  it("switches only presentation when the locale changes and keeps the same selected round", () => {
    const english = view("en", "first-words", 4);
    const hebrew = view("he", "first-words", 4);
    expect(english.html).toContain("Uh-oh!");
    expect(hebrew.html).toContain(escaped(translate("he", "elev.mimic.content.prompt.uhoh.title")));
    expect(harness.state.slice(0, 2)).toEqual(["first-words", 4]);
    expect(harness.upsert).not.toHaveBeenCalled();
    expect(harness.camera).not.toHaveBeenCalled();
  });

  it.each(["en", "he"] as const)("keeps mirror privacy, camera and saving in the parent register in %s", (lang) => {
    const parent = view(lang, "animal-sounds", 0, "animal-sounds");
    expect(parent.html).toContain(escaped(translate(lang, "elev.mimic.mirror.privacyBody")));
    expect(parent.html).toContain("<video");
    expect(parent.html).toContain('data-face-match="parent"');
    expect(parent.html).toContain(escaped(translate(lang, "elev.mimic.stamp.save")));
    harness.kid = true;
    const kid = view(lang, "animal-sounds", 0, "animal-sounds");
    expect(kid.html).not.toContain(escaped(translate(lang, "elev.mimic.mirror.privacyBody")));
    expect(kid.html).not.toContain("<video");
    expect(kid.html).not.toContain('data-face-match="parent"');
    expect(kid.html).not.toContain(escaped(translate(lang, "elev.mimic.stamp.save")));
    expect(harness.camera).not.toHaveBeenCalled();
    expect(harness.save).not.toHaveBeenCalled();
  });
});
