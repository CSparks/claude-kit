// lane-workspace.test.mjs — a submodule-lane cargo command that would run in the parent workspace is
// refused at submit (KIT-T543); a command that enters the submodule's own workspace is accepted.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPatchJob } from './submit-lib.mjs';
import { setup } from './subkit.mjs';

const ENV = '*** write api.txt\napi\n';

test('a rapid-game lane cargo command with no cd into the workspace is refused with a clear message', () => {
  const t = setup();
  try {
    const out = buildPatchJob(t.cfg, { repo: 'rapid-game', test: 'cargo t -p rg-physics' }, ENV);
    assert.match(out.error, /parent workspace/);
    assert.match(out.error, /cd rust/);
    assert.equal(out.job, undefined);
  } finally { t.done(); }
});

test('controls: a cd into the workspace, a --manifest-path and a non-cargo command are accepted', () => {
  const t = setup();
  try {
    for (const test of ['cd rust && cargo t -p rg-physics', 'cargo t --manifest-path rust/Cargo.toml -p x', 'node -e "0"']) {
      const out = buildPatchJob(t.cfg, { repo: 'rapid-game', test }, ENV);
      assert.ok(out.job, `${test}: ${out.error}`);
    }
  } finally { t.done(); }
});

test('control: the superproject lane keeps its own cargo commands', () => {
  const t = setup();
  try {
    const out = buildPatchJob(t.cfg, { test: 'cargo t -p sim' }, ENV);
    assert.ok(out.job, out.error);
  } finally { t.done(); }
});
