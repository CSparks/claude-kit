// check-tree-sub.test.mjs — the check tree of a superproject carries its submodule as a worktree at the sha HEAD records,
// and a submodule lane gets a check tree of its own; neither touches the live submodule (KIT-T698).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { prepareCheckTree } from './check-tree.mjs';
import { g } from './patchkit.mjs';
import { setup } from './subkit.mjs';
import { tempDir, cleanup } from './testkit.mjs';

const fwd = (p) => p.split(String.fromCharCode(92)).join('/');

test('the superproject check tree holds the submodule at the recorded sha; the live submodule is left alone', () => {
  const t = setup();
  const side = tempDir('check-sub-');
  try {
    t.cfg.checkTree = true;
    const recorded = g(['rev-parse', 'HEAD:rapid-game'], t.root);
    const liveHeadBefore = g(['rev-parse', 'HEAD'], t.sub);
    const out = fwd(join(side, 'readme.txt'));
    const read = `node -e "require('fs').writeFileSync('${out}', require('fs').readFileSync('rapid-game/README','utf8'))"`;
    const { r } = t.run({ ticket: 'T-1' }, '*** write p.txt\np\n', [read]);
    assert.equal(r.status, 'passed', JSON.stringify(r));
    assert.equal(readFileSync(join(side, 'readme.txt'), 'utf8').trim(), 'base', 'the command read the submodule through the check tree');
    const tree = prepareCheckTree(t.cfg, t.cfg.repos[0]);
    assert.equal(g(['rev-parse', 'HEAD'], join(tree.cfg.root, 'rapid-game')), recorded);
    assert.equal(g(['rev-parse', 'HEAD'], t.sub), liveHeadBefore, 'the live submodule did not move');
    assert.equal(existsSync(join(t.root, 'p.txt')), false, 'the live superproject never held the patch');
  } finally { cleanup(side); t.done(); }
});

test('a submodule lane job runs in its own check tree', () => {
  const t = setup();
  const side = tempDir('check-sublane-');
  try {
    t.cfg.checkTree = true;
    const seen = fwd(join(side, 'cwd.txt'));
    const where = `node -e "require('fs').writeFileSync('${seen}', process.cwd())"`;
    const { r } = t.run({ ticket: 'T-2', repo: 'rapid-game' }, '*** write q.txt\nq\n', [where]);
    assert.equal(r.status, 'passed', JSON.stringify(r));
    assert.match(fwd(readFileSync(join(side, 'cwd.txt'), 'utf8')), /target\/broker\/check\/rapid-game\/rapid-game$/);
    assert.equal(existsSync(join(t.sub, 'q.txt')), false);
  } finally { cleanup(side); t.done(); }
});
