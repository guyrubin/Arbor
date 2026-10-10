/** Bounded child process; runtime guards precede browser/collector imports. */
import { networkInterfaces } from 'node:os';
import { existsSync, readFileSync } from 'node:fs';
import { assertLoopbackOnly } from './config.mjs';
import { releaseCell, releaseIdentity } from './release-config.mjs';
assertLoopbackOnly(networkInterfaces());
if (process.platform !== 'linux' || !existsSync('/.dockerenv')) throw new Error('OFFLINE_CONTAINER_REQUIRED');
if (process.env.ARBOR_CAPTURE_FONT_MODE !== 'exact' || process.env.ARBOR_CAPTURE_CONNECTIVITY !== 'synthetic-online') throw new Error('RELEASE_FIXTURE_REQUIRED');
const identity = releaseIdentity(process.env.ARBOR_CAPTURE_SHA, process.env.ARBOR_CAPTURE_SOURCE_TREE_SHA);
const cell = releaseCell({ viewport: process.env.ARBOR_CAPTURE_VIEWPORT, group: process.env.ARBOR_CAPTURE_GROUP, shard: process.env.ARBOR_CAPTURE_SHARD });
if (cell.group === 'base') throw new Error('INTERACTION_GROUP_REQUIRED');
const bundle = readFileSync('.data/demo-family.json', 'utf8');
const family = JSON.parse(bundle);
if (family.child?.demo !== true || family.parent?.demo !== true || !family.collections) throw new Error('SYNTHETIC_FIXTURE_REQUIRED');
const { collectReleaseInteractions } = await import('./release-interactions.mjs');
const result = await collectReleaseInteractions({ output: '/capture-output', bundle, viewport: cell.viewport, group: cell.group, ...identity });
if (!result.completed) process.exitCode = 1;
