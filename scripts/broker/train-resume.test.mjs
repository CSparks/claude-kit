// train-resume.test.mjs — a train killed in its pre-push gate has its commits on local main; the
// restart finishes the push (gate, push) and never re-applies the patches onto the tree that holds them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brokerPaths, normalizeBroker } from './config.mjs';
import { readInflight } from './preimage.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { fixture, g, originSha } from './patchkit.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const BROKER = join(import.meta.dirname, 'broker.mjs');
const PASS = 'node -e "0"';
const FILES = ['a.txt', 'b.txt', 'c.txt'];
const GATE_S = 25;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slash = (p) => p.split(String.fromCharCode(92)).join('/');
const edit = (file) => `*** edit ${file}\n<<<<<<< SEARCH\n${file} base\n=======\n${file} new\n>>>>>>> REPLACE\n`;
const daemon = (root) => spawn(process.execPath, [BROKER, '--root', root, '--once'], { stdio: 'ignore', windowsHide: true });
const exited = (child) => new Promise((r) => (child.exitCode !== null ? r(child.exitCode) : child.on('exit', r)));
const phaseOf = (cfg) => { try { return JSON.parse(readFileSync(join(brokerPaths(cfg).home, 'phase.json'), 'utf8')).phase; } catch { return null; } };

for (const movedOff of [false, true]) test(`a train killed in its pre-push gate resumes: one push of the three commits, no patch re-applied${movedOff ? ' (HEAD moved off the branch meanwhile)' : ''}`, async () => {
  const s = fixture();
  const flagDir = tempDir('train-resume-flag-');
  const flag = slash(join(flagDir, 'ran'));
  const pushLog = join(flagDir, 'pushes');
  try {
    for (const f of FILES) writeFileSync(join(s.root, f), `${f} base\n`);
    g(['add', ...FILES], s.root);
    g(['commit', '-m', 'files'], s.root);
    g(['push', 'origin', 'main'], s.root);
    writeFileSync(join(s.root, '.git', 'hooks', 'pre-push'), `#!/bin/sh\nif [ ! -f "${flag}" ]; then touch "${flag}"; sleep ${GATE_S}; fi\nexit 0\n`, { mode: 0o755 });
    writeFileSync(join(s.bare, 'hooks', 'post-receive'), `#!/bin/sh\necho received >> "${slash(pushLog)}"\n`, { mode: 0o755 });
    writeFileSync(join(s.root, '.ai', 'config.yml'), 'broker:\n  repos:\n    - { name: app, path: ., main: main, remote: origin, pre_push: true }\n');
    const cfg = normalizeBroker(s.root, { repos: [{ name: 'app', path: '.', main: 'main', remote: 'origin', pre_push: true }] });
    const before = originSha(s.bare, s.root);
    const jobs = FILES.map((f) => {
      const { job } = buildPatchJob(cfg, { ticket: `T-${f[0]}`, title: `edit ${f}`, land: true }, edit(f));
      writeJob(cfg, { ...job, commands: [PASS] });
      return job;
    });

    const first = daemon(s.root);
    const end = Date.now() + 300_000;
    while (phaseOf(cfg) !== 'pre-push gate') {
      if (Date.now() > end) throw new Error(`never reached the gate (at ${phaseOf(cfg)})`);
      await sleep(50);
    }
    first.kill('SIGKILL');
    await exited(first);
    const journal = readInflight(cfg);
    assert.ok(journal && journal.committed, 'the journal was re-based at the commits');
    assert.equal(g(['rev-list', '--count', `${before}..HEAD`], s.root), '3', 'three commits sit on local main');

    if (movedOff) g(['checkout', '-q', '--detach', before], s.root);
    writeFileSync(join(brokerPaths(cfg).home, 'broker.lock'), '');
    const second = daemon(s.root);
    await exited(second);
    const results = jobs.map((j) => readResult(cfg, j.id));
    assert.deepEqual(results.map((r) => r.status), ['landed', 'landed', 'landed'], JSON.stringify(results.map((r) => r.message)));
    assert.equal(originSha(s.bare, s.root), g(['rev-parse', 'HEAD'], s.root), 'pushed');
    assert.equal(g(['rev-list', '--count', `${before}..HEAD`], s.root), '3', 'no commit was added by a re-apply');
    assert.equal(g(['rev-list', '--count', `${before}..origin/main`], s.root), '3', 'the remote holds the three commits');
    assert.equal(readFileSync(pushLog, 'utf8').trim().split('\n').length, 1, 'exactly one push');
    assert.equal(readInflight(cfg), null);
    for (const f of FILES) assert.equal(readFileSync(join(s.root, f), 'utf8'), `${f} new\n`);
  } finally { s.done(); cleanup(flagDir); }
});
