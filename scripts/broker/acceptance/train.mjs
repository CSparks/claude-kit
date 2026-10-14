#!/usr/bin/env node
// acceptance/train.mjs — the broker's batch-train vetting run (KIT-T482) on a REAL cargo
// fixture: one workspace crate `game` with five modules (the dirt-empire shape: every patch
// lands in one crate), a bare origin, `land_gate: affected` and `runner: nextest`.
// Load: five landing patches queued back to back on five modules; one of them (delta) breaks
// its module's unit test, one (echo) comes from a second session. The same load runs twice on
// fresh fixtures from a warm target dir: serial (`batch: 1`) and as trains (default batch).
//
// Invariants (the train run): every green lands, in submit order, in ONE push; the red patch
// fails alone and its result names it; at most 2 builds; the tree is clean afterwards.
// Measurements for both runs: wall time, builds, pushes, each green's queue-to-land time, and
// that time over the serial run's median single-job time.
//
// USE: node scripts/broker/acceptance/train.mjs [--keep] [--verbose]   exit 1 when an invariant fails
//   --verbose prints every result's phase timings and command durations

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeBroker } from '../config.mjs';
import { processOnce } from '../queue.mjs';
import { readResult, writeJob } from '../result.mjs';
import { buildPatchJob } from '../submit-lib.mjs';
import { cleanup, g, makeRepo, addOrigin, tempDir } from '../testkit.mjs';

const MODULES = ['alpha', 'bravo', 'charlie', 'delta', 'echo'];
const RED = 'delta';
const SECOND_SESSION = 'echo';
const MAX_TRAIN_BUILDS = 2;
const MS = 1000;
const keep = process.argv.includes('--keep');
const verbose = process.argv.includes('--verbose');

const moduleSrc = (m, value) => `pub fn value() -> i32 {\n    ${value}\n}\n\n#[cfg(test)]\nmod tests {\n    #[test]\n    fn one() {\n        assert_eq!(super::value(), 1);\n    }\n}\n`;
const testSrc = (m) => `#[test]\nfn ${m}_is_one() {\n    assert_eq!(game::${m}::value(), 1);\n}\n`;

function workspace(targetDir) {
  const root = makeRepo(tempDir('train-accept-'));
  const crate = join(root, 'crates', 'game');
  mkdirSync(join(crate, 'src'), { recursive: true });
  mkdirSync(join(crate, 'tests'), { recursive: true });
  writeFileSync(join(root, 'Cargo.toml'), '[workspace]\nmembers = ["crates/game"]\nresolver = "2"\n');
  writeFileSync(join(crate, 'Cargo.toml'), '[package]\nname = "game"\nversion = "0.1.0"\nedition = "2021"\n');
  writeFileSync(join(crate, 'src', 'lib.rs'), MODULES.map((m) => `pub mod ${m};\n`).join(''));
  for (const m of MODULES) {
    writeFileSync(join(crate, 'src', `${m}.rs`), moduleSrc(m, 1));
    writeFileSync(join(crate, 'tests', `${m}.rs`), testSrc(m));
  }
  execFileSync('cargo', ['generate-lockfile', '--offline'], { cwd: root, stdio: 'ignore' });
  g(['add', '-A'], root);
  g(['commit', '-m', 'game workspace'], root);
  const bareDir = tempDir('train-accept-bare-');
  const bare = addOrigin(root, join(bareDir, 'origin.git'));
  g(['--git-dir', bare, 'config', 'core.logAllRefUpdates', 'true'], root);
  const cfg = (batch) => normalizeBroker(root, {
    target_dir: targetDir, repos: [{ name: 'game', path: '.', main: 'main', remote: 'origin' }],
    land_gate: 'affected', runner: 'nextest', batch, suite: ['node -e 0'],
    affected: { check: 'cargo check --offline --workspace --all-targets', test: 'cargo test --offline' },
  });
  return { root, bare, cfg, done: () => { cleanup(root); cleanup(bareDir); } };
}

function queueLoad(ws, cfg) {
  return MODULES.map((m) => {
    const value = m === RED ? '2' : '1 + 0';
    const env = `*** edit crates/game/src/${m}.rs\n<<<<<<< SEARCH\n    1\n}\n=======\n    ${value}\n}\n>>>>>>> REPLACE\n`;
    const ticket = m === SECOND_SESSION ? 'S2-T1' : `S1-${m}`;
    const { job, error, result } = buildPatchJob(cfg, { ticket, title: `${m} value`, land: true }, env);
    if (!job) throw new Error(`submit ${m}: ${JSON.stringify(error || result)}`);
    return writeJob(cfg, job);
  });
}

function scenario(targetDir, batch) {
  const ws = workspace(targetDir);
  const cfg = ws.cfg(batch);
  try {
    const pushesBefore = Number(g(['--git-dir', ws.bare, 'reflog', 'show', '--format=%H', 'main'], ws.root).split('\n').filter(Boolean).length);
    const jobs = queueLoad(ws, cfg);
    const t0 = Date.now();
    processOnce(cfg);
    const wallMs = Date.now() - t0;
    const results = jobs.map((j) => readResult(cfg, j.id));
    const trains = new Map();
    for (const r of results) if (r.train) trains.set(r.train.id, Math.max(trains.get(r.train.id) || 0, r.train.builds));
    const builds = [...trains.values()].reduce((a, b) => a + b, 0) + results.filter((r) => !r.train).length;
    const pushes = g(['--git-dir', ws.bare, 'reflog', 'show', '--format=%H', 'main'], ws.root).split('\n').filter(Boolean).length - pushesBefore;
    const subjects = g(['log', '--reverse', '--pretty=%s', `${jobs[0].base}..HEAD`], ws.root).split('\n').filter(Boolean);
    const status = g(['status', '--porcelain'], ws.root);
    return { batch, wallMs, builds, pushes, results, jobs, subjects, status };
  } finally { if (!keep) ws.done(); else console.error(`kept ${ws.root}`); }
}

const secs = (ms) => `${(ms / MS).toFixed(1)}s`;
const runMs = (r) => Date.parse(r.finishedAt) - Date.parse(r.startedAt);
const waitMs = (r, job) => Date.parse(r.finishedAt) - Date.parse(job.submittedAt);
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

const targetDir = tempDir('train-accept-target-');
try {
  console.error('warming the shared target dir…');
  const warm = workspace(targetDir);
  execFileSync('cargo', ['nextest', 'run', '--offline', '--workspace', '--no-run'], { cwd: warm.root, env: { ...process.env, CARGO_TARGET_DIR: targetDir }, stdio: 'ignore' });
  execFileSync('cargo', ['check', '--offline', '--workspace', '--all-targets'], { cwd: warm.root, env: { ...process.env, CARGO_TARGET_DIR: targetDir }, stdio: 'ignore' });
  warm.done();

  const serial = scenario(targetDir, 1);
  const train = scenario(targetDir, undefined);
  const single = median(serial.results.map(runMs));
  const greens = train.results.map((r, i) => ({ r, job: train.jobs[i] })).filter(({ job }) => !job.title.startsWith(RED));
  const red = train.results[MODULES.indexOf(RED)];
  const checks = [
    ['every green landed', greens.every(({ r }) => r.status === 'landed')],
    ['greens land in submit order', JSON.stringify(train.subjects) === JSON.stringify(MODULES.filter((m) => m !== RED).map((m) => `${m} value (implements ${m === SECOND_SESSION ? 'S2-T1' : `S1-${m}`})`))],
    ['one push for the train', train.pushes === 1],
    ['red patch fails alone and is named', red.status === 'failed' && /delta/.test(JSON.stringify(red.blame || ''))],
    [`at most ${MAX_TRAIN_BUILDS} builds`, train.builds <= MAX_TRAIN_BUILDS],
    ['tree clean afterwards', train.status === '' && serial.status === ''],
  ];
  const line = (s) => `${s.batch === 1 ? 'serial' : 'trains'}: wall ${secs(s.wallMs)}, builds ${s.builds}, pushes ${s.pushes}, `
    + `green queue-to-land ${s.results.map((r, i) => (r.status === 'landed' ? secs(waitMs(r, s.jobs[i])) : r.status)).join(' / ')}`;
  console.log(line(serial));
  console.log(line(train));
  if (verbose) for (const s of [serial, train]) for (const r of s.results) console.log(r.id, r.status, JSON.stringify(r.timings), r.commands.map((c) => `${c.cmd.slice(0, 60)} ${c.exit} ${c.durationMs}`).join(' | '));
  console.log(`median single-job time (serial): ${secs(single)}; slowest train green / single: ${(Math.max(...greens.map(({ r, job }) => waitMs(r, job))) / single).toFixed(2)}x; red blame: ${(red.blame || []).join('; ')}`);
  for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  process.exitCode = checks.every(([, ok]) => ok) ? 0 : 1;
} finally { cleanup(targetDir); }
