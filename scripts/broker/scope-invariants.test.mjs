// scope-invariants.test.mjs — the broker is scoped to ONE checkout directory and Cargo only (KIT-D097).
// (a) no broker module builds a lock, queue or state path outside the checkout: a machine-wide
//     location (home dir, temp dir, ~/.claude, an env-var directory) would make checkouts wait on each other.
// (b) the behavioural twin is push-race.test.mjs: two checkouts of one remote land at once, neither waits.
// (c) a checkout without a tracked Cargo.toml is never brokered: the daemon and submit refuse it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { cargoScopeRefusal } from './cargo-scope.mjs';
import { commitOnMain, fixture } from './patchkit.mjs';

const DIR = import.meta.dirname;
const OUTSIDE_CHECKOUT = [/homedir/, /tmpdir/, /['"`]\.claude['"`/]/, /process\.env\.\w*(DIR|PATH|HOME|ROOT|LOCK)\b/, /USERPROFILE|APPDATA|XDG_/];

// Module → why a path outside the checkout is acceptable. Never a lock, queue or state file.
const EXEMPT = {
  'git.mjs': 'scratch log of one pulsing git call, deleted when the call ends',
  'testkit.mjs': 'test support, not a broker module',
};

const brokerModules = () => readdirSync(DIR).filter((f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs') && !(f in EXEMPT));

test('no broker module builds a lock, queue or state path outside the checkout', () => {
  const hits = [];
  for (const f of brokerModules()) {
    readFileSync(join(DIR, f), 'utf8').split('\n').forEach((line, i) => {
      if (/^\s*\/\//.test(line)) return;
      for (const re of OUTSIDE_CHECKOUT) if (re.test(line)) hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 100)}`);
    });
  }
  assert.deepEqual(hits, []);
});

test('negative control: the scan flags a machine-wide lock directory', () => {
  const sample = "const dir = join(homedir(), '.claude', 'broker-push-locks');";
  assert.ok(OUTSIDE_CHECKOUT.some((re) => re.test(sample)));
  assert.ok(OUTSIDE_CHECKOUT.some((re) => re.test('const d = process.env.BROKER_LOCK_DIR;')));
  assert.ok(!OUTSIDE_CHECKOUT.some((re) => re.test("const p = join(cfg.targetDir, 'broker', 'broker.lock');")));
});

const BROKER = join(DIR, 'broker.mjs');
const SUBMIT = join(DIR, 'submit.mjs');
const strictEnv = () => {
  const env = { ...process.env, BROKER_NO_AUTOSTART: '1' };
  delete env.BROKER_ALLOW_NON_CARGO;
  return env;
};

test('a repo with a broker: block and no tracked Cargo.toml is refused by the daemon and by submit', () => {
  const s = fixture();
  try {
    assert.match(cargoScopeRefusal(s.root, {}), /no tracked Cargo\.toml .*Cargo workspaces only/);
    const daemon = spawnSync(process.execPath, [BROKER, '--once', '--root', s.root], { encoding: 'utf8', env: strictEnv(), timeout: 20000 });
    assert.equal(daemon.status, 2, daemon.stderr);
    assert.match(daemon.stderr, /broker: no tracked Cargo\.toml/);
    const submit = spawnSync(process.execPath, [SUBMIT, '--no-patch', '--ticket', 'T-1', '--root', s.root], { encoding: 'utf8', env: strictEnv(), timeout: 20000, input: '' });
    assert.equal(submit.status, 2, submit.stderr);
    assert.match(submit.stderr, /submit: no tracked Cargo\.toml/);
  } finally { s.done(); }
});

test('control: the same checkout with a tracked Cargo.toml is brokered', () => {
  const s = fixture();
  try {
    writeFileSync(join(s.root, '.gitignore'), 'target/\n');
    commitOnMain(s.root, 'Cargo.toml', '[workspace]\nmembers = []\n', 'add workspace');
    assert.equal(cargoScopeRefusal(s.root, {}), null);
    const daemon = spawnSync(process.execPath, [BROKER, '--once', '--root', s.root], { encoding: 'utf8', env: strictEnv(), timeout: 20000 });
    assert.equal(daemon.status, 0, daemon.stderr);
  } finally { s.done(); }
});
