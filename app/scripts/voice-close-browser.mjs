/** Offline component integration check: actual review, tray, dialog stack,
 * voice controller and hook; synthetic records, storage and speech I/O only.
 * Run after npm run build with Playwright Chromium installed. This proves
 * rendered controls/lifecycle, not real synthesis, microphone or cloud writes. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const output = process.env.VOICE_REVIEW_EVIDENCE_DIR || await fs.mkdtemp(path.join(os.tmpdir(), 'arbor-voice-review-'));
await fs.mkdir(output, { recursive: true });
const stubs = {
  ArborContext: 'export const useArborOptional = () => null;',
  ToastContext: 'export const useToastOptional = () => null;',
  naturalVoice: 'export const initNaturalVoice = async () => {};',
  api: 'export const getAiLanguage = () => window.evidence.sourceLanguage;',
  kpiEvents: 'export const trackKeepUndone = () => {}; export const trackKeepThis = () => {}; export const trackKidSessionEnd = () => {};',
};
const fixture = `
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import VoiceCloseCard from './src/components/coach/VoiceCloseCard';
import Tray from './src/components/coach/ConversationProposalTray';
const e = window.evidence;
let active;
window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
Object.defineProperty(window, 'speechSynthesis', { configurable:true, value:{
 getVoices:()=>[], cancel:()=>{ e.cancels++; active=null; },
 speak:utterance=>{ active=utterance; e.spoken.push({text:utterance.text,lang:utterance.lang}); utterance.onstart?.(); }
}});
e.end = () => { const u=active; active=null; u?.onend?.(); };
e.fail = () => { const u=active; active=null; u?.onerror?.(); };
const drafts = () => ['journal','milestone'].map((target,i)=>({id:'draft-'+i,sessionId:'s',turnId:'t',childId:'synthetic-child',target,
 summary:e.sourceLanguage==='he' ? (i ? 'ניסינו לבנות מגדל יחד' : 'שיחקנו בקוביות היום') : (i ? 'We tried building a tower together' : 'We played with blocks today'),
 sourceExcerpt:e.language==='he'?'שיחקנו יחד':'We played together',confidence:.9,status:'draft',sourceLanguage:e.sourceLanguage,createdAt:'2026-10-15T12:00:00Z'}));
function Fixture(){
 const [open,setOpen]=useState(false),[proposals,setProposals]=useState(drafts),[pending,setPending]=useState(e.pending),[busy,setBusy]=useState(null);
 e.ready=()=>setPending(false);
 const close=()=>{ if(!busy){setOpen(false);setProposals([]);} };
 return <><button id="opener" onClick={()=>{setProposals(drafts());setOpen(true);}}>Open review</button>
 {open&&<VoiceCloseCard sessionId="s" language={e.language} proposals={proposals} pending={pending} failed={false} busy={!!busy} onClose={close}>
 <Tray inline proposals={proposals} language={e.language} busyId={busy}
 onEdit={(id,summary)=>setProposals(rows=>rows.map(row=>row.id===id?{...row,summary}:row))}
 onDiscard={id=>setProposals(rows=>rows.filter(row=>row.id!==id))}
 onConfirm={async draft=>{setBusy(draft.id);await new Promise(resolve=>{e.finishSave=resolve;});e.kept.push(draft);setProposals(rows=>rows.filter(row=>row.id!==draft.id));setBusy(null);}}/>
 </VoiceCloseCard>}</>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><Fixture/></React.StrictMode>);
`;
const bundled = await build({stdin:{contents:fixture,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"'},plugins:[{
 name:'offline-io',setup(plugin){
  plugin.onResolve({filter:/\/(ArborContext|ToastContext|naturalVoice|api|kpiEvents)$/},args=>({path:args.path.split('/').pop(),namespace:'offline-io'}));
  plugin.onLoad({filter:/.*/,namespace:'offline-io'},args=>({contents:stubs[args.path],loader:'js'}));
 }
}]});
const cssFiles = (await fs.readdir('dist/assets')).filter(file => /^index-.*\.css$/.test(file));
assert.equal(cssFiles.length,1,'Build current production CSS first');
// Public web fonts are excluded offline; geometry uses system fallbacks.
const iconFont = (await fs.readFile('public/fonts/material-symbols-rounded-subset.woff2')).toString('base64');
const shellStyles = [...(await fs.readFile('index.html','utf8')).matchAll(/<style>([\s\S]*?)<\/style>/g)].map(match=>match[1]).join('\n').replaceAll('/fonts/material-symbols-rounded-subset.woff2',`data:font/woff2;base64,${iconFont}`);
const css = (await fs.readFile(path.join('dist/assets',cssFiles[0]),'utf8')).replace(/@import"[^"]*";/g, '') + shellStyles;
const browser = await chromium.launch({headless:true,
 ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {}),
 args:['--disable-dev-shm-usage','--disable-gpu',...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? ['--single-process'] : [])],
});
const results=[];
try {
 const context=await browser.newContext({viewport:{width:375,height:812}});
 await context.route('**/*',route=>route.abort());
 const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 for(const language of ['en','he']) {
  errors.length=0;
  async function mount(pending=false,sourceLanguage=language){
   await page.goto('about:blank');
   await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body class="arbor-app"><div id="root"></div></body></html>');
   await page.addStyleTag({content:css});
   await page.evaluate(async()=>{await document.fonts.load('500 14px "Material Symbols Rounded"');document.documentElement.classList.add('msr-ready');});
   await page.evaluate(({language,pending,sourceLanguage})=>{window.evidence={language,pending,sourceLanguage,spoken:[],kept:[],cancels:0};},{language,pending,sourceLanguage});
   await page.addScriptTag({content:bundled.outputFiles[0].text});
   await page.locator('#opener').click();
   await page.getByRole('dialog').waitFor();
  }
  const stop=()=>page.getByRole('button',{name:language==='he'?'עצירת ההקראה':'Stop readback',exact:true});
  const save=()=>page.getByRole('button',{name:language==='he'?'שמירה':'Save',exact:true});
  const discard=()=>page.getByRole('button',{name:language==='he'?'ויתור':'Discard',exact:true});
  await mount();
  await stop().waitFor();
  assert.equal(await page.getByRole('dialog').getAttribute('dir'),language==='he'?'rtl':'ltr');
  assert.equal(await page.evaluate(()=>window.evidence.spoken.length),1,'StrictMode starts readback once');
  assert.equal(await page.evaluate(()=>window.evidence.kept.length),0,'Opening never saves');
  assert.equal(await page.locator('[data-arbor-dialog-layer]').evaluate(el=>getComputedStyle(el).position),'fixed','Production CSS loaded');
  assert.ok((await save().first().boundingBox()).height>=44,'Save touch target');
  const geometry=await page.getByRole('dialog').evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,overflow:el.scrollWidth>el.clientWidth};});
  assert.ok(geometry.left>=0&&geometry.right<=375&&geometry.top>=0&&geometry.bottom<=812&&!geometry.overflow,JSON.stringify(geometry));
  const closeBox=await page.getByRole('button',{name:language==='he'?'לא לשמור את הטיוטות האלה':'Don’t keep these drafts',exact:true}).boundingBox();
  assert.ok(closeBox.y>=0&&closeBox.y+closeBox.height<=788,'Discard all stays in the viewport');
  await page.screenshot({path:path.join(output,language+'-375.png'),fullPage:true});
  await page.evaluate(()=>window.evidence.end());
  await page.waitForFunction(()=>window.evidence.spoken.length===2);
  assert.equal(await page.evaluate(()=>window.evidence.spoken[1].lang),language==='he'?'he-IL':'en-US');
  await stop().click();
  await page.evaluate(()=>window.evidence.end());
  assert.equal(await page.evaluate(()=>window.evidence.spoken.length),2,'Stop does not resume');
  const edited=language==='he'?'שיחקנו בקוביות עם סבתא':'We played blocks with grandma';
  await page.getByRole('textbox').first().fill(edited);
  await save().first().click();
  assert.ok(await save().last().isDisabled(),'Other saves disabled during write');
  assert.ok(await discard().first().isDisabled(),'Discard disabled during write');
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(),1,'Escape cannot dismiss an active save');
  await page.evaluate(()=>window.evidence.finishSave());
  await page.waitForFunction(()=>window.evidence.kept.length===1 && document.querySelectorAll('textarea').length===1);
  assert.equal(await page.evaluate(()=>window.evidence.kept[0].summary),edited,'Only edited confirmed line saved');
  await discard().click();
  assert.equal(await page.evaluate(()=>window.evidence.kept.length),1,'Discard does not save');
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(),0);
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'opener','Focus restored');
  await mount(true);
  assert.equal(await page.evaluate(()=>window.evidence.spoken.length),0,'Pending extraction is silent');
  await page.evaluate(()=>window.evidence.ready());
  await stop().waitFor();
  await page.evaluate(()=>window.evidence.fail());
  await page.getByText(language==='he'?'לא הצלחנו להשמיע את ההקראה.':'Readback could not play.',{exact:false}).waitFor();
  assert.equal(await stop().count(),0,'Failed playback releases Stop');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>window.evidence.kept.length),0,'Dismiss keeps no drafts');
  await mount(false,language==='en'?'he':'en');
  await stop().waitFor();
  assert.equal(await page.evaluate(()=>window.evidence.spoken[0].lang),language==='en'?'he-IL':'en-US','Draft language is independent of UI locale');
  const count=await page.evaluate(()=>window.evidence.spoken.length);
  await page.keyboard.press('Escape');
  await page.evaluate(()=>window.evidence.end());
  assert.equal(await page.evaluate(()=>window.evidence.spoken.length),count,'Closing cancels remaining chunks');
  assert.deepEqual(errors,[]);
  results.push({language,width:375,strictMode:true,geometry,result:'passed'});
  // Each mount navigates to a fresh document. Reuse the one browser context
  // because single-process Chromium cannot reliably create a second one.
 }
 console.log(JSON.stringify({result:'passed',scope:'Offline actual-component browser checks; synthetic speech and persistence only',results,output},null,2));
 await fs.writeFile(path.join(output,'result.json'),JSON.stringify({result:'passed',scope:'Offline actual-component browser checks; synthetic speech and persistence only',results},null,2));
} finally {await browser.close();}
