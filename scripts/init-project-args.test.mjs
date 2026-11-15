#!/usr/bin/env node
// init-project-args.test.mjs — init-project.mjs never adopts by accident (KIT-T1239): --help, unknown flags, an explicit
// target or --here, the kit checkout and registered projects refused, --dry-run writes nothing. Drives the real CLI.
// Run: node scripts/init-project-args.test.mjs

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, reporter } from '../hooks/test-harness.mjs';
import { guardTarget, parseInitArgs } from './init-project-args.mjs';

const { ok, done } = reporter('init-project-args');
const SCRIPT = fileURLToPath(new URL('./init-project.mjs', import.meta.url));
const KIT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const base = mkdtempSync(join(tmpdir(), 'kit-init-args-'));
const repo = join(base, 'demo-repo');
mkdirSync(repo);
const registry = join(base, 'registry.json');
writeFileSync(registry, JSON.stringify({ projects: { known: join(base, 'known-repo') } }));
mkdirSync(join(base, 'known-repo'));

const run = (args, cwd = repo) => {
  const env = { ...process.env, CLAUDE_KIT_REGISTRY: registry };
  delete env.CLAUDE_DATA;
  return spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: 'utf8', env });
};
const files = (dir) => readdirSync(dir);

try {
  const help = run(['--help']);
  ok('--help prints usage and exits 0', help.status === 0 && /^usage: init-project\.mjs/.test(help.stdout));
  ok('--help writes nothing in the cwd', files(repo).length === 0);
  ok('-h is the same', run(['-h']).status === 0);

  const unknown = run(['--bogus', repo]);
  ok('an unknown flag exits 2 naming it, writing nothing', unknown.status === 2 && /unknown flag --bogus/.test(unknown.stderr) && files(repo).length === 0);

  const bare = run([]);
  ok('no target and no --here exits 2, writing nothing', bare.status === 2 && /no target/.test(bare.stderr) && files(repo).length === 0);

  const kit = run([KIT, '--force']);
  ok('the claude-kit checkout is refused, even with --force', kit.status === 1 && /claude-kit checkout/.test(kit.stderr));

  const known = run([join(base, 'known-repo')]);
  ok('a registered project is refused without --force', known.status === 1 && /already registered as project "known"/.test(known.stderr));
  ok('--force lifts the registered-project refusal', guardTarget({ target: join(base, 'known-repo'), kit: KIT, projects: { known: join(base, 'known-repo') }, force: true }) === '');

  const dry = run(['--here', '--dry-run']);
  ok('--here --dry-run lists what it would write and writes nothing',
    dry.status === 0 && /dry run: nothing written/.test(dry.stdout) && /would scaffold .*\.ai/.test(dry.stdout) && /would create .*AGENTS\.md/.test(dry.stdout) && files(repo).length === 0);

  const real = run(['--here']);
  ok('--here adopts the cwd', real.status === 0 && files(repo).includes('AGENTS.md') && files(repo).includes('.ai'));

  ok('parse: two targets are an error', /expected one target/.test(parseInitArgs(['a', 'b']).error));
  ok('parse: --here with a target is an error', /exclusive/.test(parseInitArgs(['--here', 'a']).error));
  ok('parse: --lab needs a name', /--lab needs/.test(parseInitArgs(['--lab']).error));
  ok('parse: --key=abc is upper-cased', parseInitArgs(['x', '--key=abc']).key === 'ABC');
} finally { rmSync(base, { recursive: true, force: true }); cleanup(); }
done();
