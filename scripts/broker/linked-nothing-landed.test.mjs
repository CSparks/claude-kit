// linked-nothing-landed.test.mjs — a linked landing that pushed no submodule half never claims one
// landed (KIT-T542); with a pushed half the message still names it (control).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { landLinked } from './linked.mjs';
import { fixture, g } from './patchkit.mjs';
import { setup } from './subkit.mjs';
import { cleanup, tempDir } from './testkit.mjs';

function refusePushes(root) {
  const dir = tempDir('refuse-hook-');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'pre-push'), '#!/bin/sh\necho "pre-push: refused" >&2\nexit 1\n', { mode: 0o755 });
  g(['config', 'core.hooksPath', dir], root);
  return dir;
}

test('no submodule half and a refused push: the error does not say anything landed', () => {
  const s = fixture();
  const hooks = refusePushes(s.root);
  try {
    const repo = s.cfg.repos[0];
    writeFileSync(join(s.root, 'src.txt'), 'changed\n');
    const r = landLinked(s.cfg, repo, { id: 'j-1', ticket: 'T-1', title: 'x' }, s.root, ['src.txt'], {});
    assert.equal(r.ok, false);
    assert.doesNotMatch(r.error, /landed and pushed/);
    assert.match(r.error, /refused/);
  } finally { cleanup(hooks); s.done(); }
});

test('control: a pushed submodule half is named when the superproject half then fails', () => {
  const t = setup();
  const hooks = refusePushes(t.root);
  try {
    const repo = t.cfg.repos[0];
    writeFileSync(join(t.sub, 'api.txt'), 'api\n');
    writeFileSync(join(t.root, 'game.txt'), 'game\n');
    const r = landLinked(t.cfg, repo, { id: 'j-2', ticket: 'T-2', title: 'x' }, t.root, ['rapid-game/api.txt', 'game.txt'], {});
    assert.equal(r.ok, false);
    assert.match(r.error, /rapid-game [0-9a-f]{10} landed and pushed; the super half/);
  } finally { cleanup(hooks); t.done(); }
});
