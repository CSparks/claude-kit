#!/usr/bin/env node
// source-shell-gate-delete-segment.test.mjs — the operands of a delete end at the segment boundary (`;`, `&&`, `||`, `|`,
// newline), also inside the quoted string of a wrapped shell, and a bare `$?`, `$!`, `$$` or `$#` is never a file operand
// (KIT-T1522). A real delete of source, an unresolved variable, a glob and `git rm -f` stay blocked, also after a construct
// the operand cut does not model: an ANSI-C string, a redirect token with `|` or `&`, a case statement (KIT-T1524).
// Run: node hooks/source-shell-gate-delete-segment.test.mjs

import { BLOCK, PASS, wrappedHarness } from './source-shell-gate-wrapped-harness.mjs';

const { ok, src, finish } = wrappedHarness('source-shell-gate-delete-segment');

try {
  const reported = `wsl.exe -d Ubuntu -- bash -lc 'cd /mnt/d/dev/x ; rm -rf build && meson setup build --prefix=/usr > /root/meson.log 2>&1; echo "meson exit $?"; tail -20 /root/meson.log'`;
  const passes = [
    ['the reported wsl meson build', reported],
    ['rm of a directory then a status echo', 'rm -rf build && echo "exit $?"'],
    ['rm then a status echo after a semicolon', 'rm -rf build; echo $?'],
    ['rm then the last background pid', 'rm -rf build ; echo $!'],
    ['rm then the shell pid', 'rm -rf build ; echo $$'],
    ['rm then an argument count', 'rm -rf build ; echo $#'],
    ['rm then a later redirect-free command in bash -c', "bash -c 'rm -rf build && echo done; ls $HOME/x.rs'"],
    ['rm then a piped command', 'rm -rf build | cat src/a.rs'],
    ['rm then an or-chained command', 'rm -rf build || echo failed src/a.rs'],
    ['rm in a container shell body then a source name', 'docker run img sh -c "rm -rf build; ls src/a.rs"'],
    ['rm over a newline then a source name', 'rm -rf build\nls src/a.rs'],
    ['a rm with an fd duplication', 'rm -rf build 2>&1'],
  ];
  for (const [name, command] of passes) ok(`source gate passes ${name}`, src(command) === PASS);

  const blocks = [
    ['rm of a source file', 'rm src/a.rs'],
    ['rm -f of a source file', 'rm -f src/a.rs'],
    ['rm -rf of an unresolved variable', 'rm -rf $VAR'],
    ['rm of a glob over source', 'rm src/*.rs'],
    ['git rm -f', 'git rm -f src/a.rs'],
    ['rm of source in a wsl bash -lc', "wsl.exe -d Ubuntu -- bash -lc 'rm -rf build && rm src/a.rs; echo $?'"],
    ['rm of source after a status echo in bash -c', "bash -c 'echo $?; rm src/a.rs'"],
    ['rm of an unresolved variable in bash -c', "bash -c 'rm -rf build; rm -rf $VAR; echo $?'"],
    ['rm of a quoted operand holding a semicolon beside source', `rm "build;" src/a.rs`],
    ['rm of source before a semicolon in bash -c', "bash -c 'rm src/a.rs; echo $?'"],
    ['rm of source then a status echo', 'rm src/a.rs && echo $?'],
    ['rm of source beside a status parameter', 'rm $? src/a.rs'],
    ['rm of source inside a substitution holding a semicolon', 'rm $(echo a; echo src/a.rs)'],
    ['rm of source after a backslash-free pipe', 'echo x | rm src/a.rs'],
    ['rm of source in a builds --run command', "builds --run 'rm src/a.rs'"],
  ];
  for (const [name, command] of blocks) ok(`source gate blocks ${name}`, src(command) === BLOCK);

  const powershell = 'PowerShell';
  const modelled = [
    ['rm of source after an ANSI-C string with an escaped quote', String.raw`bash -c "rm \$'x\\'y;z' src/a.rs"`],
    ['rm of source after a redirect with a pipe', "bash -c 'rm >| out src/a.rs'"],
    ['rm of source after a top-level redirect with a pipe', 'rm >| out src/a.rs'],
    ['rm of source after an fd redirect with a pipe', "bash -c 'rm 2>| out src/a.rs'"],
    ['rm of source after an input duplication', "bash -c 'rm a <&3 src/a.rs'"],
    ['rm of source after an ampersand redirect', "bash -c 'rm a &> log src/a.rs'"],
    ['rm of source after an appending ampersand redirect', "bash -c 'rm a &>> log src/a.rs'"],
    ['rm of source after a case statement in a process substitution', "bash -c 'rm <(case x in a) echo q;; esac) src/a.rs'"],
    ['rm of source after a substitution inside double quotes', `bash -c 'rm "$(echo "x;y" )" src/a.rs'`],
  ];
  for (const [name, command] of modelled) ok(`source gate blocks ${name}`, src(command) === BLOCK);
  ok('source gate blocks rm of source after a backtick-escaped quote in PowerShell',
    src('powershell -Command \'rm "a`";b" src/a.rs\'', powershell) === BLOCK);

  const stillCut = [
    ['rm then a redirect with a pipe and a later source name', "bash -c 'rm -rf build >| log; ls src/a.rs'"],
    ['rm then an appending ampersand redirect and a status echo', 'rm -rf build &>> log; echo $?'],
    ['rm then a group-closing rm and a later source name', "bash -c '( cd x && rm -rf build ) && ls src/a.rs'"],
  ];
  for (const [name, command] of stillCut) ok(`source gate passes ${name}`, src(command) === PASS);
  ok('source gate passes rm then a later source name in PowerShell',
    src("powershell -Command 'rm -rf build; ls src/a.rs'", powershell) === PASS);
} finally {
  finish();
}
