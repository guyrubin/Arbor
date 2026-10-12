import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ChildProfile from "./ChildProfile";
import AspectCard from "../about/AspectCard";
import { en, he } from "../../lib/i18nElevation/wave2Knowledge";
import { en as goalsEn, he as goalsHe } from "../../lib/i18nElevation/goals";
import { en as cpEn, he as cpHe } from "../../lib/i18nElevation/careprofile";
import { companionEn, companionHe } from "../../lib/i18nCompanion";
import type { AspectState } from "../../lib/aboutAspects";
const harness=vi.hoisted(() => ({
 callback:false, locale:"en", pending:[] as unknown[], approved:[] as unknown[], hasHero:true,
 goals:[] as unknown[], challenges:[] as string[], factsAsOf:undefined as unknown, updateChild:vi.fn(),
 setActiveTab:vi.fn(), setState:vi.fn(), decide:vi.fn(async()=>true), tell:[] as Record<string,unknown>[],
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
 milestones:[],behaviorLogs:[],playLogs:[],actionPlans:[],approvedMemoryItems:harness.approved,pendingMemoryItems:harness.pending,setActiveTab:harness.setActiveTab,updateChild:harness.updateChild,handleMemoryDecision:harness.decide,isMemoryUpdating:null,
})}));
vi.mock("../../context/ProfileContext",()=>({useProfile:()=>({profiles:[{id:"c1"}]})}));
vi.mock("../../context/AuthContext",()=>({useAuth:()=>({user:{displayName:"Parent"}})}));
vi.mock("../../context/LanguageContext",()=>({useLanguage:()=>({uiLang:harness.locale,t:(key:string,vars?:Record<string,unknown>)=>{
 const he_=harness.locale==="he";
 let value=(he_?he:en)[key]||(he_?goalsHe:goalsEn)[key]||(he_?cpHe:cpEn)[key]||(he_?companionHe as Record<string,string>:companionEn as Record<string,string>)[key]||key;
 for(const [k,v] of Object.entries(vars||{}))value=value.replaceAll("{"+k+"}",String(v));
 return value;
}})}));
vi.mock("../ui/HeroAvatar",()=>({HeroAvatar:()=>null,useHeroAvatar:()=>({hasHero:harness.hasHero,name:"Dylan"})}));
vi.mock("../../lib/api",()=>({api:{listShares:vi.fn()}}));
vi.mock("../profile/ProfileEditDrawer",()=>({default:()=>null}));
// The ONE guided conversation is its own suite (describe.render.test.tsx); here
// only what About opens it with is read.
vi.mock("../describe/TellArborMore",()=>({default:(props:Record<string,unknown>)=>{harness.tell.push(props);return null;}}));
function elements(node:React.ReactNode):React.ReactElement<Record<string,any>>[]{
 if(!React.isValidElement<Record<string,any>>(node))return[];
 const element=node as React.ReactElement<Record<string,any>>;
 return[element,...React.Children.toArray(element.props.children).flatMap(elements)];
}
const cards=()=>elements(ChildProfile()).filter(el=>el.type===AspectCard);
const card=(id:string)=>cards().find(el=>(el.props.state as AspectState).id===id)!;
beforeEach(()=>{vi.clearAllMocks();harness.callback=false;harness.locale="en";harness.pending=[];harness.approved=[];harness.hasHero=true;harness.goals=[];harness.challenges=[];harness.factsAsOf=undefined;harness.tell=[];});
afterEach(()=>{vi.unstubAllGlobals();});

/* v3 F-CHILD-3 re-pin: the W2 identity band, the Who chapter (with the Family
   Circle) and the remembered list left #/profile for About — the describe
   card, the eight areas and one Details row. */
describe("v3 F-CHILD-3 · About: the describe card, the eight areas, Details",()=>{
 it("renders one h1 and no count row; the Family Circle has left About (Care › Trusted sharing owns it)",()=>{
  const html=renderToStaticMarkup(<ChildProfile/>);
  expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
  expect(html).not.toContain("1 child");expect(html).not.toContain("family member");
  expect(html).not.toContain("cp.family.title");expect(html).not.toContain("profile-family-title");
  expect(html).toContain(companionEn["companion.about.title"].replace("{name}","Dylan"));
  expect(html).toContain('data-testid="about-told-line"');
 });
 it("two top-level modules and the Details row as the ONE demotion disclosure",()=>{
  const html=renderToStaticMarkup(<ChildProfile/>);
  expect(html.match(/data-module="[^"]+"/g)).toEqual(['data-module="about-describe"','data-module="about-aspects"','data-module="about-details"']);
  expect(html.match(/data-module-demoted/g)).toHaveLength(1);
  expect(html.match(/data-module-disclosure=/g)).toHaveLength(1);
  expect(html).not.toMatch(/data-module="profile-(identity|who|now|remember|milestones|strengths|language|jump-strip)"/);
 });
 it("eight area cards in the brief's order, a 4/2/1 grid, and the memory door",()=>{
  const html=renderToStaticMarkup(<ChildProfile/>);
  // the card's own testid is followed by its data-aspect (about-aspect-ask/-src/-quote are its parts)
  expect([...html.matchAll(/data-testid="about-aspect-([a-z]+)" data-aspect="\1"/g)].map(m=>m[1])).toEqual(["temper","lang","social","routine","sleep","senses","school","strengths"]);
  expect(html).toMatch(/data-testid="profile-remember-check"[^>]*min-h-11|min-h-11[^>]*data-testid="profile-remember-check"/);
  expect(html).toContain(cpEn["elev.profile.remembers.title"]);
 });
 it("renders the Details line and the area copy in HE, with the language name through its key (law 8)",()=>{
  harness.locale="he";const html=renderToStaticMarkup(<ChildProfile/>);
  expect(html).toContain(companionHe["companion.about.details"]);
  expect(html).toContain(companionHe["companion.about.aspectsKicker"]);
  const line=html.slice(html.indexOf('data-testid="profile-identity-line"'),html.indexOf("</span>",html.indexOf('data-testid="profile-identity-line"')));
  expect(line).toContain("<bdi dir=\"auto\">Dylan</bdi>");
  const roles=html.slice(html.indexOf('data-testid="about-lang-roles"'),html.indexOf("</dl>",html.indexOf('data-testid="about-lang-roles"')));
  expect(roles).not.toContain("English");expect(roles).toContain("ob.lang.english");
 });
 it("the count line says how many areas were told — never against eight, no share, no bar",()=>{
  for(const locale of ["en","he"]){
   harness.locale=locale;
   const html=renderToStaticMarkup(<ChildProfile/>);
   const line=html.slice(html.indexOf('data-testid="about-told-line"'),html.indexOf("</p>",html.indexOf('data-testid="about-told-line"'))).replace(/&#x27;/g,"'");
   // lang (English), school (School) and strengths (Dinosaurs) are told; no as-of stamps, so the line is undated
   expect(line).toContain((locale==="he"?companionHe:companionEn)["companion.about.toldManyUndated"].replace("{n}","3"));
   expect(line).not.toMatch(/%|\bof 8\b|מתוך|\/\s*8/);
   expect(html).not.toMatch(/role="progressbar"|<progress\b|<meter\b/);
  }
 });
 it("a kept fact is quoted in its area with its day; a proposal waits in its area with Confirm / No",()=>{
  harness.approved=[{memoryId:"a1",fact:"Falls asleep after two stories",createdAt:"2026-10-05T10:00:00.000Z"}];
  harness.pending=[{memoryId:"p1",fact:"Wakes up twice since the move",createdAt:"2026-10-06T10:00:00.000Z"}];
  const html=renderToStaticMarkup(<ChildProfile/>);
  const sleep=html.slice(html.indexOf('data-testid="about-aspect-sleep"'),html.indexOf("</article>",html.indexOf('data-testid="about-aspect-sleep"')));
  expect(sleep).toContain("Falls asleep after two stories");
  expect(sleep).toContain("Noted · Oct 5, 2026");
  expect(sleep).toContain('data-testid="about-aspect-pending"');
  expect(sleep).toContain(companionEn["companion.about.pending"].trim());
  expect(sleep).toContain("Wakes up twice since the move");
  expect(sleep).toContain('data-testid="about-pending-confirm"');expect(sleep).toContain('data-testid="about-pending-dismiss"');
  expect(html.split("Falls asleep after two stories").length-1).toBe(1);
  // no receipt before anything was decided
  expect(html).not.toContain('data-testid="about-aspect-receipt"');
 });
 it("an untold area asks its question and says Not told yet",()=>{
  const html=renderToStaticMarkup(<ChildProfile/>);
  const temper=html.slice(html.indexOf('data-testid="about-aspect-temper"'),html.indexOf("</article>",html.indexOf('data-testid="about-aspect-temper"'))).replace(/&#x27;/g,"'");
  expect(temper).toContain(companionEn["companion.about.ask.temper"].replace("{name}","Dylan"));
  expect(temper).toContain(companionEn["companion.milestones.notTold"]);
  expect(temper).toContain(companionEn["companion.milestones.tell"]);
 });
 it("the primary is the ONE 'Tell Arbor by voice' door (capture-moment) in every state; Write opens the same conversation",()=>{
  harness.callback=true;
  const stamped=()=>elements(ChildProfile()).filter(el=>el.props["data-primary-move"]);
  expect(stamped()).toHaveLength(1);
  expect(stamped()[0].props["data-primary-move"]).toBe("capture-moment");
  expect(stamped()[0].props["data-testid"]).toBe("about-voice");
  stamped()[0].props.onClick();expect(harness.setState).toHaveBeenLastCalledWith({from:null,open:{aspect:null,mode:"voice"}});
  elements(ChildProfile()).find(el=>el.props["data-testid"]==="about-write")!.props.onClick();
  expect(harness.setState).toHaveBeenLastCalledWith({from:null,open:{aspect:null,mode:"write"}});
  expect(harness.setActiveTab).not.toHaveBeenCalled();
  harness.pending=[{memoryId:"p1",fact:"Sleeps late"},{memoryId:"p2",fact:"Loves trains"}];
  expect(stamped()).toHaveLength(1);
  expect(elements(ChildProfile()).filter(el=>el.props["data-primary-move"]==="approve-memory")).toHaveLength(0);
 });
 it("Tell more opens the conversation on that area; the memory door goes to #/memory",()=>{
  harness.callback=true;
  card("sleep").props.onTell("sleep");
  expect(harness.setState).toHaveBeenLastCalledWith({from:null,open:{aspect:"sleep",mode:"write"}});
  elements(ChildProfile()).find(el=>el.props["data-testid"]==="profile-remember-check")!.props.onClick();
  expect(harness.setActiveTab).toHaveBeenCalledWith("memory");
 });
 it("?aspect=<id> opens the conversation with that area chosen; an unknown id opens nothing",()=>{
  harness.callback=true;
  vi.stubGlobal("window",{location:{hash:"#/profile?aspect=lang"},addEventListener(){},removeEventListener(){}});
  const open=()=>elements(ChildProfile()).filter(el=>typeof el.type==="function"&&"aspect" in el.props&&"mode" in el.props&&"onClose" in el.props);
  expect(open()).toHaveLength(1);
  expect(open()[0].props.aspect).toBe("lang");expect(open()[0].props.mode).toBe("write");
  vi.stubGlobal("window",{location:{hash:"#/profile?aspect=weather"},addEventListener(){},removeEventListener(){}});
  expect(open()).toHaveLength(0);
  vi.stubGlobal("window",{location:{hash:"#/profile"},addEventListener(){},removeEventListener(){}});
  expect(open()).toHaveLength(0);
 });
 it("Confirm / No are the #/memory decision; the receipt shows only after the write resolved",async()=>{
  harness.callback=true;
  harness.pending=[{memoryId:"p1",fact:"Wakes up twice since the move",createdAt:"2026-10-06T10:00:00.000Z"}];
  const out=()=>elements(AspectCard({...card("sleep").props} as React.ComponentProps<typeof AspectCard>));
  let resolve!:(ok:boolean)=>void;
  harness.decide.mockImplementationOnce(()=>new Promise<boolean>(r=>{resolve=r;}));
  out().find(el=>el.props["data-testid"]==="about-pending-confirm")!.props.onClick();
  expect(harness.decide).toHaveBeenCalledWith("p1","approved");
  expect(harness.setState).not.toHaveBeenCalledWith("kept");
  resolve(true);await new Promise(r=>setTimeout(r,0));
  expect(harness.setState).toHaveBeenLastCalledWith("kept");
  harness.decide.mockResolvedValueOnce(false);
  out().find(el=>el.props["data-testid"]==="about-pending-dismiss")!.props.onClick();
  expect(harness.decide).toHaveBeenLastCalledWith("p1","rejected");
  await new Promise(r=>setTimeout(r,0));
  expect(harness.setState).toHaveBeenLastCalledWith("failed");
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

/* ── B-CAREPRO-29 — the parent's chosen goals ─────────────────────────────── */
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

// v3 F-CHILD-3 re-pin: goals live on Milestones (portrait-goals-edit); About
// carries no goal line, and still derives no focus from the challenges.
describe("B-CAREPRO-29 · goals live on Milestones; About derives no focus", () => {
  it("no regex focus derivation, no plan next-step chapter and no goal line in the source", () => {
    expect(PROFILE_SRC).not.toMatch(/\/anx\|regulat|\/school\|kindergarten/);
    expect(PROFILE_SRC).not.toContain("cp.focus.");
    expect(PROFILE_SRC).not.toContain('data-module="profile-next"');
    expect(PROFILE_SRC).not.toContain("<GoalFocusLine");
    // NEGATIVE CONTROL: the pre-change derivation is caught by the same rule
    expect("/anx|regulat|meltdown|emotion|sensory/i.test(challengeText)").toMatch(/\/anx\|regulat/);
  });

  it("HE: chosen goals are not restated on About; no derived chip", () => {
    harness.locale = "he";
    harness.challenges = ["התקפי זעם במעברים", "חרדה"];
    harness.goals = GOALS;
    const html = renderToStaticMarkup(<ChildProfile />);
    expect(html).not.toContain(goalsHe["elev.goal.profile.title"]);
    expect(html).not.toContain(goalsHe["elev.goal.tile.early-talking"]);
    expect(html).not.toContain('data-testid="profile-goals-edit"');
    expect(html).not.toContain("Moving between activities");
    expect(html).not.toMatch(/ויסות רגשי|Emotional Regulation/);
  });

  it("EN with no goals: no goal invitation on About; English challenges derive nothing", () => {
    harness.challenges = ["meltdowns and anxiety"];
    const html = renderToStaticMarkup(<ChildProfile />);
    expect(html).not.toContain("Choose what you&#x27;re working on");
    expect(html).not.toContain("Emotional Regulation");
    expect(html).not.toContain('data-testid="profile-goals-edit"');
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
// v3 F-CHILD-3 re-pin: the dated facts moved from the Who band into their
// areas; the day reads in the card's source line ("In your words · {day}").
describe("B-CAREPRO-33 · the areas date their facts", () => {
  const DAYS = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
  const schoolCard = (html: string) => html.slice(html.indexOf('data-testid="about-aspect-school"'), html.indexOf("</article>", html.indexOf('data-testid="about-aspect-school"')));

  for (const locale of ["en", "he"] as const) {
    it(`${locale}: a setting dated 120 days ago shows its day and the Still-true prompt`, () => {
      harness.locale = locale;
      harness.factsAsOf = { schoolContext: DAYS(120) };
      const html = schoolCard(renderToStaticMarkup(<ChildProfile />));
      const L = locale === "he" ? cpHe : cpEn;
      const C = locale === "he" ? companionHe : companionEn;
      expect(html).toContain('data-testid="about-aspect-src"');
      expect(html).toContain(C["companion.milestones.srcWords"].replace("{date}", "").trim());
      expect(html).toContain('data-testid="profile-fact-stale-schoolContext"');
      expect(html).toContain(L["elev.profile.fact.stillTrue"]);
      expect(html).toContain(L["elev.profile.fact.keep"]);
      expect(html).toContain(L["elev.profile.fact.edit"]);
      expect(html).toMatch(/class="touch-target"[^>]*data-testid="profile-fact-keep-schoolContext"|data-testid="profile-fact-keep-schoolContext"[^>]*class="touch-target/);
    });
  }

  it("a 30-day-old setting shows its day and no prompt; an undated one reads 'In your words' with no day", () => {
    harness.factsAsOf = { schoolContext: DAYS(30) };
    let html = schoolCard(renderToStaticMarkup(<ChildProfile />));
    expect(html).toContain(companionEn["companion.milestones.srcWords"].replace("{date}", "").trim());
    expect(html).not.toContain("profile-fact-stale-");
    harness.factsAsOf = undefined;
    html = schoolCard(renderToStaticMarkup(<ChildProfile />));
    expect(html).toContain(`>${companionEn["companion.milestones.srcWordsUndated"]}<`);
    expect(html).not.toContain("profile-fact-stale-");
  });

  it("Keep stamps today through updateChild; Edit opens the drawer", () => {
    harness.callback = true;
    harness.factsAsOf = { schoolContext: DAYS(120), languages: DAYS(10) };
    const onEditDetails = vi.fn();
    const props: React.ComponentProps<typeof AspectCard> = { ...(card("school").props as React.ComponentProps<typeof AspectCard>), onEditDetails };
    const find = (id: string) => elements(AspectCard(props)).find((el) => el.props["data-testid"] === id)!;
    const before = Date.now();
    find("profile-fact-keep-schoolContext").props.onClick();
    expect(harness.updateChild).toHaveBeenCalledTimes(1);
    const [childId, patch] = harness.updateChild.mock.calls[0] as [string, { factsAsOf: Record<string, string> }];
    expect(childId).toBe("c1");
    expect(Date.parse(patch.factsAsOf.schoolContext)).toBeGreaterThanOrEqual(before - 1000);
    expect(patch.factsAsOf.languages).toBe((harness.factsAsOf as Record<string, string>).languages);
    find("profile-fact-edit-schoolContext").props.onClick();
    expect(onEditDetails).toHaveBeenCalledTimes(1);
    // and ChildProfile wires Edit to the drawer
    card("school").props.onEditDetails();
    expect(harness.setState).toHaveBeenCalledWith(true);
  });
});
