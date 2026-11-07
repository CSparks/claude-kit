// build-budget.test.mjs — the invariant of the machine build budget (KIT-D135): across every process on the
// machine, never more cores held than physical - reserve, so at least 2 cores stay free of building.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MIN_RESERVE_CORES, buildCores, readBudgetConfig, reserveCores } from './build-budget.mjs';
import { snapshot } from './build-slot-store.mjs';

const PHYSICAL = 16;
const WORKERS = 10;
const WORKER_CORES = 2;
const HOLD_MS = 600;
const POLL_MS = 15;
const SAMPLE_MS = 15;
const GIB = 2 ** 30;

const readCfg = (obj) => {
  const dir = mkdtempSync(join(tmpdir(), 'budget-cfg-'));
  const file = join(dir, 'b.json');
  writeFileSync(file, JSON.stringify(obj));
  try { return readBudgetConfig(file); } finally { rmSync(dir, { recursive: true, force: true }); }
};

test('budget: the OS physical cores minus a reserve of at least 2, never sized from logical cores', () => {
  assert.equal(MIN_RESERVE_CORES, 2);
  assert.equal(buildCores(16, readCfg({})), 14);
  assert.equal(buildCores(8, readCfg({})), 6);
  assert.equal(buildCores(2, readCfg({})), 1, 'a tiny box still builds on one core');
});

test('the configured reserve can raise the floor of 2, never lower it', () => {
  assert.equal(reserveCores(readCfg({ reserveCores: 0 })), 2);
  assert.equal(reserveCores(readCfg({ reserveCores: 1 })), 2);
  assert.equal(buildCores(16, readCfg({ reserveCores: 4 })), 12);
});

test('a running game takes its cores off the budget; the readout reports both', () => {
  const idle = snapshot({ physicalCores: () => PHYSICAL, gameRunning: () => false });
  const playing = snapshot({ physicalCores: () => PHYSICAL, gameRunning: () => true });
  console.log(`  measured: physical ${idle.physical}, budget ${idle.budget}, always free ${idle.reserve}; with a game running budget ${playing.budget}`);
  assert.deepEqual([idle.physical, idle.budget, idle.reserve], [16, 14, 2]);
  assert.ok(playing.budget < idle.budget);
});

const WORKER = (slotModule) => `
  import { acquireBuildSlot } from ${JSON.stringify(slotModule)};
  const s = acquireBuildSlot('cargo test', { jobs: ${WORKER_CORES}, label: 'worker ' + process.pid, pollMs: ${POLL_MS}, shouldCancel: ((n) => () => n-- <= 0)(4000) });
  if (!s.cancelled) { setTimeout(() => { s.release(); }, ${HOLD_MS}); }`;

function sampleHeld(dir, sink) {
  return setInterval(() => {
    let held = 0;
    for (const name of readdirSync(dir).filter((n) => n.startsWith('slot-'))) {
      try { held += JSON.parse(readFileSync(join(dir, name), 'utf8')).jobs; } catch { /* released between list and read */ }
    }
    sink.max = Math.max(sink.max, held);
  }, SAMPLE_MS);
}

test('across processes: ten builds of 2 cores never hold more than physical - 2, and the budget is reached', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'budget-x-'));
  const slotModule = new URL('./build-slot.mjs', import.meta.url).href;
  const env = {
    ...process.env, CLAUDE_KIT_BUILD_SLOT_DIR: dir, CLAUDE_KIT_PHYSICAL_CORES: String(PHYSICAL), CLAUDE_KIT_GAME_RUNNING: '0',
    CLAUDE_KIT_BUILD_BUDGET_FILE: join(dir, 'none.json'), CLAUDE_KIT_COMMIT_FREE_BYTES: String(64 * GIB),
  };
  const sink = { max: 0 };
  const sampler = sampleHeld(dir, sink);
  try {
    await Promise.all(Array.from({ length: WORKERS }, () => new Promise((resolve) => {
      spawn(process.execPath, ['--input-type=module', '-e', WORKER(slotModule)], { env, stdio: 'ignore' }).on('exit', resolve);
    })));
  } finally {
    clearInterval(sampler);
    rmSync(dir, { recursive: true, force: true });
  }
  console.log(`  measured: peak ${sink.max} cores held machine-wide, ${PHYSICAL - sink.max} free, budget ${PHYSICAL - MIN_RESERVE_CORES}`);
  assert.ok(sink.max <= PHYSICAL - MIN_RESERVE_CORES, `held ${sink.max} of ${PHYSICAL}: fewer than ${MIN_RESERVE_CORES} cores left free`);
  assert.ok(PHYSICAL - sink.max >= MIN_RESERVE_CORES);
  assert.ok(sink.max >= PHYSICAL - MIN_RESERVE_CORES - WORKER_CORES + 1, `the budget was never approached (peak ${sink.max}), so the test proves nothing`);
});
