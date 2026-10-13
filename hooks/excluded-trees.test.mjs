#!/usr/bin/env node
// Excluded trees (KIT-T447): a registry `excluded` root makes the kit inert beneath it.
// Asserts the matcher, that compat-run exits 0 without running a hook that would otherwise
// block (by cwd and by file_path), that the store resolver yields no store, and that cap / t /
// q refuse from inside the tree. A non-excluded sibling with a shared prefix stays live.

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

let pass = 0;
let fail = 0;
function ok(name, condition, detail = '') {
  if (condition) { pass++; console.log(`  ok    ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

const base = mkdtempSync(join(tmpdir(), 'kit-excluded-'));
const fleet = join(base, 'the-commodore');
const nested = join(fleet, 'mkt-workspace', 'deep');
const sibling = join(base, 'the-commodore-two');
const stray = join(base, 'elsewhere');
for (const d of [nested, sibling, stray]) mkdirSync(d, { recursive: true });
for (const d of [fleet, sibling, stray]) spawnSync('git', ['init', '-q'], { cwd: d });

const registry = join(base, 'registry.json');
writeFileSync(registry, JSON.stringify({ projects: {}, excluded: [fleet] }));
const ENV = { ...process.env, CLAUDE_KIT_REGISTRY: registry };
process.env.CLAUDE_KIT_REGISTRY = registry;

const { excludedRoot, excludedAmong } = await import('./lib/excluded-trees.mjs');
const { resolveStoreRoot, noStoreMessage } = await import('./lib/unbounded.mjs');

// --- 1. the matcher --------------------------------------------------------------
ok('root itself is excluded', excludedRoot(fleet) === fleet);
ok('nested path is excluded', excludedRoot(nested) === fleet);
ok('shared-prefix sibling is NOT excluded', excludedRoot(sibling) === null);
ok('unrelated path is NOT excluded', excludedRoot(stray) === null);
ok('empty / non-string input is NOT excluded', excludedRoot('') === null && excludedRoot(undefined) === null);
if (process.platform === 'win32') {
  ok('windows match ignores case and slash style', excludedRoot(nested.toUpperCase().replace(/\\/g, '/')) === fleet);
}
ok('excludedAmong picks the first hit across candidates', excludedAmong(stray, undefined, nested) === fleet);

// --- 2. the store resolver -------------------------------------------------------
ok('resolveStoreRoot yields NO store under an excluded tree', resolveStoreRoot(nested) === null);
ok('noStoreMessage names the exclusion', /claude-kit is off under/.test(noStoreMessage(nested)));

// --- 3. every hook exits 0 through compat-run ------------------------------------
const runner = fileURLToPath(new URL('./compat-run.mjs', import.meta.url));
const pluginRoot = fileURLToPath(new URL('..', import.meta.url));
const OFFENDING = 'export function f(x) {\n  return x * 1337;\n}\n';
function preWrite(cwd, filePath) {
  return spawnSync(process.execPath, [runner, 'pre-write.mjs'], {
    cwd,
    env: { ...ENV, CLAUDE_PLUGIN_ROOT: pluginRoot },
    input: JSON.stringify({
      cwd, hook_event_name: 'PreToolUse', tool_name: 'Write',
      tool_input: { file_path: filePath, content: OFFENDING },
    }),
    encoding: 'utf8',
  });
}
mkdirSync(join(sibling, '.ai'), { recursive: true });
const live = preWrite(sibling, join(sibling, 'src', 'a.ts'));
ok('control: the same write still HALTS in a live tree (exit 2)', live.status === 2, `status ${live.status}`);
const offByCwd = preWrite(nested, join(nested, 'src', 'a.ts'));
ok('excluded cwd: hook exits 0', offByCwd.status === 0, `status ${offByCwd.status}`);
ok('excluded cwd: hook is silent', !offByCwd.stdout.trim() && !offByCwd.stderr.trim(), offByCwd.stderr);
const offByFile = preWrite(sibling, join(fleet, 'src', 'a.ts'));
ok('live cwd, excluded file_path: hook exits 0', offByFile.status === 0, `status ${offByFile.status}`);

// --- 4. the CLIs refuse ----------------------------------------------------------
const scripts = resolve(pluginRoot, 'scripts');
function cli(name, args) {
  return spawnSync(process.execPath, [join(scripts, name), ...args], { cwd: nested, env: ENV, encoding: 'utf8' });
}
for (const [name, args] of [['cap.mjs', ['a stray thought']], ['t.mjs', ['new', 'chore', 'x']], ['q.mjs', ['fts', 'anything']]]) {
  const r = cli(name, args);
  ok(`${name} refuses under an excluded tree (exit 2)`, r.status === 2, `status ${r.status}: ${r.stderr}`);
  ok(`${name} says why`, /claude-kit is off under/.test(r.stderr), r.stderr);
}

console.log(`\nexcluded-trees: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
