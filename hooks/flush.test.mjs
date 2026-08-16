// Tests for the SESSION-cited artifact check in hooks/flush.mjs (KIT-T215): an existing
// cited path is silent, a missing one warns (never blocks), and an unadopted repo no-ops.
// Run: node hooks/flush.test.mjs

import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { citedPaths } from './session-citations.mjs';

const HOOK = fileURLToPath(new URL('./flush.mjs', import.meta.url));
let failures = 0;
let count = 0;

function ok(name, cond) {
  count++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

function makeRepo({ adopt = true, session = null, files = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'flush-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  if (adopt) mkdirSync(join(dir, '.ai', 'tickets'), { recursive: true });
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(dir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  if (session !== null) writeFileSync(join(dir, '.ai', 'SESSION.md'), session);
  return dir;
}

function run(dir) {
  const r = spawnSync(process.execPath, [HOOK], {
    cwd: dir,
    input: JSON.stringify({ hook_event_name: 'PreCompact' }),
    encoding: 'utf8',
  });
  return { code: r.status, err: r.stderr || '', out: r.stdout || '' };
}

// --- unit: what counts as a citation -------------------------------------------------
ok('citedPaths: picks up a relative path with an extension', citedPaths('see scratchpad/x.md now').includes('scratchpad/x.md'));
ok('citedPaths: ignores a bare dotted word', citedPaths('flushed SESSION.md today').length === 0);
ok('citedPaths: ignores URLs', citedPaths('https://example.com/a/b.md').length === 0);
ok('citedPaths: ignores globs', citedPaths('touched src/**/*.mjs').length === 0);

// --- existing citation -> silent -----------------------------------------------------
const good = makeRepo({ session: 'Deliverable: docs/research/harvest.md\n', files: { 'docs/research/harvest.md': 'x' } });
const rGood = run(good);
ok('existing cited path: no warning', !/do NOT exist/.test(rGood.err));
ok('existing cited path: exits 0', rGood.code === 0);

// --- missing citation -> warn, never block -------------------------------------------
const bad = makeRepo({ session: 'Deliverable: scratchpad/recipe-model-harvest.md\n' });
const rBad = run(bad);
ok('missing cited path: warns', /do NOT exist/.test(rBad.err));
ok('missing cited path: names the path', /scratchpad\/recipe-model-harvest\.md/.test(rBad.err));
ok('missing cited path: still exits 0 (warn, never block)', rBad.code === 0);

// --- unadopted repo -> no-op ---------------------------------------------------------
const none = makeRepo({ adopt: false });
const rNone = run(none);
ok('unadopted repo: silent', !/do NOT exist/.test(rNone.err) && rNone.out === '');
ok('unadopted repo: exits 0', rNone.code === 0);

console.log(`\n${count - failures}/${count} passed`);
process.exit(failures ? 1 : 0);
