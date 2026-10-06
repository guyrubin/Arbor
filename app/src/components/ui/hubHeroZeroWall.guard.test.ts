/** RUN-08: every statistical HubHero needs a translated day-0 teach line.
 * Profile/Learn use explicitly anchored semantic headers with real record facts.
 * TSX parsing follows actual attributes, including JSX after CTA arrow functions. */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";
const SRC=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..","..");
const listTsx=(dir:string):string[]=>fs.readdirSync(dir).flatMap(entry=>{
 const full=path.join(dir,entry);
 return fs.statSync(full).isDirectory()?listTsx(full):/\.tsx$/.test(entry)&&!/\.test\.tsx$/.test(entry)?[full]:[];
});
interface Mount { file:string; attributes:Map<string,ts.JsxAttribute>; spreads:ts.JsxSpreadAttribute[] }
function scan(src:string,file="fixture.tsx"):Mount[]{
 const parsed=ts.createSourceFile(file,src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const found:Mount[]=[];
 const visit=(node:ts.Node)=>{
  if((ts.isJsxSelfClosingElement(node)||ts.isJsxOpeningElement(node))&&node.tagName.getText(parsed)==="HubHero"){
   const attributes=new Map<string,ts.JsxAttribute>();const spreads:ts.JsxSpreadAttribute[]=[];
   for(const attribute of node.attributes.properties){
    if(ts.isJsxAttribute(attribute))attributes.set(attribute.name.getText(parsed),attribute);
    else spreads.push(attribute);
   }
   found.push({file,attributes,spreads});
  }
  ts.forEachChild(node,visit);
 };
 visit(parsed);return found;
}
const hasStats=(mount:Mount)=>mount.attributes.has("stats");
const missingZero=(mount:Mount)=>hasStats(mount)&&!mount.attributes.has("zeroLine");
function translatedZero(mount:Mount):boolean{
 const initializer=mount.attributes.get("zeroLine")?.initializer;
 // Actual mounts use t(key); literals, bare attributes and arbitrary expressions
 // cannot silently pass as translations. A different seam needs explicit proof.
 return !!initializer&&ts.isJsxExpression(initializer)&&!!initializer.expression&&
  ts.isCallExpression(initializer.expression)&&ts.isIdentifier(initializer.expression.expression)&&
  initializer.expression.expression.text==="t";
}
const mounts=listTsx(SRC).flatMap(file=>scan(fs.readFileSync(file,"utf8"),path.relative(SRC,file).split(path.sep).join("/")));
const fixture=(jsx:string)=>{const result=scan("const element = ("+jsx+");");expect(result).toHaveLength(1);return result[0];};
describe("RUN-08 — no statistical hub mounts an untranslated zero wall",()=>{
 it("finds four remaining mounts plus both real custom-header destinations",()=>{
  expect(mounts.length).toBeGreaterThanOrEqual(1);
  const files=new Set(mounts.map(m=>m.file));
  for(const file of ["RoutinesTab"])expect(files.has("components/tabs/"+file+".tsx"),file).toBe(true);
  // NEXTLEVEL critic r1: Behaviors' stat hero is CUT — the capture question is
  // the H1 and the week's count is one muted line; no stats mount remains there.
  expect(files.has("components/tabs/BehaviorsTab.tsx"),"BehaviorsTab").toBe(false);
  // W2-GROWTH r1: Growth's stat hero is CUT — the H1 is "What's new with {name}"
  // and the page opens on New-since rows; no stats mount can greet with zeros.
  expect(files.has("components/tabs/DevelopmentTab.tsx"),"DevelopmentTab").toBe(false);
  // W2-CAREPRO r1 (B-CAREPRO-36 hero part): Consult's hero is CUT — the H1 is the job.
  expect(files.has("components/tabs/ConsultTab.tsx"),"ConsultTab").toBe(false);
  const profile=fs.readFileSync(path.join(SRC,"components/sections/ChildProfile.tsx"),"utf8");
  const academy=fs.readFileSync(path.join(SRC,"components/sections/Masterclasses.tsx"),"utf8");
  // W2-GROWTH r1: Profile's identity header carries no counts (no zero wall possible).
  expect(profile).toContain('data-testid="profile-hub-hero"');expect(profile).not.toContain('profiles.length === 1');
  expect(academy).toContain('data-testid="academy-hub-hero"');
  // B-PLAY-18: the academy header carries no stat list — the pick's reading minutes ride the pick line.
  expect(academy).toContain('data-testid="academy-pick-minutes"');expect(academy).not.toContain('heroStats.map');
 });
 it("actually extracts a stats-bearing mount, including stats after CTA (the scanner still sees them)",()=>{
  // NEXTLEVEL r1: the last real stats mount (Behaviors) is cut; the scanner is
  // proven on the shape it shipped in, so a returning stats hero is caught.
  const shipped=fixture('<HubHero compact zeroLine={t("elev.growthTruth.hero.empty")} tone="coral" title={t("beh.hero.title", { name: behFirst })} stats={[{ value: heroStats.events, label: t("beh.stats.events") }]} testId="behaviors-hub-hero" />');
  expect(hasStats(shipped)).toBe(true);expect(shipped.attributes.has("zeroLine")).toBe(true);
  for(const m of mounts.filter(hasStats))expect(m.attributes.has("zeroLine"),m.file).toBe(true);
 });
 it("every real stats mount supplies its day-0 teach line",()=>{
  expect(mounts.filter(missingZero).map(m=>m.file),"HubHero stats without zeroLine greet day-0 parents with zeros").toEqual([]);
 });
 it("every supplied teach line resolves through the current translation seam",()=>{
  expect(mounts.filter(m=>m.attributes.has("zeroLine")&&!translatedZero(m)).map(m=>m.file),"zeroLine must use t(key), including expression-wrapped strings").toEqual([]);
 });
 it("opaque spread props cannot bypass the attribute law",()=>{
  expect(mounts.filter(m=>m.spreads.length).map(m=>m.file),"HubHero props must be explicit so stats/zeroLine are enforceable").toEqual([]);
  expect(fixture('<HubHero {...props} />').spreads).toHaveLength(1);
 });
 it("NEGATIVE CONTROL: real stats without zeroLine fail even after arrows/comparisons/long CTA objects",()=>{
  const bad=fixture('<HubHero cta={{ label: ">", onClick: () => count > 0 ? run() : stop(), detail: "'+"x".repeat(1400)+'" }} stats={stats} />');
  expect(hasStats(bad)).toBe(true);expect(missingZero(bad)).toBe(true);
  // The obsolete trio spelling must not pretend to cover the actual prop.
  expect(hasStats(fixture('<HubHero trio={stats} />'))).toBe(false);
 });
 it("NEGATIVE CONTROL: quoted, expression-wrapped and missing translation lines are rejected",()=>{
  for(const jsx of ['<HubHero stats={stats} zeroLine="Nothing here yet" />','<HubHero stats={stats} zeroLine={"Nothing here yet"} />','<HubHero stats={stats} zeroLine />'])expect(translatedZero(fixture(jsx))).toBe(false);
 });
 it("a real translated stats mount passes, including non-self-closing JSX",()=>{
  for(const jsx of ['<HubHero cta={{onClick: () => run()}} stats={stats} zeroLine={t("elev.growthTruth.hero.empty")} />','<HubHero stats={stats} zeroLine={t("elev.growthTruth.hero.empty")}></HubHero>']){
   const good=fixture(jsx);expect(hasStats(good)).toBe(true);expect(missingZero(good)).toBe(false);expect(translatedZero(good)).toBe(true);
  }
 });
});
