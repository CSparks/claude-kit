// The quoted command of `builds --run` is judged as the command it is (KIT-T1284): a copy of a built exe under target/ passes
// as it would in a direct call, a hand write of a source file inside it is still refused, and `&&` or the closing quote is
// never read as a path. Run: node hooks/source-shell-gate-builds-run.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = mkdtempSync(join(tmpdir(), 'sgbr-'));
execFileSync('git', ['init', '-q'], { cwd: root });
mkdirSync(join(root, '.ai'));
const gate = fileURLToPath(new URL('./source-shell-gate.mjs', import.meta.url));
let fails = 0;
const check = (name, cond) => { console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}`); if (!cond) fails++; };
const verdict = (command, tool = 'Bash') => {
  const r = spawnSync(process.execPath, [gate], { cwd: root, encoding: 'utf8', input: JSON.stringify({ session_id: 'S1', tool_name: tool, tool_input: { command } }) });
  return { blocked: r.status === 2 && /source-shell-write/.test(r.stderr), text: r.stderr };
};
const passes = (commands, tool) => commands.filter((c) => verdict(c, tool).blocked);
const stops = (commands, tool) => commands.filter((c) => !verdict(c, tool).blocked);
const report = (name, wrong) => { check(name, wrong.length === 0); wrong.forEach((c) => console.log(`        ${c}`)); };

report('the incident command (build, copy a built exe to a private name, run it) passes', passes([
  'builds --run "cargo build -p road-generator --bin probe && cp target/debug/probe.exe target/houses/probe-buildings.exe && SHOT_DIR=target/houses ./target/houses/probe-buildings.exe looks" --out target/houses/o.txt',
  "builds --run 'cargo build -p x && cp target/debug/p.exe target/p2.exe && ./target/p2.exe' --out target/o.txt",
  'builds --run "cp target/debug/p.exe target/q.exe && cp a.png b.png" --timeout 170 --tool-timeout 180',
  'builds --run "cp target/debug/deps/census-abc.exe target/census.exe && ./target/census.exe --nocapture" --limit 600',
]));
report('a copy of a non-source file passes inside it as it does in a direct call', passes(['builds --run "cp target/debug/p.exe q.exe"', 'cp target/debug/p.exe q.exe']));
report('a hand write of a source file inside the quoted command is still refused', stops([
  'builds --run "echo x > src/hand.rs"', 'builds --run "cp src/a.rs src/b.rs" --out o.txt', 'builds --run "cargo build && tee src/x.rs"', 'builds --run "sed -i s/a/b/ src/a.rs"',
  'builds --run "cargo build -p x && cp target/debug/p.exe src/probe.rs"', "builds --run 'rm src/a.rs'",
]));
report('a redirect of the launcher call itself into a source file is still refused', stops(['builds --run "./target/debug/p.exe" > src/out.rs']));
report('the same through PowerShell', passes(['builds --run "cargo build -p x; Copy-Item target/debug/p.exe target/p2.exe; ./target/p2.exe"'], 'PowerShell'));
report('control: other builds verbs and a quoted word of another program are unchanged', passes(['builds', 'builds --audit', 'builds --wait "target/x/lib.rs" --timeout 170']));

console.log(fails ? `\nsource-shell-gate-builds-run: ${fails} failed` : '\nsource-shell-gate-builds-run: all pass');
process.exit(fails ? 1 : 0);
