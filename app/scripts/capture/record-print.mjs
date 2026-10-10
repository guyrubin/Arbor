/** Capture the actual app-produced print payload, never a rebuilt document. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { BASE } from './config.mjs';

export function validateRecordPrintHtml(html) {
  return typeof html === 'string' && Buffer.byteLength(html) < 128_000
    && /@page\s*\{\s*size:\s*A4;/.test(html)
    && /font-family:\s*Georgia,\s*"Times New Roman",\s*serif/.test(html)
    && !/<(?:img|iframe|object|embed|form|link)\b/i.test(html)
    && !/\b(?:src|href)\s*=/i.test(html)
    && !/class=["'](?:brand|meta|footer)["']/.test(html)
    && /<bdi dir="auto" lang="(?:en|he)">/.test(html)
    && (html.match(/<script>/g) ?? []).length === 1
    && html.includes('<script>window.onload=function(){setTimeout(function(){window.print();},250);}</script>');
}

export function validRecordPrintReceipt(receipt, identity, files = [], hashes = {}) {
  return receipt?.passed === true && receipt.sourceSha === identity.sourceSha && receipt.sourceTreeSha === identity.sourceTreeSha
    && ['download-html', 'popup-html'].includes(receipt.delivery) && receipt.media === 'print'
    && receipt.fontMode === 'source-platform-serif' && receipt.paper === 'A4' && receipt.exactAppPayload === true
    && /^[a-f0-9]{64}$/.test(receipt.htmlSha256 ?? '') && receipt.htmlBytes > 0 && receipt.htmlBytes < 128_000
    && receipt.expectedRows === 4 && receipt.renderedRows === 4 && receipt.textMatches === true
    && receipt.viewport?.width === 794 && receipt.viewport?.height === 1123
    && receipt.fonts?.length > 0 && receipt.fonts.every(font => font.glyphCount > 0 && typeof font.familyName === 'string')
    && /^print\/kept-month\.(mobile|desktop)-(en|he)\.html$/.test(receipt.html ?? '')
    && receipt.shot === receipt.html.replace(/\.html$/, '.png') && files.includes(receipt.html) && files.includes(receipt.shot)
    && hashes[receipt.html] === receipt.htmlSha256;
}

export async function captureRecordPrint({ page, context, trigger, output, fixture, viewport, sourceSha, sourceTreeSha, apiState, cell }) {
  const stem = `kept-month.${viewport.id}`;
  const receipt = cell.printPreview = { sourceSha, sourceTreeSha, fixture: 'synthetic-record-local-storage', passed: false,
    html: `print/${stem}.html`, shot: `print/${stem}.png`, exactAppPayload: true, fontMode: 'source-platform-serif', media: 'print', paper: 'A4',
    viewport: { width: 794, height: 1123 }, expectedRows: fixture.expected.octoberText.length,
    limitation: 'Actual app HTML in browser print-media preview at A4 CSS pixel dimensions. Source deliberately uses installed serif/system fonts; this is not custom-font proof, OS print-dialog verification or physical printer output.' };
  const delivered = Promise.any([
    page.waitForEvent('download', { timeout: 15000 }).then(async download => {
      if (!download.url().startsWith(`blob:${BASE}/`) || !/\.html$/.test(download.suggestedFilename())) throw new Error('PRINT_DELIVERY_INVALID');
      const file = await download.path();
      if (!file) throw new Error('PRINT_DOWNLOAD_MISSING');
      return { html: readFileSync(file, 'utf8'), delivery: 'download-html' };
    }),
    page.waitForEvent('popup', { timeout: 15000 }).then(async popup => {
      try { await popup.locator('body li bdi').first().waitFor({ state: 'visible', timeout: 12000 }); return { html: await popup.content(), delivery: 'popup-html' }; }
      finally { await popup.close().catch(() => {}); }
    }),
  ]);
  // Attach a handler before click so even a click failure cannot create an
  // unhandled timeout. Only this bounded expected download is permitted.
  void delivered.catch(() => {});
  apiState.expectedPrintDownload = true;
  let emitted;
  try { await trigger.click(); emitted = await delivered; }
  finally { apiState.expectedPrintDownload = false; }
  if (!validateRecordPrintHtml(emitted.html)) throw new Error('PRINT_SOURCE_HTML_INVALID');
  Object.assign(receipt, { delivery: emitted.delivery, htmlSha256: createHash('sha256').update(emitted.html).digest('hex'), htmlBytes: Buffer.byteLength(emitted.html) });
  mkdirSync(`${output}/print`, { recursive: true });
  writeFileSync(`${output}/${receipt.html}`, emitted.html);
  // This serves the bytes received from the app's real delivery shell, only at
  // a capture-owned URL. No application route, DOM, style or builder is replaced.
  const localUrl = `${BASE}/__capture_print__/${stem}.html`;
  await context.route(localUrl, route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: emitted.html }));
  const print = await context.newPage();
  let session;
  try {
    await print.setViewportSize(receipt.viewport);
    await print.emulateMedia({ media: 'print' });
    await print.goto(localUrl, { waitUntil: 'load', timeout: 15000 });
    const rendered = await print.evaluate(({ expected, name, lang }) => {
      const rows = [...document.querySelectorAll('li bdi')];
      const style = getComputedStyle(document.body);
      return { renderedRows: rows.length, textMatches: JSON.stringify(rows.map(el => el.textContent)) === JSON.stringify(expected),
        childMatches: document.querySelector('h1')?.textContent === name, documentLang: document.documentElement.lang, direction: document.documentElement.dir,
        bidi: rows.every(el => el.getAttribute('dir') === 'auto' && el.getAttribute('lang') === lang), serif: style.fontFamily.includes('serif'),
        noExternalAssets: !document.querySelector('img, iframe, link, [src], [href]'), noReportDecorations: !document.querySelector('.brand, .meta, .footer'),
        noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth, height: document.documentElement.scrollHeight };
    }, { expected: fixture.expected.octoberText, name: fixture.childName, lang: viewport.lang });
    Object.assign(receipt, rendered);
    session = await context.newCDPSession(print);
    await session.send('DOM.enable'); await session.send('CSS.enable');
    const { root } = await session.send('DOM.getDocument');
    const { nodeIds } = await session.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: 'h1, .month, li bdi, li .date' });
    receipt.fonts = [];
    for (const nodeId of nodeIds.slice(0, 10)) {
      const { fonts } = await session.send('CSS.getPlatformFontsForNode', { nodeId });
      for (const font of fonts.filter(font => font.glyphCount > 0)) receipt.fonts.push({ familyName: font.familyName, isCustomFont: font.isCustomFont, glyphCount: font.glyphCount });
    }
    // Deliberately separate from app's exact Google-font wrapper: the source
    // printable shell declares Georgia/Times/system fonts and no remote assets.
    await print.screenshot({ path: `${output}/${receipt.shot}`, animations: 'disabled', fullPage: true, timeout: 12000 });
    receipt.passed = rendered.renderedRows === receipt.expectedRows && rendered.textMatches && rendered.childMatches && rendered.bidi && rendered.serif
      && rendered.documentLang === viewport.lang && rendered.direction === (viewport.lang === 'he' ? 'rtl' : 'ltr')
      && rendered.noExternalAssets && rendered.noReportDecorations && rendered.noHorizontalOverflow && receipt.fonts.length > 0;
  } finally {
    await session?.detach().catch(() => {});
    await print.close().catch(() => {});
    await context.unroute(localUrl);
  }
  return receipt;
}
