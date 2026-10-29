#!/usr/bin/env node
// source-shell-gate.test.mjs — a shell write of a source file is refused and points at Edit/Write
// (KIT-T648); reads, kit verbs, git, temp files, data files and build tools pass; the config
// exclusion lifts it.
// Run: node hooks/source-shell-gate.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSourcePath, shellSourceWrite } from './lib/shell-source-write.mjs';
import { maskInertStrings } from './lib/shell-quotes.mjs';

const HOOK = fileURLToPath(new URL('./source-shell-gate.mjs', import.meta.url));
let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
};

const repo = mkdtempSync(join(tmpdir(), 'kit-shellsrc-'));
const plain = mkdtempSync(join(tmpdir(), 'kit-shellsrc-plain-'));
execFileSync('git', ['init', '-q'], { cwd: repo });
mkdirSync(join(repo, '.ai'), { recursive: true });
const run = (command, cwd = repo) => spawnSync(process.execPath, [HOOK], { cwd, input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8' });
const blocked = (command) => run(command).status === 2;

try {
  const WRITES = [
    ['sed -i on a shader', "sed -i 's/a/b/' rapid-game/shaders/shader_kit.wgsl"],
    ['perl -pi on a rust file', "perl -pi -e 's/a/b/' crates/x/src/slot.rs"],
    ['a redirect into a script', 'echo "export const x = 1;" > scripts/new.mjs'],
    ['an append into a rust file', 'echo "fn a() {}" >> src/lib.rs'],
    ['a heredoc into a source file', "cat > src/main.rs <<'EOF'\nfn main() {}\nEOF"],
    ['tee into a source file', 'echo x | tee crates/a/src/lib.rs'],
    ['a copy over a source file', 'cp draft.rs crates/a/src/lib.rs'],
    ['a move onto a source file', 'mv draft.py tools/run.py'],
    ['a PowerShell Set-Content', 'Set-Content -Path src\\app.ts -Value hi'],
    ['a PowerShell Out-File', "'x' | Out-File crates\\a\\src\\lib.rs"],
    ['node -e with fs writes to a source path', `node -e "require('fs').writeFileSync('scripts/q-help.mjs','x')"`],
    ['python -c writing a source file', `python -c "open('tools/run.py','w').write('x')"`],
    ['a node heredoc rewriting a source file', "node - <<'EOF'\nfs.writeFileSync('hooks/lib/a.mjs', t)\nEOF"],
    ['a chained command', 'cargo fmt && sed -i s/a/b/ src/lib.rs'],
  ];
  for (const [name, command] of WRITES) {
    const r = run(command);
    check(`blocks ${name}`, r.status === 2 && /Edit/.test(r.stderr) && /source-shell-write/.test(r.stderr), `exit=${r.status} ${r.stderr.slice(0, 120)}`);
  }

  const PASSES = [
    ['cat of a source file', 'cat src/lib.rs'],
    ['a source file read out to scratch', 'cat src/lib.rs > /tmp/lib.rs'],
    ['a redirect into the temp dir', `cat src/lib.rs > ${join(tmpdir(), 'copy.rs').replace(/\\/g, '/')}`],
    ['a redirect into build output', 'cargo run > target/debug/out.rs'],
    ['a redirect into a data file', 'echo {} > out.json'],
    ['a log redirect', 'cargo test 2>&1 > build.log'],
    ['stderr to the null device', 'cargo build 2> /dev/null'],
    ['an arrow and a fat arrow in prose', 'echo "a -> src/lib.rs and b => c.rs"'],
    ['git', 'git add src/lib.rs'],
    ['sed without -i', "sed -n '1,5p' src/lib.rs"],
    ['sed -i on a non-source file', "sed -i 's/a/b/' notes.txt"],
    ['rm of a data file', 'rm out.json'],
    ['a build tool', 'cargo fmt'],
    ['a kit verb', 'node /k/scripts/q.mjs code write_plan --path src/lib.rs'],
    ['node -e that reads source', `node -e "console.log(require('fs').readFileSync('src/lib.rs','utf8'))"`],
    ['node -e writing a data file', `node -e "require('fs').writeFileSync('out.json','{}')"`],
    ['node -e writing a temp file named .rs', `node -e "require('fs').writeFileSync('/tmp/x.rs','x')"`],
    ['a broker patch submit heredoc', "node scripts/broker/submit.mjs --land <<'EOF'\n*** write src/new.rs\nfn a() {}\nEOF"],
  ];
  for (const [name, command] of PASSES) check(`allows ${name}`, !blocked(command), run(command).stderr.slice(0, 120));

  const script = join(tmpdir(), `kit-shellsrc-script-${process.pid}.mjs`);
  writeFileSync(script, "import fs from 'node:fs';\nfs.writeFileSync('src/lib.rs', 'x');\n");
  check('blocks a scratch script that writes a source file', blocked(`node ${script}`));
  writeFileSync(script, "import fs from 'node:fs';\nfs.writeFileSync('out.json', 'x');\n");
  check('allows a scratch script that writes a data file', !blocked(`node ${script}`));
  rmSync(script, { force: true });

  check('shellSourceWrite names the path it found', shellSourceWrite('rm src\\lib.rs')?.path === 'src/lib.rs');
  check('isSourcePath: temp, build output, vendored and data paths are not source', !isSourcePath('/tmp/a.rs') && !isSourcePath('target/a.rs') && !isSourcePath('node_modules/x/a.js') && !isSourcePath('a.json') && isSourcePath('crates/a.rs'));
  check('allows an unadopted repo', run('echo x >> src/lib.rs', plain).status === 0);
  writeFileSync(join(repo, '.claude-kit-ignore.yaml'), 'source-shell-write:\n  - "gen/**"\n');
  check('the documented exclusion lifts the block', !blocked('echo x > gen/table.rs'));
  check('the exclusion is per path: other source paths still block', blocked('echo x > src/table.rs'));
  mkdirSync(join(repo, 'hooks'), { recursive: true });
  const into = repo.replace(/\\/g, '/');
  const outside = (command) => run(command, plain);
  check('KIT-T700: a heredoc into hooks/*.mjs after `cd <repo>` is blocked even when the session cwd is no repo', outside(`cd ${into} && cat > hooks/lib/x.mjs <<'EOF'\nexport const a = 1;\nEOF`).status === 2);
  check('KIT-T700: a redirect into hooks/*.mjs is blocked', blocked('echo "export const a = 1;" > hooks/gate.mjs'));
  check('KIT-T700: an inline node writeFileSync after `cd <repo>` is blocked from a non-repo cwd', outside(`cd ${into} && node -e "require('fs').writeFileSync('hooks/y.mjs','x')"`).status === 2);
  check('KIT-T700: sed -i after `cd <repo>` is blocked from a non-repo cwd', outside(`cd ${into}/hooks && sed -i s/a/b/ orient.mjs`).status === 2);
  check('KIT-T700 negative control: a scratchpad write after `cd <repo>` passes', outside(`cd ${into} && cat > ${join(tmpdir(), 'scratchpad', 'probe.mjs').replace(/\\/g, '/')} <<'EOF'\nx\nEOF`).status === 0);
  check('KIT-T700 negative control: writing a .ai store note after `cd <repo>` passes', outside(`cd ${into} && echo note > .ai/notes/a.md`).status === 0);
  check('KIT-T700 negative control: the same write from a non-repo directory with no cd passes', outside('cat > hooks/x.mjs <<\'EOF\'\nx\nEOF').status === 0);
  const probe = `{"tool_input":{"command":"cd /d/dev/claude-kit && cat > hooks/x.mjs <<EOF\\nx\\nEOF"}}`;
  const passes = [
    ['single-quoted probe payload piped to node', `echo '${probe}' | node hook.mjs`],
    ['double-quoted payload piped to cat', 'echo "cat > hooks/x.mjs" | cat'],
    ['printf payload piped to jq', "printf '%s' 'cat > hooks/x.mjs' | jq ."],
    ['payload piped to python with a script file', "echo 'cat > hooks/x.mjs' | python3 check.py"],
    ['PowerShell doubled quote kept as data', "echo 'it''s > hooks/x.mjs here'"],
  ];
  for (const [name, command] of passes) check(`KIT-T701: ${name} passes`, !blocked(command), run(command).stderr.slice(0, 100));
  const holes = [
    ['bash -c with a double-quoted heredoc write', 'bash -c "cat > hooks/x.mjs <<EOF\nx\nEOF"'],
    ['bash -c with a redirect', `bash -c 'echo hi > hooks/x.mjs'`],
    ['sh -c fed by a pipe', `echo x | sh -c 'echo hi > hooks/x.mjs'`],
    ['dash -c', `dash -c 'echo hi > hooks/x.mjs'`],
    ['wsl sh -c', `wsl sh -c "echo hi > hooks/x.mjs"`],
    ['su -c', `su -c 'echo hi > hooks/x.mjs'`],
    ['ssh host command', `ssh host 'echo hi > hooks/x.mjs'`],
    ['xargs sh -c', `echo x | xargs sh -c 'echo hi > hooks/x.mjs'`],
    ['powershell -Command Set-Content', 'powershell -Command "Set-Content hooks/x.mjs hi"'],
    ['pwsh -c', `pwsh -c "'x' | Out-File hooks/x.mjs"`],
    ['cmd /c', 'cmd /c "echo hi > hooks\\x.mjs"'],
    ['eval', `eval 'echo hi > hooks/x.mjs'`],
    ['command substitution in double quotes', 'echo "$(cat > hooks/x.mjs)"'],
    ['backticks in double quotes', 'echo "`cat > hooks/x.mjs`"'],
    ['an escaped quote hiding a redirect', 'echo "a\\" > hooks/x.mjs #"'],
    ['PowerShell backtick-escaped quotes', "echo `' > hooks/x.mjs `'"],
    ['a $\'…\' string', "echo $'a\\' ; cat > hooks/x.mjs ; echo \\'b'"],
    ['a quote inside a comment', "echo hi # ' ; cat > hooks/x.mjs ; echo '"],
    ['a payload piped into a shell', "echo 'cat > hooks/x.mjs' | bash"],
    ['a payload piped into node -', "echo 'require(\"fs\").writeFileSync(\"hooks/x.mjs\",1)' | node -"],
    ['a quoted span across a newline', "echo 'a\ncat > hooks/x.mjs' | cat"],
    ['a heredoc after an echo', "echo 'a' && cat > hooks/x.mjs <<'EOF'\nx\nEOF"],
    ['node heredoc code naming the file inside quotes', `echo 'node - <<EOF fs.writeFileSync("hooks/a.mjs", 1)' | cat`],
    ['a real redirect after a quoted argument', "echo 'hi' > hooks/x.mjs"],
    ['a quoted redirect target', 'echo hi > "hooks/x.mjs"'],
    ['a write after a doubled-quote PowerShell string', "Write-Output 'it''s'; Set-Content hooks/x.mjs hi"],
  ];
  for (const [name, command] of holes) check(`KIT-T701 fail-closed: ${name} blocks`, blocked(command), run(command).stderr.slice(0, 100));
  check('KIT-T701: maskInertStrings blanks an echo payload and keeps a quoted redirect target', maskInertStrings(`echo 'a > b.mjs' | cat`) === `echo '' | cat` && maskInertStrings(`echo hi > 'c.mjs'`) === `echo hi > 'c.mjs'`);
  check('KIT-T701: maskInertStrings returns ambiguous text unchanged', ["echo 'unbalanced", 'echo `x`', "echo hi # c '", "cat <<EOF\n'a'\nEOF"].every((t) => maskInertStrings(t) === t));
  check('fail-open: a malformed payload exits 0', spawnSync(process.execPath, [HOOK], { cwd: repo, input: 'not json', encoding: 'utf8' }).status === 0);
} finally {
  rmSync(repo, { recursive: true, force: true });
  rmSync(plain, { recursive: true, force: true });
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
