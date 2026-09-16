import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(app,'public/marketing');
const catalog=JSON.parse(fs.readFileSync(path.join(app,'scripts/marketing-translations.json'),'utf8'));
const names={en:'English',he:'עברית',de:'Deutsch',fr:'Français',nl:'Nederlands'};
const menuLabels={en:'Choose language',he:'בחירת שפה',de:'Sprache wählen',fr:'Choisir la langue',nl:'Taal kiezen'};
const page=lang=>`arbor-marketing-landing-page-${lang}.html`;
const url=lang=>`https://arborparentingapp.com/marketing/${page(lang)}`;
const escape=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const decode=s=>s.replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#39;',"'");
const menu=lang=>`<details class="language-menu"><summary aria-label="${menuLabels[lang]}: ${names[lang]}"><span class="language-name">${names[lang]}</span><span class="language-code" aria-hidden="true">${lang.toUpperCase()}</span></summary><nav class="language-options" aria-label="${menuLabels[lang]}">${Object.entries(names).map(([code,name])=>`<a href="/marketing/${page(code)}" lang="${code}" hreflang="${code}"${code===lang?' aria-current="page"':''}>${name}</a>`).join('')}</nav></details>`;
const alternatives=Object.keys(names).map(lang=>`<link rel="alternate" hreflang="${lang}" href="${url(lang)}">`).join('')+'<link rel="alternate" hreflang="x-default" href="https://arborparentingapp.com/marketing/">';
function shell(html,lang){
 html=html.replace(/<html[^>]*>/,`<html lang="${lang}"${lang==='he'?' dir="rtl"':''}>`);
 html=html.replace(/<link rel="canonical"[^>]*>/,`<link rel="canonical" href="${url(lang)}">`);
 html=html.replace(/<link rel="alternate"[^>]*>/g,'').replace('</head>',alternatives+'</head>');
 html=html.replace(/<a class="language"[^>]*>.*?<\/a>|<details class="language-menu">[\s\S]*?<\/details>/,menu(lang));
 return html.replace(/arbor-immersive-v3\.(css|js)\?v=[\d.]+/g,'arbor-immersive-v3.$1?v=8');
}
const source=fs.readFileSync(path.join(dir,page('en')),'utf8');
for(const lang of ['de','fr','nl']){
 const tr=s=>catalog[lang][decode(s)]??decode(s);
 let html=source.replace(/>([^<>]+)</g,(_,s)=>{const trimmed=s.trim();return '>'+s.replace(trimmed,escape(tr(trimmed)))+'<';});
 html=html.replace(/(<button data-cap="plans" class="active"[\s\S]*?<span>)[^<]+/,(_,prefix)=>prefix+({de:'Routinen',fr:'Routines',nl:'Routines'}[lang]));
 html=html.replace(/(alt|aria-label|content)="([^"]*)"/g,(_,attr,value)=>`${attr}="${escape(tr(value))}"`);
 const money=new Intl.NumberFormat(lang,{style:'currency',currency:'EUR'});
 html=html.replace('€12.99',money.format(12.99)).replace('€19.99',money.format(19.99));
 fs.writeFileSync(path.join(dir,page(lang)),shell(html,lang));
}
for(const lang of ['en','he'])fs.writeFileSync(path.join(dir,page(lang)),shell(fs.readFileSync(path.join(dir,page(lang)),'utf8'),lang));
fs.copyFileSync(path.join(dir,page('he')),path.join(dir,'index.html'));
const scriptPath=path.join(dir,'arbor-immersive-v3.js');
let script=fs.readFileSync(scriptPath,'utf8').replace(/\/\* BEGIN MARKETING TRANSLATIONS \*\/[\s\S]*?\/\* END MARKETING TRANSLATIONS \*\/\n?/,'');
const keys=[...new Set([...script.matchAll(/\bt\('([^']*)'/g)].map(m=>m[1]))];
const runtime={};
for(const lang of ['de','fr','nl']){runtime[lang]={};for(const key of keys){if(!catalog[lang][key])throw Error(`Missing ${lang}: ${key}`);runtime[lang][key]=catalog[lang][key];}}
script='/* BEGIN MARKETING TRANSLATIONS */\nwindow.ARBOR_TRANSLATIONS='+JSON.stringify(runtime)+';\n/* END MARKETING TRANSLATIONS */\n'+script;
fs.writeFileSync(scriptPath,script);
console.log(`Updated five languages, language menus and ${keys.length} translated interactive strings per added language.`);
