#!/usr/bin/env node
// Tests for the sealed-runtime wiring (KIT-T450): bootstrap and dev-link point the plugin install,
// the statusline and the composed CLAUDE.md at <runtime>/current, so a stub kit whose working tree
// is deliberately broken still answers every command a session invokes. Also: the publish script
// refuses to run outside `npm run publish:runtime`, so `current` moves only after a green suite.
// Run: node scripts/runtime-wiring.test.mjs

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { publishRuntime } from './runtime-publish.mjs';

const KIT = resolve(fileURLToPath(import.meta.url), '..', '..');
let pass = 0;
let fail = 0;
const ok = (name, cond, detail = '') => { if (cond) { pass++; console.log('  ok    ' + name); } else { fail++; console.log('  FAIL  ' + name + (detail ? ' - ' + detail : '')); } };
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const put = (root, rel, text) => { mkdirSync(join(root, rel, '..'), { recursive: true }); writeFileSync(join(root, rel), text); };
const run = (script, args, env, cwd) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env, cwd });

const tmp = mkdtempSync(join(tmpdir(), 'kit-wiring-'));
const userHome = join(tmp, 'user');
const claudeHome = join(userHome, '.claude');
const runtimeRoot = join(claudeHome, 'claude-kit-runtime');
const repo = join(tmp, 'kit');
const installPath = join(claudeHome, 'plugins', 'cache', 'claude-kit', 'claude-kit', '0.0.1');
const priv = join(tmp, 'private');

// Stub kit: committed good scripts, then working-tree edits that cannot even parse.
mkdirSync(repo, { recursive: true });
git(repo, 'init', '-q');
git(repo, 'config', 'user.email', 't@t');
git(repo, 'config', 'user.name', 't');
for (const name of ['q', 't', 'cap']) put(repo, `scripts/${name}.mjs`, `console.log('${name} from the sealed copy');\n`);
put(repo, 'hooks/compat-run.mjs', "console.log('compat-run from the sealed copy');\n");
put(repo, 'user-config/CLAUDE.global.md', 'Search: `node <kit>/scripts/q.mjs`\n');
put(repo, 'user-config/statusline.sh', '#!/bin/sh\necho status\n');
git(repo, 'add', '.');
git(repo, 'commit', '-qm', 'good');
publishRuntime({ repo, runtimeRoot });
for (const rel of ['scripts/q.mjs', 'scripts/t.mjs', 'hooks/compat-run.mjs']) put(repo, rel, 'export const broken = ;; half-edit\n');

put(tmp, 'private/CLAUDE.md', 'Overlay: `node <kit>/scripts/t.mjs`\n');
put(installPath, 'scripts/q.mjs', "console.log('stale snapshot');\n");
put(claudeHome, 'plugins/installed_plugins.json', JSON.stringify({ version: 2, plugins: { 'claude-kit@claude-kit': [{ scope: 'user', installPath }] } }));
put(tmp, 'registry.json', '{}');

const env = {
  ...process.env, HOME: userHome, USERPROFILE: userHome, CLAUDE_HOME: claudeHome, CLAUDE_KIT_RUNTIME: runtimeRoot,
  CLAUDE_KIT_PRIVATE: priv, CLAUDE_KIT_REGISTRY: join(tmp, 'registry.json'),
};
delete env.npm_lifecycle_event;
delete env.LINK_TOOLING;
delete env.CLAUDE_DATA;

ok('control: the working-tree q.mjs is broken', run(join(repo, 'scripts', 'q.mjs'), [], env).status !== 0);

// 1. bootstrap wires everything onto the runtime.
const boot = run(join(KIT, 'bootstrap.mjs'), [], env, tmp);
ok('bootstrap exits 0', boot.status === 0, boot.stderr);
const composed = existsSync(join(claudeHome, 'CLAUDE.md')) ? readFileSync(join(claudeHome, 'CLAUDE.md'), 'utf8') : '';
ok('composed CLAUDE.md resolves the base <kit> to the runtime', composed.includes('node ~/.claude/claude-kit-runtime/current/scripts/q.mjs'), composed);
ok('composed CLAUDE.md resolves the overlay <kit> too', composed.includes('node ~/.claude/claude-kit-runtime/current/scripts/t.mjs'));
ok('composed CLAUDE.md keeps no <kit> placeholder', !composed.includes('<kit>'));
ok('the plugin install is a link onto the runtime', realpathSync(installPath) === realpathSync(join(runtimeRoot, 'current')));
ok('the statusline is the runtime copy (linked, or copied where symlinks are forbidden)', readFileSync(join(claudeHome, 'statusline.sh'), 'utf8').includes('echo status'));

// 2. every command a session invokes works through the runtime path while the working tree is broken.
for (const rel of ['scripts/q.mjs', 'scripts/t.mjs', 'hooks/compat-run.mjs']) {
  const viaPlugin = run(join(installPath, rel), [], env);
  const viaCurrent = run(join(runtimeRoot, 'current', rel), [], env);
  ok(`${rel} runs from the plugin install`, viaPlugin.status === 0 && viaPlugin.stdout.includes('sealed copy'), viaPlugin.stderr);
  ok(`${rel} runs from current`, viaCurrent.status === 0 && viaCurrent.stdout.includes('sealed copy'), viaCurrent.stderr);
}

// 3. a second bootstrap is a no-op for the link.
const again = run(join(KIT, 'bootstrap.mjs'), [], env, tmp);
ok('re-running bootstrap keeps the link', again.status === 0 && /already on/.test(again.stdout), again.stdout);

// 4. dev-link: --live points at a repo, the default points back at the runtime.
const devLink = join(KIT, 'scripts', 'dev-link.mjs');
run(devLink, ['--live'], env, tmp);
ok('dev-link --live links the working repo', realpathSync(installPath) === realpathSync(KIT));
const back = run(devLink, [], env, tmp);
ok('dev-link with no flag links the runtime', back.status === 0 && realpathSync(installPath) === realpathSync(join(runtimeRoot, 'current')), back.stderr);

// 5. without a published runtime nothing is composed from, linked or rewritten.
const bare = mkdtempSync(join(tmpdir(), 'kit-wiring-bare-'));
const bareEnv = { ...env, CLAUDE_HOME: join(bare, '.claude'), CLAUDE_KIT_RUNTIME: join(bare, 'none'), HOME: bare, USERPROFILE: bare };
put(bare, '.claude/plugins/installed_plugins.json', JSON.stringify({ version: 2, plugins: { 'claude-kit@claude-kit': [{ installPath: join(bare, 'install') }] } }));
put(bare, 'install/marker.txt', 'x');
const noRuntime = run(join(KIT, 'bootstrap.mjs'), [], bareEnv, tmp);
ok('no runtime: bootstrap still exits 0', noRuntime.status === 0, noRuntime.stderr);
ok('no runtime: the plugin install is untouched', existsSync(join(bare, 'install', 'marker.txt')));
ok('no runtime: composed CLAUDE.md keeps the <kit> placeholder', readFileSync(join(bare, '.claude', 'CLAUDE.md'), 'utf8').includes('<kit>'));

// 6. `current` moves only through npm run publish:runtime.
const before = realpathSync(join(runtimeRoot, 'current'));
put(repo, 'scripts/q.mjs', "console.log('q from a later commit');\n");
git(repo, 'commit', '-aqm', 'later');
const direct = run(join(KIT, 'scripts', 'runtime-publish.mjs'), ['--runtime', runtimeRoot], env, KIT);
ok('publishing outside the npm script is refused', direct.status === 1 && /npm run publish:runtime/.test(direct.stderr), direct.stderr);
ok('a refused publish leaves current where it was', realpathSync(join(runtimeRoot, 'current')) === before);
const pkg = JSON.parse(readFileSync(join(KIT, 'package.json'), 'utf8'));
ok('publish:runtime runs the suite before the publish script', /^npm test && node scripts\/runtime-publish\.mjs/.test(pkg.scripts['publish:runtime']));

rmSync(tmp, { recursive: true, force: true });
rmSync(bare, { recursive: true, force: true });
console.log(`\nruntime-wiring: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
