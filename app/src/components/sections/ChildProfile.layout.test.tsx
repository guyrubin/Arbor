import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChildProfile from "./ChildProfile";
import { en, he } from "../../lib/i18nElevation/wave2Knowledge";
import { en as goalsEn, he as goalsHe } from "../../lib/i18nElevation/goals";
import { en as cpEn, he as cpHe } from "../../lib/i18nElevation/careprofile";
const harness=vi.hoisted(() => ({
 callback:false, locale:"en", pending:[] as unknown[], approved:[] as unknown[], hasHero:true,
 goals:[] as unknown[], challenges:[] as string[], factsAsOf:undefined as unknown, updateChild:vi.fn(),
 setActiveTab:vi.fn(), setState:vi.fn(),
}));
vi.mock("react", async (original) => {
 const real=await original<typeof import("react")>();
 return {...real,
  useState:(initial:unknown) => harness.callback ? [typeof initial==="function" ? (initial as () => unknown)() : initial,harness.setState] : real.useState(initial),
  useMemo:(fn:()=>unknown,deps:unknown[]) => harness.callback ? fn() : real.useMemo(fn,deps),
  useEffect:(fn:()=>void,deps:unknown[]) => {if(!harness.callback)real.useEffect(fn,deps);},
 };
});
vi.mock("../../context/ArborContext",()=>({useArbor:()=>({
 childProfile:{id:"c1",name:"Dylan",age:5,languages:["English"],schoolContext:"School",challenges:harness.challenges,strengths:[],interests:["Dinosaurs"],activeGoals:harness.goals,factsAsOf:harness.factsAsOf},
 milestones:[],behaviorLogs:[],playLogs:[],actionPlans:[],approvedMemoryItems:harness.approved,pendingMemoryItems:harness.pending,setActiveTab:harness.setActiveTab,updateChild:harness.updateChild,
})}));
vi.mock("../../context/ProfileContext",()=>({useProfile:()=>({profiles:[{id:"c1"}]})}));
vi.mock("../../context/AuthContext",()=>({useAuth:()=>({user:{displayName:"Parent"}})}));
vi.mock("../../context/LanguageContext",()=>({useLanguage:()=>({uiLang:harness.locale,t:(key:string,vars?:Record<string,unknown>)=>{
 let value=(harness.locale==="he"?he:en)[key]||(harness.locale==="he"?goalsHe:goalsEn)[key]||(harness.locale==="he"?cpHe:cpEn)[key]||key;
 for(const [k,v] of Object.entries(vars||{}))value=value.replaceAll("{"+k+"}",String(v));
 return value;
}})}));
vi.mock("../ui/HeroAvatar",()=>({HeroAvatar:()=>null,useHeroAvatar:()=>({hasHero:harness.hasHero,name:"Dylan"})}));
vi.mock("../../lib/api",()=>({api:{listShares:vi.fn()}}));
vi.mock("../profile/ProfileEditDrawer",()=>({default:()=>null}));
function elements(node:React.ReactNode):React.ReactElement<Record<string,any>>[]{
 if(!React.isValidElement<Record<string,any>>(node))return[];
 const element=node as React.ReactElement<Record<string,any>>;
 return[element,...React.Children.toArray(element.props.children).flatMap(elements)];
}
beforeEach(()=>{vi.clearAllMocks();harness.callback=false;harness.locale="en";harness.pending=[];harness.approved=[];harness.hasHero=true;harness.goals=[];harness.challenges=[];harness.factsAsOf=undefined;});
describe("W2 Profile identity and protected doors",()=>{
 it("renders one h1 and honest singular counts with parent facts before family",()=>{
  const html=renderToStaticMarkup(<ChildProfile/>);
  expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
  expect(html).toContain("1 child");expect(html).not.toContain("1 children");
  expect(html).toContain("1 family member");
  expect(html.indexOf("English")).toBeLessThan(html.indexOf("cp.family.title"));
  expect(html).toContain("Facts you added");
 });
 it("keeps Family Circle subordinate inside the real facts module",()=>{
  const html=renderToStaticMarkup(<ChildProfile/>);
  const stack:string[]=[];let familyInsideFacts=false;
  for(const token of html.match(/<\/?section\b[^>]*>/g)||[]){
   if(token.startsWith("</")){stack.pop();continue;}
   if(token.includes('aria-labelledby="profile-family-title"'))familyInsideFacts=stack.some(parent=>parent.includes('data-module="profile-who"'));
   stack.push(token);
  }
  expect(familyInsideFacts).toBe(true);
  expect(html).toContain('<h3 id="profile-family-title"');
  expect(html.match(/data-module="profile-(identity|who|now)"/g)).toHaveLength(3);
 });
 it("renders localized interface counts and edit label in HE",()=>{
  harness.locale="he";const html=renderToStaticMarkup(<ChildProfile/>);
  expect(html).toContain("ילד אחד");expect(html).toContain("בן משפחה אחד");expect(html).toContain(he["elev.wave2Knowledge.profile.edit"]);
 });
 it("labels approved and proposed memory separately, without displaying proposal facts",()=>{
  harness.approved=[{memoryId:"a1",fact:"Approved fact"}];harness.pending=[{memoryId:"p1",fact:"Unapproved private proposal"}];
  const html=renderToStaticMarkup(<ChildProfile/>);
  expect(html).toContain("Approved by you");expect(html).toContain("Approved fact");
  expect(html).toContain("awaiting your review");expect(html).not.toContain("Unapproved private proposal");
 });
 it("the primary reviews proposals when present and opens editing otherwise",()=>{
  harness.callback=true;
  const click=()=>elements(ChildProfile()).find(el=>el.props["data-testid"]==="profile-hero-cta")!.props.onClick();
  click();expect(harness.setState).toHaveBeenCalledWith(true);expect(harness.setActiveTab).not.toHaveBeenCalled();
  harness.pending=[{memoryId:"p1"}];click();expect(harness.setActiveTab).toHaveBeenCalledWith("memory");
 });
 it("Create Hero opens the existing edit/creation seam rather than navigating to itself",()=>{
  harness.callback=true;harness.hasHero=false;
  const button=elements(ChildProfile()).find(el=>el.type==="button"&&elements(el).some(child=>child.props.children==="cp.hero.create"));
  // The creation text is a direct child alongside its icon/subline.
  const create=elements(ChildProfile()).find(el=>el.type==="button"&&React.Children.toArray(el.props.children).includes("cp.hero.create"));
  expect(create||button).toBeDefined();(create||button)!.props.onClick();
  expect(harness.setState).toHaveBeenCalledWith(true);expect(harness.setActiveTab).not.toHaveBeenCalled();
 });
});

/* ── B-CAREPRO-29 — "What we're working on" = the parent's chosen goals ───── */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GOAL_TILES } from "../../practice/goalBuilder";
import { buildConsultPacket, buildPacketInput, itemText } from "../../consult/packet";
import { translate } from "../../lib/i18n";

const PROFILE_SRC = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "ChildProfile.tsx"), "utf8").replace(/\r\n/g, "\n");
const GOALS = [
  { goalId: "transitions", label: "Moving between activities more smoothly", domainId: "regulation", addedAt: "2026-09-01T00:00:00.000Z" },
  { goalId: "early-talking", label: "Building early talking / back-and-forth", domainId: "language", addedAt: "2026-09-02T00:00:00.000Z" },
];

describe("B-CAREPRO-29 · Profile shows the parent's chosen goals", () => {
  it("no regex focus derivation and no plan next-step chapter in the source", () => {
    expect(PROFILE_SRC).not.toMatch(/\/anx\|regulat|\/school\|kindergarten/);
    expect(PROFILE_SRC).not.toContain("cp.focus.");
    expect(PROFILE_SRC).not.toContain('data-module="profile-next"');
    expect(PROFILE_SRC).toContain("goalLabel(g, t)");
    // NEGATIVE CONTROL: the pre-change derivation is caught by the same rule
    expect("/anx|regulat|meltdown|emotion|sensory/i.test(challengeText)").toMatch(/\/anx\|regulat/);
  });

  it("HE parent with Hebrew challenges sees their chosen goals in Hebrew; no derived chip", () => {
    harness.locale = "he";
    harness.challenges = ["התקפי זעם במעברים", "חרדה"];
    harness.goals = GOALS;
    const html = renderToStaticMarkup(<ChildProfile />);
    expect(html).toContain(goalsHe["elev.goal.profile.title"]);
    expect(html).toContain(goalsHe["elev.goal.tile.transitions"]);
    expect(html).toContain(goalsHe["elev.goal.tile.early-talking"]);
    expect(html).toContain(goalsHe["elev.goal.profile.edit"]);
    expect(html).not.toContain("Moving between activities");
    expect(html).not.toMatch(/ויסות רגשי|Emotional Regulation/);
  });

  it("EN with no goals: the empty state invites the choice; English challenges derive nothing", () => {
    harness.challenges = ["meltdowns and anxiety"];
    const html = renderToStaticMarkup(<ChildProfile />);
    expect(html).toContain("Choose what you&#x27;re working on");
    expect(html).not.toContain("Emotional Regulation");
    expect(html).toMatch(/data-testid="profile-goals-edit"[^>]*min-h-11|min-h-11[^>]*data-testid="profile-goals-edit"/);
  });

  it("i18n parity: all 8 tiles have EN + HE labels; EN matches the stored label", () => {
    expect(GOAL_TILES).toHaveLength(8);
    for (const tile of GOAL_TILES) {
      const key = `elev.goal.tile.${tile.id}`;
      expect(goalsEn[key], key).toBe(tile.label);
      expect(goalsHe[key], key).toBeTruthy();
      expect(goalsHe[key]).not.toMatch(/[A-Za-z]/);
    }
  });

  it("the packet's Current focus lists the goals first, then challenges — in the reader's language", () => {
    const raw = { profile: { name: "Noa", age: 5, languages: ["Hebrew"], challenges: ["בכי בבוקר"], activeGoals: GOALS }, logs: [], milestones: [], plans: [], memory: [] };
    const packet = buildConsultPacket(buildPacketInput(raw, Date.parse("2026-10-02T09:00:00Z")));
    const focus = packet.sections.flatMap((s) => s.items).find((i) => i.id === "about-focus");
    expect(focus, "about-focus present").toBeTruthy();
    expect(focus!.text).toBe("Current focus: Moving between activities more smoothly, Building early talking / back-and-forth, בכי בבוקר.");
    const heLine = itemText(focus!, "he");
    expect(heLine).toContain(translate("he", "elev.goal.tile.transitions"));
    expect(heLine.indexOf(translate("he", "elev.goal.tile.early-talking"))).toBeLessThan(heLine.indexOf("בכי בבוקר"));
    // challenges-only profiles keep their line (every challenges reader keeps working)
    const legacy = buildConsultPacket(buildPacketInput({ ...raw, profile: { ...raw.profile, activeGoals: undefined, challenges: ["mornings"] } }, Date.now()));
    expect(legacy.sections.flatMap((s) => s.items).find((i) => i.id === "about-focus")!.text).toBe("Current focus: mornings.");
  });
});

/* ── B-CAREPRO-33 — "Still true?" on the facts Care documents quote ───────── */
describe("B-CAREPRO-33 · the Who band dates its facts", () => {
  const DAYS = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

  for (const locale of ["en", "he"] as const) {
    it(`${locale}: a setting dated 120 days ago shows 'as of {month}' and the Still-true prompt`, () => {
      harness.locale = locale;
      harness.factsAsOf = { schoolContext: DAYS(120) };
      const html = renderToStaticMarkup(<ChildProfile />);
      const L = locale === "he" ? cpHe : cpEn;
      expect(html).toContain('data-testid="profile-fact-asof-schoolContext"');
      expect(html).toContain(L["elev.profile.fact.asOf"].replace("{month}", ""));
      expect(html).toContain('data-testid="profile-fact-stale-schoolContext"');
      expect(html).toContain(L["elev.profile.fact.stillTrue"]);
      expect(html).toContain(L["elev.profile.fact.keep"]);
      expect(html).toContain(L["elev.profile.fact.edit"]);
      expect(html).toMatch(/data-testid="profile-fact-keep-schoolContext"[^>]*class="touch-target/);
    });
  }

  it("a 30-day-old setting shows its date and no prompt; an undated one shows neither", () => {
    harness.factsAsOf = { schoolContext: DAYS(30) };
    let html = renderToStaticMarkup(<ChildProfile />);
    expect(html).toContain('data-testid="profile-fact-asof-schoolContext"');
    expect(html).not.toContain("profile-fact-stale-");
    harness.factsAsOf = undefined;
    html = renderToStaticMarkup(<ChildProfile />);
    expect(html).not.toContain("profile-fact-asof-");
  });

  it("Keep stamps today through updateChild; Edit opens the drawer", () => {
    harness.callback = true;
    harness.factsAsOf = { schoolContext: DAYS(120), languages: DAYS(10) };
    // the as-of line rides on Field's `asOf` prop, so walk props.asOf as well as children
    const deep = (node: React.ReactNode): React.ReactElement<Record<string, any>>[] => {
      if (!React.isValidElement<Record<string, any>>(node)) return [];
      const el = node as React.ReactElement<Record<string, any>>;
      return [el, ...[...React.Children.toArray(el.props.children), el.props.asOf].flatMap(deep)];
    };
    const find = (id: string) => deep(ChildProfile()).find((el) => el.props["data-testid"] === id)!;
    const before = Date.now();
    find("profile-fact-keep-schoolContext").props.onClick();
    expect(harness.updateChild).toHaveBeenCalledTimes(1);
    const [childId, patch] = harness.updateChild.mock.calls[0] as [string, { factsAsOf: Record<string, string> }];
    expect(childId).toBe("c1");
    expect(Date.parse(patch.factsAsOf.schoolContext)).toBeGreaterThanOrEqual(before - 1000);
    expect(patch.factsAsOf.languages).toBe((harness.factsAsOf as Record<string, string>).languages);
    find("profile-fact-edit-schoolContext").props.onClick();
    expect(harness.setState).toHaveBeenCalledWith(true);
  });
});
