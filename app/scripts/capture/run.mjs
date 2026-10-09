/** CI-only entrypoint. Refuses an ordinary networked host before importing app code. */
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE, FONT_LIMITATION, assertLoopbackOnly, captureRevision, captureScope, missingCriticalEvidence, sandboxEnvironment, sweepArguments, unreachableCells } from './config.mjs';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = '/capture-output';
const scratch = '/tmp/arbor-capture';
let server;
let stage = 'isolation';
let metadata;
let lastChildFailure;
let serverSpawnCode;
const write = (name, value) => writeFileSync(path.join(output, name), JSON.stringify(value, null, 2));
const setStage = (value) => { stage = value; write('capture.json', { ...metadata, stage }); console.log(`Synthetic capture: ${stage}.`); };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function child(args, env, label) {
  const log = openSync(path.join(scratch, `${label}.log`), 'w');
  const proc = spawn(process.execPath, args, { cwd: app, env, stdio: ['ignore', log, log] });
  const code = await new Promise((resolve, reject) => { proc.once('error', reject); proc.once('exit', resolve); });
  if (code !== 0) {
    lastChildFailure = { process: label, exitCode: code, ...safeLogDiagnosis(path.join(scratch, `${label}.log`)) };
    throw new Error(`${label} did not finish successfully`);
  }
}

// Only known static categories are exported, never raw lines, paths, tokens or
// environment values. The complete logs stay inside the disposable container.
function safeLogDiagnosis(file) {
  let tail = '';
  try { tail = readFileSync(file, 'utf8').slice(-16_384); } catch { /* missing log */ }
  const categories = ['ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND', 'ERR_PACKAGE_PATH_NOT_EXPORTED', 'EADDRINUSE', 'EACCES', 'ENOENT', 'SyntaxError', 'SWEEP ERROR', 'SEED STALE']
    .filter((code) => tail.includes(code));
  return { categories };
}

async function main() {
  assertLoopbackOnly(networkInterfaces());
  if (process.platform !== 'linux' || !existsSync('/.dockerenv')) throw new Error('Dedicated offline Linux container required.');
  const revision = captureRevision(process.env.ARBOR_CAPTURE_SHA);
  const scope = captureScope(process.env.ARBOR_CAPTURE_SCOPE);
  if (readdirSync(app).some((name) => name.startsWith('.env') || name === '.data')) throw new Error('Refusing inherited environment files or family records.');
  const env = sandboxEnvironment();
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, env);
  process.chdir(app);
  mkdirSync(env.HOME, { recursive: true });
  mkdirSync(output, { recursive: true });
  mkdirSync(path.join(output, 'shots'), { recursive: true });
  mkdirSync(scratch, { recursive: true });
  metadata = { sourceSha: revision, scope, syntheticOnly: true, runtimeNetwork: 'none', modelProvider: 'mock', memoryAdapter: 'local', firebaseEnabled: false, fontLimitation: FONT_LIMITATION, completed: false, stage };
  write('capture.json', metadata);

  setStage('local-synthetic-seed');
  await child(['--import', 'tsx', 'scripts/seed-demo-family.mjs', '--target', 'sandbox', '--apply'], env, 'seed');
  const bundle = readFileSync(path.join(app, '.data/demo-family.json'), 'utf8');
  const family = JSON.parse(bundle);
  if (family.child?.demo !== true || family.parent?.demo !== true || !family.collections) throw new Error('Synthetic demo marker missing.');
  metadata.seed = { version: family.version, seededAt: family.seededAt };

  setStage('sandbox-start');
  const log = openSync(path.join(scratch, 'server.log'), 'w');
  server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], { cwd: app, env, stdio: ['ignore', log, log] });
  server.on('error', (error) => { serverSpawnCode = ['ENOENT', 'EACCES'].includes(error.code) ? error.code : 'SPAWN_ERROR'; });
  let ready = false;
  for (let count = 0; count < 90; count++) {
    if (server.exitCode !== null || serverSpawnCode) {
      lastChildFailure = { process: 'server', exitCode: server.exitCode, spawnCode: serverSpawnCode, ...safeLogDiagnosis(path.join(scratch, 'server.log')) };
      throw new Error('Sandbox stopped during startup.');
    }
    try { if ((await fetch(`${BASE}/sandbox/demo-family.json`, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch { /* server warming */ }
    await wait(1000);
  }
  if (!ready) {
    lastChildFailure = { process: 'server', exitCode: server.exitCode, category: 'READINESS_TIMEOUT', ...safeLogDiagnosis(path.join(scratch, 'server.log')) };
    throw new Error('Sandbox readiness deadline reached.');
  }

  setStage('canonical-routes-and-states');
  await child(sweepArguments(scope, output), env, 'sweep');
  const doc = JSON.parse(readFileSync(path.join(output, 'sweep.json'), 'utf8'));
  // No .git/credentials enter the container. Record the checkout SHA supplied
  // by the dedicated workflow, preserving what the unmodified sweep observed.
  doc.sweepObservedSha = doc.sha;
  doc.sha = revision;
  doc.fontLimitation = FONT_LIMITATION;
  write('sweep.json', doc);
  write('unreachables.json', unreachableCells(doc));

  setStage('current-shell-and-together-diagnostics');
  const { collectDiagnostics } = await import('./diagnostics.mjs');
  const diagnostics = await collectDiagnostics(output, bundle);
  metadata.missingCriticalEvidence = missingCriticalEvidence(diagnostics);
  // Evaluate the same canonical modules as the sweep, not a second route list.
  const { tsImport } = await import('tsx/esm/api');
  const routes = await tsImport(path.join(app, 'src/lib/routes.ts'), import.meta.url);
  const contracts = await tsImport(path.join(app, 'src/lib/surfaceContract.ts'), import.meta.url);
  write('route-inventory.json', {
    sourceSha: revision,
    routeIds: routes.ROUTE_IDS,
    contracts: contracts.SURFACE_CONTRACTS.map(({ route, hub }) => ({ route, hub })),
    aliases: routes.HASH_ALIASES,
    retired: routes.RETIRED_ROUTES,
    actualBaseLoads: doc.cells.filter((c) => (c.state ?? 'base') === 'base').map(({ route, viewport, lang, finalHash, mounted, shot }) => ({ route, viewport, lang, finalHash, mounted, shot })),
    note: 'Aliases/retirements describe source routing; actualBaseLoads records rendered canonical/retired IDs. An alias mapping is not a separately rendered screen.',
  });
  metadata.totals = doc.totals;
  metadata.completed = true;
  metadata.stage = 'captured';
  metadata.evidenceComplete = metadata.missingCriticalEvidence.length === 0;
  write('capture.json', metadata);
  console.log(`Synthetic capture finished: ${doc.totals.cells} base cells; ${doc.totals.statesUnreached} historical states unreachable; ${metadata.missingCriticalEvidence.length} current answer cells missing. ${FONT_LIMITATION}`);
  if (!metadata.evidenceComplete) process.exitCode = 1;
}

main().catch((error) => {
  // Raw server/seed/environment logs never leave this disposable container.
  if (metadata) write('capture.json', { ...metadata, completed: false, stage, failure: `Capture stopped at ${stage}; no raw logs exported.`, diagnostic: lastChildFailure ?? { category: ['ERR_MODULE_NOT_FOUND', 'ENOENT', 'EACCES'].includes(error?.code) ? error.code : 'CAPTURE_ERROR' } });
  console.error(`Synthetic capture stopped at ${stage}.`);
  process.exitCode = 1;
}).finally(() => { if (server) server.kill('SIGTERM'); });
