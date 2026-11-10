/** Real Parent library, owned-read projection and collection-readiness hook.
 * Synthetic records, review receipts and cover pixels only; no network or child writes. */
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {RELEASE_VIEWPORTS} from './capture/release-config.mjs';
const output=path.resolve('output/parent-book-library');await mkdir(output,{recursive:true});
const fixture=`
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
import TogetherView from './src/components/companion/TogetherView';
import {fiveSmoothStones} from './src/lib/library/books/fiveSmoothStones';
import {canonicalParentSnapshot} from './src/lib/programs/canonicalBookHandback';
window.entries=[1,2].map(i=>{const book={...fiveSmoothStones,id:'synthetic-'+i,title:{en:'Synthetic book '+i,he:'ספר לבדיקה '+i},coverLine:{en:'Synthetic cover',he:'כריכה לבדיקה'},parent:{...fiveSmoothStones.parent,tomorrow:{en:'Synthetic tomorrow',he:'בדיקה למחר'},practises:[{id:'act-'+i,act:{en:'Synthetic act '+i,he:'פעולה לבדיקה '+i}}]}};return {book,doc:{bookId:book.id}};});
window.bindings=window.entries.map(({book})=>({bookId:book.id,shelf:'play',snapshot:canonicalParentSnapshot(book),clinicalEvidence:'synthetic-only',nativeHebrewEvidence:'synthetic-only'}));
window.opens=[];window.epoch=0;
function App(){const [,render]=useState(0);window.change=patch=>{Object.assign(window.fixture,patch);window.epoch++;flushSync(()=>render(n=>n+1));};return <TogetherView/>;}
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);`;
const modules={
 AuthContext:`export const useAuth=()=>({firebaseEnabled:true,loading:window.fixture.loading,user:window.fixture.owner?{uid:window.fixture.owner}:null});`,
 ArborContext:`export const useArbor=()=>({childProfile:{id:window.fixture.child,name:'Synthetic',age:4,interests:[],activeGoals:[]},saveMoment:()=>{throw Error('unexpected write')},setActiveTab:()=>{},openCaptureSheet:()=>{},behaviorLogs:[],logsLoaded:true});`,
 LanguageContext:`import {translate} from './src/lib/i18n';export const useLanguage=()=>({uiLang:window.fixture.lang,t:(k,v)=>translate(window.fixture.lang,k,v)});`,
 useChildCollection:`export const useChildCollection=(child,name)=>{const epoch=window.epoch;return {items:name==='bookAssets'&&!window.fixture.empty?window.entries:[],loaded:!window.fixture.pending,error:window.fixture.failed===name,remote:!window.fixture.local,isCurrent:()=>epoch===window.epoch&&!window.fixture.pending&&!window.fixture.failed};};`,
 bookAssets:`export const libraryBookEntries=docs=>docs;export const bookDocsOnDevice=()=>false;`,
 LibraryBookCover:`import React from 'react';export const LibraryBookCover=({childId,entry})=><span data-cover-scope={window.fixture.owner+':'+childId} data-cover-book={entry.book.id} style={{position:'absolute',inset:0,background:'linear-gradient(#e1e9d4,#8b9e69)'}}/>;`,
 usePracticeData:`const c={items:[],loaded:true,error:null};export const usePracticeData=()=>({speech:c,mimic:c,adventures:c,events:c,missions:c});`,
 useKidModeEntry:`export const useKidModeEntry=()=>({request:target=>window.opens.push(target),step:null});`,
 parentGate:`export const readParentPin=()=>null;`,
 kpiEvents:`export const trackCompanionPlaceOpen=()=>{};export const trackPracticeStudioOpen=()=>{};export const trackPracticeTogetherDid=()=>{};export const trackKidSessionEnd=()=>{};`,
 TogetherRoutines:`export default function TogetherRoutines(){return null;}`,
 togetherNavigation:`import {useRef,useState} from 'react';export const useTogetherNavigation=()=>{const [category,setCategory]=useState('stories');return {category,setCategory,pageRef:useRef(null),rememberDoor:()=>{}};};`,
 settingsBus:`export const requestOpenSettings=()=>{};`,familyTopicEvents:`export const openFamilyTopicSheet=()=>{};`,
};
const result=await build({stdin:{contents:fixture,resolveDir:process.cwd(),loader:'tsx'},outfile:'fixture.js',bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"','import.meta.env':'{}'},plugins:[{name:'synthetic-parent',setup(p){
 p.onResolve({filter:/\/(AuthContext|ArborContext|LanguageContext|useChildCollection|bookAssets|LibraryBookCover|usePracticeData|useKidModeEntry|parentGate|kpiEvents|TogetherRoutines|togetherNavigation|settingsBus|familyTopicEvents)$/},a=>({path:a.path.split('/').pop(),namespace:'synthetic-parent'}));
 p.onLoad({filter:/.*/,namespace:'synthetic-parent'},a=>({contents:modules[a.path],loader:'tsx',resolveDir:process.cwd()}));
 p.onLoad({filter:/parentBookLibrary\.ts$/},async a=>({contents:(await readFile(a.path,'utf8')).replace('bindings = REVIEWED_CANONICAL_BINDINGS','bindings = (window.fixture.reviewed ? window.bindings : REVIEWED_CANONICAL_BINDINGS)'),loader:'tsx'}));
 p.onLoad({filter:/sharedObject\.ts$/},async a=>({contents:(await readFile(a.path,'utf8')).replace('return store?.getItem(PROGRAM_SHARED_OBJECT_FLAG) === "1";','return window.fixture.flag;'),loader:'tsx'}));
}}]});
const js=result.outputFiles.find(f=>f.path.endsWith('.js')).text,css=result.outputFiles.find(f=>f.path.endsWith('.css'))?.text??'';
if(process.argv.includes('--build-only')){console.log('Parent book library regression bundle built.');process.exit(0);}
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});const results=[];
try{for(const cell of RELEASE_VIEWPORTS){
 const context=await browser.newContext({viewport:{width:cell.w,height:cell.h},reducedMotion:'reduce'});await context.route('**/*',r=>r.abort());const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<div id="root" class="arbor-app"></div>');await page.evaluate(lang=>{window.fixture={lang,owner:'owner-a',child:'child-a',flag:true,reviewed:false};document.documentElement.dir=lang==='he'?'rtl':'ltr';},cell.lang);
 await page.addStyleTag({content:css+':root{--arbor-paper:#fff;--arbor-ink:#14225a;--arbor-rule:#ccc;--arbor-muted:#475569;--t-base:16px;--t-sm:14px}'});await page.addScriptTag({content:js});await page.locator('.companion-together').waitFor();
 const library=()=>page.locator('[data-testid="parent-book-library"]'),books=()=>page.locator('[data-parent-book]');
 const change=patch=>page.evaluate(patch=>window.change(patch),patch);
 assert.equal(await library().count(),0,'no reviewed metadata means no parent facets');await change({reviewed:true});await library().waitFor();assert.equal(await books().count(),2);
 await library().locator('[data-practice="act-2"]').click();assert.equal(await books().count(),1);assert.equal(await books().first().getAttribute('data-parent-book'),'synthetic-2');
 await books().locator('button').click();assert.deepEqual(await page.evaluate(()=>window.opens),[{view:'library',book:'synthetic-2',together:true}]);
 await page.screenshot({path:path.join(output,cell.id+'.png')});
 const held=await books().locator('button').elementHandle();await change({owner:'owner-b'});assert.equal(await books().count(),2,'owner switch clears selected facet');assert.equal(await page.locator('[data-cover-scope="owner-a:child-a"]').count(),0);
 await held.evaluate(el=>el.click());assert.equal(await page.evaluate(()=>window.opens.length),1,'detached old-owner action cannot hand over');
 await library().locator('[data-practice="act-1"]').click();await change({child:'child-b'});assert.equal(await books().count(),2);assert.equal(await page.locator('[data-cover-scope="owner-b:child-a"]').count(),0);
 for(const state of [{failed:'bookAssets'},{failed:'books'},{failed:null,pending:true},{pending:false,local:true},{local:false,empty:true},{empty:false,flag:false},{flag:true,owner:null},{owner:'owner-a',loading:true}]){await change(state);assert.equal(await library().count(),0,'unavailable state is closed: '+JSON.stringify(state));}
 await change({loading:false});await library().waitFor();await page.evaluate(()=>{window.bindings[0].snapshot='stale';window.change({});});assert.equal(await books().count(),1,'copy edits invalidate that review');
 assert.deepEqual(errors,[]);results.push({viewport:cell.id,passed:true});await context.close();
}await writeFile(path.join(output,'results.json'),JSON.stringify({passed:true,scope:'real Together surface, Parent library and collection-readiness hook; synthetic review receipts, records and decorative art; not actual-account/device acceptance',results},null,2));console.log('Parent book library: '+results.length+' EN/HE cells passed filter, exact handover, review invalidation and owner/child/read-failure isolation.');}finally{await browser.close();}
