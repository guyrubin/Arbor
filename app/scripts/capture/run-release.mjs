/** Dedicated CI entrypoint. Every shard refuses a networked host before app imports. */
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { existsSync, mkdirSync, openSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE, assertLoopbackOnly } from './config.mjs';
import { SMALL_FIXTURE } from './small-state.mjs';
import { SOURCE_FONT_NOTE, validateFontCache } from './font-runtime.mjs';
import { captureDeadlineMs, releaseCell, releaseEnvironment, releaseIdentity, releaseInventory, releaseSweepArguments, shardRoutes, missingBaseEvidence } from './release-config.mjs';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = '/capture-output';
const scratch = '/tmp/arbor-release';

let server;
let metadata;
let sourceRoutes;
let cell;
const write = (name, value) => writeFileSync(`${output}/${name}`, JSON.stringify(value, null, 2));
function progress(stage) {
  metadata.stage = stage;
  metadata.screenshots = readdirSync(`${output}/shots`).filter((name) => name.endsWith('.png')).length;
  const file = cell.group === 'base' ? 'sweep.json' : 'evidence.json';
  if (existsSync(`${output}/${file}`)) {
    try {
      const result = JSON.parse(readFileSync(`${output}/${file}`, 'utf8'));
      metadata.cellsRecorded = result.cells?.length ?? 0;
      if (cell.group === 'base') metadata.missingEvidence = missingBaseEvidence(result.cells ?? [], sourceRoutes, cell.viewport);
      else metadata.missingEvidence = result.missingEvidence ?? [{ failure: 'INTERACTION_VERDICT_PENDING' }];
      metadata.completed = result.completed === true && metadata.missingEvidence.length === 0;
    } catch { /* an interrupted write must not erase the last valid progress */ }
  }
  write('capture.json', metadata);
  console.log(`Release capture: ${cell.id}/${stage}; screenshots=${metadata.screenshots}.`);
}
async function run(args, env, name, deadlineMs) {
  const log = openSync(`${scratch}/${name}.log`, 'w');
  const child = spawn(process.execPath, args, { cwd: app, env, stdio: ['ignore', 'pipe', log], detached: true });
  let pending = '';
  child.stdout.on('data', (chunk) => {
    pending += chunk.toString();
    const lines = pending.split('\n'); pending = lines.pop().slice(-4096);
    for (const line of lines) if (/^(Release cell: [a-z0-9-]+\/[a-z0-9-]+; cells=\d+\.|Release interaction: [a-z0-9/-]+; cells=\d+\.)$/.test(line)) console.log(line);
  });
  let expired = false;
  let hardKill;
  const deadline = setTimeout(() => {
    expired = true;
    try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already exited */ }
    hardKill = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already exited */ } }, 2000);
  }, deadlineMs);
  const pulse = setInterval(() => progress(name), 15_000);
  try {
    const exitCode = await new Promise((resolve, reject) => { child.once('exit', resolve); child.once('error', reject); });
    metadata.lastProcess = { name, exitCode, deadlineExpired: expired };
    if (exitCode !== 0 || expired) throw new Error(expired ? 'CAPTURE_DEADLINE' : 'CHILD_PROCESS_FAILED');
  } finally { clearTimeout(deadline); clearTimeout(hardKill); clearInterval(pulse); }
}
async function main() {
  assertLoopbackOnly(networkInterfaces());
  if (process.platform !== 'linux' || !existsSync('/.dockerenv')) throw new Error('OFFLINE_CONTAINER_REQUIRED');
  const identity = releaseIdentity(process.env.ARBOR_CAPTURE_SHA, process.env.ARBOR_CAPTURE_SOURCE_TREE_SHA);
  cell = releaseCell({ viewport: process.env.ARBOR_CAPTURE_VIEWPORT, group: process.env.ARBOR_CAPTURE_GROUP, shard: process.env.ARBOR_CAPTURE_SHARD });
  if (process.env.ARBOR_CAPTURE_FONT_MODE !== 'exact') throw new Error('RELEASE_REQUIRES_EXACT_FONTS');
  if (readdirSync(app).some((name) => name.startsWith('.env') || name === '.data')) throw new Error('INHERITED_DATA_REFUSED');
  const env = { ...releaseEnvironment(identity.sourceSha), ARBOR_CAPTURE_SHA: identity.sourceSha, ARBOR_CAPTURE_SOURCE_TREE_SHA: identity.sourceTreeSha,
    ARBOR_CAPTURE_CONNECTIVITY: 'synthetic-online', ARBOR_CAPTURE_FONT_MODE: 'exact', ARBOR_CAPTURE_FONT_PHASE: cell.group === 'base' ? 'sweep' : 'diagnostics',
    ARBOR_CAPTURE_VIEWPORT: cell.viewport.id, ARBOR_CAPTURE_GROUP: cell.group, ARBOR_CAPTURE_SHARD: String(cell.shard) };
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, env);
  process.chdir(app);
  for (const dir of [output, `${output}/shots`, scratch, env.HOME]) mkdirSync(dir, { recursive: true });
  metadata = { ...identity, cell, scope: 'parent-release', fixture: SMALL_FIXTURE, runtimeNetwork: 'none', syntheticOnly: true,
    clientMode: 'vite-production-build', serverMode: 'existing-static-handler-with-local-config', fontMode: 'exact', fontLimitation: SOURCE_FONT_NOTE, completed: false, missingEvidence: [{ failure: 'NOT_STARTED' }], deadlineMs: captureDeadlineMs(cell) };
  progress('font-cache');
  write('font-provenance.json', validateFontCache().manifest);
  const { tsImport } = await import('tsx/esm/api');
  const routes = await tsImport(path.join(app, 'src/lib/routes.ts'), import.meta.url);
  const contracts = await tsImport(path.join(app, 'src/lib/surfaceContract.ts'), import.meta.url);
  const routeIds = releaseInventory(routes.ROUTE_IDS, contracts.SURFACE_CONTRACTS);
  sourceRoutes = cell.group === 'base' ? shardRoutes(routeIds, cell.shard) : [];
  write('route-inventory.json', { ...identity, routeIds, shardRouteIds: sourceRoutes, contracts: contracts.SURFACE_CONTRACTS.map(({ route, hub }) => ({ route, hub })), aliases: routes.HASH_ALIASES, retired: routes.RETIRED_ROUTES,
    note: 'All 43 canonical IDs are loaded across the base shards. Aliases/retirements are recorded honestly; they are not additional distinct screens.' });
  progress('seed');
  await run(['--import', 'tsx', 'scripts/seed-demo-family.mjs', '--target', 'sandbox', '--apply'], env, 'seed', 30_000);
  const family = JSON.parse(readFileSync('.data/demo-family.json', 'utf8'));
  if (family.child?.demo !== true || family.parent?.demo !== true || !family.collections) throw new Error('SYNTHETIC_FIXTURE_REQUIRED');
  progress('offline-client-build');
  await run(['node_modules/vite/bin/vite.js', 'build'], env, 'offline-client-build', 4 * 60_000);
  if (!existsSync('dist/index.html')) throw new Error('BUILT_CLIENT_MISSING');
  progress('sandbox-start');
  const log = openSync(`${scratch}/server.log`, 'w');
  server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], { cwd: app, env, stdio: ['ignore', log, log] });
  let ready = false;
  let spawnError = false;
  server.on('error', () => { spawnError = true; });
  for (let n = 0; n < 90; n++) {
    if (server.exitCode !== null || spawnError) throw new Error('SANDBOX_EXITED');
    try { ready = (await fetch(`${BASE}/sandbox/demo-family.json`, { signal: AbortSignal.timeout(1000) })).ok; } catch { /* warming */ }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (!ready) throw new Error('SANDBOX_READINESS_TIMEOUT');
  progress('screens');
  await run(cell.group === 'base' ? releaseSweepArguments(output, routeIds, cell) : ['scripts/capture/collect-release.mjs'], env, 'screens', captureDeadlineMs(cell));
  progress('captured');
  if (!metadata.completed) throw new Error('EVIDENCE_INCOMPLETE');
}
main().catch((error) => {
  if (metadata) {
    metadata.failure = ['CAPTURE_DEADLINE', 'CHILD_PROCESS_FAILED', 'SYNTHETIC_FIXTURE_REQUIRED', 'SANDBOX_EXITED', 'SANDBOX_READINESS_TIMEOUT', 'RELEASE_ROUTE_INVENTORY_CHANGED', 'EVIDENCE_INCOMPLETE'].includes(error.message) ? error.message : 'CAPTURE_FAILED';
    progress('incomplete');
    metadata.completed = false;
    write('capture.json', metadata);
  }
  console.error('Release capture incomplete; available PNG/JSON evidence is retained.');
  process.exitCode = 1;
}).finally(() => { if (server) server.kill('SIGTERM'); });
