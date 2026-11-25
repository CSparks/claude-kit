// pin-sha and push-pin (KIT-T1363): a commit that moves a submodule pointer names the sha it records, and a superproject
// push is refused while HEAD points a submodule at a commit the submodule's remote lacks.
// Run: node hooks/pin-sha-push.test.mjs

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adopted, cleanup, git, hook, identify, reporter, repo, tmpDir } from './test-harness.mjs';
import { sameCommandAdds } from './lib/commit-files.mjs';
import { addsMayReach } from './lib/pin-reach.mjs';

const { ok, done } = reporter('pin-sha-push');

try {
  const env = { CLAUDE_KIT_TURN_STATE: tmpDir('pin-state-'), CLAUDE_KIT_HOLDERS_DIR: tmpDir('pin-holders-') };
  const bare = tmpDir('pin-bare-');
  git(['init', '-q', '--bare', '-b', 'main'], bare);
  const seed = identify(repo());
  writeFileSync(join(seed, 'lib.rs'), 'pub fn lib() -> u32 { 1 }\n');
  git(['add', '--', 'lib.rs'], seed);
  git(['commit', '-q', '-m', 'seed'], seed);
  git(['push', '-q', bare, 'HEAD:main'], seed);

  const parent = identify(adopted(false));
  writeFileSync(join(parent, '.ai', 'config.yml'), 'uat:\n  default: none\n');
  git(['-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', bare, 'sub'], parent);
  git(['commit', '-q', '-m', 'add the submodule'], parent);
  const sub = identify(join(parent, 'sub'));

  writeFileSync(join(sub, 'lib.rs'), 'pub fn lib() -> u32 { 2 }\n');
  git(['commit', '-q', '-am', 'framework change'], sub);
  const moved = git(['rev-parse', 'HEAD'], sub).trim();
  const short = moved.slice(0, 8);
  const MSG = 'implements KIT-T1363';
  const commit = (command) => hook('commit-gate.mjs', { session_id: 'P1', tool_name: 'Bash', tool_input: { command } }, parent, env);

  const wrong = commit(`git add -- sub && git commit -m "Pin sub to 1234abcd: ${MSG}" -- sub`);
  ok('a pin commit whose message names another sha is refused', wrong.code === 2 && /KIT-T1363/.test(wrong.out) && /id: pin-sha/.test(wrong.out));
  ok('the refusal prints the sha the gitlink records', wrong.out.includes(short) && wrong.out.includes(moved));
  ok('a pin commit naming nothing is refused too', commit(`git add -- sub && git commit -m "Pin the framework: ${MSG}" -- sub`).code === 2);
  ok('a pin commit naming the recorded sha passes', commit(`git add -- sub && git commit -m "Pin sub to ${short}: ${MSG}" -- sub`).code === 0);

  git(['add', '--', 'sub'], parent);
  ok('a staged pin is read from the index: a wrong sha is refused', commit(`git commit -m "Pin sub to 1234abcd: ${MSG}"`).code === 2);
  ok('a staged pin naming the full recorded sha passes', commit(`git commit -m "Pin sub to ${moved}: ${MSG}"`).code === 0);
  git(['commit', '-q', '-m', `Pin sub to ${short}`], parent);

  writeFileSync(join(parent, 'notes.rs'), 'pub fn notes() -> u32 { 1 }\n');
  ok('control: a commit that moves no pointer is unaffected', commit(`git add -- notes.rs && git commit -m "notes: ${MSG}" -- notes.rs`).code === 0);
  git(['add', '--', 'notes.rs'], parent);
  git(['commit', '-q', '-m', 'notes'], parent);

  const push = (dir) => hook('upstream-gate.mjs', { session_id: 'P1', tool_name: 'Bash', tool_input: { command: `git -C "${dir}" push` } }, dir, env);
  const unpushed = push(parent);
  ok('a push whose HEAD points the submodule at a commit its remote lacks is refused', unpushed.code === 2 && /id: push-pin/.test(unpushed.out) && unpushed.out.includes(moved));
  ok('the refusal names the submodule push to do first', /git -C "[^"]*sub" push origin/.test(unpushed.out));

  git(['push', '-q', 'origin', 'HEAD:main'], sub);
  git(['fetch', '-q', 'origin'], sub);
  ok('once the submodule commit is on its remote the push passes', push(parent).code === 0);

  const plain = identify(repo());
  writeFileSync(join(plain, 'a.rs'), 'pub fn a() -> u32 { 1 }\n');
  git(['add', '--', 'a.rs'], plain);
  git(['commit', '-q', '-m', 'a'], plain);
  ok('control: a repo without submodules pushes unaffected', push(plain).code === 0);

  writeFileSync(join(sub, 'lib.rs'), 'pub fn lib() -> u32 { 3 }\n');
  git(['commit', '-q', '-am', 'a later framework change'], sub);
  const unstaged = git(['rev-parse', 'HEAD'], sub).trim();
  ok('setup: the work-tree pointer differs from the index', unstaged !== git(['ls-files', '-s', '--', 'sub'], parent).split(/\s+/)[1]);
  writeFileSync(join(parent, 'more.rs'), 'pub fn more() -> u32 { 1 }\n');
  const variable = (add) => commit(`${add} && git commit -m "more: ${MSG}"`);
  const expansions = ['git add -- "$P/more.rs"', 'git add -- "${DIR}/more.rs"', 'git add -- $P/more.rs', 'git add -- "$P"', 'git add -- "$P/*"',
    'git add -- "$P/sub"', 'git add -- "$D"/../more.rs', 'git add -- "$X"', 'git add -- $(git ls-files -m)'];
  ok('KIT-T1562: the pointer moved only in the work tree and the commit adds plain other files: it passes', variable('git add -- more.rs').code === 0 && variable('git add -- more.rs notes.rs').code === 0);
  ok('a pathspec holding an expansion may reach the pointer: judged by the work tree', expansions.every((add) => variable(add).code === 2));
  ok('a tree-wide add and an add naming the submodule are judged by the work tree', ['git add .', 'git add -A', 'git add -- sub'].every((add) => variable(add).code === 2));
  ok('a glob, magic, ./, .. or absolute pathspec is judged by the work tree',
    ['git add -- "su*"', 'git add -- ":(glob)su*"', 'git add -- ./more.rs', 'git add -- ../x', 'git add -- /abs/more.rs'].every((add) => variable(add).code === 2));
  ok('an add under -C or after a cd is judged by the work tree', ['git -C . add -- more.rs', 'cd . && git add -- more.rs'].every((add) => variable(add).code === 2));
  ok('a failed status call makes the pointer reachable', variable('git add -- ":(bogus)x"').code === 2);
  git(['add', '--', 'sub'], parent);
  ok('a pointer staged in the index is judged from the index when the adds are plain other files: a wrong sha is refused', variable('git add -- more.rs').code === 2);
  git(['reset', '-q', '--', 'sub'], parent);

  const reach = (add, pin = 'a/b/sub') => addsMayReach(`${add} && git commit -m x`, { root: parent, shell: 'bash', cwd: parent }, pin);
  ok('addsMayReach: plain root-relative files that are not the pin, inside it or a parent of it do not reach', !reach('git add -- a/c.rs d.rs') && !reach('git add -- a/b/other.rs') && !reach('git stage -- x.rs'));
  ok('addsMayReach: the pin, a parent directory of it, a path inside it, and . reach', ['git add -- a/b/sub', 'git add -- a/b', 'git add -- a', 'git add -- a/b/sub/x.rs', 'git add -- .'].every((add) => reach(add)));
  ok('addsMayReach: names compare without case', reach('git add -- A/B/SUB'));
  ok('addsMayReach: an expansion, a glob, magic, .., ./, an absolute or drive path reach',
    ['git add -- $D/x', 'git add -- "$X"', 'git add -- "a/*"', 'git add -- ":(glob)a"', 'git add -- ../a', 'git add -- ./a/c.rs', 'git add -- /abs/x', 'git add -- C:/abs/x', 'git add -- "a\\c"'].every((add) => reach(add)));
  ok('addsMayReach: an add from a directory other than the root reaches', addsMayReach('git add -- x.rs && git commit -m x', { root: parent, shell: 'bash', cwd: join(parent, 'sub') }, 'a/b/sub'));
  ok('addsMayReach: a command with no add reaches nothing', !addsMayReach('git commit -m x', { root: parent, shell: 'bash', cwd: parent }, 'a/b/sub'));
  ok('sameCommandAdds: a pathspec holding an expansion still covers the whole tree for the file-set checks', ['git add -- $D/x', 'git add -- "$X"'].every((add) => sameCommandAdds(`${add} && git commit -m x`).includes('.')));
} finally {
  cleanup();
  done();
}
