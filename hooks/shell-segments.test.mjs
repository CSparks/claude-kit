#!/usr/bin/env node
// shell-segments.test.mjs — segments() splits a shell line on operators outside quotes (KIT-T523) and,
// when an escaped quote or an unclosed quote leaves the split ambiguous, adds every plausible split plus
// the whole command as a last flagged segment (KIT-T705).
// Run: node hooks/shell-segments.test.mjs

import { segments } from './lib/shell-segments.mjs';

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
check('a Windows path with backslashes does not make a clean command ambiguous', flagged('cd C:\\dev\\x && ls hooks\\a.mjs').length === 0);
check('a balanced escaped quote inside double quotes stays one clean segment', flagged('echo "say \\"hi\\" ; there" ; ls').length === 0 && texts('echo "say \\"hi\\" ; there" ; ls').length === 2);

const hidden = 'grep \\" ; sed -i s/a/b/ hooks/a.mjs ; echo \\"';
check('KIT-T705: an escaped quote that hides a write is ambiguous and flagged', flagged(hidden).length === 1);
check('KIT-T705: the real-shell split exposes the hidden sed -i as its own segment', texts(hidden).includes('sed -i s/a/b/ hooks/a.mjs'));
check('KIT-T705: the flagged segment is last and holds the whole command', segments(hidden).at(-1).ambiguous === true && segments(hidden).at(-1).text === hidden);
check('KIT-T705: the no-escape split is still present, so no consumer loses a segment', texts(hidden).some((t) => t.startsWith('grep')));

check('KIT-T705: an unclosed quote is ambiguous', flagged("echo it's ; rm x").length === 1);
check('KIT-T705: an unclosed quote keeps the splits before it', texts("echo hi ; grep x ; echo it's").includes('grep x'));
check('KIT-T705: a PowerShell backtick-escaped quote is ambiguous', flagged("echo `' ; sed -i s/a/b/ hooks/a.mjs ; echo `'").length === 1);
check('KIT-T705: an escaped backslash before a closing quote resolves cleanly', flagged('echo "a\\\\" ; ls').length === 0);

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
