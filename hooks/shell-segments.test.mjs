#!/usr/bin/env node
// shell-segments.test.mjs — segments() splits a shell line on operators outside quotes (KIT-T523) and flags
// the result `ambiguous` when an escape before a quote, a $'…' or $"…" string or an unclosed quote leaves the
// quoting unresolvable (KIT-T705, KIT-D117). The flag adds no segments.
// Run: node hooks/shell-segments.test.mjs

import { segments } from './lib/shell-segments.mjs';

let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
};
const texts = (cmd) => segments(cmd).map((s) => s.text.trim());

check('splits on ; && | and newline, tagging the operator before each', JSON.stringify(segments('a ; b && c | d\ne').map((s) => [s.text.trim(), s.after])) === JSON.stringify([['a', 'start'], ['b', ';'], ['c', '&&'], ['d', '|'], ['e', ';']]));
check('an operator inside quotes does not split', texts('echo "a ; b" \'c && d\'').length === 1);
check('>& and &> are redirections, not separators', texts('cmd 2>&1 &> out').length === 1);
check('a clean command is not flagged', segments('echo "a" ; echo \'b\'').ambiguous === false);
check('a Windows path with backslashes is not ambiguous', segments('cd C:\\dev\\x && ls hooks\\a.mjs').ambiguous === false);
check('a common node -e with plain quotes is not ambiguous', segments('node -e "console.log(1)"').ambiguous === false);

const ambiguousCases = [
  ['a backslash before a quote', 'grep \\" ; sed -i s/a/b/ hooks/a.mjs ; echo \\"'],
  ['a backslash before a quote inside double quotes', 'echo "say \\"hi\\" ; there" ; ls'],
  ['a backtick before a quote', "echo `' ; sed -i s/a/b/ hooks/a.mjs ; echo `'"],
  ['a $\'…\' string', "echo $'a\\' ; sed -i x hooks/a.mjs ; \\''"],
  ['a $"…" string', 'echo $"a ; b"'],
  ['an unclosed quote', "echo it's ; rm x"],
];
for (const [name, cmd] of ambiguousCases) {
  check(`KIT-T705: ${name} flags the result ambiguous`, segments(cmd).ambiguous === true);
}
check('KIT-T705: the flag adds no segment: the plain split is returned', texts("echo hi ; grep x ; echo it's").join('|') === "echo hi|grep x|echo it's");

// KIT-T941: with the shell named, bash escapes settle quoting that PowerShell leaves ambiguous.
const bash = (cmd) => segments(cmd, { shell: 'bash' });
const powershell = (cmd) => segments(cmd, { shell: 'powershell' });
const escaped = 'echo "say \\"hi\\" ; there" ; ls';
check('KIT-T941: bash reads an escaped quote inside double quotes as text, not ambiguity', bash(escaped).ambiguous === false);
check('KIT-T941: the escaped quote keeps the semicolon inside the argument', bash(escaped).map((s) => s.text.trim()).join('|') === 'echo "say \\"hi\\" ; there"|ls');
check('KIT-T941: powershell still flags the escape before a quote', powershell(escaped).ambiguous === true);
check('KIT-T941: an escape inside single quotes is literal in both shells', bash("t comment 'a \\\"b\\\" ; c'").ambiguous === false && powershell("t comment 'a \\\"b\\\" ; c'").ambiguous === false);
check('KIT-T941: a backslash-escaped quote outside quotes does not open a string in bash', bash('echo \\" ; ls').ambiguous === false);
check('KIT-T941 control: a $\' string stays ambiguous in bash', bash("echo $'a\\' ; b").ambiguous === true);
check('KIT-T941 control: a backtick before a quote stays ambiguous in bash', bash("echo `' ; b").ambiguous === true);
check('KIT-T941 control: an unclosed quote stays ambiguous in bash', bash("echo it's ; rm x").ambiguous === true);
check('KIT-T941 control: a bash escaped backslash then a closing quote ends the argument', bash('cap "a\\\\" ; sed -i x y').map((s) => s.text.trim()).join('|') === 'cap "a\\\\"|sed -i x y');
check('KIT-T941: without a shell the legacy test flags any escape before a quote', segments(escaped).ambiguous === true);

// KIT-T784: a quoted heredoc read by a data consumer is inert data.
const body = "ancestors' and \"quotes\" and `ticks` ; grep -r .ai/ ; rm x";
const heredoc = (head, tail = '') => `${head} <<'EOF'\n${body}\nEOF${tail}`;
check('KIT-T784: a git commit -F - heredoc with an apostrophe is not ambiguous', segments(heredoc('git commit -q -F -')).ambiguous === false);
check('KIT-T784: the body adds no segment', texts(heredoc('git commit -q -F -')).filter(Boolean).join('|') === "git commit -q -F - <<'EOF'");
check('KIT-T784: a double-quoted delimiter and <<- with tabs', segments(`t decide --file - <<-"EOF"\n\tit's\n\tEOF`).ambiguous === false);
check('KIT-T784: commands after the terminator are still parsed', texts(heredoc('git commit -F -', '\ngrep -r x src')).includes('grep -r x src'));
check('KIT-T784: two heredocs on one line', segments("cat <<'A' <<'B'\nit's\nA\nit's\nB").ambiguous === false);
check('KIT-T784: a cap script run by node reads the body as data', segments(`node scripts/cap.mjs --file - <<'EOF'\nit's\nEOF`).ambiguous === false);
const stays = [
  ['an unquoted delimiter (expansion runs)', "git commit -F - <<EOF\nit's $(grep -r x)\nEOF"],
  ['a shell reader', "bash <<'EOF'\nit's\nEOF"],
  ['node reading its program from stdin', "node - <<'EOF'\nit's\nEOF"],
  ['a remote shell', "ssh host <<'EOF'\nit's\nEOF"],
  ['a pipe on from the reader', "cat <<'EOF' | bash\nit's\nEOF"],
  ['an opener in a comment', "echo hi # <<'EOF'\nit's\nEOF"],
  ['an opener behind a backslash', "echo \\<<'EOF'\nit's\nEOF"],
  ['no terminator line', "git commit -F - <<'EOF'\nit's"],
  ['an escaped quote in the head', "echo \\\" ; cat <<'EOF'\nx\nEOF"],
  ['a here-string', "cat <<<'EOF'\nit's\nEOF"],
];
for (const [name, cmd] of stays) check(`KIT-T784 control: ${name} is not cut`, segments(cmd).text === cmd);
check('KIT-T784 control: the body of a shell reader stays parsed (hidden command seen)', texts("bash <<'EOF'\ngrep -r x src\nEOF").includes('grep -r x src'));
check('KIT-T784 control: an escaped-quote head keeps the line ambiguous', segments("echo \\\" ; cat <<'EOF'\nx\nEOF\ngrep -r a src").ambiguous === true);

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
