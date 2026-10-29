import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ChildProfile from "./ChildProfile";
import AspectCard from "../about/AspectCard";
import AboutMemoryCard from "../about/AboutMemoryCard";
import AboutLastVisit from "../about/AboutLastVisit";
import { en, he } from "../../lib/i18nElevation/wave2Knowledge";
import { en as goalsEn, he as goalsHe } from "../../lib/i18nElevation/goals";
import { en as cpEn, he as cpHe } from "../../lib/i18nElevation/careprofile";
import { companionEn, companionHe } from "../../lib/i18nCompanion";
import type { AspectState } from "../../lib/aboutAspects";
const harness=vi.hoisted(() => ({
 callback:false, locale:"en", pending:[] as unknown[], approved:[] as unknown[], hasHero:true,
 goals:[] as unknown[], challenges:[] as string[], factsAsOf:undefined as unknown, updateChild:vi.fn(),
 setActiveTab:vi.fn(), setState:vi.fn(), decide:vi.fn(async()=>true), tell:[] as Record<string,unknown>[], phone:false,
 // B-CAREPRO-37: the bookings and their after-visit notes the memory card reads.
 appts:[] as unknown[], notes:[] as unknown[],
}));
vi.mock("../../hooks/useChildCollection",()=>({useChildCollection:(_id:string,name:string)=>({items:name==="appointments"?harness.appts:name==="apptFollowUps"?harness.notes:[],loaded:true,confirmed:true,error:false,upsert:vi.fn(),remove:vi.fn()})}));
vi.mock("react", async (original) => {
 const real=await original<typeof import("react")>();
 return {...real,
  useState:(initial:unknown) => harness.callback ? [typeof initial==="function" ? (initial as () => unknown)() : initial,harness.setState] : real.useState(initial),
  useMemo:(fn:()=>unknown,deps:unknown[]) => harness.callback ? fn() : real.useMemo(fn,deps),
  useEffect:(fn:()=>void,deps:unknown[]) => {if(!harness.callback)real.useEffect(fn,deps);},
  // B-CAREPRO-38 r2: the ledger's arrival hook keeps its handled arrival in a ref.
  useRef:(initial:unknown) => harness.callback ? {current:initial} : real.useRef(initial),
 };
});
vi.mock("../../context/ArborContext",()=>({useArbor:()=>({
 childProfile:{id:"c1",name:"Noa",age:5,languages:["English"],schoolContext:"School",challenges:harness.challenges,strengths:[],interests:["Dinosaurs"],activeGoals:harness.goals,factsAsOf:harness.factsAsOf},
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
vi.mock("../ui/HeroAvatar",()=>({HeroAvatar:()=>null,useHeroAvatar:()=>({hasHero:harness.hasHero,name:"Noa"})}));
vi.mock("../../lib/api",()=>({api:{listShares:vi.fn()}}));
vi.mock("../profile/ProfileEditDrawer",()=>({default:()=>null}));
// The ONE guided conversation is its own suite (describe.render.test.tsx); here
// only what About opens it with is read.
vi.mock("../describe/TellArborMore",()=>({default:(props:Record<string,unknown>)=>{harness.tell.push(props);return null;}}));
// The phone width seam (v4: About no longer reads it; kept so a regression
// that brings the doors back would render them here).
vi.mock("../companion/ChildDoors",async(importOriginal)=>({...(await importOriginal<typeof import("../companion/ChildDoors")>()),useChildPhoneLayout:()=>harness.phone}));
function elements(node:React.ReactNode):React.ReactElement<Record<string,any>>[]{
 if(!React.isValidElement<Record<string,any>>(node))return[];
 const element=node as React.ReactElement<Record<string,any>>;
 return[element,...React.Children.toArray(element.props.children).flatMap(elements)];
}
const cards=()=>elements(ChildProfile()).filter(el=>el.type===AspectCard);
const card=(id:string)=>cards().find(el=>(el.props.state as AspectState).id===id)!;
beforeEach(()=>{vi.clearAllMocks();harness.appts=[];harness.notes=[];harness.callback=false;harness.locale="en";harness.pending=[];harness.approved=[];harness.hasHero=true;harness.goals=[];harness.challenges=[];harness.factsAsOf=undefined;harness.tell=[];harness.phone=false;});
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
  expect(html).toContain(companionEn["companion.about.title"].replace("{name}","Noa"));
  expect(html).toContain('data-testid="about-told-line"');
 });
 /* v3 F-CHILD-3 review r1 re-pin: Details is ONE tap (a row that opens the
    drawer), so it is a visible top-level module; what folds away is the
    measurements log, demoted inside the route's ONE disclosure. Still three
    top-level modules (budget 3), one demotion, one disclosure. */
 it("three top-level modules; the measurements log is the ONE demotion, in the ONE disclosure",()=>{
  const html=renderToStaticMarkup(<ChildProfile/>);
  expect(html.match(/data-module="[^"]+"/g)).toEqual(['data-module="about-describe"','data-module="about-aspects"','data-module="about-details"','data-module="about-measurements"']);
  expect(html.match(/data-module-demoted/g)).toHaveLength(1);
  expect(html.match(/data-module-disclosure=/g)).toHaveLength(1);
  // the demoted module sits inside the closed disclosure, never on the page face
  const fold=html.slice(html.indexOf('data-module-disclosure="about-details"'));
  expect(html).toMatch(/<details data-testid="profile-measurements" data-module-disclosure="about-details"(?![^>]*\bopen\b)/);
  expect(fold.indexOf('data-module="about-measurements" data-module-demoted')).toBeGreaterThan(-1);
  expect(html).not.toMatch(/data-module="about-details"[^>]*data-module-demoted/);
  expect(html).not.toMatch(/data-module="profile-(identity|who|now|remember|milestones|strengths|language|jump-strip)"/);
 });
 it("Details is ONE tap: the row is a button that opens the drawer (no two-tap fold), with the identity line inside",()=>{
  const html=renderToStaticMarkup(<ChildProfile/>);
  const row=html.slice(html.indexOf('data-testid="about-details-edit"'),html.indexOf("</button>",html.indexOf('data-testid="about-details-edit"')));
  expect(html).toMatch(/<button type="button" data-testid="about-details-edit"[^>]*class="about-details-row min-h-11"/);
  expect(row).toContain('data-testid="profile-identity-line"');
  expect(row).toContain(companionEn["companion.about.details"]);
  expect(row).toContain(companionEn["companion.about.detailsEdit"]);
  expect(html).not.toMatch(/<details[^>]*data-testid="about-details"/);
  harness.callback=true;
  elements(ChildProfile()).find(el=>el.props["data-testid"]==="about-details-edit")!.props.onClick();
  expect(harness.setState).toHaveBeenLastCalledWith(true);
  expect(harness.setActiveTab).not.toHaveBeenCalled();
 });
 /* v4 re-pin: What Arbor remembers is a card on About (AboutMemoryCard). A
    proposal an area shows is decided THERE (never asked twice on one page);
    one that names no area waits in the card with Remember / Not this. */
 it("a proposal no area shows waits in What Arbor remembers with Remember / Not this; one an area shows is not asked twice (EN + HE)",()=>{
  for(const locale of ["en","he"]){
   harness.locale=locale;
   const C=locale==="he"?companionHe:companionEn;
   harness.pending=[];
   let html=renderToStaticMarkup(<ChildProfile/>);
   expect(html).toContain('data-testid="about-memory"');
   expect(html).not.toContain('data-testid="about-memory-pending"');
   expect(html).toContain('data-testid="about-memory-empty"');
   // placed in its area: decided there; the card only notes that more sits below
   harness.pending=[{memoryId:"p1",fact:"Wakes up twice since the move",createdAt:"2026-10-06T10:00:00.000Z"}];
   html=renderToStaticMarkup(<ChildProfile/>);
   expect(html).not.toContain('data-testid="about-memory-pending"');
   expect(html.split("Wakes up twice since the move").length-1).toBe(1);
   expect(html).toContain('data-testid="about-memory-in-areas"');
   // names no area: it waits in the card, decided through the #/memory seam
   harness.pending=[{memoryId:"p2",fact:"fact 1",createdAt:"2026-10-06T10:00:00.000Z"}];
   html=renderToStaticMarkup(<ChildProfile/>);
   const card=html.slice(html.indexOf('data-testid="about-memory"'),html.indexOf("</section>",html.indexOf('data-testid="about-memory"')));
   expect(card).toContain('data-testid="about-memory-pending"');
   expect(card).toContain("Fact 1");
   expect(card).toContain(C["companion.about.memory.remember"]);
   expect(card).toContain(C["companion.about.memory.not"]);
   expect(card).toContain(C["companion.about.memory.waitingOne"]);
   expect(html).not.toContain('data-testid="about-aspect-pending"');
  }
 });
 it("Remember / Not this are the #/memory decision (handleMemoryDecision), one fact at a time",()=>{
  harness.callback=true;
  harness.pending=[{memoryId:"p2",fact:"fact 1",createdAt:"2026-10-06T10:00:00.000Z"}];
  const mounted=elements(ChildProfile()).find(el=>el.type===AboutMemoryCard)!;
  const inner=elements(AboutMemoryCard(mounted.props as React.ComponentProps<typeof AboutMemoryCard>));
  inner.find(el=>el.props["data-testid"]==="about-memory-remember")!.props.onClick();
  inner.find(el=>el.props["data-testid"]==="about-memory-not")!.props.onClick();
  expect(harness.decide.mock.calls).toEqual([["p2","approved"],["p2","rejected"]]);
  // B-CAREPRO-38: the door opens the ledger in place on this page (never a second page).
  inner.find(el=>el.props["data-testid"]==="profile-remember-check")!.props.onClick();
  expect(harness.setActiveTab).not.toHaveBeenCalledWith("memory");
  expect(harness.setState).toHaveBeenCalled();
 });
 it("eight area cards in the brief's order, a 4/2/1 grid, and the memory door",()=>{
  const html=renderToStaticMarkup(<ChildProfile/>);
  // the card's own testid is followed by its data-aspect (about-aspect-ask/-src/-quote are its parts)
  expect([...html.matchAll(/data-testid="about-aspect-([a-z]+)" data-aspect="\1"/g)].map(m=>m[1])).toEqual(["temper","lang","social","routine","sleep","senses","school","strengths"]);
  expect(html).toMatch(/data-testid="profile-remember-check"[^>]*min-h-11|min-h-11[^>]*data-testid="profile-remember-check"/);
  // v4 re-pin: the memory room is the What Arbor remembers card, before the areas.
  expect(html).toContain(companionEn["companion.about.memory.title"]);
  expect(html.indexOf('data-testid="about-memory"')).toBeLessThan(html.indexOf('data-testid="about-aspects"'));
 });
 it("renders the Details line and the area copy in HE, with the language name through its key (law 8)",()=>{
  harness.locale="he";const html=renderToStaticMarkup(<ChildProfile/>);
  expect(html).toContain(companionHe["companion.about.details"]);
  expect(html).toContain(companionHe["companion.about.aspectsKicker"]);
  const line=html.slice(html.indexOf('data-testid="profile-identity-line"'),html.indexOf("</span>",html.indexOf('data-testid="profile-identity-line"')));
  expect(line).toContain("<bdi dir=\"auto\">Noa</bdi>");
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
  // v4: the memory card does not print a fact its area already quotes.
  expect(html.split("Falls asleep after two stories").length-1).toBe(1);
  // no receipt before anything was decided
  expect(html).not.toContain('data-testid="about-aspect-receipt"');
 });
 it("an untold area asks its question and says Not told yet",()=>{
  const html=renderToStaticMarkup(<ChildProfile/>);
  const temper=html.slice(html.indexOf('data-testid="about-aspect-temper"'),html.indexOf("</article>",html.indexOf('data-testid="about-aspect-temper"'))).replace(/&#x27;/g,"'");
  expect(temper).toContain(companionEn["companion.about.ask.temper"].replace("{name}","Noa"));
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
 it("Tell more opens the conversation on that area; the memory door opens the ledger in place (B-CAREPRO-38)",()=>{
  harness.callback=true;
  card("sleep").props.onTell("sleep");
  expect(harness.setState).toHaveBeenLastCalledWith({from:null,open:{aspect:"sleep",mode:"write"}});
  // v4 re-pin: the door is the What Arbor remembers card's own (AboutMemoryCard).
  const mounted=elements(ChildProfile()).find(el=>el.type===AboutMemoryCard)!;
  const door=elements(AboutMemoryCard(mounted.props as React.ComponentProps<typeof AboutMemoryCard>)).find(el=>el.props["data-testid"]==="profile-remember-check")!;
  expect(door.props["aria-controls"]).toBe("about-memory-ledger");
  expect(door.props["aria-expanded"]).toBe(false);
  door.props.onClick();
  expect(harness.setActiveTab).not.toHaveBeenCalled();
  // the toggle is the ledger's own state: closed → open
  const toggle=harness.setState.mock.calls.at(-1)![0] as (o:boolean)=>boolean;
  expect(toggle(false)).toBe(true);
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
  expect(harness.setState).not.toHaveBeenCalledWith(expect.objectContaining({kind:"kept"}));
  resolve(true);await new Promise(r=>setTimeout(r,0));
  // review r1 re-pin: the receipt names the proposal it answered (it clears
  // when a different one arrives, or after RECEIPT_MS — aboutAspects.test.ts)
  expect(harness.setState).toHaveBeenLastCalledWith({kind:"kept",memoryId:"p1"});
  harness.decide.mockResolvedValueOnce(false);
  out().find(el=>el.props["data-testid"]==="about-pending-dismiss")!.props.onClick();
  expect(harness.decide).toHaveBeenLastCalledWith("p1","rejected");
  await new Promise(r=>setTimeout(r,0));
  expect(harness.setState).toHaveBeenLastCalledWith({kind:"failed",memoryId:"p1"});
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

/* v4 re-pin: My child's phone doors are gone. About's one door to #/memory
   is the What Arbor remembers card at every width; the page keeps its three
   modules and its one primary move. */
describe("v4 · About on a phone: no doors; the memory card is the one door to #/memory",()=>{
 const MODULES=['data-module="about-describe"','data-module="about-aspects"','data-module="about-details"','data-module="about-measurements"'];
 it.each(["en","he"] as const)("no doors grid; the card and its one door are there on a phone too (%s)",locale=>{
  harness.locale=locale;harness.phone=true;
  const html=renderToStaticMarkup(<ChildProfile/>);
  expect(html).not.toContain("child-door");
  expect(html.match(/data-testid="profile-remember-check"/g)).toHaveLength(1);
  expect(html).toContain((locale==="he"?companionHe:companionEn)["companion.about.memory.title"]);
  expect(html.match(/data-module="[^"]+"/g)).toEqual(MODULES);
  expect(html.match(/data-primary-move=/g)).toHaveLength(1);
 });
 it("wide: the same: no doors, one door to #/memory, the same modules",()=>{
  const html=renderToStaticMarkup(<ChildProfile/>);
  expect(html).not.toContain('data-testid="child-doors"');
  expect(html.match(/data-testid="profile-remember-check"/g)).toHaveLength(1);
  expect(html.match(/data-module="[^"]+"/g)).toEqual(MODULES);
 });
});

describe("B-CAREPRO-37 · My child › About: the newest after-visit note, its own line under the memory card",()=>{
 const appts=[
  {id:"a1",who:"",role:"Speech therapist",profession:"slp",when:"",whenIso:"2026-10-12T09:00:00.000Z",mode:"In person",status:"done"},
  {id:"a2",who:"",role:"Pediatrician",profession:"pediatrician",when:"",whenIso:"2026-09-01T09:00:00.000Z",mode:"In person",status:"done"},
 ];
 const notes=[
  {id:"f1",apptId:"a2",note:"Keep reading together in the evening.",createdAt:"2026-09-01T12:00:00.000Z"},
  {id:"f2",apptId:"a1",note:"She suggested we wait a beat before naming the toy.",createdAt:"2026-10-12T12:00:00.000Z"},
 ];
 for(const locale of ["en","he"] as const){
  it(`${locale}: one visit line — the profession and the visit day, the parent's words verbatim, a door to every visit`,()=>{
   harness.locale=locale; harness.appts=appts; harness.notes=notes;
   const html=renderToStaticMarkup(<AboutLastVisit/>);
   expect(html.match(/data-testid="about-visit"/g)).toHaveLength(1);
   const meta=html.match(/data-testid="about-visit-meta">([^<]*)</)![1];
   // this harness resolves the companion dictionary (the profession word is the label helper's own key)
   expect(meta).toMatch(locale==="en"?/^Last visit · .*profession\.slp · .*12/:/^הביקור האחרון · .*profession\.slp · .*12/);
   expect(html).toContain("She suggested we wait a beat before naming the toy.");
   expect(html).not.toContain("Keep reading together");
   expect(html).toContain(locale==="en"?"All visits":"כל הביקורים");
  });
 }
 it("r2: it is NOT a row of the memory card (no Edit/Forget there); About renders it right under the card",()=>{
  harness.appts=appts; harness.notes=notes;
  const card=renderToStaticMarkup(<AboutMemoryCard areas={[]}/>);
  expect(card).not.toContain('data-testid="about-visit"');
  expect(card).toContain('data-testid="about-memory-empty"');
  const about=renderToStaticMarkup(<ChildProfile/>);
  const cardEnd=about.indexOf('data-testid="profile-remember-check"');
  const visit=about.indexOf('data-testid="about-visit"');
  expect(visit).toBeGreaterThan(cardEnd);
  expect(about.indexOf('data-testid="about-aspects"')).toBeGreaterThan(visit);
 });
 it("the door opens #/appointments; without a note there is no line",()=>{
  harness.callback=true; harness.appts=appts; harness.notes=notes;
  elements(AboutLastVisit()).find(el=>el.props["data-testid"]==="about-visit-open")!.props.onClick();
  expect(harness.setActiveTab).toHaveBeenCalledWith("appointments");
  harness.callback=false; harness.notes=[];
  expect(renderToStaticMarkup(<AboutLastVisit/>)).toBe("");
 });
});
