#!/usr/bin/env node
// source-shell-gate-touch-segments.test.mjs — the other segments of a command with a touch stay judged: a write, a move, a
// delete or a directory change around the touch cancels the lift (KIT-T1088), and a plain cd into an existing directory
// before it keeps it. Split from source-shell-gate-touch.test.mjs so each suite finishes inside one foreground call (KIT-T1271).
// Run: node hooks/source-shell-gate-touch-segments.test.mjs

import { touchHarness } from './source-shell-gate-touch-harness.mjs';

const { scratch, expectPass, expectBlock, check, passes_, finish } = touchHarness();

try {
  const SEGMENTS = [
    ['a second segment redirects into the touched file', 'touch src/a.cpp && echo x > src/a.cpp'],
    ['a second segment appends to the touched file', 'touch src/a.cpp; echo x >> src/a.cpp'],
    ['a second segment of tee', 'touch src/a.cpp && echo x | tee src/a.cpp'],
    ['a second segment of sed -i', "touch src/a.cpp && sed -i 's/x/y/' src/a.cpp"],
    ['-c does not lift a following write', 'touch -c src/a.cpp && echo x > src/a.cpp'],
    ['a write before the touch', 'echo x > src/a.cpp && touch src/a.cpp'],
    ['a second touch that creates', 'touch src/a.cpp && touch src/new.cpp'],
    ['a copy before the touch moves the file away', `mv src/a.cpp ${scratch} && touch src/a.cpp`],
    ['touch of a file the command deletes', 'rm src/a.cpp && touch src/a.cpp'],
    ['a move with a differently spelled path before the touch', `mv ./src/a.cpp ${scratch} && touch src/a.cpp`],
    ['a directory removed and recreated before the touch', 'rm -rf src && mkdir src && touch src/a.cpp'],
    ['git rm before the touch', 'git rm src/a.cpp && touch src/a.cpp'],
    ['a substitution that deletes, before the touch', 'echo $(rm src/a.cpp) && touch src/a.cpp'],
    ['a backtick substitution that deletes, before the touch', 'echo `find src -delete` && touch src/a.cpp'],
    ['a find -delete substitution in an assignment, before the touch', 'D=$(find src -delete) && touch src/a.cpp'],
    ['an assignment that deletes, before the touch', 'D=$(rm -rf src) && touch src/a.cpp'],
    ['a directory change after the touch', 'touch src/a.cpp && cd lib'],
    ['a pushd before the touch', 'pushd lib && touch src/a.cpp'],
    ['a pipeline before the touch', 'echo x | xargs rm && touch src/a.cpp'],
  ];
  for (const [name, command] of SEGMENTS) expectBlock(name, command);

  const PS = 'PowerShell';
  const CD_PASS = [
    ['cd into an existing directory then the touch', 'cd src && touch a.cpp'],
    ['cd with a semicolon', 'cd src; touch a.cpp'],
    ['a quoted literal directory', 'cd "src" && touch a.cpp'],
    ['a dot-relative directory', 'cd ./src && touch a.cpp'],
    ['two cds into nested directories', 'cd src && cd state && touch AppState.h'],
    ['cd under PowerShell', 'cd src; touch a.cpp', PS],
    ['an unrelated assignment before the cd', 'D=1 && cd src && touch a.cpp'],
    ['a directory name that a CDPATH assignment would redirect', 'cd lib && touch only.h'],
  ];
  for (const [name, command, tool] of CD_PASS) expectPass(name, command, tool);

  check('the move alone still passes', passes_(`mv src/b.cpp ${scratch}`));
  check('two touches of the same existing file pass', passes_('touch src/a.cpp && touch src/a.cpp'));
} finally {
  finish();
}
