#!/usr/bin/env node
// dispatch-worker.test.mjs — patch-worker-discipline (KIT-T687): the worker cap, required and overlapping
// [paths:], the train-rules advice and the pin warning, unit-level and through dispatch-guard.mjs.
// Run: node hooks/dispatch-worker.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixtureKit, isoDaysAgo } from './test-harness.mjs';
import { normalizeBroker } from '../scripts/broker/config.mjs';
import { WORKER_CHECK, overlaps, workerAdvice, workerBlock } from './dispatch-worker.mjs';

let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
};

const HOOK = fileURLToPath(new URL('./dispatch-guard.mjs', import.meta.url));
const FRESH_KIT = fixtureKit(isoDaysAgo(0));
const worker = { subagent_type: 'claude-kit:patch-worker' };
const cfg = (extra = {}) => normalizeBroker('/r', { repos: [{ name: 'game', path: '.', main: 'main', remote: 'origin' }, { name: 'fw', path: 'fw', submodule: true, auto_pin: true }], ...extra });
const block = (prompt, live = [], over = {}) => workerBlock({ tree: '/r', input: worker, prompt, live, cfg: cfg(), escaped: false, footer: 'footer', ...over });
const rows = (n, paths = ['other/a.rs']) => Array.from({ length: n }, (_, i) => ({ id: `w${i}`, scope: 'claude-kit:patch-worker', paths }));

// unit
check('overlaps: equal files, a directory and its file, a wildcard', overlaps(['a/b.rs'], ['a/b.rs']) && overlaps(['a'], ['a/b.rs']) && overlaps(['*'], ['x.rs']));
check('overlaps: disjoint siblings do not', !overlaps(['a/b.rs'], ['a/c.rs']) && !overlaps(['ab'], ['a/b.rs']));
check('a brief with disjoint [paths:] and a free slot passes', block('fix it [paths: src/a.rs]') === null);
check('a brief with no [paths:] is blocked and names the token', /\[paths: a, b\]/.test(block('fix it')));
check('[paths: *] counts as declared', block('fix it [paths: *]') === null);
check('[paths: *] overlaps a live worker', block('fix it [paths: *]', rows(1)) !== null);
check('overlap with a live worker is blocked and names it', /w0/.test(block('fix [paths: other/a.rs]', rows(1))));
check('the cap blocks the fourth worker (default 3)', /cap 3/.test(block('fix [paths: src/a.rs]', rows(3))));
check('negative control: two live workers leave room under the cap', block('fix [paths: src/a.rs]', rows(2)) === null);
check('writer_cap is configurable', block('fix [paths: src/a.rs]', rows(2), { cfg: cfg({ writer_cap: 2 }) }) !== null);
check('the maintainer escape lifts every rule', block('fix', rows(5), { escaped: true }) === null);
check('another agent type is never checked', block('fix', rows(5), { input: { subagent_type: 'claude-kit:researcher' } }) === null);
check('a repo without a broker config is never checked', block('fix', rows(5), { cfg: null }) === null);
check('advice carries the train rules', /no hand --pin/.test(workerAdvice({ input: worker, prompt: 'x', cfg: cfg() })));
check('a brief that tells the worker to pin is warned when auto_pin is on', /WARNING/.test(workerAdvice({ input: worker, prompt: 'then submit with --pin rapid-game=abc', cfg: cfg() })));
check('negative control: the same brief draws no warning without auto_pin', !/WARNING/.test(workerAdvice({ input: worker, prompt: 'submit with --pin rapid-game=abc', cfg: normalizeBroker('/r', { repos: [{ name: 'game', path: '.' }] }) })));

// through dispatch-guard.mjs
function brokeredRepo(extraRows = []) {
  const dir = mkdtempSync(join(tmpdir(), 'dw-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  mkdirSync(join(dir, '.ai'), { recursive: true });
  writeFileSync(join(dir, 'Cargo.toml'), '[workspace]\nmembers = []\n');
  writeFileSync(join(dir, '.ai', 'config.yml'), 'broker:\n  repos:\n    - { name: game, path: ., main: main, remote: origin }\n');
  execFileSync('git', ['add', 'Cargo.toml'], { cwd: dir });
  writeFileSync(join(dir, '.ai', 'agents.jsonl'), extraRows.map((r) => JSON.stringify(r)).join('\n') + (extraRows.length ? '\n' : ''));
  return dir;
}
const dispatch = (dir, prompt) => {
  const input = { ...worker, model: 'sonnet', prompt: `${prompt} [job: fix] [model-override: fixture] [escalate: fixture]` };
  const r = spawnSync(process.execPath, [HOOK], { cwd: dir, input: JSON.stringify({ tool_name: 'Agent', tool_input: input }), encoding: 'utf8', env: { ...process.env, CLAUDE_KIT_ALLOW_FABLE: '', CLAUDE_PLUGIN_ROOT: '', CLAUDE_KIT_LADDER_ROOT: FRESH_KIT } });
  return { code: r.status, err: r.stderr || '' };
};
const liveRow = (id, paths) => ({ ts: new Date().toISOString(), id, status: 'in-flight', task: 't', scope: 'claude-kit:patch-worker', readOnly: 'submits patches', paths });

const repos = [];
try {
  const free = brokeredRepo(); repos.push(free);
  const noPaths = dispatch(free, 'patch the physics step');
  check('guard: a patch-worker brief without [paths:] exits 2 naming the check', noPaths.code === 2 && noPaths.err.includes(WORKER_CHECK), noPaths.err.slice(0, 200));
  const ok = dispatch(free, 'patch the physics step [paths: crates/a/src/lib.rs]');
  check('guard: a declared brief passes and prints the train rules', ok.code === 0 && /Train rules/.test(ok.err), ok.err.slice(0, 200));

  const busy = brokeredRepo([liveRow('w1', ['crates/a/src/lib.rs'])]); repos.push(busy);
  check('guard: overlapping paths with a live worker exit 2', dispatch(busy, 'edit [paths: crates/a/src/lib.rs]').code === 2);
  check('guard: disjoint paths beside a live worker pass', dispatch(busy, 'edit [paths: crates/b/src/lib.rs]').code === 0);

  const full = brokeredRepo([liveRow('w1', ['a.rs']), liveRow('w2', ['b.rs']), liveRow('w3', ['c.rs'])]); repos.push(full);
  check('guard: the fourth worker exits 2 on the cap', dispatch(full, 'edit [paths: d.rs]').code === 2);
  check('guard: the maintainer escape lets it through', dispatch(full, 'edit [paths: d.rs] [maintainer-asked-parallel: run four]').code === 0);
} finally {
  for (const d of repos) rmSync(d, { recursive: true, force: true });
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
