/** Real Parent review components; deferred synthetic redraws, no model calls. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { RELEASE_VIEWPORTS } from './capture/release-config.mjs';

const output = path.resolve('output/profile-review');
await mkdir(output, { recursive: true });
const fixture = `
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
import BookSheetStrip from './src/components/profile/BookSheetStrip';import HeroSheetPanel from './src/components/profile/HeroSheetPanel';
import {heroAvatarHash} from './src/lib/heroSheetContract';import {bookSheetId} from './src/lib/library/bookSheet';
window.calls=[];window.ownerListeners=new Set();
window.portrait=id=>'data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="60" height="90"><rect width="60" height="90" fill="'+(id==='a'?'#567890':'#895674')+'"/><text x="25" y="50" fill="white">'+id+'</text></svg>');
window.hash=id=>heroAvatarHash(window.portrait(id));
window.bookDoc=(extra={})=>({id:window.fixture.book,bookId:window.fixture.book,sheetId:bookSheetId(window.hash(window.fixture.hero)),setId:'synthetic',sets:['synthetic'],createdAt:'2026-11-10T10:00:00Z',files:[],bytes:0,sheetManifest:{poses:{idle:{file:'idle.svg',redrawn:false}}},...extra});
window.heroDocs=()=>({meta:{avatarHash:window.hash(window.fixture.hero),status:'complete',poses:['idle']},poses:window.fixture.empty?{}:{idle:{id:'idle',pose:'idle',avatarHash:window.hash(window.fixture.stalePose?'a':window.fixture.hero),dataUrl:window.portrait(window.fixture.stalePose?'a':window.fixture.hero)}}});
window.defer=(kind,input)=>new Promise((resolve,reject)=>window.calls.push({kind,input,resolve,reject}));
function App(){const[,render]=useState(0);window.change=patch=>{Object.assign(window.fixture,patch);flushSync(()=>{for(const f of [...window.ownerListeners])f();render(n=>n+1);});};const f=window.fixture;
 const child={id:f.child,name:'Synthetic',gender:'girl',comicAvatarUrl:window.portrait(f.hero),avatar:{source:'descriptor',style:'soft3d',createdAt:'2026-11-10'}};
 return f.mounted?(f.kind==='book'?<BookSheetStrip child={child} avatarHash={window.hash(f.hero)} target={{bookId:f.book,poses:['idle'],keyBase:'elev.hero.sheet.book'}}/>:<HeroSheetPanel child={child}/>):null;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
`;
const modules = {
  LanguageContext: `import {translate} from './src/lib/i18n';export const useLanguage=()=>({uiLang:window.fixture.lang,t:(k,v)=>translate(window.fixture.lang,k,v)});`,
  heroSheetStore: `export const heroSheetOwnerKey=()=>window.fixture.owner;export const subscribeHeroSheetOwner=f=>{window.ownerListeners.add(f);return()=>window.ownerListeners.delete(f)};export const heroSheetStoreFor=child=>({child,owner:window.fixture.owner});`,
  useChildCollection: `export const useChildCollection=()=>({items:window.fixture.kind==='book'?[window.bookDoc()]:[],confirmed:true,loaded:true,remote:true,error:false});`,
  useHeroSheet: `export const useHeroSheetDocs=()=>window.heroDocs();`,
  bookAssetStore: `export const fetchBookAsset=async()=>null;`,
  buildBookSheet: `export const DEFAULT_SHEET_BOOK='five-smooth-stones';export const bookSheetRunning=()=>false;export const browserBookBuilderDeps=()=>({});export const redrawBookPose=input=>window.defer('book',input);`,
  buildHeroSheet: `export const resumeHeroSheet=()=>null;export const browserBuilderDeps=()=>({});export const redrawHeroPose=input=>window.defer('hero',input);export const markHeroPoseOk=(store,pose)=>window.defer('approve',{...store,pose});`,
};
async function bundle(negative) {
  const result = await build({ stdin: { contents: fixture, resolveDir: process.cwd(), loader: 'tsx' }, outfile: 'fixture.js', bundle: true, write: false,
    platform: 'browser', format: 'iife', define: { 'process.env.NODE_ENV': '"development"', 'import.meta.env': '{}' }, plugins: [{ name: 'synthetic-review', setup(p) {
      p.onResolve({ filter: /\/(LanguageContext|heroSheetStore|useChildCollection|useHeroSheet|bookAssetStore|buildBookSheet|buildHeroSheet)$/ }, a => ({ path: a.path.split('/').pop(), namespace: 'synthetic-review' }));
      p.onLoad({ filter: /.*/, namespace: 'synthetic-review' }, a => ({ contents: modules[a.path], loader: 'tsx', resolveDir: process.cwd() }));
      if (negative) p.onLoad({ filter: /\/(BookSheetStrip|HeroSheetPanel)\.tsx$/ }, async a => ({ contents: (await readFile(a.path, 'utf8'))
        .replace('key={scope}', 'key="unscoped"').replace('key={JSON.stringify([owner, child.id, hash])}', 'key="unscoped"')
        .replace('const d = docs.poses[pose]?.avatarHash === hash ? docs.poses[pose] : undefined;', 'const d = docs.poses[pose];'), loader: 'tsx' }));
    } }] });
  return result.outputFiles.find(f => f.path.endsWith('.js')).text;
}
const [fixed, prior] = await Promise.all([bundle(false), bundle(true)]);
if (process.argv.includes('--build-only')) { console.log('Profile review fixed and negative-control bundles built.'); process.exit(0); }
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const results = [];
try {
  for (const cell of RELEASE_VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: cell.w, height: cell.h }, reducedMotion: 'reduce' });
    await context.route('**/*', r => r.abort());
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const mount = async (kind, negative = false) => {
      await page.goto('about:blank'); await page.setContent('<div id="root"></div>');
      await page.evaluate(({ lang, kind }) => { window.fixture = { lang, kind, owner: 'owner-a', child: 'child-a', hero: 'a', book: 'five-smooth-stones', mounted: true, empty: false, stalePose: false }; }, { lang: cell.lang, kind });
      await page.addScriptTag({ content: negative ? prior : fixed });
      await page.locator(kind === 'book' ? '[data-book-pose]' : '[data-hero-pose]').waitFor();
    };
    const change = patch => page.evaluate(p => window.change(p), patch);
    const bookButton = () => page.locator('[data-book-pose="idle"] button');
    const heroRow = () => page.locator('[data-hero-pose="idle"]');
    const redrawHero = () => heroRow().locator('button').last();
    const settle = (index, ok = false) => page.evaluate(({ index, ok }) => window.calls[index].resolve(ok ? { ok: true, doc: window.bookDoc({ createdAt: '2099-01-01', sheetManifest: { poses: { idle: { file: 'late.svg', redrawn: true } } } }) } : { ok: false }), { index, ok });
    const callCount = () => page.evaluate(() => window.calls.length);

    // Prior unscoped state remains busy in the next child's book review.
    await mount('book', true); await bookButton().click(); await change({ child: 'child-b' });
    assert.equal(await bookButton().count(), 0, 'negative control inherits another child\'s pending state');
    // It can also show an earlier hero's image after a late failure.
    await mount('hero', true); await redrawHero().click(); await change({ hero: 'b', stalePose: true }); await settle(0);
    await heroRow().locator('img').waitFor();
    assert.equal(await heroRow().locator('img').getAttribute('src'), await page.evaluate(() => window.portrait('a')));

    await mount('book');
    await bookButton().evaluate(el => { el.click(); el.click(); }); assert.equal(await callCount(), 1, 'one redraw per pose');
    await change({ child: 'child-b' }); assert.equal(await bookButton().count(), 1);
    await bookButton().click(); assert.equal(await callCount(), 2);
    await settle(0, true); assert.equal(await bookButton().count(), 0, 'late child-a result cannot settle child-b');
    await settle(1); await bookButton().waitFor();
    // Rejection unlocks retry; account, book and hero transitions retire its controls.
    await bookButton().click(); await page.evaluate(() => window.calls[2].reject(Error('synthetic rejection'))); await bookButton().waitFor();
    for (const patch of [{ owner: 'owner-b' }, { book: 'plan-shared' }, { hero: 'b' }]) {
      const index = await callCount(); await bookButton().click(); await change(patch); await bookButton().waitFor();
      await settle(index, true); assert.equal(await bookButton().count(), 1, 'stale result cannot install a redraw override');
    }
    // A -> B -> A creates a new review; the original callback cannot revive.
    const index = await callCount(); await bookButton().click(); await change({ owner: 'owner-c' }); await change({ owner: 'owner-b' }); await settle(index, true);
    assert.equal(await bookButton().count(), 1);
    const unmountIndex = await callCount(); await bookButton().click(); await change({ mounted: false }); await settle(unmountIndex, true); await change({ mounted: true }); await bookButton().waitFor();

    await mount('hero');
    await redrawHero().evaluate(el => { el.click(); el.click(); }); assert.equal(await callCount(), 1);
    await change({ hero: 'b', stalePose: true }); await settle(0); assert.equal(await heroRow().count(), 0, 'never show a mismatched hero from stale feedback');
    await change({ stalePose: false }); await heroRow().waitFor();
    await redrawHero().click(); await change({ child: 'child-b', empty: true }); await settle(1);
    assert.equal(await heroRow().count(), 0, 'late error cannot create a sibling review row');
    await change({ empty: false }); await heroRow().waitFor();
    await redrawHero().click(); await change({ owner: 'owner-b' }); await change({ owner: 'owner-a' }); await settle(2);
    assert.equal(await heroRow().locator('img').count(), 1);
    await redrawHero().click(); await change({ mounted: false }); await settle(3); await change({ mounted: true }); await heroRow().waitFor();
    // Approval and redraw of the same pose cannot race, even before React paints.
    await heroRow().evaluate(row => { const buttons = row.querySelectorAll('button'); buttons[0].click(); buttons[0].click(); buttons[1].click(); });
    assert.equal(await callCount(), 5); assert.equal(await page.evaluate(() => window.calls[4].kind), 'approve');
    await settle(4); await redrawHero().click(); assert.equal(await callCount(), 6); await settle(5); await heroRow().locator('img').waitFor();
    await page.screenshot({ path: path.join(output, cell.id + '.png') });
    assert.deepEqual(errors, []); results.push({ viewport: cell.id, passed: true }); await context.close();
  }
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ passed: true, scope: 'real Parent book/hero review components; synthetic ownership, artwork and deferred requests; no generation or actual-account/device proof', results }, null, 2));
  console.log(`Profile review: ${results.length} EN/HE cells pass duplicate locks, late settlement, child/owner/hero/book switches, ABA and unmount; two prior-behavior negative controls.`);
} finally { await browser.close(); }
