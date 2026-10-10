import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { classifyReleaseConsole, createRuntimeDiagnostics, sanitizedReleaseLocation } from './capture/runtime-diagnostics.mjs';

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

  it('wires the same allowlist into both raw error entry points of both collectors', () => {
    const sweep = read('./rendered-sweep.mjs');
    const visit = sweep.slice(sweep.indexOf('async function visit('), sweep.indexOf('/* ── determinism guards'));
    expect(visit).toContain('errors.add(diagnostics.record(message.text(), message.location()))');
    expect(visit).toContain('errors.add(diagnostics.record(error?.message))');
    expect(visit).toContain('runtimeDiagnostics: diagnostics.snapshot()');
    expect(visit).toContain('navError = classifyReleaseConsole(err?.message)');
    expect(visit).toContain('collectError: classifyReleaseConsole(err?.message)');
    expect(visit).toContain('stateRec.undoError = classifyReleaseConsole(err?.message)');
    expect(visit).not.toMatch(/errors\.add\((?:text|norm|message\.text\(|error\?\.message)/);
    expect(visit).not.toMatch(/String\(err\?\.message|err\?\.stack|firstErr\.slice|const norm =/);
    const ask = read('./capture/release-interactions.mjs');
    expect(ask).toContain("from './runtime-diagnostics.mjs'");
    expect(ask).toContain('diagnostics.record(message.text(), message.location())');
    expect(ask).toContain('diagnostics.record(error.message)');
    expect(ask).toContain('cell.runtimeDiagnostics = diagnostics.snapshot()');
  });
});
