// KIT-T1121: the retrieval gate's pipe cases. A search fed a SET of source files through a pipe (a file list through xargs,
// a glob read by cat/head/tail, Get-ChildItem into Select-String) is tree-wide discovery and blocks, naming q code and the
// forms that stay allowed. Filtering a command's own output, one named file, ls/wc/head/tail/cut/cat of named files, and
// filename lookups pass. Run: node hooks/query-gate-pipes.test.mjs

import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HOOK = fileURLToPath(new URL('./query-gate.mjs', import.meta.url));
let failures = 0;

function makeRepo({ adopt = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'qgp-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  if (adopt) mkdirSync(join(dir, '.ai', 'decisions'), { recursive: true });
  return dir;
}

function run(dir, command, tool_name = 'Bash') {
  const r = spawnSync(process.execPath, [HOOK], { cwd: dir, input: JSON.stringify({ tool_name, tool_input: { command } }), encoding: 'utf8' });
  return { code: r.status, err: r.stderr || '' };
}

function expect(name, actual, wanted) {
  const ok = actual === wanted;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (exit=${actual}, want=${wanted})`);
  if (!ok) failures++;
}

const d = makeRepo();
const un = makeRepo({ adopt: false });

const BLOCKED = [
  ['find | xargs grep', "find crates -name '*.rs' | xargs grep -n fn"],
  ['git ls-files | xargs grep', 'git ls-files crates | xargs grep -n fn'],
  ['ls | xargs grep', 'ls crates | xargs grep -n fn'],
  ['find | xargs cat | grep', "find crates -name '*.rs' | xargs cat | grep -n fn"],
  ['git ls-files | xargs cat | grep', 'git ls-files crates | xargs cat | grep fn'],
  ['cat of a glob | grep', 'cat crates/rdg-world/src/*.rs | grep -n fn'],
  ['cat of a glob | grep | cut', 'cat crates/*/src/*.rs | grep -n fn | cut -d: -f1'],
  ['head of a glob | grep', 'head -n 5 crates/*/src/lib.rs | grep fn'],
  ['tail of a glob | grep', 'tail -n 20 crates/*/src/lib.rs | grep fn'],
  ['rg --files | xargs grep', 'rg --files crates | xargs grep fn'],
];
for (const [name, cmd] of BLOCKED) expect(`KIT-T1121: blocks ${name}`, run(d, cmd).code, 2);

const PS_BLOCKED = [
  ['Get-ChildItem -Recurse | Select-String', 'Get-ChildItem -Recurse crates -Filter *.rs | Select-String fn'],
  ['gci | sls', 'gci crates\\*.rs | sls fn'],
  ['Get-Content of a glob | Select-String', 'Get-Content crates\\rdg-world\\src\\*.rs | Select-String fn'],
  ['Get-ChildItem | Get-Content | Select-String', 'Get-ChildItem -Recurse crates | Get-Content | Select-String fn'],
];
for (const [name, cmd] of PS_BLOCKED) expect(`KIT-T1121: PowerShell blocks ${name}`, run(d, cmd, 'PowerShell').code, 2);

const blocked = run(d, 'cat crates/rdg-world/src/*.rs | grep -n fn');
expect('KIT-T1121: the block names the q code equivalent, the one-file form and the output filter', blocked.err.includes('code fn') && blocked.err.includes('grep <pattern> <file>') && blocked.err.includes("cargo test 2>&1 | grep -E 'test result|FAILED' | tail -20"), true);
expect('KIT-T1121: the block names its check id for the ignore file', blocked.err.includes('source-discovery'), true);

const ALLOWED = [
  ['a build filtered by grep and tail', "cargo test -p rdg-world 2>&1 | grep -E 'test result|FAILED' | tail -20"],
  ['a build through head', 'cargo test -p rdg-world 2>&1 | head -50'],
  ['a build through tail', 'cargo test -p rdg-world 2>&1 | tail -30'],
  ['a build through cut and tail', 'cargo test -p rdg-world 2>&1 | cut -c1-120 | tail -20'],
  ['a build counted by wc', 'cargo test -p rdg-world 2>&1 | wc -l'],
  ['q output through head', 'q code foo | head -20'],
  ['git log through grep', 'git log --oneline | grep physics'],
  ['cat of ONE file into grep', 'cat crates/rdg-world/src/lib.rs | grep -n fn'],
  ['cat of one file into wc', 'cat crates/rdg-world/src/lib.rs | wc -l'],
  ['head of one file', 'head -n 40 crates/rdg-world/src/lib.rs'],
  ['tail of one file into grep', 'tail -n 100 crates/rdg-world/src/lib.rs | grep fn'],
  ['cat of one file', 'cat crates/road-generator/assets/roads/roads.ron'],
  ['cat of two named files into grep', 'cat crates/a/src/lib.rs crates/b/src/lib.rs | grep fn'],
  ['grep of one file through head', 'grep -n fn crates/rdg-world/src/lib.rs | head -20'],
  ['ls of a source dir', 'ls crates/rdg-world/src'],
  ['ls into wc', 'ls rapid-game/rust/roads/rg-roadworks/src | wc -l'],
  ['ls -R into a filename grep', 'ls -R crates | grep -i rs'],
  ['wc of a glob', 'wc -l crates/rdg-world/src/*.rs'],
  ['wc of a glob into tail', 'wc -l rapid-game/rust/roads/rg-roadworks/src/*.rs | tail -1'],
  ['find into wc (filename lookup)', "find crates -name '*.rs' | wc -l"],
  ['find into xargs wc', "find crates -name '*.rs' | xargs wc -l"],
  ['a log glob into grep (build output, not source)', 'cat target/*.log | grep ERROR'],
  ['find of logs into xargs grep', "find target -name '*.log' | xargs grep ERROR"],
  ['a scratchpad glob into grep', 'cat C:/Users/x/scratchpad/*.txt | grep ramps'],
  ['a grep of one scratchpad file', 'grep -E "census|ramps" C:/Users/x/scratchpad/census.txt'],
  ['an output filter to a scratch file', 'cargo run 2>&1 | grep -E "ramps|bridges" > C:/Users/x/scratchpad/census.txt'],
  ['a Rust glob grep (no exact index answer: KIT-T085)', 'grep -n fn crates/rdg-world/src/*.rs'],
];
for (const [name, cmd] of ALLOWED) expect(`KIT-T1121 control: allows ${name}`, run(d, cmd).code, 0);

const PS_ALLOWED = [
  ['a build through Select-String', 'cargo test 2>&1 | Select-String FAILED'],
  ['Get-ChildItem of names only', 'Get-ChildItem crates | Select-Object Name'],
  ['Select-String of one named file', 'Select-String -Path crates\\rdg-world\\src\\lib.rs -Pattern fn'],
  ['Get-Content of one file', 'Get-Content crates\\rdg-world\\src\\lib.rs | Select-String fn'],
];
for (const [name, cmd] of PS_ALLOWED) expect(`KIT-T1121 control: PowerShell allows ${name}`, run(d, cmd, 'PowerShell').code, 0);

// Glob operands follow the recursive-search policy (KIT-T085): an indexed JS/TS glob is the code graph's; a non-indexed one passes.
expect('KIT-T1121: blocks a non-recursive grep of a TS glob', run(d, 'grep -n useState src/*.ts').code, 2);
expect('KIT-T1121 control: a markdown glob grep passes', run(d, 'grep -n usage docs/*.md').code, 0);
expect('KIT-T1121 control: a grep of one TS file passes', run(d, 'grep -n useState src/App.ts').code, 0);

expect('KIT-T1121 control: an unadopted repo is never gated', run(un, 'cat crates/*/src/*.rs | grep fn').code, 0);

console.log(failures ? `\n${failures} FAIL` : '\nall pass');
process.exit(failures ? 1 : 0);
