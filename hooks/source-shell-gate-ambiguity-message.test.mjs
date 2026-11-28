#!/usr/bin/env node
// source-shell-gate-ambiguity-message.test.mjs — a source-shell-write block on ambiguous quoting names the construct
// it could not resolve, where it starts, the text around it and the write word it saw, and prints the workaround
// (KIT-T1619). The pass and refuse results are unchanged: only the block text gains the three facts.
// Run: node hooks/source-shell-gate-ambiguity-message.test.mjs

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { REASON } from './lib/shell-lexer.mjs';
import { AMBIGUOUS_PATH, shellSourceWrite } from './lib/shell-source-write.mjs';

const HOOK = fileURLToPath(new URL('./source-shell-gate.mjs', import.meta.url));
const KIT_ROOT = fileURLToPath(new URL('..', import.meta.url));
let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`); }
};

const BASH_BACKTICK = 'echo "`true "x" ; rm src` a" ; ls';
const POWERSHELL_ESCAPE = 'echo "a\\"b" ; rm src/a.rs';
const BASH_PASS = 'echo "`true "x" ; ls` a"';

const run = (tool_name, command) => {
  const r = spawnSync(process.execPath, [HOOK], { cwd: KIT_ROOT, input: JSON.stringify({ session_id: 'S1', tool_name, tool_input: { command } }), encoding: 'utf8' });
  return { code: r.status, text: `${r.stdout || ''}${r.stderr || ''}` };
};

const bash = run('Bash', BASH_BACKTICK);
check('the backtick-in-quotes write is still blocked (exit 2)', bash.code === 2, bash.text.trim());
check('the block names the construct: a quote inside a substitution inside double quotes', bash.text.includes(`Ambiguous span: ${REASON.quoteInSubstitution} at character`), bash.text.trim());
check('the block names the write word it saw', bash.text.includes('the write word that made it a hit: "rm"'), bash.text.trim());
check('the block quotes the span it could not resolve', bash.text.includes(`near "`) && bash.text.includes('true'), bash.text.trim());
check('the block prints the single-quote workaround', bash.text.includes('single quotes, with no backticks or escaped quotes'), bash.text.trim());

const ps = run('PowerShell', POWERSHELL_ESCAPE);
check('the PowerShell backslash-quote write is still blocked (exit 2)', ps.code === 2, ps.text.trim());
check('the PowerShell block names the escape construct', ps.text.includes(`Ambiguous span: ${REASON.escape} at character`), ps.text.trim());
check('the PowerShell block names the write word it saw', ps.text.includes('the write word that made it a hit: "rm"'), ps.text.trim());

const pass = run('Bash', BASH_PASS);
check('an ambiguous command with no write word still passes (exit 0)', pass.code === 0, pass.text.trim());

const hit = shellSourceWrite(BASH_BACKTICK, { shell: 'bash' });
check('the refuse result keeps its path and ambiguous flag', hit?.path === AMBIGUOUS_PATH && hit?.ambiguous === true, JSON.stringify(hit));
check('the hit carries the construct, the position and the write word', hit?.ambiguity?.reason === REASON.quoteInSubstitution && hit?.ambiguity?.trigger === 'rm' && Number.isInteger(hit?.ambiguity?.at), JSON.stringify(hit));
check('the pass result stays null', shellSourceWrite(BASH_PASS, { shell: 'bash' }) === null);

console.log(`${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
