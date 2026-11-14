// KIT-T1178, KIT-T1064: a Grep tool call or a shell search whose only target is a file outside every adopted repo passes whatever
// its pattern holds (an apostrophe, a double quote, a backslash, a dollar); the same patterns over the source tree, or over a
// target that cannot be resolved, stay blocked.
// Run: node hooks/query-gate-tool.test.mjs

import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HOOK = fileURLToPath(new URL('./query-gate.mjs', import.meta.url));
let failures = 0;

const repo = mkdtempSync(join(tmpdir(), 'qgt-repo-'));
execFileSync('git', ['init', '-q'], { cwd: repo });
mkdirSync(join(repo, '.ai', 'decisions'), { recursive: true });
mkdirSync(join(repo, 'crates', 'a', 'src'), { recursive: true });
writeFileSync(join(repo, 'crates', 'a', 'src', 'lib.rs'), 'fn main() {}\n');

const scratch = mkdtempSync(join(tmpdir(), 'qgt-scratch-'));
const slashed = (p) => p.replace(/\\/g, '/');
const logTxt = slashed(join(scratch, 'u9.txt'));
const logBare = slashed(join(scratch, 'u9'));
writeFileSync(join(scratch, 'u9.txt'), "plan's uv\n");
writeFileSync(join(scratch, 'u9'), "plan's uv\n");

function call(tool_name, tool_input) {
  const r = spawnSync(process.execPath, [HOOK], { cwd: repo, input: JSON.stringify({ tool_name, tool_input }), encoding: 'utf8' });
  return r.status;
}
const grepTool = (input) => call('Grep', input);
const shell = (command, tool = 'Bash') => call(tool, { command });

function expect(name, actual, wanted) {
  const ok = actual === wanted;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (exit=${actual}, want=${wanted})`);
  if (!ok) failures++;
}

const PATTERNS = [
  ['an apostrophe', "plan's uv"],
  ['two apostrophes', "it's the plan's"],
  ['a trailing apostrophe', "users'"],
  ['a double quote', 'say "hi"'],
  ['an apostrophe and a double quote', `it's "x"`],
  ['a backslash', 'a\\sb'],
  ['a dollar', 'end$'],
  ['an apostrophe then a dollar', "it's$"],
  ['a backtick', 'a`b'],
  ['a pipe alternation and an apostrophe', "^error|can't"],
  ['an escaped bracket', 'foo\\[0\\]'],
];
for (const [name, pattern] of PATTERNS) {
  expect(`Grep tool: one outside .txt file passes with ${name}`, grepTool({ pattern, path: logTxt }), 0);
  expect(`Grep tool: one outside file with no extension passes with ${name}`, grepTool({ pattern, path: logBare }), 0);
}
expect('Grep tool: an outside file with a glob and options and an apostrophe passes', grepTool({ pattern: "plan's", path: logTxt, glob: '*.txt', '-i': true, type: 'rust' }), 0);
expect('Grep tool: an outside file with a glob holding an apostrophe passes', grepTool({ pattern: 'x', path: logTxt, glob: "it's*.txt" }), 0);

for (const [name, pattern] of PATTERNS) {
  expect(`Grep tool control: no path (tree-wide) still blocks with ${name}`, grepTool({ pattern }), 2);
  expect(`Grep tool control: a repo source directory still blocks with ${name}`, grepTool({ pattern, path: join(repo, 'crates') }), 2);
}
expect('Grep tool control: a relative source directory with an apostrophe still blocks', grepTool({ pattern: "it's", path: 'crates/a/src' }), 2);
expect('Grep tool control: an outside directory with an apostrophe still blocks', grepTool({ pattern: "it's", path: slashed(scratch) }), 2);
expect('Grep tool control: one repo source file with an apostrophe passes as a named file', grepTool({ pattern: "it's", path: 'crates/a/src/lib.rs' }), 0);

const scratchpad = join(mkdtempSync(join(tmpdir(), 'qgt-session-')), 'scratchpad');
mkdirSync(scratchpad, { recursive: true });
const pad = slashed(scratchpad);
expect('KIT-T1183: Grep tool over a scratchpad directory passes', grepTool({ pattern: 'KIT-T1', path: pad }), 0);
expect('KIT-T1183: Grep tool over a scratchpad directory with a glob passes', grepTool({ pattern: 'KIT-T1', path: pad, glob: '*.txt' }), 0);
expect('KIT-T1183: Grep tool over a scratchpad directory with a recursive glob passes', grepTool({ pattern: 'KIT-T1', path: pad, glob: '**/*.txt' }), 0);
expect('KIT-T1183: Grep tool over a scratchpad directory with a pattern holding a slash passes', grepTool({ pattern: 'a/b|crates/x', path: pad, glob: 'q-*.md' }), 0);
expect('KIT-T1183: Grep tool over a scratchpad directory with type and output options passes', grepTool({ pattern: 'x', path: pad, glob: '**/*.md', type: 'md', output_mode: 'content', '-n': true }), 0);
expect('KIT-T1183: Grep tool over a backslash scratchpad path with a recursive glob passes', grepTool({ pattern: 'KIT-T1', path: scratchpad, glob: '**/*.txt' }), 0);
expect('KIT-T1183: Grep tool over a backslash scratchpad path with a spaced 8.3 name passes', grepTool({ pattern: 'KIT-T1', path: String.raw`C:\Users\CHRISS~1\AppData\Local\Temp\claude\d87a\bf05\scratchpad`, glob: '*.md' }), 0);
expect('KIT-T1183: Grep tool over a spaced scratchpad path with a glob passes', grepTool({ pattern: 'KIT-T1', path: String.raw`C:\Users\Chris Sparks\AppData\Local\Temp\claude\d87a\bf05\scratchpad`, glob: '*.md' }), 0);
for (const [name, pattern] of PATTERNS) {
  for (const glob of ['*.txt', '**/*.md', '*.{txt,md}', 'q-*', '!*.log']) {
    expect(`KIT-T1183: Grep tool over a scratchpad directory, glob ${glob}, pattern with ${name}`, grepTool({ pattern, path: scratchpad, glob }), 0);
  }
}
expect('KIT-T1183 control: a recursive glob over the repo source tree still blocks', grepTool({ pattern: 'KIT-T1', path: join(repo, 'crates'), glob: '**/*.rs' }), 2);
expect('KIT-T1183 control: a recursive glob with no path still blocks', grepTool({ pattern: 'KIT-T1', glob: '**/*.mjs' }), 2);
expect('KIT-T1183 control: a scratchpad-looking glob does not launder a repo directory', grepTool({ pattern: 'x', path: join(repo, 'crates'), glob: `${pad}/*.txt` }), 2);
expect('KIT-T1183: a shell rg over a scratchpad directory with a recursive glob passes', shell(`rg -g '**/*.txt' KIT-T1 ${pad}`), 0);

const SHELL_PASSES = [
  ['a bash doubled-apostrophe pattern over an assigned variable', `S=${logTxt}; rg 'it''s' "$S"`],
  ['a bash apostrophe inside double quotes', `S=${logTxt}; rg "it's" "$S"`],
  ['a bash apostrophe closed and reopened', `S=${logTxt}; rg 'it'"'"'s' "$S"`],
  ['a bash apostrophe pattern over the literal path', `rg "plan's" ${logTxt}`],
  ['a bash grep -rn with an apostrophe pattern over the literal path', `grep -rn "plan's" ${logTxt}`],
];
for (const [name, cmd] of SHELL_PASSES) expect(`shell: passes ${name}`, shell(cmd), 0);

const POWERSHELL_PASSES = [
  ['a doubled apostrophe in a single-quoted pattern over an assigned variable', `$S = '${logTxt}'; rg 'it''s' $S`],
  ['an apostrophe inside a double-quoted pattern over an assigned variable', `$S = '${logTxt}'; rg "it's" $S`],
  ['a doubled apostrophe over the literal path', `rg 'it''s' '${logTxt}'`],
];
for (const [name, cmd] of POWERSHELL_PASSES) expect(`PowerShell: passes ${name}`, shell(cmd, 'PowerShell'), 0);

expect('shell control: an apostrophe pattern over a repo directory still blocks', shell(`rg 'it''s' crates/`), 2);
expect('shell control: an apostrophe pattern over an unassigned variable still blocks', shell(`rg "it's" $S`), 2);
expect('shell control: an apostrophe pattern over a variable assigned conditionally still blocks', shell(`false && S=${logTxt}; rg "it's" "$S"`), 2);
expect('shell control: an escaped-quote pattern over an unresolved target in PowerShell stays ambiguous and blocks', shell('rg "a`"b" $S', 'PowerShell'), 2);
expect('shell control: a never-closing quote over an unresolved target blocks', shell(`rg 'it's $S`), 2);
expect('PowerShell control: a doubled apostrophe over a repo directory still blocks', shell(`rg 'it''s' crates/`, 'PowerShell'), 2);

const blockText = (tool_name, tool_input) => spawnSync(process.execPath, [HOOK], { cwd: repo, input: JSON.stringify({ tool_name, tool_input }), encoding: 'utf8' }).stderr;
expect('Grep tool: the block names the whole apostrophe pattern in its exact equivalent', /code 'it'\\''s plan'/.test(blockText('Grep', { pattern: "it's plan" })), true);
expect('shell: the block names the whole pattern of a doubled-apostrophe search', /code its\b/.test(blockText('Bash', { command: "rg 'it''s' crates/" })), true);

console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
