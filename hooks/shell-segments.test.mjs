#!/usr/bin/env node
// shell-segments.test.mjs — segments() splits a shell line on operators outside quotes (KIT-T523) and,
// when an escape before a quote, a $'…' string or an unclosed quote leaves the quoting ambiguous, adds the
// flagged candidate segment from each word of the command (KIT-T705, KIT-D117).
// Run: node hooks/shell-segments.test.mjs

import { candidateStarts, segments } from './lib/shell-segments.mjs';

let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
};
const texts = (cmd) => segments(cmd).map((s) => s.text.trim());
const flagged = (cmd) => segments(cmd).filter((s) => s.ambiguous);

check('splits on ; && | and newline, tagging the operator before each', JSON.stringify(segments('a ; b && c | d\ne').map((s) => [s.text.trim(), s.after])) === JSON.stringify([['a', 'start'], ['b', ';'], ['c', '&&'], ['d', '|'], ['e', ';']]));
check('an operator inside quotes does not split', texts('echo "a ; b" \'c && d\'').length === 1);
check('>& and &> are redirections, not separators', texts('cmd 2>&1 &> out').length === 1);
check('a clean command is returned as the plain split, nothing flagged', flagged('echo "a" ; echo \'b\'').length === 0);
check('a Windows path with backslashes is not ambiguous', flagged('cd C:\\dev\\x && ls hooks\\a.mjs').length === 0);

const ambiguousCases = [
  ['a backslash before a quote', 'grep \\" ; sed -i s/a/b/ hooks/a.mjs ; echo \\"'],
  ['a backslash before a quote inside double quotes', 'echo "say \\"hi\\" ; there" ; ls'],
  ['a backtick before a quote', "echo `' ; sed -i s/a/b/ hooks/a.mjs ; echo `'"],
  ['a $\'…\' string', "echo $'a\\' ; sed -i x hooks/a.mjs ; \\''"],
  ['a $"…" string', 'echo $"a ; b"'],
  ['an unclosed quote', "echo it's ; rm x"],
];
for (const [name, cmd] of ambiguousCases) {
  const segs = segments(cmd);
  const first = segs.findIndex((s) => s.ambiguous);
  check(`KIT-T705: ${name} is ambiguous: flagged segments come last, the whole command first among them`, first > 0 && segs.slice(first).every((s) => s.ambiguous) && segs[first].text === cmd);
  check(`KIT-T705: ${name} yields a candidate segment starting at each word`, flagged(cmd).length === candidateStarts(cmd).length && flagged(cmd).every((s, i) => s.text === cmd.slice(candidateStarts(cmd)[i])));
}
const hiddenPush = 'echo $\'a\\\' ; git push origin main ; \\\'\'';
check('KIT-T705: a command hidden behind an escaped quote leads one candidate segment', texts(hiddenPush).some((t) => /^git push origin main/.test(t)));
check('KIT-T705: a huge ambiguous command stays capped', segments(`echo \\" ${'w '.repeat(5000)}`).length < 2100);
check('KIT-T705: the plain split is kept ahead of the flagged whole command', texts("echo hi ; grep x ; echo it's").slice(0, 3).join('|') === "echo hi|grep x|echo it's");

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
