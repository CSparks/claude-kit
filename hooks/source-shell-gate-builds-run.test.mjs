// The quoted command of `builds --run` is judged as the command it is (KIT-T1284): a copy of a built exe under target/ passes
// as it would in a direct call, a hand write of a source file inside it is still refused, and `&&` or the closing quote is
// never read as a path. Run: node hooks/source-shell-gate-builds-run.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanAllShellWrites } from './lib/shell-write-scan.mjs';
import { shellSourceWrites } from './lib/shell-source-write.mjs';

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
// A working-directory option is refused in every form (KIT-T1284, reviews of 2791d58 and 74927ba): no parsing of its value.
const CWD_FORMS = [
  'builds --run "./p.exe" --cwd x', 'builds --run "./p.exe" --cwd=x', 'builds --run "./p.exe" "--cwd" x', "builds --run \"./p.exe\" '--cwd=x'", 'builds --run "./p.exe" --cwd a --cwd b',
  'builds --run "./p.exe" --cwd %VAR%', 'builds --run "./p.exe" --cwd !VAR!', 'builds --run "./p.exe" --cwd $DIR', 'builds --run "./p.exe" --cwd "$(pwd)"', 'builds --run "./p.exe" --cwd `pwd`',
  'builds --run "./p.exe" --cwd', 'builds --run "./p.exe" --out o.txt --cwd target', 'builds --run "./p.exe" --cwd target/debug --out o.txt', 'builds --cwd x --run "./p.exe"', 'builds --run "./p.exe" --"cwd" x',
  'builds --run "./p.exe" --cwd="x y"', 'builds --run "cp a.bin q.exe" --cwd ./target',
];
report('every form of a working-directory option is refused, with the way out named', stops(CWD_FORMS));
const cwdText = verdict('builds --run "./p.exe" --cwd x').text;
check('the refusal says to run from the project root or to put the directory change inside the quoted command', /run it from the project root with paths relative to the root/.test(cwdText) && /cd <dir> && \.\.\./.test(cwdText));
report('the same forms through PowerShell are refused', stops(['builds --run "./p.exe" --cwd x', 'builds --run "./p.exe" --cwd=x', 'builds --run "./p.exe" --cwd %VAR%'], 'PowerShell'));
report('a hand write inside the quoted command is refused with and without a refused --cwd', stops(['builds --run "echo x > src/hand.rs"', 'builds --run "echo x > src/hand.rs" --cwd target', 'builds --run "cp src/a.rs src/b.rs" --cwd=x']));
const both = shellSourceWrites('builds --run "echo x > src/hand.rs" --cwd target');
check('the quoted command is scanned whatever the launcher flags say: the launcher refusal and the hand write are both hits', Boolean(both) && scanAllShellWrites('builds --run "echo x > src/hand.rs" --cwd target', { hit: (p) => (/\.rs$/.test(p) ? { path: p } : null), codeHit: () => null }).some((h) => h.launcherProblem)
  && scanAllShellWrites('builds --run "echo x > src/hand.rs" --cwd target', { hit: (p) => (/\.rs$/.test(p) ? { path: p } : null), codeHit: () => null }).some((h) => h.path === 'src/hand.rs'));
// The launcher's whole surface is an allowlist (KIT-T1284, review of def8fb5): --out names a file the verb writes.
const scratch = mkdtempSync(join(tmpdir(), 'sgbr-scratch-')).replace(/\\/g, '/');
const OUT_REFUSED = [
  'builds --run "./p.exe" --out src/lib.rs', 'builds --run "./p.exe" --out=src/lib.rs', 'builds --run "./p.exe" --out "src/lib.rs"', "builds --run \"./p.exe\" --out '../src/x.rs'", 'builds --run "./p.exe" --out o.txt',
  'builds --run "./p.exe" --out $F', 'builds --run "./p.exe" --out "$(pwd)/x"', 'builds --run "./p.exe" --out *.rs', 'builds --run "./p.exe" --out %OUT%', 'builds --run "./p.exe" --out !OUT!',
  'builds --run "./p.exe" --out a.txt --out target/b.txt', 'builds --run "./p.exe" --out', 'builds --run "./p.exe" --out --limit 5', 'builds --run "./p.exe" --out ""', 'builds --run "./p.exe" --out target/../src/x.rs',
  'builds --run "./p.exe" --out ~/x.txt', 'builds --run "./p.exe" --out /etc/passwd', 'builds --run "./p.exe" --out C:/Users/x/src/lib.rs', 'builds --run "./p.exe" --out target/x.txt --out=y.txt', 'builds --run "./p.exe" --"out" src/lib.rs',
  'builds --run "./p.exe" --out ../target/x.txt',
];
report('--out must be a plain literal under target/ or the scratchpad: anywhere else, unresolvable, repeated or empty is refused', stops(OUT_REFUSED));
const OPERANDS_REFUSED = [
  'builds --run "./p.exe" --limit abc', 'builds --run "./p.exe" --timeout 1e9', 'builds --run "./p.exe" --tool-timeout $X', 'builds --run "./p.exe" --limit', 'builds --run "./p.exe" --limit=-5', 'builds --run "./p.exe" --timeout 170s',
  'builds --run "./p.exe" --limit 5 --limit 6', 'builds --run "./p.exe" --foo 1', 'builds --run "./p.exe" --wait', 'builds --run "./p.exe" extra', 'builds --run "./p.exe" --run "./q.exe"', 'builds --run "./p.exe" -o x',
  'builds --run "./p.exe" --limit "$(cat n)"', 'builds --run "./p.exe" --result id', 'builds --run "./p.exe" --out target/x.txt --verbose',
];
report('every other flag, bare word, repeated flag or non-numeric value is refused', stops(OPERANDS_REFUSED));
const refusalText = verdict('builds --run "./p.exe" --out src/lib.rs').text;
check('the refusal names the allowed surface and the allowed output locations', /takes only --run "<command>", --out <file> \(a path under target\/ or the session scratchpad/.test(refusalText) && /numbers for --limit, --timeout and --tool-timeout/.test(refusalText));
report('the allowed surface passes: --out under target/ or an absolute scratch path, numbers, the = form, quotes, any order', passes([
  'builds --run "./p.exe" --out target/o.txt', 'builds --run "./p.exe" --out ./target/o.txt', 'builds --run "./p.exe" --out "target/x y.txt"', 'builds --run "./p.exe" --out=target/o.txt', "builds --run \"./p.exe\" --out 'target/houses/o.txt'",
  'builds --run "./p.exe" --out crates/a/target/o.txt', `builds --run "./p.exe" --out ${scratch}/o.txt`, 'builds --run "./p.exe" --limit 600 --timeout 170 --tool-timeout 180 --out target/o.txt', 'builds --run "./p.exe" --limit 1.5',
  'builds --limit 600 --run "./p.exe" --out target/o.txt', 'builds --run "./p.exe" --timeout=170', 'builds --run "./p.exe"',
]));
report('the same through PowerShell', stops(['builds --run "./p.exe" --out src/lib.rs', 'builds --run "./p.exe" --limit abc'], 'PowerShell').concat(passes(['builds --run "./p.exe" --out target/o.txt --timeout 170'], 'PowerShell')));
report('plain forms pass: no working-directory option', passes(['builds --run "./target/debug/probe.exe --frames 3" --out target/o.txt', 'builds --run "cargo build && cp target/debug/p.exe target/q.exe" --limit 600 --timeout 170 --tool-timeout 180']));
const outside = mkdtempSync(join(tmpdir(), 'sgbr-out-')).replace(/\\/g, '/');
report('a cd inside the quoted command moves the directory its later writes are judged in, as in a direct call: a directory outside every adopted repo passes', passes([`builds --run "cd ${outside} && cp a.bin gen/out.rs"`, `cd ${outside} && cp a.bin gen/out.rs`]));
check('a cd inside the quoted command and the same cd in a direct call get the same verdict', ['cd target && cp a.bin gen/out.rs', 'cd crates/a && echo x > hand.rs', `cd ${outside} && echo x > hand.rs`]
  .every((direct) => verdict(`builds --run "${direct}"`).blocked === verdict(direct).blocked));
report('and the same cd into a source directory refuses, as in a direct call', stops(['builds --run "cd crates/a && cp a.bin gen/out.rs"', 'cd crates/a && cp a.bin gen/out.rs']));

report('control: other builds verbs and a quoted word of another program are unchanged', passes(['builds', 'builds --audit', 'builds --wait "target/x/lib.rs" --timeout 170']));

// A refused launcher call gets the launcher's usage, not the Write-gate advice (KIT-T1313).
for (const bad of ['builds --run', 'builds --run "cargo check" --bogus 1', 'builds --run "cargo check" --out src/x.txt']) {
  const text = verdict(bad).text;
  check(`KIT-T1313 the block of "${bad}" names the usage form and not the Write-tool advice`,
    text.includes('builds --run "<command>" --out <file> --timeout N --tool-timeout N') && text.includes('finished.log') && !text.includes('Use the Write tool'));
}
// A refused launcher call carries a worked example and the usual wrong turns named (KIT-T1326).
const EXAMPLE = 'builds --run "cd crates/foo && cargo test -p foo 2>&1 | tail -30" --out crates/foo/target/test.txt --timeout 170 --tool-timeout 180';
for (const bad of ['builds --run', 'builds --run "cargo check" --out src/x.txt']) {
  const text = verdict(bad).text;
  check(`KIT-T1326 the block of "${bad}" carries the worked example, with the filter inside the quotes`, text.includes(EXAMPLE) && /read the --out file/.test(text));
}
const tmpText = verdict('builds --run "cargo test -p x" --out /tmp/t.txt').text;
check('KIT-T1326 an --out under /tmp says /tmp is not the scratchpad and names target/ instead', /\/tmp is not the session scratchpad/.test(tmpText) && /--out target\/<file>/.test(tmpText));
check('KIT-T1326 control: an --out refusal elsewhere does not mention /tmp', !/\/tmp is not/.test(verdict('builds --run "cargo test -p x" --out src/x.txt').text));
check('KIT-T1313 control: a real hand write keeps the Write-tool advice and no launcher usage', (() => {
  const text = verdict('echo x > src/hand.rs').text;
  return text.includes('Use the Write tool') && !text.includes('--tool-timeout N');
})());

// KIT-T1552: a `cd` inside a quoted command moves the directory its git call's relative pathspec is read in, and an absolute
// pathspec under `git -C <dir>` is not joined to <dir>.
{
  const slash = (p) => p.replace(/\\/g, '/').toLowerCase();
  const real = (p) => slash(realpathSync.native(p));
  const top = slash(execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8' }).trim());
  mkdirSync(join(root, 'sub'), { recursive: true });
  const before = process.cwd();
  process.chdir(root);
  const owned = (command) => shellSourceWrites(command, { shell: 'bash' }).filter((h) => h.path === 'own.rs');
  const places = (command) => owned(command).map((h) => real(h.from || process.cwd()));
  const inSub = [`builds --run "cd sub && git stash push -u -- own.rs" --out target/x.txt`, 'bash -c "cd sub && git stash push -u -- own.rs"', 'sh -c "cd sub; git stash push -u -- own.rs"'];
  check('a git stash inside a quoted command is judged in the directory its cd chose', inSub.every((c) => places(c).length > 0 && places(c).every((p) => p === real(join(root, 'sub')))));
  check('control: a git stash before the cd inside the quoted command keeps the outer directory', places('builds --run "git stash push -u -- own.rs && cd sub" --out target/x.txt').every((p) => p === real(root)));
  // A cd that may not run in this shell is no proof of where the call runs (security review of the KIT-T1552 fix): both directories are judged.
  const distinct = (command) => [...new Set(places(command))].sort();
  const here = real(root);
  const there = real(join(root, 'sub'));
  const both = [here, there].sort();
  check('a cd joined by && from the start is followed alone', JSON.stringify(distinct('bash -c "cd sub && git stash push -u -- own.rs"')) === JSON.stringify([there]));
  check('a cd after ; is followed alone', JSON.stringify(distinct('bash -c "git status; cd sub; git stash push -u -- own.rs"')) === JSON.stringify([there]));
  const unsure = {
    'a cd in an || branch': 'bash -c "false || cd sub; git stash push -u -- own.rs"',
    'a cd after a command that can fail and skip it': 'bash -c "false && cd sub; git stash push -u -- own.rs"',
    'a cd in a subshell': 'bash -c "(cd sub); git stash push -u -- own.rs"',
    'a cd in a pipeline': 'bash -c "cd sub | true; git stash push -u -- own.rs"',
    'a cd in an if branch': 'bash -c "if true; then cd sub; fi; git stash push -u -- own.rs"',
    'a backgrounded cd': 'bash -c "cd sub & git stash push -u -- own.rs"',
    'a cd piped with |&': 'bash -c "cd sub |& cat; git stash push -u -- own.rs"',
    'a cd backgrounded before a later segment': 'bash -c "cd sub & echo hi; git stash push -u -- own.rs"',
    'a cd before ||': 'bash -c "cd sub || git stash push -u -- own.rs"',
    'a cd in a group':'bash -c "{ cd sub; }; git stash push -u -- own.rs"',
  };
  for (const [name, command] of Object.entries(unsure)) check(`${name} judges the hit in both directories`, JSON.stringify(distinct(command)) === JSON.stringify(both));
  check('control: a git stash in a direct call is unchanged', shellSourceWrites('git stash push -u -- own.rs', { shell: 'bash' }).some((h) => h.path === 'own.rs' && !h.from));
  process.chdir(before);
  const absolute = shellSourceWrites(`git -C "${top}" stash push -u -- "${top}/mine.rs"`, { shell: 'bash', tempDir: '/no-such-temp' });
  check('an absolute pathspec under git -C names that path, not <dir>/<absolute path>', absolute.some((h) => slash(h.path) === `${top}/mine.rs`) && !absolute.some((h) => slash(h.path).includes(`${top}/${top}`)));
  const relative = shellSourceWrites(`git -C "${top}" stash push -u -- mine.rs`, { shell: 'bash', tempDir: '/no-such-temp' });
  check('control: a relative pathspec under git -C is still joined to <dir>', relative.some((h) => slash(h.path) === `${top}/mine.rs`));
}

console.log(fails ? `\nsource-shell-gate-builds-run: ${fails} failed` : '\nsource-shell-gate-builds-run: all pass');
process.exit(fails ? 1 : 0);
