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
} finally {
  cleanup();
}

done();
