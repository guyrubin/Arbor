import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { classifyReleaseConsole, createRuntimeDiagnostics, createAssetDiagnostics, safeReleaseException, sanitizedReleaseLocation } from './capture/runtime-diagnostics.mjs';

const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');
const secret = 'FAKE_API_KEY_sk_test_never_export_42';
const child = 'Synthetic Child Rowan Private';

describe('shared release diagnostic allowlist, no browser or sockets', () => {
  it('exports only enum categories for secret-like text, child text and stack snippets', () => {
    const cases = [
      [`Maximum update depth exceeded: ${secret}; ${child}`, 'REACT_UPDATE_DEPTH'],
      [`Rendered more hooks than during the previous render: ${child}`, 'REACT_HOOKS'],
      [`Outdated Optimize Dep ${secret}`, 'OPTIMIZED_DEPENDENCY'],
      [`Content Security Policy blocked ${child} at https://private.test/?token=${secret}`, 'CSP'],
      [`Failed to fetch dynamically imported module https://private.test/${secret}`, 'MODULE_LOAD'],
      [`Minified React error #185; private ${child}; args[]=${secret}`, 'REACT_MINIFIED_185'],
      [`Minified React error #1859; private ${secret}`, 'REACT_MINIFIED'],
      [`Error: Minified React error #418; ${secret}`, 'REACT_MINIFIED_418'],
      [`Uncaught (in promise) Error: Minified React error #426; ${child}`, 'REACT_MINIFIED_426'],
      [`The result of getSnapshot should be cached ${secret}`, 'REACT_UNCACHED_SNAPSHOT'],
      [`Cannot update a component while rendering a different component ${child}`, 'REACT_RENDER_PHASE_UPDATE'],
      [`Detected multiple renderers concurrently rendering the same context ${secret}`, 'REACT_MULTIPLE_RENDERERS'],
      [`useInsertionEffect must not schedule updates ${secret}`, 'REACT_INSERTION_UPDATE'],
      [`<button> cannot be a descendant of <button> ${child}`, 'HTML_NESTING'],
      [`Autofocus processing was blocked ${secret}`, 'FOCUS_WARNING'],
      [`An error occurred in the CoachTab component ${secret}`, 'REACT_ERROR_BOUNDARY'],
      [`A component suspended by an uncached promise ${secret}`, 'REACT_UNCACHED_PROMISE'],
      [`Cannot access 'privateChild' before initialization ${secret}`, 'MODULE_INITIALIZATION'],
      [`Cannot read properties of undefined ${child}`, 'TYPE_ERROR'],
      [`Service Worker registration blocked by Playwright ${secret}`, 'SERVICE_WORKER_BLOCKED'],
      [`TypeError: ${child} ${secret}\n at secretFunction (https://private.test/secret.js:1:2)`, 'OTHER_ERROR'],
    ];
    for (const [raw, expected] of cases) {
      const result = classifyReleaseConsole(raw);
      expect(result).toBe(expected);
      expect(result).not.toContain(secret);
      expect(result).not.toContain(child);
      expect(result).not.toContain('https://');
      // Negative control: the former first-line/truncate policy leaked these.
      expect(raw.split('\n')[0].slice(0, 300)).toMatch(/Private|FAKE_API_KEY/);
    }
  });

  it('shares bounded snapshots with safe module locations and no raw values', () => {
    const diagnostics = createRuntimeDiagnostics();
    for (let n = 0; n < 80; n++) diagnostics.record(`Maximum update depth exceeded ${secret} ${child}`, {
      url: `http://127.0.0.1:4805/assets/index-a1b2.js?key=${secret}#${child}`,
      lineNumber: 12, columnNumber: 34,
    });
    diagnostics.record(`Unhandled private error ${secret} ${child}`, { url: `http://127.0.0.1:4805/api/chat?prompt=${child}`, lineNumber: 88 });
    const snapshot = diagnostics.snapshot();
    expect(snapshot.counts).toEqual({ REACT_UPDATE_DEPTH: 80, OTHER_ERROR: 1 });
    expect(snapshot.recent).toHaveLength(20);
    expect(snapshot.recent[0]).toEqual({ kind: 'REACT_UPDATE_DEPTH', source: { path: '/assets/index-a1b2.js', line: 12, column: 34 } });
    expect(snapshot.recent.at(-1)).toEqual({ kind: 'OTHER_ERROR' });
    expect(JSON.stringify(snapshot)).not.toMatch(/FAKE_API_KEY|Rowan|Private|https?:|prompt=|key=|stack|message/);
    snapshot.recent[0].source.path = '/changed';
    expect(diagnostics.snapshot().recent[0].source.path).toBe('/assets/index-a1b2.js');
    expect(sanitizedReleaseLocation({ url: `https://other.test/src/${secret}.tsx` })).toBeUndefined();
  });


  it('retains only allowlisted exception names and bounded local static module frames', () => {
    const error = { name: 'TypeError', message: `${secret} ${child}`, stack: `TypeError: ${secret} ${child}
 at privateFunction (http://127.0.0.1:4805/assets/CoachTab-a1.js?key=${secret}#${child.replaceAll(' ', '_')}:12:34)
 at hidden (https://external.test/src/private.js:2:3)
 at hidden (http://127.0.0.1:4805/api/chat?prompt=${secret}:2:3)
 at hidden (http://127.0.0.1:4805/src/main.tsx:2:3)` };
    expect(safeReleaseException(error)).toEqual({ errorName: 'TypeError', frames: [{ path: '/assets/CoachTab-a1.js', line: 12, column: 34 }, { path: '/src/main.tsx', line: 2, column: 3 }] });
    const diagnostics = createRuntimeDiagnostics(); diagnostics.recordPageError(error);
    expect(diagnostics.snapshot().recent[0]).toMatchObject({ kind: 'OTHER_ERROR', errorName: 'TypeError' });
    expect(JSON.stringify(diagnostics.snapshot())).not.toMatch(/FAKE_API_KEY|Rowan|Private|privateFunction|hidden|external|https?:|key=|prompt=|message|stack/);
    expect(safeReleaseException({ name: secret, stack: secret })).toEqual({ errorName: 'OtherError' });
    expect(safeReleaseException({ name: 'Error', stack: 'Error\n' + ' at fn (http://127.0.0.1:4805/assets/index.js:1:2)\n'.repeat(30) }).frames).toHaveLength(5);
    const snapshot = diagnostics.snapshot(); snapshot.recent[0].frames[0].path = '/changed';
    expect(diagnostics.snapshot().recent[0].frames[0].path).toBe('/assets/CoachTab-a1.js');
  });

  it('records only bounded local JS/CSS lifecycle facts, never private URLs or payloads', () => {
    const assets = createAssetDiagnostics();
    const key = {};
    assets.request(key, `http://127.0.0.1:4805/assets/CoachTab-a1b2.js?token=${secret}#${child}`, 'script');
    assets.response(key, 200, `text/javascript; private=${secret}`);
    expect(assets.snapshot().pending[0]).toMatchObject({ path: '/assets/CoachTab-a1b2.js', type: 'script', status: 200, mime: 'javascript', state: 'pending' });
    assets.finish(key);
    const css = {};
    assets.request(css, 'http://127.0.0.1:4805/assets/CoachTab-a1b2.css', 'stylesheet');
    assets.response(css, 404, 'text/html');
    assets.finish(css, true);
    assets.request({}, `https://private.test/src/${secret}.js`, 'script');
    assets.request({}, `http://127.0.0.1:4805/api/chat?prompt=${child}`, 'fetch');
    const snapshot = assets.snapshot();
    expect(snapshot.counts).toMatchObject({ started: 2, finished: 1, failed: 1, httpErrors: 1 });
    expect(snapshot.pending).toHaveLength(0);
    expect(snapshot.recent[1]).toMatchObject({ path: '/assets/CoachTab-a1b2.css', type: 'stylesheet', status: 404, mime: 'html', state: 'failed' });
    expect(JSON.stringify(snapshot)).not.toMatch(/FAKE_API_KEY|Rowan|Private|token=|private=|https?:|payload/);
    for (let n = 0; n < 200; n++) assets.request({}, `http://127.0.0.1:4805/assets/chunk-${n}.js`, 'script');
    expect(assets.snapshot().pending).toHaveLength(120);
    expect(assets.snapshot().counts.omitted).toBe(80);
  });

  it('wires the same allowlist into both raw error entry points of both collectors', () => {
    const sweep = read('./rendered-sweep.mjs');
    const visit = sweep.slice(sweep.indexOf('async function visit('), sweep.indexOf('/* ── determinism guards'));
    expect(visit).toContain('errors.add(diagnostics.record(message.text(), message.location()))');
    expect(visit).toContain('errors.add(diagnostics.recordPageError(error))');
    expect(visit).toContain('runtimeDiagnostics: diagnostics.snapshot()');
    expect(visit).toContain('navError = classifyReleaseConsole(err?.message)');
    expect(visit).toContain('collectError: classifyReleaseConsole(err?.message)');
    expect(visit).toContain('stateRec.undoError = classifyReleaseConsole(err?.message)');
    expect(visit).not.toMatch(/errors\.add\((?:text|norm|message\.text\(|error\?\.message)/);
    expect(visit).not.toMatch(/String\(err\?\.message|err\?\.stack|firstErr\.slice|const norm =/);
    const ask = read('./capture/release-interactions.mjs');
    expect(ask).toContain("from './runtime-diagnostics.mjs'");
    expect(ask).toContain('diagnostics.record(message.text(), message.location())');
    expect(ask).toContain('diagnostics.recordPageError(error)');
    expect(ask).toContain('cell.runtimeDiagnostics = diagnostics.snapshot()');
  });
});
