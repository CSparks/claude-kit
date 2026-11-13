// commit-gate reads the message a `git commit -F <file>` carries for the ticket citation (KIT-T1097, KIT-T1019).
// Run: node hooks/commit-gate-message-file.test.mjs

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adopted, cleanup, hook, reporter, tmpDir } from './test-harness.mjs';

const { ok, done } = reporter('commit-gate-message-file');

try {
  const target = adopted(true);
  const files = tmpDir('commit-gate-msg-');
  const message = (name, text) => { const path = join(files, name).replace(/\\/g, '/'); writeFileSync(path, text); return path; };
  const cited = message('cited.txt', 'fix the rings (implements KIT-T1097)\n');
  const uncited = message('uncited.txt', 'fix the rings\n');
  const skipped = message('skipped.txt', 'fix the rings [no-log: scratch]\n');
  const spaced = message('my msg.txt', 'fix the rings (implements KIT-T1097)\n');
  const gate = (command) => hook('commit-gate.mjs', { tool_input: { command: `cd ${target} && ${command}` } }, target).code;

  ok('a -F file whose subject cites the ticket passes', gate(`git commit -q -F ${cited}`) === 0);
  ok('--file=<file> and -aF <file> read the same message', gate(`git commit -q --file=${cited}`) === 0 && gate(`git commit -q -aF ${cited}`) === 0);
  ok('a -F file with [no-log: ...] passes', gate(`git commit -q -F ${skipped}`) === 0);
  ok('a quoted path with a space is read', gate(`git commit -q -F "${spaced}"`) === 0);
  ok('an MSYS drive path (/c/...) is read as a Windows path', process.platform !== 'win32' || gate(`git commit -q -F ${cited.replace(/^([A-Za-z]):\//, (_, d) => `/${d.toLowerCase()}/`)}`) === 0);
  ok('control: a -F file with no citation still blocks', gate(`git commit -q -F ${uncited}`) === 2);
  ok('control: a missing -F file with no citation in the command still blocks', gate(`git commit -q -F ${join(files, 'nope.txt').replace(/\\/g, '/')}`) === 2);
  ok('control: -F - with no citation in the command text still blocks', gate('git commit -q -F -') === 2);
  ok('control: a citation in the command text passes beside an uncited file', gate(`git commit -q -m "x (implements KIT-T1097)" -F ${uncited}`) === 0);
  ok('control: -m without a file still blocks when uncited', gate('git commit -q -m "fix the rings"') === 2);

  const dirOf = (path) => path.slice(0, path.lastIndexOf('/'));
  const dir = dirOf(cited);
  const viaVariable = (assign, command, tool = 'Bash') => hook('commit-gate.mjs', { tool_name: tool, tool_input: { command: `${assign}\n${command}` } }, target);
  ok('KIT-T1131: -F "$S/cited.txt" with S assigned on an earlier line passes', viaVariable(`S="${dir}"`, `cd ${target} && git commit -q -F "$S/cited.txt"`).code === 0);
  ok('KIT-T1131: the assignment may share the && chain with cd and the commit', hook('commit-gate.mjs', { tool_input: { command: `cd ${target} && S="${dir}" && git commit -q -F "$S/cited.txt"` } }, target).code === 0);
  ok('KIT-T1131: ${S} braces and an unquoted plain path resolve', hook('commit-gate.mjs', { tool_input: { command: `S=${dir}; cd ${target} && git commit -q -F \${S}/cited.txt` } }, target).code === 0);
  ok('KIT-T1131: a PowerShell $S = ... assignment resolves', viaVariable(`$S = '${dir}'`, `cd ${target}; git commit -q -F "$S/cited.txt"`, 'PowerShell').code === 0);
  ok('KIT-T1131 control: an uncited file reached through a variable still blocks', viaVariable(`S="${dir}"`, `cd ${target} && git commit -q -F "$S/uncited.txt"`).code === 2);
  ok('KIT-T1131 control: a prefix assignment is not visible to its own command', hook('commit-gate.mjs', { tool_input: { command: `cd ${target} && S="${dir}" git commit -q -F "$S/cited.txt"` } }, target).code === 2);
  ok('KIT-T1131 control: a value computed by command substitution stays unresolved', viaVariable(`S="$(echo ${dir})"`, `cd ${target} && git commit -q -F "$S/cited.txt"`).code === 2);
  ok('KIT-T1131 control: a variable assigned twice stays unresolved', viaVariable(`S="${dir}"; S="${dir}/nope"`, `cd ${target} && git commit -q -F "$S/cited.txt"`).code === 2);
  const unresolved = viaVariable('', `cd ${target} && git commit -q -F "$NOWHERE/msg.txt"`);
  ok('KIT-T1131: the block names the -F file it could not read', unresolved.code === 2 && unresolved.out.includes('$NOWHERE/msg.txt') && /could not be read/.test(unresolved.out));
  const readableButUncited = viaVariable('', `cd ${target} && git commit -q -F ${uncited}`);
  ok('KIT-T1131 control: an uncited but readable file blocks without an unreadable-file line', readableButUncited.code === 2 && !/could not be read/.test(readableButUncited.out));
} finally {
  cleanup();
}

done();
