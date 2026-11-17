// Each CLI script run through a linked scripts folder (the sealed runtime's `current`) must still run and print (KIT-T1330).
// Run: node --test scripts/linked-launch-guards.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = fileURLToPath(new URL('.', import.meta.url));
const emptyRoot = mkdtempSync(join(tmpdir(), 'llg-root-'));
const link = join(mkdtempSync(join(tmpdir(), 'llg-link-')), 'scripts');
symlinkSync(scriptsDir, link, 'junction');

const CASES = [
  { script: 'broker/build-run.mjs', args: ['no-such-tool-kit-t1330'], output: 'stderr', expect: /not found on PATH/ },
  { script: 'broker/build-status.mjs', args: [], output: 'stdout', expect: /building/ },
  { script: 'decision-promotion.mjs', args: ['--root', emptyRoot], output: 'stdout', expect: /0 unpromoted/ },
  { script: 'framework-mirror.mjs', args: ['--root', emptyRoot], output: 'stderr', expect: /usage: node scripts\/framework-mirror\.mjs/ },
  { script: 'broker/incremental.mjs', args: ['--root', emptyRoot, '--dry-run'], output: 'stdout', expect: /incremental caches/ },
  { script: 'broker/stats.mjs', args: ['--root', emptyRoot, '--json'], output: 'stdout', expect: /\{/ },
];

const run = (dir, c) => spawnSync(process.execPath, [join(dir, c.script), ...c.args], { encoding: 'utf8', cwd: emptyRoot });

for (const c of CASES) {
  test(`${c.script} through a linked scripts folder prints what the real path prints`, () => {
    const real = run(scriptsDir, c);
    assert.match(real[c.output], c.expect, `real path: ${real.stderr}`);
    const linked = run(link, c);
    assert.match(linked[c.output], c.expect, `linked path printed nothing useful: ${linked.stderr}`);
    assert.equal(linked.status, real.status);
  });
}
