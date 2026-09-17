import React from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import WorldScene from "./WorldScene";
import { _resetSceneCache } from "../../lib/sceneCache";
const h=vi.hoisted(()=>({slots:[] as any[],at:0,effects:[] as (()=>void)[],observers:[] as any[],generate:vi.fn()}));
vi.mock("react",async(original)=>{
 const real=await original<typeof import("react")>();
 return {...real,
  useState:(initial:any)=>{const i=h.at++;if(!(i in h.slots))h.slots[i]=typeof initial==="function"?initial():initial;return[h.slots[i],(v:any)=>{h.slots[i]=typeof v==="function"?v(h.slots[i]):v;}];},
  useRef:()=>{const i=h.at++;return h.slots[i]??(h.slots[i]={current:{}});},
  useEffect:(fn:()=>any,deps:any[])=>{const i=h.at++;const old=h.slots[i];if(old&&deps.every((v,n)=>Object.is(v,old.deps[n])))return;old?.cleanup?.();const record={deps,cleanup:undefined as any};h.slots[i]=record;h.effects.push(()=>{record.cleanup=fn();});},
 };
});
vi.mock("../../lib/api",()=>({api:{generateScene:h.generate}}));
vi.mock("../../hooks/useAsyncAction",()=>({runInstrumented:(_name:string,run:()=>unknown)=>run()}));
const props=(over:Partial<React.ComponentProps<typeof WorldScene>>={})=>({worldId:"feelings",imagePrompt:"same world prompt",heroUrl:"data:hero-A",children:<span>icon fallback</span>,...over});
function render(over:Partial<React.ComponentProps<typeof WorldScene>>={}){h.at=0;const tree=WorldScene(props(over));h.effects.splice(0).forEach(run=>run());return tree;}
function nodes(node:React.ReactNode):React.ReactElement<Record<string,any>>[]{if(!React.isValidElement(node))return[];const el=node as React.ReactElement<Record<string,any>>;return[el,...React.Children.toArray(el.props.children).flatMap(nodes)];}
function image(tree:React.ReactNode){return nodes(tree).find(el=>el.type==="img");}
function visible(){h.observers.at(-1).callback([{isIntersecting:true}]);}
async function settle(){for(let i=0;i<12;i++)await Promise.resolve();}
function deferred(){let resolve!:(v:{dataUrl:string})=>void;let reject!:(e:Error)=>void;const promise=new Promise<{dataUrl:string}>((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
function unmount(){for(const slot of h.slots)slot?.cleanup?.();}
beforeEach(()=>{
 h.slots=[];h.at=0;h.effects=[];h.observers=[];vi.clearAllMocks();_resetSceneCache();
 vi.stubGlobal("IntersectionObserver",class{callback:any;disconnect=vi.fn();observe=vi.fn();constructor(callback:any,options:any){this.callback=callback;h.observers.push(this);expect(options.rootMargin).toBe("160px");}});
});
afterEach(()=>{unmount();vi.unstubAllGlobals();});
describe("WorldScene current-key lifecycle and decorative fallback",()=>{
 it("shows responsive static art with no avatar and never calls a provider",()=>{
  const tree=render({heroUrl:undefined});const img=image(tree)!;
  expect(img.props.src).toContain("mood-mountain-v2-480.webp");expect(img.props.srcSet).toContain("960w");expect(img.props.loading).toBe("lazy");expect(img.props.alt).toBe("");expect(img.props["aria-hidden"]).toBe("true");expect(h.generate).not.toHaveBeenCalled();
 });
 it("hides the whole decorative slot, including a covered named fallback and ultimate icon",()=>{
  const labelledFallback=<span role="img" aria-label="Dylan, the hero">hero fallback</span>;
  let tree=render({heroUrl:undefined,children:labelledFallback});
  expect(tree.props["aria-hidden"]).toBe("true");
  expect(image(tree)).toBeDefined();
  expect(nodes(tree).some(node=>node.props["aria-label"]==="Dylan, the hero")).toBe(true);
  image(tree)!.props.onError();tree=render({heroUrl:undefined,children:labelledFallback});
  expect(image(tree)).toBeUndefined();expect(tree.props["aria-hidden"]).toBe("true");
  expect(nodes(tree).some(node=>node.props.children==="hero fallback")).toBe(true);
 });
 it("waits for intersection and starts once even if observer callbacks repeat",async()=>{
  h.generate.mockResolvedValue({dataUrl:"data:scene-A"});render();expect(h.generate).not.toHaveBeenCalled();visible();visible();await settle();
  expect(h.generate).toHaveBeenCalledTimes(1);expect(image(render())!.props.src).toBe("data:scene-A");
 });
 it("new hero immediately uses neutral art and ignores late old responses",async()=>{
  const old=deferred(),current=deferred();h.generate.mockImplementationOnce(()=>old.promise).mockImplementationOnce(()=>current.promise);
  render();visible();await settle();
  expect(image(render({heroUrl:"data:hero-B"}))!.props.src).toContain("mood-mountain-v2-480");visible();await settle();old.resolve({dataUrl:"data:old-child"});await settle();
  expect(image(render({heroUrl:"data:hero-B"}))!.props.src).not.toBe("data:old-child");current.resolve({dataUrl:"data:new-child"});await settle();expect(image(render({heroUrl:"data:hero-B"}))!.props.src).toBe("data:new-child");
  expect(image(render({heroUrl:undefined}))!.props.src).toContain("mood-mountain-v2-480");
 });
 it("changing world never shows the previous world's resolved scene",async()=>{
  h.generate.mockResolvedValueOnce({dataUrl:"data:mountain"});render();visible();await settle();expect(image(render())!.props.src).toBe("data:mountain");
  expect(image(render({worldId:"speech"}))!.props.src).toContain("sound-lab-v2-480");
 });
 it("generated decode failure falls to static, then a static failure falls to the icon without retrying",async()=>{
  h.generate.mockResolvedValue({dataUrl:"data:broken-scene"});render();visible();await settle();image(render())!.props.onError();
  let tree=render();expect(image(tree)!.props.src).toContain("mood-mountain-v2-480");image(tree)!.props.onError();tree=render();expect(image(tree)).toBeUndefined();expect(nodes(tree).some(el=>el.props.children==="icon fallback")).toBe(true);
  for(let i=0;i<5;i++)render();await settle();expect(h.generate).toHaveBeenCalledTimes(1);
 });
 it("unmount ignores a late state write while keeping a different identity neutral",async()=>{
  const request=deferred();h.generate.mockImplementation(()=>request.promise);render();visible();await settle();unmount();request.resolve({dataUrl:"data:late"});await settle();expect(h.slots.some(slot=>slot?.url==="data:late")).toBe(false);expect(image(render({heroUrl:"data:hero-B"}))!.props.src).toContain("mood-mountain-v2-480");
  expect(h.generate).toHaveBeenCalledTimes(1);
 });
 it("provider rejection leaves the same fallback without automatic retries",async()=>{
  h.generate.mockRejectedValue(new Error("offline"));render();visible();await settle();
  expect(image(render())!.props.src).toContain("mood-mountain-v2-480");
  for(let i=0;i<5;i++)render();await settle();expect(h.generate).toHaveBeenCalledTimes(1);
 });
 it("cached current key avoids new generation after remount",async()=>{
  h.generate.mockResolvedValue({dataUrl:"data:cached"});render();visible();await settle();unmount();h.slots=[];expect(image(render())!.props.src).toBe("data:cached");expect(h.generate).toHaveBeenCalledTimes(1);
 });
});
