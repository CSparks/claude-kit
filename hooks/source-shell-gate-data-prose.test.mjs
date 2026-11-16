// source-shell-gate-data-prose (KIT-T1308): the quoted text of a command that takes prose as data (`t notes`, `git commit -m`)
// never names the environment to the git-call policy. A note saying "(local, not pushed)" before a later `git add` is no
// `local` declaration; a real export or declaration in front of a git call, and a command substitution inside the note, still are.
// Run: node hooks/source-shell-gate-data-prose.test.mjs

import { shellSourceWrites } from './lib/shell-source-write.mjs';

let fails = 0;
let passes = 0;
const check = (name, cond) => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name}`); }
};
const hits = (command) => shellSourceWrites(command, { shell: 'bash' });

const NOTE = 't notes RDG-T072 "built, framework commit 0e37abf9 (local, not pushed, not pinned).\n\nHandoff: run \'cargo test -p x\' once." 2>&1 | tail -3';
const TAIL = 'git add docs/perf/a.md docs/perf/b.md && git status --short | head -3';

check('the incident: a note with "(local, ..." then git add and git status is not a sweep', hits(`${NOTE}; ${TAIL}`).length === 0);
check('a commit message naming export or declare before a later git call is not a sweep', hits('git commit -m "export the helper (declare it local)" -- a.md ; git status').length === 0);
check('control: an export in its own segment before a git call is still a sweep', hits('t notes X "ok"; export A=1; git pull origin main').length > 0);
check('control: local with a flag in front of git, outside quotes, is still a sweep', hits('t notes X "ok"; local -x A=1; git status --short').length > 0);
check('control: an export inside a command substitution in the note still counts', hits('t notes X "$(export A=1; git pull origin main)"').length > 0);
check('control: a plain export in front of git without any note is still a sweep', hits('export A=1; git pull origin main').length > 0);

console.log(`\nsource-shell-gate-data-prose: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
