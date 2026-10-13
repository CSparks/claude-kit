#!/usr/bin/env node
// Tests for the id mints that share the atomic reservation (KIT-T459): `t move` and the
// `triage --apply` allocator claim ids through id-reserve, so processes minting in the same
// store at the same moment never get the same id.
// Run: node scripts/id-reserve-callers.test.mjs

import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
let pass = 0;
let fail = 0;
const ok = (name, cond, detail = '') => { if (cond) { pass++; console.log('  ok    ' + name); } else { fail++; console.log('  FAIL  ' + name + (detail ? ' — ' + detail : '')); } };

const tmp = mkdtempSync(join(tmpdir(), 'kit-idcallers-'));
const src = join(tmp, 'src');
const dest = join(tmp, 'dest');
const CALLERS = 4;

function makeRepo(root, key, notes = []) {
  mkdirSync(join(root, '.ai', 'notes'), { recursive: true });
  writeFileSync(join(root, '.ai', 'config.yml'), `ids:\n  key: "${key}"\n  pad: 3\n`);
  for (const id of notes) {
    writeFileSync(join(root, '.ai', 'notes', `${id}-n.md`), `---\nid: ${id}\ntitle: note ${id}\nstatus: open\n---\n\nbody ${id}\n`);
  }
}

const noteIds = Array.from({ length: CALLERS }, (_, i) => `SRC-N${String(i + 1).padStart(3, '0')}`);
makeRepo(src, 'SRC', noteIds);
makeRepo(dest, 'DST', ['DST-N001']);
writeFileSync(join(tmp, 'registry.json'), '{}');

const env = { ...process.env, CLAUDE_PLUGIN_ROOT: tmp, CLAUDE_KIT_REGISTRY: join(tmp, 'registry.json') };

function collect(child) {
  return new Promise((resolve) => {
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.on('close', (code) => resolve({ code, out }));
  });
}

const tMove = (id) => collect(spawn(process.execPath, [join(HERE, 't.mjs'), 'move', id, dest], { cwd: src, env, stdio: ['ignore', 'pipe', 'ignore'] }));

const mintScript = `
  import { mintId } from ${JSON.stringify(new URL('./triage/apply.mjs', import.meta.url).href)};
  const db = { all: () => [{ m: 0 }] };
  console.log(mintId(db, 'DST', 'notes', ${JSON.stringify(dest)}, new Map(), ${JSON.stringify(join(dest, '.ai'))}));
`;
const triageMint = () => collect(spawn(process.execPath, ['--input-type=module', '-e', mintScript], { env, stdio: ['ignore', 'pipe', 'ignore'] }));

const results = await Promise.all([
  ...noteIds.map(tMove),
  ...Array.from({ length: CALLERS }, triageMint),
]);

const minted = results.slice(CALLERS).map((r) => r.out.trim());
const moved = readdirSync(join(dest, '.ai', 'notes')).map((f) => f.match(/^(DST-N\d+)/)?.[1]).filter(Boolean).filter((id) => id !== 'DST-N001');

ok('every concurrent t move succeeds', results.slice(0, CALLERS).every((r) => r.code === 0));
ok('every concurrent triage mint returns an id', minted.every((id) => /^DST-N\d+$/.test(id)), minted.join(','));
ok('the t move ids are distinct', new Set(moved).size === CALLERS && moved.length === CALLERS, moved.join(','));
ok('the triage ids are distinct', new Set(minted).size === CALLERS, minted.join(','));
const all = [...moved, ...minted];
ok('no id is minted by both t move and triage', new Set(all).size === all.length, all.join(','));
ok('every mint lands above what was on disk', all.every((id) => Number(id.slice(5)) > 1));

rmSync(tmp, { recursive: true, force: true });
console.log(`\nid-reserve-callers: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
