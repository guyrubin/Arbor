import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChildProfile from "./ChildProfile";
import { en, he } from "../../lib/i18nElevation/wave2Knowledge";
const harness=vi.hoisted(() => ({
 callback:false, locale:"en", pending:[] as unknown[], approved:[] as unknown[], hasHero:true,
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
 childProfile:{id:"c1",name:"Dylan",age:5,languages:["English"],schoolContext:"School",challenges:[],strengths:[],interests:["Dinosaurs"]},
 milestones:[],behaviorLogs:[],playLogs:[],actionPlans:[],approvedMemoryItems:harness.approved,pendingMemoryItems:harness.pending,setActiveTab:harness.setActiveTab,
})}));
vi.mock("../../context/ProfileContext",()=>({useProfile:()=>({profiles:[{id:"c1"}]})}));
vi.mock("../../context/AuthContext",()=>({useAuth:()=>({user:{displayName:"Parent"}})}));
vi.mock("../../context/LanguageContext",()=>({useLanguage:()=>({t:(key:string,vars?:Record<string,unknown>)=>{
 let value=(harness.locale==="he"?he:en)[key]||key;
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
beforeEach(()=>{vi.clearAllMocks();harness.callback=false;harness.locale="en";harness.pending=[];harness.approved=[];harness.hasHero=true;});
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
