// autopin-affected.test.mjs — a consumer on land_gate: affected refuses a pin-only job with no --test, so
// the auto-pin must carry the consumer's own check; without it the pin was refused in a detached submit
// nobody read, and the superproject never moved to the landed framework commit.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildPatchJob, SUITE_REFUSAL } from './submit-lib.mjs';
import { parseFlags } from './cli.mjs';
import { readBrokerConfig } from './config.mjs';
import { pinSubmitArgs } from './autopin.mjs';
import { g } from './patchkit.mjs';
import { setup } from './subkit.mjs';

const CHECK = 'node -v';
const REPOS = '  repos:\n    - { name: super, path: ., main: main, remote: origin }\n    - { name: rapid-game, path: rapid-game, main: main, remote: origin, submodule: true, pin_in: ., auto_pin: true }\n';

// pinSubmitArgs reads the consumer's own config file, as the detached submit does.
function consumer(gate) {
  const t = setup();
  mkdirSync(join(t.root, '.ai'), { recursive: true });
  const affected = gate ? `  land_gate: affected\n  affected: { check: ${CHECK}, test: ${CHECK} }\n` : '';
  writeFileSync(join(t.root, '.ai', 'config.yml'), `broker:\n  verify_default:\n    - node -p 1\n${affected}${REPOS}`);
  return { t, cfg: readBrokerConfig(t.root), sha: g(['rev-parse', 'HEAD'], t.sub) };
}
const argsFor = (c) => pinSubmitArgs(c.t.root, { name: 'rapid-game' }, c.sha, { ticket: 'RG-T1', origin: 'j-origin' });

test('an auto-pin to an affected-gate consumer carries that consumer\'s check and is accepted', () => {
  const c = consumer(true);
  try {
    const args = argsFor(c);
    assert.deepEqual(args.slice(args.indexOf('--test'), args.indexOf('--test') + 2), ['--test', CHECK]);
    const out = buildPatchJob(c.cfg, parseFlags(args), '');
    assert.ok(out.job, JSON.stringify(out.error || out.result));
    assert.deepEqual([out.job.commands, out.job.land, out.job.autoPin, out.job.pins.map((p) => p.sha)], [[CHECK], true, 'j-origin', [c.sha]]);
  } finally { c.t.done(); }
});

test('negative control: the same pin without a check is refused under the affected gate', () => {
  const c = consumer(true);
  try {
    const bare = argsFor(c).filter((a, i, all) => a !== '--test' && all[i - 1] !== '--test');
    assert.equal(buildPatchJob(c.cfg, parseFlags(bare), '').error, SUITE_REFUSAL);
  } finally { c.t.done(); }
});

test('a consumer on the full gate gets no --test: its verify_default is the check', () => {
  const c = consumer(false);
  try {
    assert.equal(argsFor(c).includes('--test'), false);
  } finally { c.t.done(); }
});
