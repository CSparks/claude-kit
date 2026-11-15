#!/usr/bin/env node
// source-shell-gate-touch.test.mjs — a `touch` that only stamps the mtime of an existing source file authors no
// content and passes (KIT-T1088); creating a source file, a glob, an unresolved variable, any other option and every
// other segment of the command stay judged as today. This file judges the touch forms themselves; the segments around a
// touch are source-shell-gate-touch-segments.test.mjs and the `cd` forms source-shell-gate-touch-cd.test.mjs, split so
// each finishes inside one foreground call (KIT-T1271).
// Run: node hooks/source-shell-gate-touch.test.mjs

import { join } from 'node:path';
import { touchHarness } from './source-shell-gate-touch-harness.mjs';

const { repo, scratch, expectPass, expectBlock, finish } = touchHarness();

try {
  const PASS = [
    ['the ticket command', 'touch src/state/AppState.h'],
    ['the ticket command under PowerShell', 'touch src/state/AppState.h', 'PowerShell'],
    ['-m', 'touch -m src/a.cpp'],
    ['-a and -m clustered', 'touch -am src/a.cpp'],
    ['-c of an existing file', 'touch -c src/a.cpp'],
    ['-d with a quoted date', 'touch -d "2020-01-01 00:00" src/a.cpp'],
    ['-t with a stamp', 'touch -t 202001010000 src/a.cpp'],
    ['-r with a reference file', 'touch -r src/ref.h src/a.cpp'],
    ['--date=', 'touch --date=2020-01-01 src/a.cpp'],
    ['--date with a separate value', 'touch --date "2 hours ago" src/a.cpp'],
    ['--reference=', 'touch --reference=src/ref.h src/a.cpp'],
    ['several existing files', 'touch src/a.cpp src/b.cpp src/state/AppState.h'],
    ['an absolute path to an existing file', `touch ${join(repo, 'src', 'a.cpp').replace(/\\/g, '/')}`],
    ['cd into the repo then a relative touch', `cd ${repo.replace(/\\/g, '/')} && touch src/a.cpp`],
    ['a touch and a build in one command', 'touch src/state/AppState.h && echo timing'],
    ['an assigned variable operand', 'D=src && touch $D/a.cpp'],
    ['an echo before the touch', 'echo stamping && touch src/a.cpp'],
    ['a cd into a subdirectory before the touch', 'cd src && touch a.cpp'],
    ['two touches in a row', 'touch src/a.cpp && touch src/b.cpp'],
    ['a missing file under -c (creates nothing)', 'touch -c src/missing.cpp'],
    ['a missing file under --no-create', 'touch --no-create src/missing.cpp'],
    ['a missing file under -c clustered with -m', 'touch -cm src/missing.cpp'],
    ['a missing non-source file', 'touch notes.txt'],
    ['a file named touch beside an existing source file', 'touch touch src/a.cpp'],
    ['a scratch source file', `touch ${scratch}`],
  ];
  for (const [name, command, tool] of PASS) expectPass(name, command, tool);

  const BLOCK = [
    ['a source file that does not exist', 'touch src/new.cpp'],
    ['a missing source file next to an existing one', 'touch src/a.cpp src/new.cpp'],
    ['a missing source file with -m only', 'touch -m src/new.cpp'],
    ['a missing source file with -d', 'touch -d "2020-01-01" src/new.cpp'],
    ['a glob operand', 'touch src/*.cpp'],
    ['a bracket glob', 'touch src/[ab].cpp'],
    ['a brace expansion', 'touch src/{a,new}.cpp'],
    ['an unresolved variable', 'touch $UNSET/a.cpp'],
    ['a braced unresolved variable', 'touch ${UNSET}/a.cpp'],
    ['a command substitution', 'touch $(echo src/a.cpp)'],
    ['a backtick substitution', 'touch `echo src/a.cpp`'],
    ['a variable assigned twice', 'D=src; D=lib; touch $D/a.cpp'],
    ['a conditionally assigned variable', 'true || D=src; touch $D/a.cpp'],
    ['an option outside the allowlist (-h)', 'touch -h src/a.cpp'],
    ['a glued -d value', 'touch -d2020-01-01 src/a.cpp'],
    ['an abbreviated long option', 'touch --no-c src/a.cpp'],
    ['a quoted option', 'touch "-m" src/a.cpp'],
    ['a substitution inside the -d value', 'touch -d "$(date)" src/a.cpp'],
    ['a stdin-less operand dash', 'touch - src/a.cpp'],
    ['no operand but a reference source', 'touch -r src/ref.cpp'],
    ['an unquoted backslash path', 'touch src\\a.cpp'],
    ['a touch with a redirect to a source file', 'touch src/a.cpp > src/b.cpp'],
    ['touch led by a wrapper', 'sudo touch src/a.cpp'],
    ['touch run through ssh', 'ssh host touch src/a.cpp'],
    ['touch run through bash -c', `bash -c "touch src/a.cpp"`],
    ['PowerShell New-Item', 'New-Item src/new.cpp', 'PowerShell'],
    ['a touch with a comma list under PowerShell', 'touch src/a.cpp,src/b.cpp', 'PowerShell'],
  ];
  for (const [name, command, tool] of BLOCK) expectBlock(name, command, tool);
} finally {
  finish();
}
