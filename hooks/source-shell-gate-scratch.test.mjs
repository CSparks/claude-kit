#!/usr/bin/env node
// source-shell-gate-scratch.test.mjs — KIT-T1345: a heredoc that writes a source-extension file into a gitignored scratch
// folder under target/ is a tool's output, not a hand write, however the command names the folder: a literal path, a `cd`,
// a `mkdir -p … && cd …` into a folder that does not exist yet, or a variable the command assigns as one literal. The same
// shapes aimed at a tracked source folder, an unassigned or reassigned variable and a missing `cd` target stay blocked.
// Run: node hooks/source-shell-gate-scratch.test.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { touchHarness } from './source-shell-gate-touch-harness.mjs';

const { repo, expectPass, expectBlock, finish } = touchHarness();

try {
  writeFileSync(join(repo, '.gitignore'), 'target/\n');
  mkdirSync(join(repo, 'target', 'perf', 'aa-captures'), { recursive: true });
  const root = repo.replace(/\\/g, '/');
  const SCRATCH = 'target/perf/aa-captures';
  const heredoc = (path) => `cat > ${path} <<'EOF'\nprint(1)\nEOF`;

  const PASS = [
    ['a relative path under target', heredoc(`${SCRATCH}/find_apex.py`)],
    ['an absolute path under target', heredoc(`${root}/${SCRATCH}/find_apex.py`)],
    ['a cd into the scratch folder then a bare file name', `cd ${root}/${SCRATCH} && ${heredoc('find_apex.py')}`],
    ['a quoted cd then ./name', `cd "${root}/${SCRATCH}"; ${heredoc('./find_apex.py')}`],
    ['mkdir -p then cd into the new folder', `mkdir -p ${SCRATCH}/new && cd ${SCRATCH}/new && ${heredoc('find_apex.py')}`],
    ['mkdir -p an absolute folder then cd', `mkdir -p ${root}/${SCRATCH}/abs && cd ${root}/${SCRATCH}/abs && ${heredoc('find_apex.py')}`],
    ['a variable holding the scratch folder', `D=${SCRATCH}\n${heredoc('$D/find_apex.py')}`],
    ['a quoted variable holding an absolute scratch folder', `D="${root}/${SCRATCH}"\n${heredoc('"$D/find_apex.py"')}`],
    ['a braced variable', `D=${SCRATCH}; ${heredoc('${D}/find_apex.py')}`],
    ['two scratch scripts', `${heredoc(`${SCRATCH}/a.py`)}\n${heredoc(`${SCRATCH}/b.py`)}`],
  ];
  for (const [name, command] of PASS) expectPass(name, command);

  const BLOCK = [
    ['a heredoc onto a tracked source path', heredoc('crates/x/src/lib.rs')],
    ['a bare source name at the repo root', heredoc('find_apex.py')],
    ['a variable holding a source folder', `D=crates/x/src\n${heredoc('$D/lib.rs')}`],
    ['an unassigned variable', heredoc('$D/find_apex.py')],
    ['a variable assigned twice', `D=${SCRATCH}; D=crates/x/src; ${heredoc('$D/find_apex.py')}`],
    ['a variable assigned behind ||', `true || D=${SCRATCH}; ${heredoc('$D/find_apex.py')}`],
    ['mkdir -p a source folder then cd into it', `mkdir -p crates/x/src && cd crates/x/src && ${heredoc('lib.rs')}`],
    ['mkdir -p a folder that is not ignored', `mkdir -p scratch/out && cd scratch/out && ${heredoc('find_apex.py')}`],
    ['a cd into a folder nothing makes', `cd ${root}/target/perf/never-made && ${heredoc('find_apex.py')}`],
    ['a cd into a folder made after the cd', `cd crates/x && mkdir -p crates/x && ${heredoc('lib.rs')}`],
    ['a command that also edits the ignore file', `cd ${root}/${SCRATCH} && echo x >> .gitignore && ${heredoc('find_apex.py')}`],
    ['a cd through a variable (not followed)', `D=${SCRATCH} && cd $D && ${heredoc('find_apex.py')}`],
  ];
  for (const [name, command] of BLOCK) expectBlock(name, command);
} finally {
  finish();
}
