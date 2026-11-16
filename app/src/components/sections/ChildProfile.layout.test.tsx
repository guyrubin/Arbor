import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ChildProfile from "./ChildProfile";
import AspectCard from "../about/AspectCard";
import { PendingNote, StageCard } from "../about/AboutAnswer";
import AboutChildTile from "../about/AboutChildTile";
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
 // v10: which composition renders (desktop ≥1024 px, else phone).
 desk:false,
}));
vi.mock("../../design/useComposition",()=>({useComposition:()=>harness.desk?"desk":"phone"}));
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
beforeEach(()=>{vi.clearAllMocks();harness.appts=[];harness.notes=[];harness.callback=false;harness.locale="en";harness.pending=[];harness.approved=[];harness.hasHero=true;harness.goals=[];harness.challenges=[];harness.factsAsOf=undefined;harness.tell=[];harness.phone=false;harness.desk=false;});
afterEach(()=>{vi.unstubAllGlobals();});

/* v10.1 re-pin: #/profile is the N-About route — 1 Answer Arbor (the stage:
   the notebook heading and the next proposal), 2 Waiting, and remembered
   (Tell Arbor by voice / Write, the next notes, the newest remembered fact),
   3 What you told me, what the coach sees (+ the child's tile), 4 What Arbor
   knows (the eight areas). One tree per composition. */
const both=[false,true] as const;
const label=(desk:boolean)=>desk?"desktop":"phone";
describe("v10.1 · About: the notebook, the parent's words, the eight areas",()=>{
 for(const desk of both){
  it(`${label(desk)}: one h1 (the notebook's), no count row; the Family Circle has left About`,()=>{
   harness.desk=desk;
   const html=renderToStaticMarkup(<ChildProfile/>);
   expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
   expect(html).toMatch(new RegExp(`<h1[^>]*>${companionEn["companion.about.memory.title"].replace("{name}","Noa").replace("’","&#x27;|’").replace(/[.]/g,"\\.")}`.replace("&#x27;|’","(?:’|&#x27;)")));
   expect(html).not.toContain("1 child");expect(html).not.toContain("family member");
   expect(html).not.toContain("cp.family.title");expect(html).not.toContain("profile-family-title");
   expect(html).toContain(companionEn["companion.about.title"].replace("{name}","Noa"));
   expect(html).toContain('data-testid="about-told-line"');
  });
  /* Three top-level modules (budget 3); the measurements log is the ONE
     demotion, inside the route's ONE disclosure (a button-shaped summary in
     the child's tile). */
  it(`${label(desk)}: three top-level modules; the measurements log is the ONE demotion, in the ONE disclosure`,()=>{
   harness.desk=desk;
   const html=renderToStaticMarkup(<ChildProfile/>);
   const stamps=html.match(/data-module="[^"]+"/g)!;
   expect([...stamps].sort()).toEqual(['data-module="about-answer"','data-module="about-aspects"','data-module="about-measurements"','data-module="about-told"']);
   expect(html.match(/data-module-demoted/g)).toHaveLength(1);
   expect(html.match(/data-module-disclosure=/g)).toHaveLength(1);
   expect(html).toMatch(/<details data-testid="profile-measurements" data-module-disclosure="about-details"(?![^>]*\bopen\b)/);
   const fold=html.slice(html.indexOf('data-module-disclosure="about-details"'));
   expect(fold.indexOf('data-module="about-measurements" data-module-demoted')).toBeGreaterThan(-1);
   expect(html).not.toMatch(/data-module="profile-(identity|who|now|remember|milestones|strengths|language|jump-strip)"/);
  });
  it(`${label(desk)}: the guide's stops match the numbered sections`,()=>{
   harness.desk=desk;
   harness.approved=[{memoryId:"a9",fact:"Hums a quiet tune",createdAt:"2026-10-05T10:00:00.000Z"}];
   const html=renderToStaticMarkup(<ChildProfile/>);
   const hrefs=[...html.matchAll(/class="gstop[^"]*" href="#([a-z]+)"/g)].map(m=>m[1]);
   expect(hrefs).toEqual(desk?["answer","waiting","tell","areas"]:["answer","waiting","areas"]);
   for(const id of hrefs) expect(html).toContain(`id="${id}"`);
  });
 }
 it("Edit details is ONE tap: a button in the child's tile that opens the drawer, beside the identity line",()=>{
  harness.desk=true;
  const html=renderToStaticMarkup(<ChildProfile/>);
  const tile=html.slice(html.indexOf('data-testid="about-details"'));
  expect(tile).toContain('data-testid="profile-identity-line"');
  expect(tile).toMatch(/<button type="button" class="btn sm nowrap about-btn-tint touch-target" data-testid="about-details-edit">/);
  expect(tile).toContain(companionEn["companion.about.detailsEdit"]);
  harness.callback=true;
  const mounted=elements(ChildProfile()).find(el=>el.type===AboutChildTile)!;
  mounted.props.onEditDetails();
  expect(harness.setState).toHaveBeenLastCalledWith(true);
  expect(harness.setActiveTab).not.toHaveBeenCalled();
 });
 /* A proposal an area shows is decided THERE (never asked twice on one
    page); one that names no area waits as the stage card, Remember / Not this. */
 for(const desk of both){
  it(`${label(desk)}: a proposal no area shows is the stage card with Remember / Not this / Edit; one an area shows is not asked twice (EN + HE)`,()=>{
   harness.desk=desk;
   for(const locale of ["en","he"]){
    harness.locale=locale;
    const C=locale==="he"?companionHe:companionEn;
    harness.pending=[];
    let html=renderToStaticMarkup(<ChildProfile/>);
    expect(html).not.toContain('data-testid="about-memory-pending"');
    expect(html).toContain('data-testid="about-memory-empty"');
    harness.pending=[{memoryId:"p1",fact:"Wakes up twice since the move",createdAt:"2026-10-06T10:00:00.000Z"}];
    html=renderToStaticMarkup(<ChildProfile/>);
    expect(html).not.toContain('data-testid="about-memory-pending"');
    expect(html.split("Wakes up twice since the move").length-1).toBe(1);
    expect(html).toContain('data-testid="about-memory-in-areas"');
    harness.pending=[{memoryId:"p2",fact:"fact 1",createdAt:"2026-10-06T10:00:00.000Z"}];
    html=renderToStaticMarkup(<ChildProfile/>);
    const stage=html.slice(html.indexOf('data-stage=""'),html.indexOf('id="waiting"')>0?html.indexOf('id="waiting"'):undefined);
    expect(stage).toContain("Fact 1");
    expect(stage).toContain(C["companion.about.memory.remember"]);
    expect(stage).toContain(C["companion.about.memory.not"]);
    expect(html).not.toContain('data-testid="about-aspect-pending"');
    // the figure counts notes waiting, with its unit in words
    expect(html).toMatch(/<div class="fig[^"]*"><b>1<\/b><span>/);
   }
  });
 }
 it("Remember / Not this are the ledger's decision (handleMemoryDecision), one fact at a time — on the stage and in the rail",()=>{
  harness.callback=true;
  const m={memoryId:"p2",fact:"Fact 1",createdAt:"2026-10-06T10:00:00.000Z"} as never;
  const stage=elements(StageCard({m,stored:m,index:0,queueLength:2,onEdited:()=>{}}));
  stage.find(el=>el.props["data-testid"]==="about-memory-remember")!.props.onClick();
  stage.find(el=>el.props["data-testid"]==="about-memory-not")!.props.onClick();
  const rail=elements(PendingNote({m}));
  rail.find(el=>el.props["data-testid"]==="about-memory-remember")!.props.onClick();
  expect(harness.decide.mock.calls).toEqual([["p2","approved"],["p2","rejected"],["p2","approved"]]);
  // Edit opens the ledger's one edit form in place (no route change)
  stage.find(el=>el.props["data-testid"]==="about-memory-edit")!.props.onClick();
  expect(harness.setState).toHaveBeenLastCalledWith(true);
  expect(harness.setActiveTab).not.toHaveBeenCalled();
 });
 it("the first three proposals no area shows are asked on the page (stage + rail); the rest wait in the ledger",()=>{
  harness.desk=true;
  harness.pending=["fact a","fact b","fact c","fact d"].map((fact,i)=>({memoryId:`q${i}`,fact,createdAt:`2026-10-0${i+1}T10:00:00.000Z`}));
  const html=renderToStaticMarkup(<ChildProfile/>);
  expect(html.match(/data-testid="about-memory-pending"/g)).toHaveLength(3);
  expect(html).not.toContain("Fact d");
  expect(html).toContain(">1 of 4<");
 });
 for(const desk of both){
  it(`${label(desk)}: eight area rows in the brief's order, and the one door to everything Arbor remembers`,()=>{
   harness.desk=desk;
   const html=renderToStaticMarkup(<ChildProfile/>);
   expect([...html.matchAll(/data-testid="about-aspect-([a-z]+)" data-aspect="\1"/g)].map(m=>m[1])).toEqual(["temper","lang","social","routine","sleep","senses","school","strengths"]);
   expect(html.match(/data-testid="profile-remember-check"/g)).toHaveLength(1);
   expect(html).toContain(companionEn["companion.about.memory.open"]);
   expect(html.indexOf('id="answer"')).toBeLessThan(html.indexOf('data-testid="about-aspects"'));
  });
 }
 it("renders the identity and the area copy in HE, with the language name through its key (law 8)",()=>{
  harness.locale="he";harness.desk=true;const html=renderToStaticMarkup(<ChildProfile/>);
  expect(html).toContain(companionHe["companion.about.detailsEdit"]);
  expect(html).toContain(companionHe["companion.about.aspectsTitle"]);
  const line=html.slice(html.indexOf('data-testid="profile-identity-line"'),html.indexOf("</span>",html.indexOf('data-testid="profile-identity-line"')));
  expect(line).toContain("<bdi dir=\"auto\">Noa</bdi>");
  const roles=html.slice(html.indexOf('data-testid="about-lang-roles"'),html.indexOf("</small>",html.indexOf('data-testid="about-lang-roles"')));
  expect(roles).not.toContain("English");expect(roles).toContain("ob.lang.english");
 });
 it("the count line says how many areas were told — never against eight, no share, no bar",()=>{
  for(const locale of ["en","he"]){
   harness.locale=locale;
   const html=renderToStaticMarkup(<ChildProfile/>);
   const line=html.slice(html.indexOf('data-testid="about-told-line"'),html.indexOf("</span>",html.indexOf('data-testid="about-told-line"'))).replace(/&#x27;/g,"'");
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
  // an ink token for the told fact, a pencil token for the proposal
  expect(sleep).toMatch(/class="tok md told"/);expect(sleep).toMatch(/class="tok ai md"/);
  // the notebook does not print a fact its area already quotes
  expect(html.split("Falls asleep after two stories").length-1).toBe(1);
  expect(html).not.toContain('data-testid="about-aspect-receipt"');
 });
 it("an untold area asks its question, says Not told yet, and carries no token",()=>{
  const html=renderToStaticMarkup(<ChildProfile/>);
  const temper=html.slice(html.indexOf('data-testid="about-aspect-temper"'),html.indexOf("</article>",html.indexOf('data-testid="about-aspect-temper"'))).replace(/&#x27;/g,"'");
  expect(temper).toContain(companionEn["companion.about.ask.temper"].replace("{name}","Noa"));
  expect(temper).toContain(companionEn["companion.milestones.notTold"]);
  expect(temper).toContain(companionEn["companion.milestones.tell"]);
  expect(temper).not.toContain('class="tok');
 });
 for(const desk of both){
  it(`${label(desk)}: the primary is the ONE 'Tell Arbor by voice' door (capture-moment) in every state; Write opens the same conversation`,()=>{
   harness.callback=true;harness.desk=desk;
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
 }
 it("Tell more opens the conversation on that area; the door opens the ledger in place (B-CAREPRO-38); How Arbor works opens the page",()=>{
  harness.callback=true;harness.desk=true;
  card("sleep").props.onTell("sleep");
  expect(harness.setState).toHaveBeenLastCalledWith({from:null,open:{aspect:"sleep",mode:"write"}});
  const tree=elements(ChildProfile());
  const door=tree.find(el=>el.props["data-testid"]==="profile-remember-check")!;
  expect(door.props["aria-controls"]).toBe("about-memory-ledger");
  expect(door.props["aria-expanded"]).toBe(false);
  tree.find(el=>el.props.className==="about-ledger-door")!.props.onClick();
  expect(harness.setActiveTab).not.toHaveBeenCalled();
  const toggle=harness.setState.mock.calls.at(-1)![0] as (o:boolean)=>boolean;
  expect(toggle(false)).toBe(true);
  tree.find(el=>typeof el.props.children==="string"&&el.props.children==="nav.view.science"&&el.props.onClick)!.props.onClick();
  expect(harness.setActiveTab).toHaveBeenCalledWith("science");
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
 it("Confirm / No are the ledger's decision; the receipt shows only after the write resolved",async()=>{
  harness.callback=true;
  harness.pending=[{memoryId:"p1",fact:"Wakes up twice since the move",createdAt:"2026-10-06T10:00:00.000Z"}];
  const out=()=>elements(AspectCard({...card("sleep").props} as React.ComponentProps<typeof AspectCard>));
  let resolve!:(ok:boolean)=>void;
  harness.decide.mockImplementationOnce(()=>new Promise<boolean>(r=>{resolve=r;}));
  out().find(el=>el.props["data-testid"]==="about-pending-confirm")!.props.onClick();
  expect(harness.decide).toHaveBeenCalledWith("p1","approved");
  expect(harness.setState).not.toHaveBeenCalledWith(expect.objectContaining({kind:"kept"}));
  resolve(true);await new Promise(r=>setTimeout(r,0));
  expect(harness.setState).toHaveBeenLastCalledWith({kind:"kept",memoryId:"p1"});
  harness.decide.mockResolvedValueOnce(false);
  out().find(el=>el.props["data-testid"]==="about-pending-dismiss")!.props.onClick();
  expect(harness.decide).toHaveBeenLastCalledWith("p1","rejected");
  await new Promise(r=>setTimeout(r,0));
  expect(harness.setState).toHaveBeenLastCalledWith({kind:"failed",memoryId:"p1"});
 });
 it("Create hero opens the existing edit/creation seam rather than navigating to itself",()=>{
  harness.hasHero=false;
  const html=renderToStaticMarkup(<AboutChildTile onEditDetails={()=>{}} measurements={null} onKeepsakes={()=>{}}/>);
  // this harness's childProfile has no hero render, so asksForHero is true
  expect(html).toContain('data-testid="about-hero-create"');
  harness.callback=true;
  const onEditDetails=vi.fn();
  elements(AboutChildTile({onEditDetails,measurements:null,onKeepsakes:()=>{}})).find(el=>el.props["data-testid"]==="about-hero-create")!.props.onClick();
  expect(onEditDetails).toHaveBeenCalled();expect(harness.setActiveTab).not.toHaveBeenCalled();
 });
 it("no score-shaped figure and no tile for a zero: an empty notebook prints no figure",()=>{
  for(const desk of both){
   harness.desk=desk;
   const html=renderToStaticMarkup(<ChildProfile/>);
   expect(html).not.toMatch(/<div class="fig/);
   expect(html).not.toMatch(/\b\d+ of \d+ (areas|settled)/);
  }
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
describe("v4 → v10 · About on a phone: no doors; one door to everything Arbor remembers",()=>{
 it.each(["en","he"] as const)("no doors grid; the notebook and its one door are there on a phone too (%s)",locale=>{
  harness.locale=locale;harness.phone=true;
  const html=renderToStaticMarkup(<ChildProfile/>);
  expect(html).not.toContain("child-door");
  expect(html.match(/data-testid="profile-remember-check"/g)).toHaveLength(1);
  expect(html.match(/data-primary-move=/g)).toHaveLength(1);
  expect(html).toContain('data-composition="phone"');
 });
 it("desktop: the same objects, the same one door and one move",()=>{
  harness.desk=true;
  const html=renderToStaticMarkup(<ChildProfile/>);
  expect(html).not.toContain('data-testid="child-doors"');
  expect(html.match(/data-testid="profile-remember-check"/g)).toHaveLength(1);
  expect(html.match(/data-primary-move=/g)).toHaveLength(1);
  expect(html).toContain('data-composition="desk"');
 });
});

describe("B-CAREPRO-37 → v10 · My child › About: the newest visit as ONE line and a link to Care › Visits",()=>{
 const appts=[
  {id:"a1",who:"",role:"Speech therapist",profession:"slp",when:"",whenIso:"2026-10-12T09:00:00.000Z",mode:"In person",status:"done"},
  {id:"a2",who:"",role:"Pediatrician",profession:"pediatrician",when:"",whenIso:"2026-09-01T09:00:00.000Z",mode:"In person",status:"done"},
 ];
 const notes=[
  {id:"f1",apptId:"a2",note:"Keep reading together in the evening.",createdAt:"2026-09-01T12:00:00.000Z"},
  {id:"f2",apptId:"a1",note:"She suggested we wait a beat before naming the toy.",createdAt:"2026-10-12T12:00:00.000Z"},
 ];
 for(const locale of ["en","he"] as const){
  it(`${locale}: one visit line — the profession and the visit day; the note stays on Visits`,()=>{
   harness.locale=locale; harness.appts=appts; harness.notes=notes;
   const html=renderToStaticMarkup(<AboutLastVisit/>);
   const line=html.match(/data-testid="about-visit">([^<]*)</)![1];
   expect(line).toMatch(locale==="en"?/^Last visit · .*profession\.slp · .*12/:/^הביקור האחרון · .*profession\.slp · .*12/);
   expect(html).not.toContain("She suggested");
   expect(html).toMatch(/^<button type="button" class="ds-link"/);
  });
 }
 it("it sits in the child's tile, below the notebook and outside its cards",()=>{
  harness.appts=appts; harness.notes=notes; harness.desk=true;
  const tile=renderToStaticMarkup(<AboutChildTile onEditDetails={()=>{}} measurements={null} onKeepsakes={()=>{}}/>);
  expect(tile).toContain('data-testid="about-visit"');
  expect(renderToStaticMarkup(<ChildProfile/>)).not.toMatch(/data-testid="about-memory-approved"[^]*data-testid="about-visit"[^]*<\/div>\s*<\/div>\s*<\/div>\s*<div class="rhead"/);
 });
 it("the link opens #/appointments (Visits); without a note there is no line",()=>{
  harness.callback=true; harness.appts=appts; harness.notes=notes;
  const link=AboutLastVisit()!;
  (link.props as {onClick:()=>void}).onClick();
  expect(harness.setActiveTab).toHaveBeenCalledWith("appointments");
  harness.callback=false; harness.notes=[];
  expect(renderToStaticMarkup(<AboutLastVisit/>)).toBe("");
 });
});
