#!/usr/bin/env node
// shell-lexer.test.mjs — the shared tokenizer per shell: word values, operators, redirections, substitutions and the
// marks it leaves on every construct it does not model (KIT-T1528).
// Run: node hooks/shell-lexer.test.mjs

import { lex, REASON, words } from './lib/shell-lexer.mjs';

let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
};
const values = (text, opts) => words(text, opts).map((w) => w.value);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const reasons = (text, opts) => lex(text, opts).marks.map((m) => m.reason);
const ops = (text, opts) => lex(text, opts).tokens.filter((t) => t.kind === 'op').map((t) => t.op);

// Word values per shell: [name, text, shell, expected values].
const wordCases = [
  ['bash drops quotes', `rm "a b" 'c d' e`, 'bash', ['rm', 'a b', 'c d', 'e']],
  ['bash glues quoted spans into one word', `x"a"'b'c`, 'bash', ['xabc']],
  ['bash reads an escaped quote outside quotes as text', `rm \\" src/a.rs \\"`, 'bash', ['rm', '"', 'src/a.rs', '"']],
  ['bash keeps an escaped quote inside double quotes', `rm "a\\" " src/a.rs`, 'bash', ['rm', 'a" ', 'src/a.rs']],
  ['bash keeps a backslash before an ordinary character inside double quotes', `cd "C:\\dev\\x"`, 'bash', ['cd', 'C:\\dev\\x']],
  ['bash drops a backslash before an ordinary character outside quotes', `git checkout feat\\ure`, 'bash', ['git', 'checkout', 'feature']],
  ['bash reads an escaped space as part of the word', `rm a\\ b`, 'bash', ['rm', 'a b']],
  ['bash single quotes are literal', `echo 'a\\'`, 'bash', ['echo', 'a\\']],
  ['bash keeps a substitution inside its word', `rm -rf $(mktemp -d)/x`, 'bash', ['rm', '-rf', '$(mktemp -d)/x']],
  ['bash keeps a backtick span inside its word', 'rm `ls a b`', 'bash', ['rm', '`ls a b`']],
  ['flat splits the words inside a substitution', `rm $(cat list)/x`, { shell: 'bash', flat: true }, ['rm', 'cat', 'list', '/x']],
  ['bash redirections are no words; their target is', `cmd a 2>&1 >out <in`, 'bash', ['cmd', 'a', '1', 'out', 'in']],
  ['powershell backtick escapes a quote', 'echo a`"b', 'powershell', ['echo', 'a"b']],
  ['powershell doubles a quote inside quotes', `echo 'it''s' "say ""hi"""`, 'powershell', ['echo', "it's", 'say "hi"']],
  ['powershell reads a backslash as text', `del a\\b`, 'powershell', ['del', 'a\\b']],
  ['cmd caret escapes outside quotes', 'del a^&b "c^d"', 'cmd', ['del', 'a&b', 'c^d']],
  ['cmd reads a single quote as text', `del 'a b'`, 'cmd', ['del', "'a", "b'"]],
  ['an unknown shell pairs quotes without escapes', `rm "a\\" b`, '', ['rm', 'a\\', 'b']],
  ['blind separates at quotes, backticks, operators and brackets', `a"b c'd\`e(f)g<h>i`, { blind: true }, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']],
];
for (const [name, text, shell, want] of wordCases) {
  const opts = typeof shell === 'string' ? { shell } : shell;
  const got = values(text, opts);
  check(`words: ${name}`, same(got, want), JSON.stringify(got));
}

check('literal keeps a Windows path whole under bash', words('rm -rf C:\\dev\\x', { shell: 'bash' })[2].literal === 'C:\\dev\\x');
check('literal still resolves an escaped quote', words('rm \\"a', { shell: 'bash' })[1].literal === '"a');
check('a redirect target is marked', words('cmd > out', { shell: 'bash' })[1].redirect === true);
check('every word carries its span', (() => { const [w] = words('  rm', { shell: 'bash' }); return w.start === 2 && w.end === 4 && w.raw === 'rm'; })());

// Operators: [name, text, shell, expected ops].
const opCases = [
  ['bash splits on ; && || | & and newline', 'a; b && c || d | e & f\ng', 'bash', [';', '&&', '||', '|', '&', ';']],
  ['redirection tokens are no operators', 'a >| b >&2 <&3 &> c &>> d 2>&1', 'bash', []],
  ['an escaped operator is text in bash', 'a \\; b \\| c', 'bash', []],
  ['an escaped operator is text in PowerShell', 'a `; b', 'powershell', []],
  ['cmd has no semicolon operator and a caret escape', 'a;b ^& c & d', 'cmd', ['&']],
  ['an operator inside quotes is text', `a "x;y" 'p|q'`, 'bash', []],
  ['an operator inside a substitution is still an operator', 'a $(b; c)', 'bash', [';']],
];
for (const [name, text, shell, want] of opCases) {
  const got = ops(text, { shell });
  check(`ops: ${name}`, same(got, want), JSON.stringify(got));
}
check('an operator inside a group carries its depth', lex('a $(b; c); d', { shell: 'bash' }).tokens.filter((t) => t.kind === 'op').map((t) => t.depth).join() === '1,0');
check('an ANSI-C string ends at its real close', ops("echo $'a\\'b;c' ; d", { shell: 'bash' }).length === 1);

// Ambiguity: the quoting cannot be resolved.
const ambiguity = (text, shell) => lex(text, { shell }).ambiguity?.reason ?? null;
check("a $' string is ambiguous", ambiguity("echo $'a'", 'bash') === REASON.dollar);
check('a backtick before a quote is ambiguous in bash', ambiguity("echo `' ; b", 'bash') === REASON.escape);
check('a backslash before a quote is ambiguous in PowerShell', ambiguity('echo "a\\"b"', 'powershell') === REASON.escape);
check('a typographic quote is ambiguous in PowerShell and an unknown shell', ambiguity('rm “a”', 'powershell') === REASON.typographic && ambiguity('rm “a”', '') === REASON.typographic);
check('a typographic quote is text in bash and cmd', ambiguity('rm “a”', 'bash') === null && ambiguity('rm “a”', 'cmd') === null);
check('a single quote is ambiguous under cmd', ambiguity("del 'a", 'cmd') === REASON.textQuote);
check('an unclosed quote is ambiguous and names where it opens', (() => { const a = lex("echo it's", { shell: 'bash' }).ambiguity; return a.reason === REASON.unclosed && a.at === 7; })());
check('an unknown shell reads any escape before a quote as ambiguous', ambiguity("echo '\\'", '') === REASON.escape);
check('a clean line carries no ambiguity', ambiguity('echo "a" ; ls', 'bash') === null);

// Marks: the spans the lexer cannot bound.
check('a substitution inside double quotes is marked', reasons('echo "$(date)"', { shell: 'bash' }).includes(REASON.quotedSubstitution));
check('a comment inside a group is marked', reasons('$(echo x # )\n)', { shell: 'bash' }).includes(REASON.groupComment));
check('a heredoc inside a group is marked', reasons('$(cat <<EOF\nx\nEOF\n)', { shell: 'bash' }).includes(REASON.groupComment));
check('a case statement is marked', reasons('case x in a) b;; esac', { shell: 'bash' }).includes(REASON.caseStatement));
check('an unclosed substitution is marked', reasons('echo $(a', { shell: 'bash' }).includes(REASON.unclosedSubstitution));
check('an unknown shell escape is marked', reasons('a^&b', { shell: '' }).includes(REASON.unknownEscape));
for (const text of ['a#b', '$(echo $#)', '$(echo ${#x})', '`echo a#b`']) check(`no comment mark: ${text}`, !reasons(text, { shell: 'bash' }).includes(REASON.groupComment));
check('a top-level comment is a token with no mark', (() => { const l = lex('a # b; c', { shell: 'bash' }); return l.tokens.some((t) => t.kind === 'comment') && l.marks.length === 0; })());
check('a stray close paren is a token and keeps depth at zero', lex('a ) b; c', { shell: 'bash' }).tokens.filter((t) => t.kind === 'op').every((t) => t.depth === 0));
check('a heredoc operator is a token', lex("cat <<'EOF'", { shell: 'bash' }).tokens.some((t) => t.kind === 'heredoc' && t.op === '<<'));
check('substitutions are open and close tokens', lex('a $(b) `c` <(d)', { shell: 'bash' }).tokens.filter((t) => t.kind === 'open').map((t) => t.op).join() === '$(,`,<(');

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
