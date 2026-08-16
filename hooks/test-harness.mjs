// Shared fixture + spawn harness for the hook test files.
//
// Use: import the pieces you need, build throwaway repos, assert through the reporter's
// `ok`, and call `cleanup()` in a `finally` — it tears down every fixture directory
// registered here.
//
// Importing this module isolates the process: CLAUDE_PLUGIN_ROOT and the kit registry are
// redirected to throwaway temp paths BEFORE any hook is spawned, so a fixture store can
// never replace a scope in the maintainer's live cache or registry.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SECONDS_PER_DAY = 86400;

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const HOOKS = join(ROOT, 'hooks');
export const SCRIPTS = join(ROOT, 'scripts');
export const fixtures = [];

export function tmpDir(prefix) {
  const d = mkdtempSync(join(tmpdir(), prefix));
  fixtures.push(d);
  return d;
}

export const TMP_REG = join(tmpDir('kit-reg-'), 'registry.json');
process.env.CLAUDE_PLUGIN_ROOT = tmpDir('kit-hooks-plugin-');

export const ENV = { ...process.env, CLAUDE_KIT_REGISTRY: TMP_REG };

export function hook(name, payload, cwd, extraEnv) {
  const r = spawnSync(process.execPath, [join(HOOKS, name)], {
    input: JSON.stringify(payload), cwd, encoding: 'utf8', env: { ...ENV, ...extraEnv },
  });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

export function script(name, args, cwd, env) {
  const r = spawnSync(process.execPath, [join(SCRIPTS, name), ...args], {
    cwd, encoding: 'utf8', env: { ...ENV, ...env },
  });
  return { code: r.status, out: r.stdout || '', err: r.stderr || '' };
}

export const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

export function repo() {
  const d = tmpDir('kit-test-');
  execFileSync('git', ['init', '-q'], { cwd: d, stdio: 'ignore' });
  return d;
}

export function identify(dir) {
  git(['config', 'user.email', 't@t'], dir);
  git(['config', 'user.name', 't'], dir);
  return dir;
}

// `withCode` STAGES foo.ts rather than leaving it untracked: a bare `git commit` is judged
// on the staged set (KIT-T052).
export function adopted(withCode) {
  const d = repo();
  mkdirSync(join(d, '.ai'));
  if (withCode) {
    writeFileSync(join(d, 'foo.ts'), 'function f() { return doStuff(42); }\n');
    execFileSync('git', ['add', 'foo.ts'], { cwd: d, stdio: 'ignore' });
  }
  return d;
}

// An adopted repo with a committer identity, a config.yml declaring `uat` + id key, and the
// inbox/tickets dirs the closure nags scan.
export function project(uat, key = 'KIT') {
  const d = identify(adopted(false));
  writeFileSync(join(d, '.ai', 'config.yml'), `uat:\n  default: ${uat}\nids:\n  key: "${key}"\n`);
  mkdirSync(join(d, '.ai', 'inbox'), { recursive: true });
  mkdirSync(join(d, '.ai', 'tickets'), { recursive: true });
  return d;
}

export function ageFile(path, days) {
  const t = Date.now() / 1000 - days * SECONDS_PER_DAY;
  utimesSync(path, t, t);
}

export function reviewTicket(dir, id, ageDays) {
  const p = join(dir, '.ai', 'tickets', `${id}-x.md`);
  writeFileSync(p, `---\nid: ${id}\ntitle: a review item\nstatus: review\n---\n`);
  if (ageDays !== undefined) ageFile(p, ageDays);
  return p;
}

// USERPROFILE drives os.homedir() on Windows, HOME elsewhere.
export const homeEnv = (home) => ({ USERPROFILE: home, HOME: home });

// A throwaway HOME with FRESH review timestamps — keeps the weekly-review nags quiet so a
// test sees only the signal it asserts on.
export function quietHome() {
  const home = tmpDir('kit-home-');
  const enc = home.replace(/[:\\/ ]/g, '-');
  mkdirSync(join(home, '.claude', 'projects', enc, 'memory'), { recursive: true });
  writeFileSync(join(home, '.claude', 'projects', enc, 'memory', '.last-reviewed'), '');
  writeFileSync(join(home, '.claude', '.maintenance-last-reviewed'), '');
  return home;
}

// A bare origin plus a `clone(name)` factory — for upstream ahead/behind scenarios.
export function remoteOrigin() {
  const base = tmpDir('kit-ab-');
  const bare = join(base, 'r.git');
  mkdirSync(bare);
  git(['init', '-q', '--bare', bare], base);
  const clone = (name) => {
    const d = join(base, name);
    git(['clone', '-q', bare, d], base);
    return identify(d);
  };
  return { base, bare, clone };
}

export function reporter(label) {
  let pass = 0;
  let fail = 0;
  const ok = (name, cond) => {
    if (cond) { pass++; console.log('  ok    ' + name); }
    else { fail++; console.log('  FAIL  ' + name); }
  };
  const done = () => {
    console.log(`\n${label}: ${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  };
  return { ok, done };
}

export function cleanup() {
  for (const d of fixtures) {
    try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}
