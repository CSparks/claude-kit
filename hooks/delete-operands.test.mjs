#!/usr/bin/env node
// delete-operands.test.mjs — where the operand text of a delete ends, per shell, and that every construct the cut does not
// model leaves the text whole (KIT-T1524).
// Run: node hooks/delete-operands.test.mjs

import { deleteOperandText as cut, isStatusParameter } from './lib/delete-operands.mjs';
import { reporter } from './test-harness.mjs';

const { ok, done } = reporter('delete-operands');

const cuts = [
  ['bash cuts at a semicolon', ' -rf build; echo $?', 'bash', ' -rf build'],
  ['bash cuts at a double ampersand', ' -rf build && ls', 'bash', ' -rf build '],
  ['bash keeps a quoted semicolon', ' "a;b" c; d', 'bash', ' "a;b" c'],
  ['bash keeps a backslash-escaped semicolon', ' a\\;b c; d', 'bash', ' a\\;b c'],
  ['bash keeps a group', ' <(echo a; echo b) c; d', 'bash', ' <(echo a; echo b) c'],
  ['bash keeps a redirect with a pipe', ' a >| b c; d', 'bash', ' a >| b c'],
  ['bash keeps an input duplication', ' a <&3 c; d', 'bash', ' a <&3 c'],
  ['bash keeps an ampersand redirect', ' a &> b c; d', 'bash', ' a &> b c'],
  ['bash keeps an fd duplication', ' a 2>&1; d', 'bash', ' a 2>&1'],
  ['powershell cuts at a semicolon', ' -r build; ls', 'powershell', ' -r build'],
  ['powershell reads a backslash outside quotes as plain text', ' a\\;b c', 'powershell', ' a\\'],
  ['cmd keeps a semicolon', ' a;b c & d', 'cmd', ' a;b c '],
  ['cmd keeps a caret-escaped ampersand', ' a^&b c & d', 'cmd', ' a^&b c '],
  ['cmd reads a caret in quotes as plain text', ' "a^" b & d', 'cmd', ' "a^" b '],
];
for (const [name, text, shell, want] of cuts) ok(name, cut(text, shell) === want);

const whole = [
  ['an ANSI-C string', " $'a\\'b;c' d; e", 'bash'],
  ['a locale string', ' $"a;b" c; d', 'bash'],
  ['an escaped ANSI-C opener', " \\$'a\\\\'b;c' d; e", 'bash'],
  ['a case statement', ' <(case x in a) echo;; esac) d; e', 'bash'],
  ['a substitution inside double quotes', ' "$(echo "a;b")" d; e', 'bash'],
  ['a backtick inside double quotes', ' "`echo "a;b"`" d; e', 'bash'],
  ['an unclosed group', ' $(echo a; b', 'bash'],
  ['a backtick-escaped quote in PowerShell', ' "a`";b" c; d', 'powershell'],
  ['a backslash before a quote in PowerShell', ' "a\\";b c', 'powershell'],
  ['a single quote the splitter pairs but cmd does not', " 'a & b", 'cmd'],
  ['a curly double quote in PowerShell', ' “a;b” c; d', 'powershell'],
  ['a curly single quote in PowerShell', ' ‘a;b’ c; d', 'powershell'],
  ['a low curly single quote in PowerShell', ' ‚a;b‛ c; d', 'powershell'],
  ['a low curly double quote in PowerShell', ' „a;b“ c; d', 'powershell'],
  ['a comment inside a group', ' $(echo x # )\n) c; d', 'bash'],
  ['a comment right after a group opens', ' $(# )\n) c; d', 'bash'],
  ['a comment after a semicolon inside a group', ' $(echo x;# )\n) c; d', 'bash'],
  ['a heredoc inside a group', ' $(cat <<EOF\n)\nEOF\n) c; d', 'bash'],
  ['a hash after a close paren inside a group', ' $(echo $(echo a)#)\n) c; d', 'bash'],
  ['a hash after a less-than inside a group', ' $(echo x <#)\n) c; d', 'bash'],
  ['a hash after a greater-than inside a group', ' $(echo x >#)\n) c; d', 'bash'],
  ['a hash right after a backtick span opens', ' `#`\nc; d', 'bash'],
  ['a hash after a close paren inside a PowerShell group', ' $(echo (a)#)\n) c; d', 'powershell'],
  ['a hash after a close paren inside a group of an unknown shell', ' $(echo $(echo a)#)\n) c; d', ''],
  ['a curly double quote under an unknown shell', ' “a;b” c; d', ''],
  ['a curly single quote under an unknown shell', ' ‘a;b’ c; d', ''],
  ['a caret under an unknown shell', ' a^&b; c', ''],
  ['a backtick under an unknown shell', ' a`;b; c', ''],
  ['an escaped quote under an unknown shell', ' \\"a;b\\" c; d', ''],
  ['an escaped semicolon under an unknown shell', ' a\\;b; c', ''],
];
for (const [name, text, shell] of whole) ok(`the text stays whole at ${name}`, cut(text, shell) === text);

ok('a curly quote is plain text in bash', cut(' “a b”; ls', 'bash') === ' “a b”');
ok('a hash inside a word in a group is no comment', cut(' $(echo a#b; c) d; e', 'bash') === ' $(echo a#b; c) d');
ok('a parameter-length hash in a group is no comment', cut(' $(echo $#; c) d; e', 'bash') === ' $(echo $#; c) d');
ok('a braced parameter-length hash in a group is no comment', cut(' $(echo ${#x}; c) d; e', 'bash') === ' $(echo ${#x}; c) d');
ok('a hash inside a word in a backtick span is no comment', cut(' `echo a#b` d; e', 'bash') === ' `echo a#b` d');
ok('a curly quote is plain text in cmd', cut(' “a b” & ls', 'cmd') === ' “a b” ');
ok('a hash outside a group leaves the cut alone', cut(' a #b; c', 'bash') === ' a #b');
ok('a case-named file is no case statement', cut(' case.txt; ls', 'bash') === ' case.txt');
ok('an unknown shell cuts plain text', cut(' -rf build; ls', '') === ' -rf build');
ok('a bare status parameter is no operand', ['$?', '$!', '$$', '$#'].every(isStatusParameter) && !isStatusParameter('$?x'));

done();
