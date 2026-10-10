/** Offline artifact aggregation. No browser, app, dependencies or network. */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { summarizeRelease } from './release-summary.mjs';
import { releaseIdentity } from './release-config.mjs';
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  if (!['--root', '--out', '--sha', '--tree', '--scope'].includes(process.argv[i]) || !process.argv[i + 1]) throw new Error('SUMMARY_ARGUMENT_INVALID');
  args.set(process.argv[i], process.argv[i + 1]);
}
const identity = releaseIdentity(args.get('--sha'), args.get('--tree'));
const root = path.resolve(args.get('--root'));
const output = path.resolve(args.get('--out'));
const read = (dir, name) => { try { return JSON.parse(readFileSync(path.join(dir, name), 'utf8')); } catch { return null; } };
const dirs = existsSync(root) ? readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => path.join(root, entry.name)) : [];
const records = dirs.map((dir) => {
  const capture = read(dir, 'capture.json');
  const base = capture?.cell?.group === 'base';
  const printFiles = existsSync(path.join(dir, 'print')) ? readdirSync(path.join(dir, 'print')).filter(name => /^kept-month\.(mobile|desktop)-(en|he)\.(html|png)$/.test(name)).map(name => `print/${name}`) : [];
  const printHashes = Object.fromEntries(printFiles.filter(name => name.endsWith('.html')).map(name => [name, createHash('sha256').update(readFileSync(path.join(dir, name))).digest('hex')]));
  return { capture, inventory: read(dir, 'route-inventory.json'), evidence: read(dir, base ? 'sweep.json' : 'evidence.json'), fonts: read(dir, base ? 'font-evidence.sweep.json' : 'font-evidence.diagnostics.json'),
    printFiles, printHashes,
    shotNames: existsSync(path.join(dir, 'shots')) ? readdirSync(path.join(dir, 'shots')).filter((name) => name.endsWith('.png')) : [] };
});
const result = summarizeRelease(records, identity, args.get('--scope') ?? 'all');
mkdirSync(output, { recursive: true });
writeFileSync(path.join(output, 'release-summary.json'), JSON.stringify(result, null, 2));
writeFileSync(path.join(output, 'release-summary.md'), `# Parent release evidence: ${result.completed ? 'coverage complete' : 'incomplete'}\n\nSource commit: ${result.sourceSha}\n\nSource tree: ${result.sourceTreeSha}\n\n- Base route cells: ${result.baseCells}/${result.expectedBaseCells}\n- Interaction cells: ${result.interactionCells}\n- App screenshot files: ${result.screenshots}\n- Separate actual print previews: ${result.printPreviews}\n- Returned shards: ${result.returnedShards}/${result.expectedShards}\n\n${result.note}\n\n${result.failures.map((failure) => `- ${failure.id}: ${failure.reasons.join(', ')}`).join('\n')}\n`);
console.log(`Release evidence ${result.completed ? 'complete' : 'incomplete'}: ${result.baseCells}/${result.expectedBaseCells} base cells; ${result.returnedShards}/${result.expectedShards} shards.`);
if (!result.completed) process.exitCode = 1;
