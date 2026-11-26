// push-drift (KIT-T1447): a push of a repo whose checked-out submodule is not at the commit HEAD records is refused, naming
// the order: submodule push (exact sha), pin commit, then this push. Main thread and subagents alike.
// Run: node hooks/push-drift.test.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adopted, cleanup, git, hook, identify, reporter, repo, tmpDir } from './test-harness.mjs';

const { ok, done } = reporter('push-drift');

try {
  const env = { CLAUDE_KIT_TURN_STATE: tmpDir('drift-state-'), CLAUDE_KIT_HOLDERS_DIR: tmpDir('drift-holders-') };
  const bare = tmpDir('drift-bare-');
  git(['init', '-q', '--bare', '-b', 'main'], bare);
  const seed = identify(repo());
  writeFileSync(join(seed, 'lib.rs'), 'pub fn lib() -> u32 { 1 }\n');
  git(['add', '--', 'lib.rs'], seed);
  git(['commit', '-q', '-m', 'seed'], seed);
  git(['push', '-q', bare, 'HEAD:main'], seed);

  const parent = identify(adopted(false));
  git(['-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', bare, 'sub'], parent);
  git(['commit', '-q', '-m', 'add the submodule'], parent);
  const sub = identify(join(parent, 'sub'));
  const base = git(['rev-parse', 'HEAD'], sub).trim();
  git(['fetch', '-q', 'origin'], sub);

  const gate = (command, cwd = parent, extra = {}) => hook('upstream-gate.mjs', { session_id: 'D1', tool_name: 'Bash', tool_input: { command }, ...extra }, cwd, env);
  const push = (cwd = parent) => gate(`git -C "${parent}" push`, cwd);
  const commitInSub = (n) => {
    writeFileSync(join(sub, 'lib.rs'), `pub fn lib() -> u32 { ${n} }\n`);
    git(['commit', '-q', '-am', `framework change ${n}`], sub);
    return git(['rev-parse', 'HEAD'], sub).trim();
  };

  ok('control: a pointer that matches the checkout passes', push().code === 0);

  const ahead = commitInSub(2);
  const aheadBlock = push();
  ok('a checkout ahead of an unpushed pointer is refused with the check id and the triage line', aheadBlock.code === 2 && aheadBlock.out.includes('id: push-drift') && aheadBlock.out.includes('BLOCK TRIAGE') && aheadBlock.out.includes('.claude-kit-ignore.yaml'));
  ok('the block names the recorded and the checked-out sha in full', aheadBlock.out.includes(base) && aheadBlock.out.includes(ahead) && aheadBlock.out.includes('unpushed work'));
  const subPush = aheadBlock.out.indexOf(`push origin ${ahead}:main`);
  const pinCommit = aheadBlock.out.indexOf('commit -m "Pin sub to');
  ok('the order is submodule push (exact sha), then the pin commit, then push again', subPush > 0 && pinCommit > subPush && aheadBlock.out.indexOf('push this repo again') > pinCommit);
  ok('a bare git push from inside the repo is refused too', gate('git push', parent).code === 2);
  ok('the git -C form from another directory is refused', gate(`git -C "${parent}" push origin main`, tmpDir('drift-away-')).code === 2);
  ok('a subagent push is refused as the main thread is', gate(`git -C "${parent}" push`, parent, { agent_id: 'sub1' }).code === 2);
  ok('a push after a cd is refused', gate(`cd "${parent}" && git push origin main`, tmpDir('drift-cd-')).code === 2);

  // KIT-T1601: the pushed repo is the one the command's last Set-Location, cd or pushd reached, never the session's cwd.
  const clean = identify(repo());
  writeFileSync(join(clean, 'c.rs'), 'pub fn c() -> u32 { 1 }\n');
  git(['add', '--', 'c.rs'], clean);
  git(['commit', '-q', '-m', 'c'], clean);
  const ps = (command, cwd) => gate(command, cwd, { tool_name: 'PowerShell' });
  ok('KIT-T1601: a push after Set-Location into a clean repo is judged there, not in the drifted session cwd', ps(`Set-Location "${clean}"; git status; git push origin main`, parent).code === 0);
  ok('KIT-T1601: a push after Set-Location into the drifted repo from a clean cwd is refused', ps(`Set-Location "${parent}"; git push origin main`, clean).code === 2);
  ok('KIT-T1601: set-location -Path, in any case, is followed', ps(`set-location -Path "${parent}"; git push`, clean).code === 2);
  ok('KIT-T1601: a push after pushd into the drifted repo is refused', gate(`pushd "${parent}" && git push`, clean).code === 2);
  ok('KIT-T1601: popd returns to the directory before pushd', gate(`pushd "${parent}" && popd && git push`, clean).code === 0);
  ok('KIT-T1601: Push-Location then Pop-Location return too', ps(`Push-Location "${parent}"; Pop-Location; git push`, clean).code === 0);
  ok('KIT-T1601: git -C names the pushed repo whatever the location before it', ps(`Set-Location "${clean}"; git -C "${parent}" push`, clean).code === 2);

  git(['push', '-q', 'origin', 'HEAD:main'], sub);
  git(['fetch', '-q', 'origin'], sub);
  const pushedDrift = push();
  ok('an uncommitted pointer to a pushed commit is still refused', pushedDrift.code === 2 && /pushed commit the pointer does not name/.test(pushedDrift.out));
  ok('with the submodule already pushed the steps start with the pin commit', !pushedDrift.out.includes('push the submodule first') && /1\. commit the pin/.test(pushedDrift.out));

  git(['add', '--', 'sub'], parent);
  ok('a staged but uncommitted pointer is still refused', push().code === 2);
  git(['commit', '-q', '-m', `Pin sub to ${ahead.slice(0, 8)}`], parent);
  ok('the pin committed to the pushed sha passes', push().code === 0);

  git(['checkout', '-q', base], sub);
  const behind = push();
  ok('a checkout behind the recorded pointer is refused with the restoring command', behind.code === 2 && /submodule update -- sub/.test(behind.out) && /BEHIND/.test(behind.out));
  git(['checkout', '-q', 'main'], sub);
  ok('control: back at the recorded commit it passes', push().code === 0);

  commitInSub(3);
  ok('unpushed work again blocks', push().code === 2);
  const ignoreFile = join(parent, '.claude-kit-ignore.yaml');
  writeFileSync(ignoreFile, 'wait-poll:\n  - sub\n');
  ok('an exclusion of another check does not lift it', push().code === 2);
  writeFileSync(ignoreFile, 'push-drift:\n  - sub\n');
  ok('negative control: the check excluded for the submodule path lets the push through', push().code === 0);
  writeFileSync(ignoreFile, 'push-drift:\n  - other/**\n');
  ok('an exclusion of another path does not lift it', push().code === 2);
  writeFileSync(ignoreFile, '');
  ok('the trailing marker in the command lifts it', gate(`git -C "${parent}" push # claude-kit-ignore push-drift`).code === 0);

  const plain = identify(repo());
  writeFileSync(join(plain, 'a.rs'), 'pub fn a() -> u32 { 1 }\n');
  git(['add', '--', 'a.rs'], plain);
  git(['commit', '-q', '-m', 'a'], plain);
  ok('control: a repo without a submodule pushes unaffected', gate('git push', plain).code === 0);
  ok('malformed stdin fails open', hook('upstream-gate.mjs', 'not an object', parent, env).code === 0);
  ok('the gate is still wired for Bash and PowerShell', (() => {
    const wiring = JSON.parse(readFileSync(join(import.meta.dirname, 'hooks.json'), 'utf8'));
    const entry = wiring.hooks.PreToolUse.find((e) => e.hooks.some((h) => h.command.includes('upstream-gate')));
    return !!entry && /\bBash\b/.test(entry.matcher) && /\bPowerShell\b/.test(entry.matcher);
  })());
} finally {
  cleanup();
  done();
}
