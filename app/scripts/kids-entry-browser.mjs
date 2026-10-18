/** Actual React entry hook/button and narration builder, with synthetic
 * profile/lock/authoring/I/O boundaries. No cloud, real child, image generation
 * or audio synthesis. Tests admission and lifecycle, not private likeness. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';
const output = process.env.KIDS_ENTRY_EVIDENCE_DIR || path.resolve('output/kids-entry');
await fs.mkdir(output, { recursive: true });
const stubs = {
  ArborContext: 'export const useArborOptional = () => ({childProfile:window.evidence.child});export const useArbor=useArborOptional;',
  ProfileContext: `export const useProfileOptional = () => window.evidence.noProfile ? null : ({loading:false,loadError:false,
    isCurrentSession:window.evidence.ownerCurrent,captureOnboardingLifetime:()=>{const lease=window.evidence.lease;return ()=>window.evidence.lease===lease;}});`,
  LanguageContext: 'export const useLanguage=()=>({t:key=>key,uiLang:window.evidence.language,aiLang:window.evidence.language});',
  heroSheetStore: 'export const heroSheetOwnerKey=()=>window.evidence.owner;',
  useHeroSheet: 'export const PROOF_HERO_CHILD_IDS=["protected-proof"];',
  buildHeroSheet: 'export const ensureHeroSheet=async()=>{};',
  buildBookSheet: 'export const DEFAULT_SHEET_BOOK="five-smooth-stones";export const keepLocalBookDoc=()=>async()=>{};',
  api: 'export const authHeaders=async()=>({"Content-Type":"application/json"});',
  kidModeGate: `export const isKidModeActive=()=>window.evidence.locked;
    export const subscribeKidMode=fn=>{window.evidence.listeners.add(fn);return ()=>window.evidence.listeners.delete(fn);};`,
  KidModeContext: `export const useKidMode=()=>({openKidMode:target=>{const e=window.evidence;e.events.push('open');e.target=target;e.locked=true;for(const fn of e.listeners)fn(true);e.refresh();},isKidModeOpen:window.evidence.locked});`,
  HeroFirstStep: `import React from 'react';export default function Step(p){return <div data-test-step><button id="continue" onClick={p.onEnterKidMode}>Continue</button><button id="cancel" onClick={p.onClose}>Cancel</button></div>;}`,
};
const fixture = `
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import KidModeButton from './src/components/layout/KidModeButton';
import {useKidModeEntry} from './src/components/kidmode/useKidModeEntry';
const e=window.evidence;
function Direct(){const {request,step}=useKidModeEntry();return <>{step}<button id="direct" onClick={()=>request({view:'journeys'})}>Direct stories</button></>;}
function Fixture(){const [,tick]=useState(0);e.refresh=()=>tick(n=>n+1);return <>
 {e.showButton&&<div id="door"><KidModeButton onBeforeOpen={()=>{if(e.closeOnOpen){e.showButton=false;e.refresh();}}}/></div>}
 <div id="compact"><KidModeButton compact/></div><Direct/>
 <output id="mode">{e.locked?'kids':'parent'}</output>
 </>;}
createRoot(document.getElementById('root')).render(<React.StrictMode><Fixture/></React.StrictMode>);
`;
const bundled = await build({ stdin: { contents: fixture, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, platform: 'browser', format: 'iife',
  define: { 'process.env.NODE_ENV': '"development"', 'import.meta.env': '{}' },
  plugins: [{ name: 'synthetic-entry-boundaries', setup(plugin) {
    plugin.onResolve({ filter: /\/(ArborContext|ProfileContext|LanguageContext|heroSheetStore|useHeroSheet|buildHeroSheet|buildBookSheet|api|kidModeGate|KidModeContext|HeroFirstStep)$/ },
      args => ({ path: args.path.split('/').pop(), namespace: 'entry-fixture' }));
    plugin.onLoad({ filter: /.*/, namespace: 'entry-fixture' }, args => ({ contents: stubs[args.path], loader: 'tsx', resolveDir: process.cwd() }));
  } }],
});
const browser = await chromium.launch({ headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const results = []; let debugPage; let debugErrors;
try {
  for (const width of [375, 1280]) for (const language of ['en', 'he']) {
    const context = await browser.newContext({ viewport: { width, height: 812 } });
    await context.route('**/*', route => route.abort());
    const page = await context.newPage(), errors = [];
    debugPage=page; debugErrors=errors; page.on('pageerror', error => errors.push(error.message));
    const mount = async (opts = {}) => {
      errors.length = 0; await page.goto('about:blank');
      await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
      await page.evaluate(({ language, opts }) => {
        const store = () => { const map = new Map(); return { getItem: k => map.get(k) ?? null, setItem: (k,v) => map.set(k,String(v)), removeItem: k => map.delete(k) }; };
        Object.defineProperty(window, 'localStorage', { value: store(), configurable: true });
        Object.defineProperty(window, 'sessionStorage', { value: store(), configurable: true });
        const baseChild = { id:'synthetic-child',name:'Aster',age:5,gender:'girl',photoUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aCU8AAAAASUVORK5CYII=',avatar:{source:'descriptor'},languages:['English'],strengths:[],challenges:[],schoolContext:'' };
        const e = window.evidence = { language, locked: false, owner: 'synthetic-owner', lease: {}, requests: [], events: [],
          listeners: new Set(), showButton: true, closeOnOpen: false, hold: false, refused: false, noProfile: false,
          ...opts, child: { ...baseChild, ...opts.child } };
        const owner = e.owner; e.ownerCurrent = () => e.owner === owner;
        e.change = patch => {
          if (patch.owner || patch.child?.id && patch.child.id !== e.child.id) e.lease = {};
          if (patch.child) patch.child = { ...e.child, ...patch.child };
          Object.assign(e,patch);
          if (patch.owner) { const owner=e.owner; e.ownerCurrent=()=>e.owner===owner; }
          e.refresh();
        };
        window.fetch = async (url,init) => {
          if (!String(url).endsWith('/book-narration')) throw new Error('Unexpected request: '+url);
          e.requests.push({url:String(url),body:JSON.parse(init.body),afterOpen:e.locked});
          if (e.hold) { e.hold=false; await new Promise(resolve=>{e.release=resolve;}); }
          return {ok:!e.refused,status:e.refused?403:200,json:async()=>e.refused?{code:'book_narration_plan'}:{complete:true,cached:true}};
        };
      }, { language, opts });
      await page.addScriptTag({ content: bundled.outputFiles[0].text }); await page.locator('#mode').waitFor();
    };
    const requests = () => page.evaluate(() => window.evidence.requests);
    const quiet = async () => { await page.waitForTimeout(100); assert.equal((await requests()).length,0); assert.deepEqual(errors,[]); };
    const click = () => page.locator('#door > button').click();
    const record = name => { console.log('PASS',width,language,name); assert.deepEqual(errors,[]); results.push({ language, width, name, passed:true }); };

    await mount(); await quiet(); await page.evaluate(()=>window.evidence.change({child:{name:'Fern'}})); await quiet(); record('passive-mount-and-profile-refresh');
    await mount({locked:true}); await page.locator('#direct').click(); await quiet(); record('restored-session-and-locked-door');
    await mount({child:{photoUrl:''}}); await click(); await page.locator('#cancel').waitFor(); await quiet(); await page.locator('#cancel').click(); await quiet(); record('hero-step-open-and-cancel');
    await mount({child:{photoUrl:''}}); await click(); await page.locator('#continue').click();
    await page.waitForFunction(()=>window.evidence.requests.length===5); assert.equal(await page.locator('#mode').textContent(),'kids'); record('hero-step-explicit-continuation');
    await mount({child:{age:2}}); assert.equal(await page.locator('#door > button').count(),0); await page.locator('#direct').click(); await quiet(); record('under-age-door');
    await mount({child:{id:'protected-proof'}}); await click(); await quiet(); assert.equal(await page.locator('#mode').textContent(),'kids'); record('approved-proof-no-generation');
    await mount({noProfile:true}); await click(); await quiet(); assert.equal(await page.locator('#mode').textContent(),'kids'); record('missing-profile-fence-no-generation');
    await mount({closeOnOpen:true}); await click(); await page.waitForFunction(()=>window.evidence.requests.length===5);
    assert.equal(await page.locator('#door').count(),0); record('mobile-control-unmount-does-not-strand-work');
    await mount(); await page.locator('#direct').click(); await page.waitForFunction(()=>window.evidence.requests.length===5);
    const bodies=await requests(); assert.ok(bodies.every(r=>r.afterOpen));
    assert.ok(bodies.every(r=>r.body.lang===(language==='he'?'he-f':'en')));
    assert.ok(bodies.every(r=>Object.keys(r.body).sort().join(',')==='bookId,file,lang'));
    await page.locator('#direct').click(); await page.waitForTimeout(100); assert.equal((await requests()).length,5); record('direct-door-folder-ids-only-and-no-duplicate');
    await page.evaluate(()=>window.evidence.change({locked:false})); await page.locator('#direct').click(); await page.waitForTimeout(100); assert.equal((await requests()).length,5); record('confirmed-work-not-repeated');
    await mount({refused:true}); await click(); await page.waitForFunction(()=>window.evidence.requests.length===1);
    assert.equal(await page.locator('#mode').textContent(),'kids');
    await page.evaluate(()=>window.evidence.change({locked:false,refused:false})); await click();
    await page.waitForFunction(()=>window.evidence.requests.length===6); record('refusal-does-not-block-entry-or-later-retry');
    for(const kind of ['child','owner','name','language']) {
      await mount({hold:true}); await click(); await page.waitForFunction(()=>!!window.evidence.release);
      await page.evaluate(kind=>{const e=window.evidence;e.change(kind==='child'?{child:{id:'other-child'}}:kind==='owner'?{owner:'other-owner'}:kind==='name'?{child:{name:'Fern'}}:{language:e.language==='he'?'en':'he'});},kind);
      await page.waitForTimeout(40); await page.evaluate(()=>window.evidence.release()); await page.waitForTimeout(100);
      assert.equal((await requests()).length,1); record('retired-'+kind+'-stops-further-requests');
    }
    await context.close();
  }
  const evidence = {fixture:'actual entry hook/button/builder; synthetic profile, lock and I/O boundaries; no real synthesis',passed:true,cases:results.length,results};
  await fs.writeFile(path.join(output,'results.json'),JSON.stringify(evidence,null,2));
  console.log(JSON.stringify(evidence,null,2));
} catch(error) { console.error(JSON.stringify({error:String(error),pageErrors:debugErrors,state:await debugPage?.evaluate(()=>({requests:window.evidence?.requests,locked:window.evidence?.locked,events:window.evidence?.events,child:window.evidence?.child,body:document.body.innerText}))},null,2)); throw error; } finally { await browser.close(); }
