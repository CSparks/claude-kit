// cargo-scope-dirs.mjs — the paths a cargo build compiles, recorded in its build hold (KIT-T1114).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { acquireBuildSlot } from './build-slot.mjs';
import { compiledPaths, compiledScope, inScope, scopeVia, selection } from './cargo-scope-dirs.mjs';

const lower = (list) => list.map((p) => resolve(p).replace(/\\/g, '/').toLowerCase());

function workspace() {
  const root = mkdtempSync(join(tmpdir(), 'csd-'));
  const crates = { a: ['b'], b: [], c: [] };
  writeFileSync(join(root, 'Cargo.toml'), '[workspace]\nresolver = "2"\nmembers = ["crates/a", "crates/b", "crates/c"]\n');
  for (const [name, deps] of Object.entries(crates)) {
    mkdirSync(join(root, 'crates', name, 'src'), { recursive: true });
    const depText = deps.map((d) => `${d} = { path = "../${d}" }`).join('\n');
    writeFileSync(join(root, 'crates', name, 'Cargo.toml'), `[package]\nname = "${name}"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n${depText}\n`);
    writeFileSync(join(root, 'crates', name, 'src', 'lib.rs'), '');
    mkdirSync(join(root, 'crates', name, 'tests'), { recursive: true });
    writeFileSync(join(root, 'crates', name, 'tests', 'it.rs'), '');
  }
  writeFileSync(join(root, 'crates', 'b', 'build.rs'), 'fn main() {}\n');
  mkdirSync(join(root, 'crates', 'a', 'src', 'bin'), { recursive: true });
  writeFileSync(join(root, 'crates', 'a', 'src', 'bin', 'probe.rs'), 'fn main() {}\n');
  mkdirSync(join(root, 'crates', 'a', 'examples'), { recursive: true });
  writeFileSync(join(root, 'crates', 'a', 'examples', 'ex.rs'), 'fn main() {}\n');
  return root;
}

const covers = (scope, file) => inScope(resolve(file), scope);

test('selection reads -p, --package, --workspace and --all from the command line', () => {
  assert.deepEqual(selection(['test', '-p', 'a', '--package=b', '-p=c']), { names: ['a', 'b', 'c'], workspace: false });
  assert.deepEqual(selection(['build', '--workspace', '--exclude', 'x']), { names: [], workspace: true });
  assert.deepEqual(selection(['test', '--', '-p', 'ignored']), { names: [], workspace: false });
});

test('-p a scopes a and the library inputs of its path dependency b, never c, plus the workspace manifest and lock', () => {
  const root = workspace();
  const scope = compiledPaths(['test', '-p', 'a'], root);
  for (const want of ['crates/a/src/lib.rs', 'crates/a/tests/it.rs', 'crates/b/src/lib.rs', 'crates/b/Cargo.toml', 'crates/b/build.rs', 'Cargo.toml', 'Cargo.lock']) assert.ok(covers(scope, join(root, want)), want);
  assert.ok(!covers(scope, join(root, 'crates/c/src/lib.rs')), 'negative control: c is not compiled');
});

test('KIT-T1132: a dependency\'s integration tests are no input of the dependent\'s build; the built package\'s own are', () => {
  const root = workspace();
  const scope = compiledPaths(['test', '-p', 'a'], root);
  assert.ok(!covers(scope, join(root, 'crates/b/tests/it.rs')), 'b is a dependency: its tests/ are not compiled');
  assert.ok(covers(scope, join(root, 'crates/a/tests/it.rs')), 'negative control: a is built by cargo test, so its tests/ stay held');
  assert.ok(covers(scope, join(root, 'crates/b/src/lib.rs')), 'negative control: b\'s library source stays held');
  assert.ok(covers(compiledPaths(['test', '-p', 'b'], root), join(root, 'crates/b/tests/it.rs')), 'negative control: building b itself holds its tests/');
});

test('KIT-T1143: a --bin or run build holds the package\'s source, not its tests/ or examples/; a test build holds them', () => {
  const root = workspace();
  const tests = join(root, 'crates/a/tests/it.rs');
  const example = join(root, 'crates/a/examples/ex.rs');
  for (const args of [['run', '-p', 'a', '--bin', 'probe'], ['build', '-p', 'a'], ['check', '-p', 'a', '--bin', 'probe'], ['test', '-p', 'a', '--lib']]) {
    const scope = compiledPaths(args, root);
    assert.ok(!covers(scope, tests), `${args.join(' ')}: tests/ is not compiled`);
    assert.ok(!covers(scope, example), `${args.join(' ')}: examples/ is not compiled`);
    for (const want of ['crates/a/src/lib.rs', 'crates/a/src/bin/probe.rs', 'crates/a/Cargo.toml', 'crates/b/src/lib.rs']) assert.ok(covers(scope, join(root, want)), `${args.join(' ')}: ${want} stays held`);
  }
  for (const args of [['test', '-p', 'a'], ['test', '-p', 'a', '--test', 'it'], ['check', '-p', 'a', '--tests'], ['check', '-p', 'a', '--all-targets'], ['nextest', 'run', '-p', 'a'], ['bench', '-p', 'a']]) {
    assert.ok(covers(compiledPaths(args, root), tests), `negative control: ${args.join(' ')} holds tests/`);
  }
  assert.ok(covers(compiledPaths(['test', '-p', 'a', '--example', 'ex'], root), example), 'negative control: --example holds examples/');
});

test('KIT-T1143: a dev-only path dependency is held only when a test, bench or example is built', () => {
  const root = workspace();
  writeFileSync(join(root, 'crates', 'c', 'Cargo.toml'), '[package]\nname = "c"\nversion = "0.1.0"\nedition = "2021"\n\n[dev-dependencies]\nb = { path = "../b" }\n');
  assert.ok(!covers(compiledPaths(['run', '-p', 'c'], root), join(root, 'crates/b/src/lib.rs')), 'run does not compile dev-dependencies');
  assert.ok(covers(compiledPaths(['test', '-p', 'c'], root), join(root, 'crates/b/src/lib.rs')), 'negative control: test compiles them');
});

test('--workspace scopes every member whole; no selection inside a member scopes that member and its dependencies', () => {
  const root = workspace();
  const all = compiledPaths(['test', '--workspace'], root);
  assert.ok(['a', 'b', 'c'].every((n) => covers(all, join(root, 'crates', n, 'tests', 'it.rs'))));
  const inB = compiledPaths(['check'], join(root, 'crates', 'b'));
  assert.ok(covers(inB, join(root, 'crates/b/src/lib.rs')) && !covers(inB, join(root, 'crates/a/src/lib.rs')));
});

test('metadata that cannot be read leaves the whole working directory as the scope', () => {
  const root = mkdtempSync(join(tmpdir(), 'csd-none-'));
  assert.deepEqual(lower(compiledPaths(['test'], root)), lower([root]));
});

// The demo layout: an outer workspace (app) that excludes `inner/`, a second workspace holding x -> z and y; app depends on x and y.
function twoWorkspaces() {
  const root = mkdtempSync(join(tmpdir(), 'csd-two-'));
  const crate = (dir, name, deps) => {
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'src', 'lib.rs'), '');
    writeFileSync(join(dir, 'Cargo.toml'), `[package]\nname = "${name}"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n${deps.map(([d, path]) => `${d} = { path = "${path}" }`).join('\n')}\n`);
  };
  writeFileSync(join(root, 'Cargo.toml'), '[workspace]\nresolver = "2"\nmembers = ["app"]\nexclude = ["inner"]\n');
  mkdirSync(join(root, 'inner'), { recursive: true });
  writeFileSync(join(root, 'inner', 'Cargo.toml'), '[workspace]\nresolver = "2"\nmembers = ["x", "y", "z"]\n');
  crate(join(root, 'app'), 'app', [['x', '../inner/x'], ['y', '../inner/y']]);
  crate(join(root, 'inner', 'x'), 'x', [['z', '../z']]);
  crate(join(root, 'inner', 'y'), 'y', []);
  crate(join(root, 'inner', 'z'), 'z', []);
  return root;
}

test('KIT-T1147: -p on a package outside the outer workspace\'s members holds that package and its dependencies, never a sibling', () => {
  const root = twoWorkspaces();
  const { scope, via, reason } = compiledScope(['test', '-p', 'x', '--lib'], root);
  for (const want of ['inner/x/src/lib.rs', 'inner/z/src/lib.rs']) assert.ok(covers(scope, join(root, want)), want);
  for (const not of ['inner/y/src/lib.rs', 'app/src/lib.rs']) assert.ok(!covers(scope, join(root, not)), `${not} is not compiled by -p x`);
  assert.equal(reason, '');
  assert.equal(scopeVia(join(root, 'inner/z/src/lib.rs'), via), 'x -> z');
  assert.equal(scopeVia(join(root, 'inner/x/src/lib.rs'), via), 'x');
  assert.ok(covers(compiledPaths(['test', '-p', 'app'], root), join(root, 'inner/y/src/lib.rs')), 'negative control: building app holds y');
});

test('KIT-T1147: --manifest-path and -C point the metadata read at the other workspace', () => {
  const root = twoWorkspaces();
  for (const args of [['test', '--manifest-path', join(root, 'inner', 'Cargo.toml'), '-p', 'x'], ['test', '-C', 'inner', '-p', 'x']]) {
    const scope = compiledPaths(args, root);
    assert.ok(covers(scope, join(root, 'inner/z/src/lib.rs')) && !covers(scope, join(root, 'inner/y/src/lib.rs')), args.join(' '));
  }
});

test('KIT-T1147: a -p name outside the graph holds every member and says so; unreadable metadata holds the directory and says so', () => {
  const root = twoWorkspaces();
  const unknown = compiledScope(['test', '-p', 'nope'], root);
  assert.ok(covers(unknown.scope, join(root, 'app/src/lib.rs')) && covers(unknown.scope, join(root, 'inner/y/src/lib.rs')), 'fail closed: every member and its dependencies');
  assert.match(unknown.reason, /-p nope is not a package of the dependency graph/);
  const broken = compiledScope(['test', '-p', 'x'], root, join(root, process.platform === 'win32' ? 'no-such-cargo.cmd' : 'no-such-cargo'));
  assert.deepEqual(lower(broken.scope), lower([root]));
  assert.match(broken.reason, /cargo metadata failed in/);
  assert.equal(scopeVia(join(root, 'inner/y/src/lib.rs'), broken.via), 'the whole workspace directory');
});

test('KIT-T1147: metadata that fails for every platform is read again for the host triple', () => {
  const root = twoWorkspaces();
  const stubDir = mkdtempSync(join(tmpdir(), 'csd-stub-'));
  const script = join(stubDir, 'stub.mjs');
  writeFileSync(script, `import { spawnSync } from 'node:child_process';\nconst a = process.argv.slice(2);\nif (!a.includes('--filter-platform')) { console.error('failed to download js-sys'); process.exit(101); }\nconst r = spawnSync('cargo', a, { stdio: 'inherit' });\nprocess.exit(r.status ?? 1);\n`);
  const stub = join(stubDir, process.platform === 'win32' ? 'cargo.cmd' : 'cargo');
  writeFileSync(stub, process.platform === 'win32' ? `@node "%~dp0stub.mjs" %*\r\n` : '#!/bin/sh\nexec node "$(dirname "$0")/stub.mjs" "$@"\n', { mode: 0o755 });
  const { scope, reason } = compiledScope(['test', '-p', 'x'], root, stub);
  assert.equal(reason, '');
  assert.ok(covers(scope, join(root, 'inner/z/src/lib.rs')) && !covers(scope, join(root, 'inner/y/src/lib.rs')), 'the platform-filtered read scopes the closure, not the directory');
});

test('a build hold carries the scope and writer it was acquired with', () => {
  const dir = mkdtempSync(join(tmpdir(), 'csd-slots-'));
  process.env.CLAUDE_KIT_BUILD_SLOT_DIR = dir;
  const slot = acquireBuildSlot('cargo test', { jobs: 1, force: true, probes: { physicalCores: () => 8, commitFreeBytes: () => Infinity, gameRunning: () => false }, meta: { scope: ['/x/crates/a'], writer: 'S1|agentA' } });
  const file = readdirSync(dir).find((n) => n.startsWith('slot-'));
  const held = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  slot.release();
  assert.deepEqual([held.scope, held.writer], [['/x/crates/a'], 'S1|agentA']);
});
