// commit-foreign credits a file the session wrote through a shell redirect (KIT-T1479): in a later call and in a call whose
// session directory is another repo, each proved by the Post hook's mtime check; the gate credits no command-text redirect, and a
// file the session did not write still blocks. The redirect scan fails closed on control flow it cannot place.
// Run: node hooks/commit-foreign-redirect.test.mjs

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adopted, cleanup, git, hook, identify, reporter, tmpDir } from './test-harness.mjs';
import { redirectedFiles } from './lib/redirect-writes.mjs';

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
  const inline = verdict('S1', sameCall);
  ok('a file the committing command itself creates by redirect is not judged, so it commits without [commit-foreign]', inline.code === 0, inline.out.trim());

  writeFileSync(abs('theirs.patch'), 'theirs\n');
  const theirs = verdict('S1', commitOf('theirs.patch'));
  ok('negative control: a file no session call wrote still blocks and is named', theirs.code === 2 && theirs.out.includes('theirs.patch'), theirs.out.trim());

  shellCall('S2', 'c3', `git -C ${target} diff > ${abs('s2.patch')}`, target, () => writeFileSync(abs('s2.patch'), 'diff\n'));
  const other = verdict('S1', commitOf('s2.patch'));
  ok("negative control: a file another session's redirect wrote still blocks", other.code === 2 && other.out.includes('s2.patch'), other.out.trim());

  const commitIn = (rel) => `git -C ${target} commit -m "${MSG}" -- ${rel}`;
  const diffTo = (rel) => `git -C ${target} diff > ${abs(rel)}`;
  const rejected = [
    ['an append (>>) is no write of the file', 'append.patch', (f) => `echo x >> ${abs(f)} && ${commitIn(f)}`],
    ['a redirect on the right of || may never run', 'or.patch', (f) => `false || ${diffTo(f)} && ${commitIn(f)}`],
    ['a redirect behind a && that fails is skipped while a ; commit still runs', 'skip.patch', (f) => `false && ${diffTo(f)} ; ${commitIn(f)}`],
    ['a redirect inside quotes is text', 'quoted.patch', (f) => `echo "a > ${abs(f)}" && ${commitIn(f)}`],
    ['a redirect in a heredoc body is text', 'heredoc.patch', (f) => `cat <<EOF\nx > ${abs(f)}\nEOF\n${commitIn(f)}`],
    ['a redirect in a comment is text', 'comment.patch', (f) => `echo hi # > ${abs(f)}\n${commitIn(f)}`],
    ['a redirect on the commit command itself runs after the gate', 'commit.patch', (f) => `${commitIn(f)} > ${abs(f)}`],
    ['a redirect after the commit runs after the gate', 'after.patch', (f) => `${commitIn(f)} && ${diffTo(f)}`],
  ];
  for (const [what, file, build] of rejected) {
    writeFileSync(abs(file), 'foreign\n');
    const result = verdict('S1', build(file));
    ok(`negative control: ${what}, so the path stays foreign`, result.code === 2 && result.out.includes(file), result.out.trim());
  }

  writeFileSync(abs('stale.patch'), 'foreign\n');
  const stale = verdict('S1', `${diffTo('stale.patch')} ; ${commitIn('stale.patch')}`);
  ok('negative control: an existing file the commit\'s own command overwrites is not credited at the gate (the redirect has not run, so no mtime can prove it)', stale.code === 2 && stale.out.includes('stale.patch'), stale.out.trim());

  writeFileSync(abs('untouched.patch'), 'foreign\n');
  await sleep(CLOCK_GAP_MS);
  shellCall('S1', 'c4', `git -C ${target} diff > ${abs('untouched.patch')} ; false`, elsewhere, () => {});
  const untouched = verdict('S1', commitOf('untouched.patch'));
  ok('negative control: a redirect target whose mtime is older than the call is not credited by the Post hook', untouched.code === 2 && untouched.out.includes('untouched.patch'), untouched.out.trim());

  const flow = (command) => redirectedFiles(command, { start: target, shell: 'bash' });
  const out = abs('flow.patch');
  const control = flow(`git diff > ${out}`);
  ok('lib control: a plain > in a simple command is read', control.length === 1 && control[0].endsWith('flow.patch'), control.join());
  const shapes = {
    'an if-block': `if true; then git diff > ${out}; fi`,
    'a brace group': `{ git diff > ${out}; }`,
    'a subshell': `(git diff > ${out})`,
    'a function definition': `f() { git diff > ${out}; }; f`,
    'an escaped >': `echo a \\> ${out}`,
    'a [[ ]] comparison': `[[ a > ${out} ]] && true`,
    'a (( )) comparison': `(( a > b )) && git diff`,
    'a while loop': `while true; do git diff > ${out}; done`,
    'an append': `echo x >> ${out}`,
    'a redirect after ||': `false || git diff > ${out}`,
    'a redirect in quotes': `echo "x > ${out}"`,
    'a redirect in a heredoc': `cat <<EOF\nx > ${out}\nEOF`,
    'a redirect in a comment': `echo hi # > ${out}`,
  };
  for (const [what, command] of Object.entries(shapes)) ok(`lib negative control: ${what} credits no file`, flow(command).length === 0, flow(command).join());

  const unrelated = verdict('S1', `git -C ${target} diff > ${abs('scratch.out')} && git -C ${target} commit -m "${MSG}" -- theirs.patch`);
  ok('negative control: a redirect elsewhere in the command does not clear a foreign path of the commit', unrelated.code === 2 && unrelated.out.includes('theirs.patch'), unrelated.out.trim());
} finally {
  cleanup();
}

done();
