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

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
