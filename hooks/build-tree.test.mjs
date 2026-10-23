// Tests for hooks/lib/build-tree.mjs — the SessionStart build-dir nag over an unbounded repo walk
// (KIT-T635) and the nightly sweep's status lines (KIT-T636). Run: node hooks/build-tree.test.mjs

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildTreeLine, sweepStatusLines } from './lib/build-tree.mjs';

const home = mkdtempSync(join(tmpdir(), 'bt-home-'));
process.env.CLAUDE_KIT_SWEEP_HOME = home;
process.env.CLAUDE_KIT_CACHE_DIR = join(home, 'cache');
let passed = 0;
const ok = (name, cond) => { assert.ok(cond, name); passed += 1; };

const fill = (profile, n) => {
  mkdirSync(join(profile, 'deps'), { recursive: true });
  for (let i = 0; i < n; i++) writeFileSync(join(profile, 'deps', `a${i}.rlib`), 'x');
};

const sessions = (profile) => {
  for (let i = 0; i < 500; i++) mkdirSync(join(profile, 'incremental', `game-${i}`), { recursive: true });
};

const repo = mkdtempSync(join(tmpdir(), 'bt-repo-'));
mkdirSync(join(repo, 'target', 'debug', 'deps'), { recursive: true });
ok('a healthy repo is silent', buildTreeLine(repo) === null);

const submodule = join(repo, 'rapid-game', 'rust', 'target', 'debug');
fill(submodule, 8000);
let line = buildTreeLine(repo);
ok('a runaway submodule target is found at depth', /rapid-game\/rust\/target\/debug: deps holds 8,000 artifacts/.test(line));
ok('the drain command names the sweep and the repo', line.includes('build-sweep.mjs') && line.includes(repo));

const lane = join(repo, 'target-lanes', 'lane-1', 'debug');
sessions(lane);
line = buildTreeLine(repo);
ok('a lane dir is found beside it', /target-lanes\/lane-1\/debug: 500 orphaned incremental sessions/.test(line));
ok('the healthy primary target stays out of the line', !line.includes(': target/debug:') && !line.includes('; target/debug:'));

for (let i = 0; i < 4; i++) sessions(join(repo, `target-extra${i}`, 'debug'));
ok('the list is capped and counts the rest', /\(\+3 more\)/.test(buildTreeLine(repo)));

// sweep status
process.env.CLAUDE_KIT_SWEEP_SCHEDULED = '0';
ok('no scheduled task warns with the install command', /BUILD SWEEP NOT SCHEDULED.*--install/.test(sweepStatusLines()[0]));
process.env.CLAUDE_KIT_SWEEP_SCHEDULED = '1';
ok('scheduled but never run says so', /scheduled, no run recorded/.test(sweepStatusLines()[0]));

const receipt = (daysAgo) => JSON.stringify({
  at: new Date(Date.now() - daysAgo * 86400000).toISOString(), root: repo, dryRun: false,
  buildDirs: 4, profiles: 9, removed: 120, wholeDirs: 1, bytes: 5 * 1024 ** 3, failed: 0, repos: {}, skipped: [],
});
writeFileSync(join(home, 'build-sweep.log'), `${receipt(1)}\n`);
ok('a fresh receipt is surfaced as a plain line', /^Build sweep last run .*freed 5\.00 GB/.test(sweepStatusLines()[0]));
writeFileSync(join(home, 'build-sweep.log'), `${receipt(9)}\n${receipt(1)}\n`);
ok('the newest receipt wins', /removed 120 item/.test(sweepStatusLines()[0]) && !/NOT FIRING/.test(sweepStatusLines()[0]));
writeFileSync(join(home, 'build-sweep.log'), `${receipt(5)}\n`);
ok('an old receipt warns the task is not firing', /BUILD SWEEP NOT FIRING.*5d ago/.test(sweepStatusLines()[0]));

rmSync(home, { recursive: true, force: true });
rmSync(repo, { recursive: true, force: true });
console.log(`build-tree: ${passed} passed, 0 failed`);
