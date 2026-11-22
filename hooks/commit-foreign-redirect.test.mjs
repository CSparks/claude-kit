// commit-foreign credits a file the session wrote through a shell redirect (KIT-T1479): in a later call, in a call whose
// session directory is another repo, and in the same command that commits it; a file the session did not write still blocks.
// Run: node hooks/commit-foreign-redirect.test.mjs

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adopted, cleanup, git, hook, identify, reporter, tmpDir } from './test-harness.mjs';

const { ok, done } = reporter('commit-foreign-redirect');
const CLOCK_GAP_MS = 300;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  const env = { CLAUDE_KIT_TURN_STATE: tmpDir('commit-redirect-state-') };
  const target = identify(adopted(false));
  const elsewhere = identify(adopted(false));
  const abs = (rel) => join(target, rel);
  const MSG = 'implements KIT-T1479';
  const verdict = (session, command) => hook('commit-gate.mjs', { session_id: session, tool_input: { command } }, target, env);
  const commitOf = (rel) => `git -C ${target} commit -m "${MSG}" -- ${rel}`;

  writeFileSync(abs('seed.js'), 'export const s = 0;\n');
  hook('pre-write.mjs', { session_id: 'S1', tool_input: { file_path: abs('seed.js'), content: 'export const s = 0;\n' } }, target, env);
  git(['add', 'seed.js'], target);
  git(['commit', '-q', '-m', 'seed'], target);
  await sleep(CLOCK_GAP_MS);

  const shellCall = (session, id, command, cwd, action) => {
    const input = { session_id: session, tool_use_id: id, tool_input: { command } };
    hook('shell-writes.mjs', { ...input, hook_event_name: 'PreToolUse', cwd }, cwd, env);
    action();
    hook('shell-writes.mjs', { ...input, hook_event_name: 'PostToolUse', cwd, tool_response: {} }, cwd, env);
  };

  shellCall('S1', 'c1', `git -C ${target} diff > ${abs('own.patch')}`, target, () => writeFileSync(abs('own.patch'), 'diff\n'));
  const own = verdict('S1', commitOf('own.patch'));
  ok('a file a redirect wrote in an earlier call of this session commits without [commit-foreign]', own.code === 0, own.out.trim());

  shellCall('S1', 'c2', `git -C ${target} diff > ${abs('away.patch')}`, elsewhere, () => writeFileSync(abs('away.patch'), 'diff\n'));
  const away = verdict('S1', commitOf('away.patch'));
  ok('a redirect into this repo from a call whose session directory is another repo is still the session\'s own', away.code === 0, away.out.trim());

  const sameCall = `git -C ${target} diff > ${abs('inline.patch')} && git -C ${target} add inline.patch && git -C ${target} commit -m "${MSG}" -- inline.patch`;
  writeFileSync(abs('inline.patch'), 'old\n');
  const inline = verdict('S1', sameCall);
  ok('a file the committing command itself redirects into is the session\'s own', inline.code === 0, inline.out.trim());

  writeFileSync(abs('theirs.patch'), 'theirs\n');
  const theirs = verdict('S1', commitOf('theirs.patch'));
  ok('negative control: a file no session call wrote still blocks and is named', theirs.code === 2 && theirs.out.includes('theirs.patch'), theirs.out.trim());

  shellCall('S2', 'c3', `git -C ${target} diff > ${abs('s2.patch')}`, target, () => writeFileSync(abs('s2.patch'), 'diff\n'));
  const other = verdict('S1', commitOf('s2.patch'));
  ok("negative control: a file another session's redirect wrote still blocks", other.code === 2 && other.out.includes('s2.patch'), other.out.trim());

  const unrelated = verdict('S1', `git -C ${target} diff > ${abs('scratch.out')} && git -C ${target} commit -m "${MSG}" -- theirs.patch`);
  ok('negative control: a redirect elsewhere in the command does not clear a foreign path of the commit', unrelated.code === 2 && unrelated.out.includes('theirs.patch'), unrelated.out.trim());
} finally {
  cleanup();
}

done();
