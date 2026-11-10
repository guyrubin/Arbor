/** Real Together view and dialog surfaces; synthetic auth, records and writes.
 * Network is blocked. This is not authenticated or physical-device acceptance. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { RELEASE_VIEWPORTS } from './capture/release-config.mjs';

const output = path.resolve('output/together-save');
await mkdir(output, { recursive: true });
const fixture = `
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
import {MotionConfig} from 'motion/react';import TogetherView from './src/components/companion/TogetherView';
window.writes=[];window.keptEvents=[];
window.save=(text,options)=>new Promise((resolve,reject)=>window.writes.push({text,options,resolve,reject,owner:window.fixture.owner,child:window.fixture.child}));
function App(){const [,render]=useState(0);window.family=(owner,child,loading=false)=>{Object.assign(window.fixture,{owner,child,loading});flushSync(()=>render(n=>n+1));};
return <MotionConfig reducedMotion="always"><TogetherView/></MotionConfig>;}
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);`;

async function bundle(negative) {
  const modules = {
    AuthContext: `export const useAuth=()=>({firebaseEnabled:true,loading:window.fixture.loading,user:window.fixture.owner?{uid:window.fixture.owner}:null});`,
    ArborContext: `export const useArbor=()=>({childProfile:{id:window.fixture.child,name:'Synthetic',age:4,interests:[],activeGoals:[]},saveMoment:window.save,setActiveTab:()=>{},openCaptureSheet:()=>{},behaviorLogs:[],logsLoaded:true});`,
    LanguageContext: `import {translate} from './src/lib/i18n';export const useLanguage=()=>({uiLang:window.fixture.lang,t:(k,v)=>translate(window.fixture.lang,k,v)});`,
    useChildCollection: `export const useChildCollection=()=>({items:[],loaded:true,error:null});`,
    usePracticeData: `const c={items:[],loaded:true,error:null};export const usePracticeData=()=>({speech:c,mimic:c,adventures:c,events:c,missions:c});`,
    useKidModeEntry: `export const useKidModeEntry=()=>({request:()=>{},step:null});`,
    parentGate: `export const readParentPin=()=>null;`,
    kpiEvents: `export const trackCompanionPlaceOpen=()=>{};export const trackPracticeStudioOpen=()=>{};export const trackPracticeTogetherDid=id=>window.keptEvents.push(id);export const trackKidSessionEnd=()=>{};`,
    TogetherRoutines: `export default function TogetherRoutines(){return null;}`,
    togetherNavigation: `import {useRef,useState} from 'react';export const useTogetherNavigation=()=>{const [category,setCategory]=useState('games');return {category,setCategory,pageRef:useRef(null),rememberDoor:()=>{}};};`,
    settingsBus: `export const requestOpenSettings=()=>{};`,
    familyTopicEvents: `export const openFamilyTopicSheet=()=>{};`,
  };
  const result = await build({stdin:{contents:fixture,resolveDir:process.cwd(),loader:'tsx'},outfile:'together-fixture.js',bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"','import.meta.env':'{}'},plugins:[{name:'isolated-together',setup(p){
    p.onResolve({filter:/\/(AuthContext|ArborContext|LanguageContext|useChildCollection|usePracticeData|useKidModeEntry|parentGate|kpiEvents|TogetherRoutines|togetherNavigation|settingsBus|familyTopicEvents)$/},a=>({path:a.path.split('/').pop(),namespace:'isolated-together'}));
    p.onLoad({filter:/.*/,namespace:'isolated-together'},a=>({contents:modules[a.path],loader:'tsx',resolveDir:process.cwd()}));
    if(negative)p.onLoad({filter:/TogetherView\.tsx$/},async a=>({contents:(await readFile(a.path,'utf8')).replace('key={JSON.stringify([ownerId, childProfile.id])}','key={childProfile.id}'),loader:'tsx'}));
  }}]});
  return {js:result.outputFiles.find(f=>f.path.endsWith('.js')).text,css:result.outputFiles.find(f=>f.path.endsWith('.css'))?.text??''};
}
const [fixed,before]=await Promise.all([bundle(false),bundle(true)]);
if(process.argv.includes('--build-only')){console.log('Together save regression bundles built.');process.exit(0);}
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[];
try {
  for(const cell of RELEASE_VIEWPORTS){
    const context=await browser.newContext({viewport:{width:cell.w,height:cell.h},reducedMotion:'reduce'});
    await context.route('**/*',r=>r.abort());
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const mount=async negative=>{
      await page.goto('about:blank');await page.setContent('<div id="root" class="arbor-app"></div>');
      await page.evaluate(lang=>{window.fixture={lang,owner:'owner-a',child:'child-a',loading:false};document.documentElement.dir=lang==='he'?'rtl':'ltr';},cell.lang);
      const content=negative?before:fixed;
      await page.addStyleTag({content:content.css+':root{--arbor-paper:#fff;--arbor-paper-elevated:#fff;--arbor-ink:#14225a;--arbor-rule:#ccc;--arbor-muted:#475569;--touch-min:44px}button{min-height:44px} [data-arbor-dialog-layer]{position:fixed;inset:0;z-index:50;background:#fff;overflow:auto}'});
      await page.addScriptTag({content:content.js});await page.locator('.companion-offscreen-card').first().waitFor();
    };
    const dialog=()=>page.getByRole('dialog');
    const keep=()=>dialog().locator('.companion-text-button');
    const open=async (index=0)=>{await page.locator('.companion-offscreen-card').nth(index).click();await dialog().waitFor();};
    const close=async()=>{await dialog().locator('button[aria-label]').click();await dialog().waitFor({state:'hidden'});};
    const alert=()=>dialog().getByRole('alert');
    const settle=async(index,ok)=>{await page.evaluate(({index,ok})=>window.writes[index].resolve(ok),{index,ok});};

    await mount(true);await open();await page.evaluate(()=>window.family('owner-b','child-a'));
    assert.equal(await dialog().count(),1,'negative control retains the previous account preview');

    await mount(false);await open();await keep().evaluate(el=>{el.click();el.click();});
    assert.equal(await page.evaluate(()=>window.writes.length),1,'one pending write after rapid repeat');
    assert.equal(await keep().isDisabled(),true);
    assert.deepEqual(await page.evaluate(()=>({ack:window.writes[0].options.requireAcknowledgement,quiet:window.writes[0].options.callerShowsFailure,current:window.writes[0].options.isCurrent(),key:window.writes[0].options.retryKey})),{ack:true,quiet:true,current:true,key:'together-offscreen:build'});
    await page.evaluate(()=>window.writes[0].reject(new Error('synthetic rejection')));await alert().waitFor();assert.equal(await keep().isEnabled(),true);
    await keep().click();await settle(1,false);await alert().waitFor();assert.equal(await keep().isEnabled(),true);
    assert.equal(await page.evaluate(()=>window.writes[0].options.retryKey===window.writes[1].options.retryKey),true,'retry keeps its idempotency key');
    await keep().click();await settle(2,true);await page.waitForFunction(()=>window.keptEvents.length===1);assert.equal(await keep().isDisabled(),true);
    await close();await open();assert.equal(await keep().isDisabled(),true,'a confirmed activity stays kept in this visit');await close();

    await open(1);await keep().click();await close();await open(2);await settle(3,false);
    await page.waitForFunction(()=>!document.querySelector('[role="dialog"] .companion-text-button').disabled);
    assert.equal(await alert().count(),0,'late failure cannot attach to another activity');

    await keep().click();await page.evaluate(()=>window.family('owner-b','child-a'));
    assert.equal(await dialog().count(),0,'account collision retires the portal immediately');
    assert.equal(await page.evaluate(()=>window.writes[4].options.isCurrent()),false);
    await open(2);await settle(4,true);assert.equal(await page.evaluate(()=>window.keptEvents.length),1,'old success has no new-owner receipt/event');assert.equal(await keep().isEnabled(),true);
    await page.evaluate(()=>window.family('owner-a','child-a'));assert.equal(await dialog().count(),0,'A→B→A never resurrects an old preview');
    await open();assert.equal(await keep().isEnabled(),true,'owner return starts a fresh visible visit');
    await keep().click();await page.evaluate(()=>window.family('owner-a','child-b'));assert.equal(await dialog().count(),0);
    await open();await page.evaluate(()=>window.writes[5].reject(new Error('late sibling failure')));assert.equal(await alert().count(),0);assert.equal(await keep().isEnabled(),true);
    await page.evaluate(()=>window.family(null,'child-b'));assert.equal(await dialog().count(),0);assert.equal(await page.locator('.companion-together').count(),0,'unknown hosted auth fails closed');
    await page.evaluate(()=>window.family('owner-a','child-a',true));assert.equal(await page.locator('.companion-together').count(),0,'restoring auth does not retain a family surface');
    await page.evaluate(()=>window.family('owner-a','child-a'));await open();assert.equal(await keep().isEnabled(),true);
    assert.deepEqual(errors,[]);results.push({viewport:cell.id,passed:true});await context.close();
  }
  await writeFile(path.join(output,'results.json'),JSON.stringify({passed:true,scope:'real Together and Sheet/Modal; synthetic auth/records/writes; network blocked; not authenticated or device acceptance',results},null,2));
  console.log('Together saves: '+results.length+' EN/HE release cells passed account/child retirement, acknowledged retry, duplicate-save and late-preview checks.');
} finally { await browser.close(); }
