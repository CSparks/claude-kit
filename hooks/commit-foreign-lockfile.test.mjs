// commit-foreign counts a Cargo.lock cargo regenerated for a crate the session wrote as the session's own (KIT-T1250): the
// shell call that ran cargo may sit in another repo's cwd, so no shell hook credited the lock. A lock beside no manifest
// of the session stays foreign, and so does a foreign source file beside it. Run: node hooks/commit-foreign-lockfile.test.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { adopted, cleanup, git, hook, identify, reporter, tmpDir } from './test-harness.mjs';

const { ok, done } = reporter('commit-foreign-lockfile');

try {
  const env = { CLAUDE_KIT_TURN_STATE: tmpDir('commit-lockfile-state-') };
  const target = identify(adopted(false));
  const abs = (rel) => join(target, rel);
  const put = (rel, text) => { mkdirSync(dirname(abs(rel)), { recursive: true }); writeFileSync(abs(rel), text); };
  const toolPayload = (rel, session, text) => ({ session_id: session, tool_input: { file_path: abs(rel), content: text } });
  const written = (rel, text, session) => {
    put(rel, text);
    hook('pre-write.mjs', toolPayload(rel, session, text), target, env);
    hook('tool-write-record.mjs', toolPayload(rel, session, text), target, env);
  };
  const verdict = (session, paths) => hook('commit-gate.mjs', { session_id: session, tool_input: { command: `git -C ${target} add -- ${paths.join(' ')} && git -C ${target} commit -m "implements KIT-T1250" -- ${paths.join(' ')}` } }, target, env);
  const manifest = (name) => `[package]\nname = "${name}"\nversion = "0.1.0"\n`;
  const lock = (n) => `# generated\nversion = ${n}\n`;

  written('src/anchor.rs', 'pub fn a() {}\n', 'S1');
  git(['add', '--', 'src/anchor.rs'], target);
  git(['commit', '-q', '-m', 'anchor'], target);

  written('crates/mine/Cargo.toml', manifest('mine'), 'S1');
  written('crates/mine/src/lib.rs', 'pub fn m() {}\n', 'S1');
  put('Cargo.lock', lock(1));
  const own = verdict('S1', ['Cargo.lock', 'crates/mine/Cargo.toml', 'crates/mine/src/lib.rs']);
  ok('a root Cargo.lock beside a crate the session wrote is the session\'s own', own.code === 0, own.out.trim());

  written('src/other.rs', 'pub fn o() {}\n', 'S2');
  written('tools/x.rs', 'pub fn x() {}\n', 'S3');
  const noManifest = verdict('S3', ['Cargo.lock', 'tools/x.rs']);
  ok('negative control: a Cargo.lock with no manifest of the session stays foreign', noManifest.code === 2 && noManifest.out.includes('Cargo.lock'), noManifest.out.trim());

  put('crates/theirs.rs', 'pub fn t() {}\n');
  const withForeign = verdict('S1', ['Cargo.lock', 'crates/mine/Cargo.toml', 'crates/theirs.rs']);
  ok('negative control: a foreign source file beside the own lock is still refused, the lock is not named', withForeign.code === 2 && withForeign.out.includes('crates/theirs.rs') && !withForeign.out.includes('  Cargo.lock'), withForeign.out.trim());

  written('rust/crates/member/Cargo.toml', manifest('member'), 'S4');
  put('rust/Cargo.lock', lock(2));
  const nested = verdict('S4', ['rust/Cargo.lock', 'rust/crates/member/Cargo.toml']);
  ok('a lock in a workspace directory beside a member the session wrote is its own', nested.code === 0, nested.out.trim());

  written('other/Cargo.toml', manifest('elsewhere'), 'S5');
  written('rust2/src/lib.rs', 'pub fn r() {}\n', 'S5');
  put('rust2/Cargo.lock', lock(3));
  const elsewhere = verdict('S5', ['rust2/Cargo.lock', 'rust2/src/lib.rs']);
  ok('negative control: a manifest in another directory credits no lock', elsewhere.code === 2 && elsewhere.out.includes('rust2/Cargo.lock'), elsewhere.out.trim());

  put('cargo.lock.bak', 'x\n');
  put('notes/Cargo.lockfile', 'x\n');
  written('notes/Cargo.toml', manifest('notes'), 'S6');
  written('notes/ok.rs', 'pub fn k() {}\n', 'S6');
  const lookalike = verdict('S6', ['notes/Cargo.lockfile', 'notes/ok.rs']);
  ok('negative control: a file merely named like a lock is not the lock', lookalike.code === 2 && lookalike.out.includes('notes/Cargo.lockfile'), lookalike.out.trim());
} finally {
  cleanup();
}
done();
