// pin-sha and push-pin (KIT-T1363): a commit that moves a submodule pointer names the sha it records, and a superproject
// push is refused while HEAD points a submodule at a commit the submodule's remote lacks.
// Run: node hooks/pin-sha-push.test.mjs

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adopted, cleanup, git, hook, identify, reporter, repo, tmpDir } from './test-harness.mjs';
import { addsReach } from './lib/commit-files.mjs';

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
  ok('a double-quoted variable path with a file tail cannot stage the pointer: the unstaged pointer is not judged', variable('git add -- "$P/more.rs"').code === 0);
  ok('a braced double-quoted variable with a file tail passes the same way', variable('git add -- "${DIR}/more.rs"').code === 0);
  ok('a quoted variable path whose tail names the submodule is judged by the work tree', variable('git add -- "$P/sub"').code === 2);
  ok('an unquoted variable path may split or glob into anything: judged by the work tree', variable('git add -- $P/more.rs').code === 2);
  ok('a bare variable path may be anything: judged by the work tree', variable('git add -- "$P"').code === 2);
  ok('a variable path with a glob tail may be anything: judged by the work tree', variable('git add -- "$P/*"').code === 2);
  ok('a command substitution path may be anything: judged by the work tree', variable('git add -- $(git ls-files -m)').code === 2);
  ok('a tree-wide add stages the pointer: judged by the work tree', variable('git add .').code === 2);
  ok('a literal add of other files leaves the unstaged pointer alone', variable('git add -- more.rs').code === 0);

  const reach = (add, path = 'rapid-game') => addsReach(`${add} && git commit -m x`, path);
  ok('addsReach: a quoted variable then a file name reaches only a path that ends with it', !reach('git add -- "$D/x"') && reach('git add -- "$D/rapid-game"') && reach('git add -- "$D/rapid-game"', 'a/rapid-game'));
  ok('addsReach: a tail with .. fails closed', reach('git add -- "$D"/../other') && reach('git add -- "$D/../other"') && reach('git add -- "$D/./other"'));
  ok('addsReach: an unquoted expansion fails closed', reach('git add -- $D/x') && reach('git add -- ${D}/x'));
  ok('addsReach: pathspec magic, a backslash and a glob fail closed', reach('git add -- ":(glob)x/*.rs"') && reach('git add -- ":!x"') && reach('git add -- "$D\\x"') && reach('git add -- "$D/x*"'));
  ok('addsReach: a literal pathspec names the path or a parent of it, else it is not reached', reach('git add -- rapid-game') && reach('git add -- a', 'a/b') && !reach('git add -- other') && !reach('git add -- other/rapid-game'));
  ok('addsReach: a literal pathspec with .., ./ or an absolute start fails closed', reach('git add -- ../x') && reach('git add -- ./other') && reach('git add -- /abs/other') && reach('git add -- C:/abs/other'));
  ok('addsReach: names compare without case, as a case-insensitive checkout does', reach('git add -- "$D/Rapid-Game"') && reach('git add -- Rapid-Game'));
} finally {
  cleanup();
  done();
}
