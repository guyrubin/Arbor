import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HeroAvatar } from "./HeroAvatar";
import { ArborMascot } from "./ArborMascot";
const h=vi.hoisted(()=>({failed:null as string|null,url:"data:hero-A" as string|null}));
vi.mock("react",async(original)=>({...await original<typeof import("react")>(),useState:()=>[h.failed,(v:string)=>{h.failed=v;}]}));
vi.mock("../../context/ArborContext",()=>({useArbor:()=>({childProfile:{name:"Dylan",comicAvatarUrl:h.url}})}));
function image(node:React.ReactNode):React.ReactElement<Record<string,any>>|undefined{if(!React.isValidElement(node))return;const el=node as React.ReactElement<Record<string,any>>;return el.type==="img"?el:React.Children.toArray(el.props.children).map(image).find(Boolean);}
vi.mock("../../context/LanguageContext",()=>({useLanguage:()=>({t:()=>"Sprout, Arbor mascot"})}));
beforeEach(()=>{h.failed=null;h.url="data:hero-A";});
describe("HeroAvatar decorative decode resilience",()=>{
 it("selected image failure resolves to Sprout without a fallback image loop",()=>{
  const img=image(HeroAvatar({decorative:true}))!;expect(img.props.alt).toBe("");img.props.onError();
  const fallback=HeroAvatar({size:56,animate:false});expect(fallback.type).toBe(ArborMascot);expect(fallback.props.size).toBe(56);expect(image(fallback)).toBeUndefined();
 });
 it("a new identity can render even after the old URL failed",()=>{
  image(HeroAvatar({}))!.props.onError();h.url="data:hero-B";expect(image(HeroAvatar({}))!.props.src).toBe("data:hero-B");
  h.url=null;expect(HeroAvatar({}).type).toBe(ArborMascot);
 });
 it.each(["missing", "decode-failed"])("decorative %s avatar hides Sprout with unchanged dimensions",state=>{
  if(state==="missing")h.url=null;else h.failed=h.url;
  const fallback=HeroAvatar({decorative:true,size:56,animate:false,className:"profile-avatar"});
  expect(fallback.type).toBe("span");expect(fallback.props["aria-hidden"]).toBe("true");
  expect(fallback.props.style).toEqual({width:56,height:56});expect(fallback.props.className).toContain("profile-avatar");
  const html=renderToStaticMarkup(fallback);
  expect(html).toMatch(/^<span aria-hidden="true"/);expect(html).toContain('width="56"');expect(html).toContain('height="56"');
 });
 it.each(["missing", "decode-failed"])("nondecorative %s avatar retains the accessible mascot",state=>{
  if(state==="missing")h.url=null;else h.failed=h.url;
  const fallback=HeroAvatar({size:56,animate:false});expect(fallback.type).toBe(ArborMascot);
  const html=renderToStaticMarkup(fallback);expect(html).toContain('role="img"');expect(html).toContain('aria-label="Sprout, Arbor mascot"');expect(html).not.toContain('aria-hidden="true"');
 });
});
