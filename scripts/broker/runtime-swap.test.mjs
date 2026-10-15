// runtime-swap.test.mjs — an idle daemon moves onto a newly published runtime; one already on it,
// or running from a checkout, stays (KIT-T500).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { publishedSwap } from './runtime-swap.mjs';
import { cleanup, tempDir } from './testkit.mjs';

function runtime(shas, pointAt) {
  const root = tempDir('rtswap-');
  for (const sha of shas) { mkdirSync(join(root, sha, 'scripts'), { recursive: true }); writeFileSync(join(root, sha, 'scripts', 'q.mjs'), ''); }
  symlinkSync(join(root, pointAt), join(root, 'current'), process.platform === 'win32' ? 'junction' : 'dir');
  return root;
}

test('current moved to a new sha: the daemon on the old sha swaps; on the new sha or from a checkout it stays', () => {
  const root = runtime(['aaaaaaa', 'bbbbbbb'], 'bbbbbbb');
  try {
    assert.equal(publishedSwap({ own: 'aaaaaaa', current: join(root, 'current') }), 'bbbbbbb');
    assert.equal(publishedSwap({ own: 'bbbbbbb', current: join(root, 'current') }), null, 'control: already current');
    assert.equal(publishedSwap({ own: 'repo', current: join(root, 'current') }), null, 'control: checkout daemon');
    assert.equal(publishedSwap({ own: 'aaaaaaa', current: '' }), null, 'control: nothing published');
  } finally { cleanup(root); }
});
