/** Real toast provider, scope boundary, handback view and translations.
 * Synthetic contexts and writes only. All network is blocked. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { RELEASE_VIEWPORTS } from './capture/release-config.mjs';

const output = path.resolve('output/parent-handback');
await mkdir(output, { recursive: true });
const fixture = `
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
import {ToastProvider,ToastScope,useToast} from './src/context/ToastContext';
import {ProgramBookHandbackView} from './src/components/program/ProgramBookHandback';
import {translate} from './src/lib/i18n';
window.kidLocked=false;window.kidListeners=new Set();window.writes=[];window.actions=0;
window.lock=value=>{window.kidLocked=value;window.kidListeners.forEach(fn=>fn(value));};
function Child(){const {toast}=useToast();window.notify=()=>toast('Synthetic private message','info',{label:'Synthetic action',onClick:()=>window.actions++});return null;}
function App(){const [scope,setScope]=useState('owner-a:child-a'),[family,setFamily]=useState(true);
 window.scope=value=>flushSync(()=>setScope(value));window.family=value=>flushSync(()=>setFamily(value));
 const lang=window.fixture.lang,t=k=>translate(lang,'elev.program.object.'+k);
 return <ToastProvider>{family&&<ToastScope scopeKey={scope}><Child/><ProgramBookHandbackView key={scope} cover={<span data-owned-cover={scope}/>} card={{key:'synthetic:yesterday',objectId:'synthetic',title:'Synthetic book',coverLine:'Synthetic cover',tomorrow:'Synthetic tomorrow',askAfter:'Synthetic question'}} lang={lang} labels={{handback:t('handback'),tomorrow:t('tomorrow'),ask:t('ask'),dismiss:t('dismiss'),save:t('save'),words:t('words'),placeholder:t('placeholder'),saveError:t('saveError')}} onDismiss={()=>window.dismissed=true} onSave={text=>{window.writes.push(text);return new Promise((resolve,reject)=>{window.resolveWrite=resolve;window.rejectWrite=()=>reject(new Error('synthetic failure'));});}}/></ToastScope>}</ToastProvider>;}
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);`;

async function bundle(negative) {
  return (await build({stdin:{contents:fixture,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"','import.meta.env':'{}'},plugins:[{name:'isolated-parent',setup(p){
    p.onResolve({filter:/\/(LanguageContext|ArborContext|AuthContext|useChildCollection|useNowClock|kidModeGate)$/},args=>({path:args.path.split('/').pop(),namespace:'isolated-parent'}));
    p.onResolve({filter:/\/Icon$/},()=>({path:'Icon',namespace:'isolated-parent'}));
    p.onLoad({filter:/.*/,namespace:'isolated-parent'},args=>({contents:({
      LanguageContext:`import {translate} from './src/lib/i18n';export const useLanguage=()=>({uiLang:window.fixture.lang,t:(k,v)=>translate(window.fixture.lang,k,v)});`,
      ArborContext:'export const useArbor=()=>({});',AuthContext:'export const useAuth=()=>({});',useChildCollection:'export const useChildCollection=()=>({});',useNowClock:'export const useNowClock=()=>new Date();',
      kidModeGate:'export const isKidModeActive=()=>window.kidLocked;export const subscribeKidMode=fn=>{window.kidListeners.add(fn);return()=>window.kidListeners.delete(fn);};',
      Icon:'export const Icon=()=>null;',
    })[args.path],loader:'tsx',resolveDir:process.cwd()}));
    if(negative)p.onLoad({filter:/ToastContext\.tsx$/},async args=>({contents:(await readFile(args.path,'utf8')).replace('useToastScopeEffect(() => { retire(); return retire; }, [scopeKey, retire]);','useToastScopeEffect(() => {}, [scopeKey, retire]);'),loader:'tsx'}));
  }}]})).outputFiles[0].text;
}
const [fixed,before,css]=await Promise.all([bundle(false),bundle(true),readFile('src/components/companion/nowView.css','utf8')]);
if(process.argv.includes('--build-only')){console.log('Parent handback regression bundles built.');process.exit(0);}
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[];
try{
 for(const cell of RELEASE_VIEWPORTS){
  const context=await browser.newContext({viewport:{width:cell.w,height:cell.h},reducedMotion:'reduce'});
  await context.route('**/*',r=>r.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const mount=async negative=>{await page.goto('about:blank');await page.setContent('<div id="root"></div>');await page.evaluate(lang=>{window.fixture={lang};document.documentElement.dir=lang==='he'?'rtl':'ltr';},cell.lang);await page.addStyleTag({content:css+':root{--arbor-paper:#fff;--arbor-ink:#14225a;--arbor-rule:#ccc;--arbor-muted:#475569}'});await page.addScriptTag({content:negative?before:fixed});await page.locator('textarea').waitFor();};
  const privateMessages=()=>page.getByText('Synthetic private message',{exact:true});
  await mount(true);await page.evaluate(()=>window.notify());await privateMessages().waitFor();await page.evaluate(()=>window.scope('owner-b:child-a'));assert.equal(await privateMessages().count(),1,'negative control retains the other owner’s private toast');
  await mount(false);await page.evaluate(()=>{window.oldNotify=window.notify;window.notify();});await privateMessages().waitFor();
  const staleAction=await page.getByRole('button',{name:'Synthetic action'}).elementHandle();
  await page.evaluate(()=>window.scope('owner-b:child-a'));assert.equal(await privateMessages().count(),0,'no private exit animation after account change');assert.equal(await page.locator('[data-owned-cover]').getAttribute('data-owned-cover'),'owner-b:child-a');
  await staleAction.evaluate(el=>el.click());assert.equal(await page.evaluate(()=>window.actions),0,'detached old action cannot write');
  await page.evaluate(()=>window.oldNotify());assert.equal(await privateMessages().count(),0,'late failure from old owner cannot re-offer private text');
  await page.evaluate(()=>window.scope('owner-a:child-a'));await page.evaluate(()=>window.oldNotify());assert.equal(await privateMessages().count(),0,'A→B→A cannot revive old callbacks');
  await page.evaluate(()=>{window.lock(true);window.notify();});assert.equal(await privateMessages().count(),0);
  await page.evaluate(()=>window.scope('owner-a:child-b'));await page.evaluate(()=>window.lock(false));assert.equal(await privateMessages().count(),0,'queued old-child toast is discarded');
  await page.evaluate(()=>window.notify());await privateMessages().waitFor();await page.evaluate(()=>window.family(false));assert.equal(await privateMessages().count(),0,'logout removes family feedback');
  await page.evaluate(()=>window.family(true));await page.locator('textarea').waitFor();
  const draft=cell.lang==='he'?'מילים של הורה לבדיקה':'A parent’s synthetic words';await page.locator('textarea').fill(draft);
  await page.locator('[data-testid="program-book-save"]').evaluate(el=>{el.click();el.click();});assert.deepEqual(await page.evaluate(()=>window.writes),[draft]);
  assert.equal(await page.locator('textarea').isDisabled(),true);assert.equal(await page.locator('[data-testid="program-book-dismiss"]').isDisabled(),true);
  await page.evaluate(()=>window.rejectWrite());await page.locator('[role="alert"]').waitFor();assert.equal(await page.locator('textarea').inputValue(),draft);assert.equal(await page.locator('[data-testid="program-book-save"]').isEnabled(),true);
  await page.locator('[data-testid="program-book-save"]').click();await page.evaluate(()=>window.resolveWrite(false));await page.locator('[role="alert"]').waitFor();assert.equal(await page.locator('textarea').inputValue(),draft);
  await page.locator('[data-testid="program-book-save"]').click();await page.evaluate(()=>window.scope('owner-a:child-c'));assert.equal(await page.locator('textarea').inputValue(),'');await page.evaluate(()=>window.resolveWrite(false));assert.equal(await page.locator('[role="alert"]').count(),0,'late old-card failure cannot change the next child');
  await page.locator('textarea').fill(draft);await page.locator('[data-testid="program-book-save"]').click();await page.evaluate(()=>window.resolveWrite(true));await page.waitForFunction(()=>!document.querySelector('[data-testid="program-book-save"]').disabled);assert.equal(await page.locator('[role="alert"]').count(),0);
  await page.screenshot({path:path.join(output,cell.id+'.png')});assert.deepEqual(errors,[]);results.push({viewport:cell.id,passed:true});await context.close();
 }
 await writeFile(path.join(output,'results.json'),JSON.stringify({passed:true,scope:'synthetic accounts, records and writes; real React, Motion, toast and handback view; not authenticated/device acceptance',results},null,2));
 console.log('Parent handback: '+results.length+' EN/HE release cells passed account/child retirement, queued/late toast, rejection/retry and duplicate-save checks.');
}finally{await browser.close();}
