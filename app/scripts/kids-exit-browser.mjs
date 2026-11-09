/** Real parent gate, real translations/CSS, synthetic Kids stacking surfaces.
 * No auth, child records, network, audio, or model calls. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { DEVICE_VIEWPORTS } from './capture/release-config.mjs';
const output = path.resolve('output/kids-exit');
await mkdir(output, { recursive: true });
const fixture = `
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {HoldExitButton} from './src/components/kidmode/HoldExitButton';
import {commerceAllowed,saveParentPin} from './src/components/kidmode/parentGate';
if(window.fixture.pin)saveParentPin('4826');
function App(){const [open,setOpen]=useState(true);return open?<main className="arbor-play" data-kid-mode-layer="true" style={{position:'fixed',inset:0,transform:'scale(1)',display:'flex',flexDirection:'column',overflow:'hidden'}}>
 {window.fixture.home?<section className="studio-v2 studio-v2--home"><header className="studio-v2__header"><HoldExitButton onExit={()=>setOpen(false)}/></header><div className="studio-v2__quest">Synthetic play surface</div></section>:<><header style={{position:'relative',zIndex:1}}><HoldExitButton onExit={()=>setOpen(false)}/></header><section style={{position:'relative',zIndex:1,flex:1,background:'white'}}>Synthetic play surface</section></>}
 </main>:<output id="parent" data-commerce={commerceAllowed()}>Parent</output>;}
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);`;
async function bundle(negative) {
  const result = await build({stdin:{contents:fixture,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"','import.meta.env':'{}'},plugins:[{name:'exit-fixture',setup(plugin){
    plugin.onResolve({filter:/\/LanguageContext$/},()=>({path:'language',namespace:'exit-fixture'}));
    plugin.onLoad({filter:/.*/,namespace:'exit-fixture'},()=>({contents:`import {translate} from './src/lib/i18n';export const useLanguage=()=>({uiLang:window.fixture.lang,t:(k,v)=>translate(window.fixture.lang,k,v)});`,loader:'ts',resolveDir:process.cwd()}));
    if(negative)plugin.onLoad({filter:/HoldExitButton\.tsx$/},async args=>({contents:(await readFile(args.path,'utf8')).replace(/portalRoot=\{[^\n]+\}/,'portalRoot={undefined}'),loader:'tsx'}));
  }}]}); return result.outputFiles[0].text;
}
const [fixed, before, css] = await Promise.all([bundle(false),bundle(true),readFile('src/components/kidmode/studioV2/studioV2.css','utf8')]);
const browser = await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[];
try {
 for(const cell of DEVICE_VIEWPORTS) {
  const context=await browser.newContext({viewport:{width:cell.w,height:cell.h},reducedMotion:'reduce'});
  await context.route('**/*',r=>r.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const mount=async({negative=false,home=false,pin=false}={})=>{
   await page.goto('about:blank');await page.setContent('<div id="root"></div>');
   await page.addStyleTag({content:css.replace(/^@import[^;]+;/,'')+'body{margin:0} :root{--arbor-paper:#fff;--arbor-paper-elevated:#fff;--arbor-ink:#14225a;--arbor-muted:#475569;--arbor-clay:#1558c0;--arbor-on-accent:#fff;--arbor-rule:#ddd;--arbor-rule-strong:#ccc;--t-lg:20px;--t-xl:24px;--t-sm:14px;--t-xs:12px;--r:12px}'});
   await page.evaluate(opts=>{const storage=()=>{const m=new Map();return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}};Object.defineProperty(window,'localStorage',{value:storage(),configurable:true});Object.defineProperty(window,'sessionStorage',{value:storage(),configurable:true});window.fixture=opts;document.documentElement.dir=opts.lang==='he'?'rtl':'ltr';},{home,pin,lang:cell.lang});
   await page.addScriptTag({content:negative?before:fixed});
  };
  const hold=async()=>{const b=await page.locator('main header button').first().boundingBox();assert.ok(b);await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.waitForTimeout(3100);await page.mouse.up();await page.locator('[role="dialog"]').waitFor();};
  const reachable=()=>page.locator('[role="dialog"] input').evaluate(el=>{const b=el.getBoundingClientRect();return document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)===el;});
  await mount({negative:true});await hold();assert.equal(await reachable(),false,'negative control reproduces content covering the inline gate');
  for(const home of [false,true])for(const pin of [false,true]) {
   await mount({home,pin});await hold();assert.equal(await reachable(),true,'answer field must receive real pointer input');
   assert.equal(await page.locator('main > [data-kid-parent-gate]').count(),1,'portal remains INSIDE the locked Kids layer');
   const dialog=page.locator('[role="dialog"]'),input=dialog.locator('input');
   await input.fill('0');await dialog.locator('button[type="submit"]').click();assert.equal(await page.locator('#parent').count(),0,'wrong answer cannot exit');
   const answer=pin?'4826':String((await dialog.locator('[dir="ltr"] > span').textContent()).match(/\d+/g).map(Number).reduce((a,b)=>a+b,0));
   await input.fill(answer);await dialog.locator('button[type="submit"]').click();await page.locator('#parent').waitFor();
   assert.equal(await page.locator('#parent').getAttribute('data-commerce'),String(pin),'math exit retains commerce restriction');
   results.push({viewport:cell.id,home,pin,passed:true});
  }
  await mount();await hold();await page.locator('[role="dialog"] > button').click();assert.equal(await page.locator('#parent').count(),0);assert.equal(await page.locator('[role="dialog"]').count(),0,'dismiss stays in Kids');
  await hold();await page.screenshot({path:path.join(output,cell.id+'.png')});assert.deepEqual(errors,[]);
  await context.close();
 }
 await writeFile(path.join(output,'results.json'),JSON.stringify({passed:true,scope:'synthetic stacking surfaces; actual gate and translations; no physical-device/auth proof',negativeControl:'inline gate obscured by later content at same stacking level',results},null,2));
 console.log('Kids exit: '+results.length+' successful EN/HE viewport/surface/verification cases; negative controls and dismissal passed.');
}finally{await browser.close();}
