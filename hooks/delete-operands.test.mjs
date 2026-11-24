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
  ['a caret under an unknown shell', ' a^&b; c', ''],
  ['a backtick under an unknown shell', ' a`;b; c', ''],
  ['an escaped quote under an unknown shell', ' \\"a;b\\" c; d', ''],
  ['an escaped semicolon under an unknown shell', ' a\\;b; c', ''],
];
for (const [name, text, shell] of whole) ok(`the text stays whole at ${name}`, cut(text, shell) === text);

ok('a case-named file is no case statement', cut(' case.txt; ls', 'bash') === ' case.txt');
ok('an unknown shell cuts plain text', cut(' -rf build; ls', '') === ' -rf build');
ok('a bare status parameter is no operand', ['$?', '$!', '$$', '$#'].every(isStatusParameter) && !isStatusParameter('$?x'));

done();
