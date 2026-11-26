import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";

// Exercise the real composer and dictation engine. The recognizer supplies
// deterministic event orderings that a physical microphone cannot reproduce.
const bundle = await build({
  stdin: { contents: `
    import React, { useState, StrictMode } from "react";
    import {createRoot} from "react-dom/client";
    import Composer from "./src/components/companion/CompanionComposer";
    import {translate} from "./src/lib/i18n";
    window.label = key => translate(window.lang, key);
    function Fixture() {
      const [text, setText] = useState("Original");
      return <Composer childId="synthetic" conversationRevision={1} language={window.lang}
        value={text} onChange={setText} busy={false} visible onVoice={()=>{}} voiceActive={false}
        voiceLabel="Talk" onKeep={()=>{}} onSend={async () => { window.sends++; return true; }} />;
    }
    createRoot(document.getElementById("root")).render(<StrictMode><Fixture/></StrictMode>);`,
    resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, write: false, format: "iife", jsx: "automatic",
  loader: { ".css": "empty" }, define: { "process.env.NODE_ENV": '"development"' },
  plugins: [{ name: "synthetic-account", setup(b) {
    b.onResolve({filter: /\/useCompanionConsent$/}, () => ({path:"consent", namespace:"stub"}));
    b.onLoad({filter:/.*/,namespace:"stub"},()=>({ contents: 'export const useCompanionConsent=()=>({accountId:"synthetic",reviewing:false})' }));
    b.onResolve({filter: /\/lib\/api$/}, () => ({path:"api",namespace:"api"}));
    b.onLoad({filter:/.*/,namespace:"api"},()=>({contents:'export const api = {};'}));
  }}],
});
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
  args: ["--disable-dev-shm-usage", "--disable-gpu", ...(executablePath ? ["--single-process"] : [])],
});
try {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[]; page.on("pageerror", err => errors.push(err.message));
  for (const lang of ["en","he"]) {
    await page.goto("about:blank");
    await page.setContent('<main id="root"></main>');
    await page.evaluate(lang=>{
      window.lang=lang;window.sends=0;window.recognizers=[];
      window.SpeechRecognition=class {
        constructor(){window.recognizers.push(this)}
        start() {}
        stop(){ this.stopCalls=(this.stopCalls||0)+1; }
        abort(){ this.abortCalls=(this.abortCalls||0)+1; this.onend?.(); }
      };
    },lang);
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    const label=key=>page.evaluate(k=>window.label(k),key);
    const input=page.getByRole("textbox");
    const strip=page.getByTestId("composer-listening");
    const enter=async()=>{
      await page.getByRole("button",{name:await label("companion.input.add-or-save")}).click();
      await page.getByRole("button",{name:await label("companion.input.dictate"),exact:true}).click();
      await strip.getByText(await label("elev.rec.starting"),{exact:true}).waitFor();
      assert.equal(await page.getByTestId("composer-listening-time").count(),0);
    };
    await enter();
    await page.evaluate(()=>window.recognizers.at(-1).onerror({error:"not-allowed"}));
    await page.getByRole("alert").waitFor();
    assert.equal(await input.inputValue(),"Original");
    await enter();
    await page.evaluate(()=>window.recognizers.at(-1).onaudiostart());
    await strip.getByText(await label("elev.rec.on"),{exact:true}).waitFor();
    const say=async(text,final=false)=>page.evaluate(({text,final})=>{
      window.recognizers.at(-1).onresult({resultIndex:0,results:[Object.assign([{transcript:text}],{isFinal:final})]});
    },{text,final});
    const phrase=lang==="he"?"היום שיחקנו":"we played today";
    await say(phrase);
    await page.getByText(phrase,{exact:true}).waitFor();
    await page.getByTestId("composer-listening-stop").click();
    await strip.getByText(await label("elev.rec.finishing"),{exact:true}).waitFor();
    await say(phrase+"!",true);
    await strip.waitFor({state:"detached",timeout:3000});
    assert.equal(await input.inputValue(),"Original "+phrase+"!");
    assert.equal(await page.evaluate(()=>window.recognizers.at(-1).abortCalls),1);
    await enter(); await say(phrase);
    await strip.waitFor({state:"detached",timeout:8000});
    assert.equal(await input.inputValue(),"Original "+phrase+"! "+phrase);
    assert.equal(await page.evaluate(()=>window.sends),0);
    assert.equal(await page.getByTestId("coach-send").isEnabled(),true);
    console.log(lang+": permission recovery, readiness, live caption, Done, late final, pause, retry and editable draft passed");
  }
  assert.deepEqual(errors,[]);
} finally { await browser.close(); }
