#!/usr/bin/env node
// source-shell-gate-vendor.test.mjs — vendoring an unmodified third-party tree (a crate copied from the cargo registry into a
// patches folder) has one route the block names: the folder listed in .claude-kit-ignore.yaml (KIT-T1218).
// Run: node hooks/source-shell-gate-vendor.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = fileURLToPath(new URL('./source-shell-gate.mjs', import.meta.url));
let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
};

const repo = realpathSync.native(mkdtempSync(join(tmpdir(), 'kit-vendor-')));
execFileSync('git', ['init', '-q'], { cwd: repo });
mkdirSync(join(repo, '.ai'), { recursive: true });
mkdirSync(join(repo, 'rust', 'patches'), { recursive: true });
mkdirSync(join(repo, 'rust', 'crates'), { recursive: true });
const registry = '/c/Users/Some Body/.cargo/registry/src/index-abc123/bevy_render-0.19.1';
const run = (command, cwd = repo, tool = 'Bash') => spawnSync(process.execPath, [HOOK], { cwd, input: JSON.stringify({ tool_name: tool, tool_input: { command } }), encoding: 'utf8' });

try {
  const copyIn = `cp -r "${registry}" patches/bevy_render`;
  const before = run(`cp -r "${registry}" rust/patches/bevy_render`);
  check('a recursive copy of a registry crate into the repo blocks until the folder is listed', before.status === 2, before.stderr.slice(0, 160));
  check('the block names the vendoring route: the folder listed in .claude-kit-ignore.yaml', /vendor/i.test(before.stderr) && /\.claude-kit-ignore\.yaml/.test(before.stderr) && /"\*":/.test(before.stderr), before.stderr);

  writeFileSync(join(repo, '.claude-kit-ignore.yaml'), '"*":\n  - "rust/patches/**"\n');
  check('with the folder listed, the copy passes from the repo root', run(`cp -r "${registry}" rust/patches/bevy_render`).status === 0);
  check('with the folder listed, the copy passes from a subdirectory (the glob is repo-relative)', run(copyIn, join(repo, 'rust')).status === 0, run(copyIn, join(repo, 'rust')).stderr.slice(0, 160));
  const psCopy = run(`Copy-Item -Recurse -Path "${registry}" -Destination rust\\patches\\bevy_render`, repo, 'PowerShell');
  check('with the folder listed, a PowerShell Copy-Item -Recurse passes', psCopy.status === 0, psCopy.stderr.slice(0, 100));
  check('control: the same copy into an unlisted folder still blocks', run(`cp -r "${registry}" rust/crates/bevy_render`).status === 2);
  check('control: a redirect into ordinary source outside the listed folder still blocks', run('echo x > rust/crates/a.rs').status === 2);
  check('control: a write below a subdirectory is judged by its repo path, so a root-level glob does not lift a same-named folder there', run('echo x > rust/patches/a.rs', join(repo, 'rust', 'crates')).status === 2);
  check('control: a PowerShell copy into an unlisted folder still blocks', run(`Copy-Item -Recurse -Path "${registry}" -Destination rust\\crates\\bevy_render`, repo, 'PowerShell').status === 2);

  const PRE_WRITE = fileURLToPath(new URL('./pre-write.mjs', import.meta.url));
  const OVER_HARD_LINES = 700;
  const body = Array.from({ length: OVER_HARD_LINES }, (_, i) => `// filler line ${i}`).join('\n');
  const write = (rel) => spawnSync(process.execPath, [PRE_WRITE], { cwd: repo, input: JSON.stringify({ tool_input: { file_path: join(repo, rel), content: `${body}\n` } }), encoding: 'utf8' });
  const listedWrite = write('rust/patches/bevy_render/src/allocator.rs');
  check('a Write of an over-long file in the listed folder passes the length gate', listedWrite.status === 0, listedWrite.stderr.slice(0, 200));
  check('control: the same Write in an unlisted folder blocks', write('rust/crates/allocator.rs').status === 2);
} finally {
  rmSync(repo, { recursive: true, force: true });
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
