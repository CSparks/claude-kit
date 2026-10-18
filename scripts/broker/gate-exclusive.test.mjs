// gate-exclusive.test.mjs — while a submodule lane's pre-push gate runs, no other lane's cargo runs in
// the shared target dir (KIT-T561): the gate runs under the lane's tree lock, so a superproject job
// that builds over that tree waits, and idle work yields to the busy lane. Control: with the gate done
// the same job takes the tree.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { laneConfigs, normalizeBroker, repoByName } from './config.mjs';
import { processOnce } from './queue.mjs';
import { readInflight } from './preimage.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { takeSubtrees } from './subtree.mjs';
import { g } from './patchkit.mjs';
import { setup } from './subkit.mjs';
import { tempDir, cleanup } from './testkit.mjs';

const here = (name) => pathToFileURL(join(import.meta.dirname, name)).href;
const slash = (p) => p.split(String.fromCharCode(92)).join('/');

// A pre-push hook for the rapid-game checkout: while the gate runs it tries to take the rapid-game
// tree for a root-lane cargo job, and records the answer and what laneBusy says.
function probingGate(t) {
  const dir = tempDir('gate-excl-');
  const out = join(dir, 'probe.json');
  const script = join(dir, 'probe.mjs');
  const root = JSON.stringify(slash(t.root));
  writeFileSync(script, [
    "import { writeFileSync } from 'node:fs';",
    `const { normalizeBroker, laneConfigs, repoByName } = await import(${JSON.stringify(here('config.mjs'))});`,
    `const { takeSubtrees } = await import(${JSON.stringify(here('subtree.mjs'))});`,
    `const { laneBusy } = await import(${JSON.stringify(here('lane-busy.mjs'))});`,
    `const cfg = normalizeBroker(${root}, ${JSON.stringify(t.broker)});`,
    "const [rootLane] = laneConfigs(cfg);",
    "const got = takeSubtrees(rootLane, [repoByName(cfg, 'rapid-game')], 'root-cargo-job');",
    "const busy = laneBusy(rootLane);",
    "if (got.ok) got.release();",
    `writeFileSync(${JSON.stringify(slash(out))}, JSON.stringify({ rootTookTree: got.ok, reason: got.reason || null, busy }));`,
    '',
  ].join('\n'));
  const hooks = join(dir, 'hooks');
  mkdirSync(hooks);
  writeFileSync(join(hooks, 'pre-push'), `#!/bin/sh\nexec node "${slash(script)}"\n`);
  chmodSync(join(hooks, 'pre-push'), 0o755);
  g(['config', 'core.hooksPath', hooks], t.sub);
  return { probe: () => JSON.parse(readFileSync(out, 'utf8')), done: () => cleanup(dir) };
}

test('a root-lane cargo job cannot take the rapid-game tree while the rapid-game pre-push gate runs, and can after', () => {
  const t = setup();
  t.broker.repos[1].pre_push = true;
  t.cfg = normalizeBroker(t.root, t.broker);
  const gate = probingGate(t);
  try {
    const [rootLane, subLane] = laneConfigs(t.cfg);
    const { job } = buildPatchJob(t.cfg, { repo: 'rapid-game', ticket: 'T-1', title: 'fw', land: true, 'no-pin': true }, '*** write api.txt\napi\n');
    writeJob(subLane, { ...job, commands: ['node -e "0"'] });
    processOnce(subLane);
    assert.equal(readResult(subLane, job.id).status, 'landed', JSON.stringify(readResult(subLane, job.id)));
    const seen = gate.probe();
    assert.equal(seen.rootTookTree, false, 'the gate runs under the rapid-game lane\'s tree lock');
    assert.match(seen.reason, /rapid-game tree held by lane rapid-game/);
    assert.match(seen.busy, /lane rapid-game (has a queued job|is running)/, 'idle work in the root lane yields to the gate');
    const after = takeSubtrees(rootLane, [repoByName(t.cfg, 'rapid-game')], 'root-cargo-job');
    assert.equal(after.ok, true, 'control: once the gate is done the tree is free');
    after.release();
    assert.equal(readInflight(subLane), null);
  } finally { gate.done(); t.done(); }
});
