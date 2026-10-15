// root-map.test.mjs — a `--root` naming a submodule maps to the parent's lane (KIT-T528): wait finds a
// result the lane daemon wrote, and an unknown id exits 3 at once instead of polling. Controls: the
// parent root keeps the root lane; an unrelated directory maps to itself.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadCfg } from './cli.mjs';
import { normalizeBroker } from './config.mjs';
import { mapSubmoduleRoot } from './root-map.mjs';
import { STATUS, writeResult } from './result.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const WAIT = join(import.meta.dirname, 'wait.mjs');
const REPOS = [{ name: 'app', path: '.', main: 'main', remote: 'origin' }, { name: 'sub', path: 'sub', main: 'main', remote: 'origin', submodule: true, pin_in: '.' }];

function project() {
  const root = tempDir('rootmap-');
  mkdirSync(join(root, '.ai'));
  mkdirSync(join(root, 'sub'));
  writeFileSync(join(root, '.ai', 'config.yml'), 'broker:\n  repos:\n    - { name: app, path: ., main: main, remote: origin }\n    - { name: sub, path: sub, main: main, remote: origin, submodule: true, pin_in: . }\n');
  return root;
}
const wait = (root, ...args) => spawnSync(process.execPath, [WAIT, ...args, '--root', root, '--timeout', '20', '--poll', '100'], { encoding: 'utf8', timeout: 30000, env: { ...process.env, BROKER_NO_AUTOSTART: '1' } });

test('a submodule root maps to the parent and its lane; the parent root and a stranger do not', () => {
  const root = project();
  try {
    assert.deepEqual(mapSubmoduleRoot(join(root, 'sub')), { root, lane: 'sub' });
    assert.equal(mapSubmoduleRoot(root).lane, null);
    const flags = { root: join(root, 'sub') };
    const { cfg } = loadCfg(flags);
    assert.equal(cfg.lane, 'sub');
    assert.equal(cfg.root, root);
    assert.equal(flags.repo, 'sub', 'a submit defaults to the submodule repo');
    assert.equal(mapSubmoduleRoot(tempDir('stranger-')).lane, null);
  } finally { cleanup(root); }
});

test('wait --root <submodule> returns the lane result; an unknown id exits 3 at once', () => {
  const root = project();
  try {
    const lane = { ...normalizeBroker(root, { repos: REPOS }), lane: 'sub' };
    writeResult(lane, { id: 'j-1-a', repo: 'sub', status: STATUS.FAILED, phase: 'run', commands: [], message: 'x' });
    const found = wait(join(root, 'sub'), 'j-1-a');
    assert.equal(found.status, 1, found.stderr);
    const t0 = Date.now();
    const gone = wait(join(root, 'sub'), 'j-9-zzz');
    assert.equal(gone.status, 3);
    assert.match(gone.stderr, /unknown job j-9-zzz/);
    assert.ok(Date.now() - t0 < 10000, 'no polling');
    assert.equal(wait(root, 'j-1-a').status, 1, 'control: the parent root also finds it');
  } finally { cleanup(root); }
});
