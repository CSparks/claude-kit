// The commit-log check reads the message a commit WILL carry (KIT-T1354, KIT-T1019): `--amend` with no new message keeps
// the HEAD message, `-C <rev>` / `--reuse-message <rev>` take that commit's message, `-F <file>` the file, `-m` the text.
// Run: node hooks/commit-gate-reused-message.test.mjs

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, git, hook, project, reporter } from './test-harness.mjs';

const { ok, done } = reporter('commit-gate-reused-message');

try {
  const dir = project('none', 'KIT');
  const code = join(dir, 'code.js');
  let n = 0;
  const commitWith = (message) => {
    writeFileSync(code, `export const x = ${++n};\n`);
    git(['add', '--', 'code.js'], dir);
    git(['commit', '-q', '-m', message], dir);
  };
  const stageChange = () => {
    writeFileSync(code, `export const x = ${++n};\n`);
    git(['add', '--', 'code.js'], dir);
  };
  const verdict = (args) => hook('commit-gate.mjs', { tool_input: { command: `git -C "${dir}" commit ${args}` } }, dir);
  const refused = (r) => r.code === 2 && /no ticket citation|does not touch the plan-of-record/.test(r.out);

  commitWith('implements KIT-T1354');
  stageChange();
  const cited = verdict('--amend --no-edit');
  ok('an amend that keeps a cited HEAD message passes', cited.code === 0, cited.out.trim());
  const reused = verdict('-C HEAD');
  ok('-C HEAD reuses the cited message and passes', reused.code === 0, reused.out.trim());
  const reusedLong = verdict('--reuse-message=HEAD');
  ok('--reuse-message=HEAD passes', reusedLong.code === 0, reusedLong.out.trim());
  const replaced = verdict('--amend -m "tidy"');
  ok('negative control: an amend with a new uncited -m message is refused although HEAD cited', refused(replaced), replaced.out.trim());

  git(['commit', '-q', '--amend', '--no-edit'], dir);
  commitWith('tidy');
  stageChange();
  const uncited = verdict('--amend --no-edit');
  ok('negative control: an amend that keeps an uncited HEAD message is refused', refused(uncited), uncited.out.trim());
  const uncitedReuse = verdict('-C HEAD');
  ok('negative control: -C HEAD of an uncited commit is refused', refused(uncitedReuse), uncitedReuse.out.trim());

  const message = join(dir, '..', `msg-${Date.now()}.txt`);
  writeFileSync(message, 'implements KIT-T1019\n');
  const file = verdict(`--amend -F "${message}"`);
  ok('an amend with a cited -F file passes', file.code === 0, file.out.trim());
  const text = verdict('--amend -m "implements KIT-T1354"');
  ok('an amend with a cited -m text passes', text.code === 0, text.out.trim());
} finally {
  cleanup();
  done();
}
