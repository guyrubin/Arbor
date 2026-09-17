import { describe, expect, it } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { WORLD_ARTWORK, worldArtwork } from "./worldArtwork";
import { KID_WORLDS } from "./HeroArcade";
const manifest=JSON.parse(readFileSync(new URL("../../../../docs/design/world-art-v2.json",import.meta.url),"utf8"));
describe("reviewed world-art delivery map",()=>{
 it("covers all nine child worlds plus two adventures and banner, with twelve unique scenes",()=>{
  expect(Object.keys(WORLD_ARTWORK)).toHaveLength(12);
  for(const w of KID_WORLDS)expect(worldArtwork(w.id),w.id).toBeDefined();
  expect(KID_WORLDS).toHaveLength(9);expect(worldArtwork("word-world")).toBeUndefined();
  expect(new Set(Object.values(WORLD_ARTWORK).map(a=>a.src)).size).toBe(12);
 });
 it("uses the exact approved bytes and responsive derivatives within budget",()=>{
  for(const art of Object.values(WORLD_ARTWORK)){
   for(const url of [art.src,...art.srcSet.split(", ").map(item=>item.split(" ")[0])]){
    const name=url.split("/").at(-1)!;
    const approved=manifest.assets.flatMap((a:any)=>a.exports).find((e:any)=>e.file===name);
    expect(approved,name).toBeDefined();
    const disk=new URL("../../../public"+url,import.meta.url);
    const bytes=readFileSync(disk);expect(statSync(disk).size).toBe(approved.bytes);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(approved.sha256);
    expect(bytes.length).toBeLessThanOrEqual(160*1024);
   }
  }
 });
 it("does not invent navigation or substitute a child portrait",()=>{
  expect(worldArtwork("unknown")).toBeUndefined();
  for(const art of Object.values(WORLD_ARTWORK))expect(art.src).toMatch(/worlds\/v2\/.*-v2-480\.webp$/);
 });
});
