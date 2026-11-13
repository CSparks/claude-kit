#!/usr/bin/env node
// store-shell-gate.test.mjs — a shell write of the .ai work store is refused and names the verb that
// does it; reads, kit verbs, git and ordinary files pass; the config exclusion lifts it.
// Run: node hooks/store-shell-gate.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shellStoreWrite } from './lib/store-shell-write.mjs';
import { hiddenBehindQuotes } from './hidden-command-cases.mjs';

const HOOK = fileURLToPath(new URL('./store-shell-gate.mjs', import.meta.url));
let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
};

const repo = mkdtempSync(join(tmpdir(), 'kit-shellstore-'));
const plain = mkdtempSync(join(tmpdir(), 'kit-shellstore-plain-'));
execFileSync('git', ['init', '-q'], { cwd: repo });
mkdirSync(join(repo, '.ai', 'decisions'), { recursive: true });
const run = (command, cwd = repo, tool = 'Bash') => spawnSync(process.execPath, [HOOK], { cwd, input: JSON.stringify({ tool_name: tool, tool_input: { command } }), encoding: 'utf8' });
const blocked = (command) => run(command).status === 2;

try {
  const WRITES = [
    ['a redirect into SESSION.md', 'echo "- done" >> .ai/SESSION.md', /t session/],
    ['a heredoc into a ticket', "cat > .ai/tickets/X-T001-a.md <<'EOF'\nbody\nEOF", /t new/],
    ['a rename of an inbox capture', 'mv .ai/inbox/a.md .ai/inbox/triaged/a.md', /t triage/],
    ['an rm of a decision', 'rm .ai/decisions/X-D001-a.md', /t revise|t decide/],
    ['sed -i on a ticket', "sed -i 's/todo/doing/' .ai/tickets/X-T001-a.md", /t status/],
    ['a copy into the store', 'cp draft.md .ai/notes/X-N001.md', /t note/],
    ['tee into the store', 'echo x | tee .ai/questions/X-Q001.md', /t question/],
    ['a PowerShell Set-Content', 'Set-Content -Path .ai\\decisions\\X-D001-a.md -Value hi', /t decide/],
    ['node -e with fs writes to a store path', `node -e "require('fs').writeFileSync('.ai/decisions/X-D001-a.md','x')"`, /t revise|t decide/],
    ['node -e building the path from parts', `node -e "const fs=require('fs');fs.renameSync(path.join('.ai','inbox','a.md'),'b')"`, /t triage|cap/],
    ['a node heredoc rewriting a decision', "node - <<'EOF'\nfs.writeFileSync('.ai/decisions/X-D001-a.md', t)\nEOF", /t revise|t decide/],
    ['a central data root path', 'echo x > /d/data/projects/dirt-empire/tickets/DE-T001-a.md', /t new/],
  ];
  for (const [name, command, hint] of WRITES) {
    const r = run(command);
    check(`blocks ${name}`, r.status === 2 && hint.test(r.stderr), `exit=${r.status} ${r.stderr.slice(0, 120)}`);
  }

  check('KIT-T705: a store rm hidden behind an escaped quote or a $\'…\' string blocks', hiddenBehindQuotes('rm .ai/decisions/X-D001-a.md').every((c) => blocked(c)));
  check('KIT-T705: a store rm behind a reader leader and an escaped quote blocks', blocked('grep \\" ; rm .ai/decisions/X-D001-a.md ; echo \\"'));

  check("KIT-T784: a git commit -F - heredoc whose body holds an apostrophe, rm and a redirect passes", !blocked("git commit -q -F - <<'EOF'\nfix: ancestors' rm .ai/tickets/a.md > .ai/SESSION.md\nEOF"));
  check("KIT-T784 control: a store redirect on the heredoc line still blocks", blocked("cat > .ai/tickets/X-T001-a.md <<'EOF'\nit's\nEOF"));
  check("KIT-T784 control: a store rm after the heredoc still blocks", blocked("git commit -q -F - <<'EOF'\nmsg\nEOF\nrm .ai/decisions/X-D001-a.md"));
  check("KIT-T784 control: a shell heredoc body that writes the store still blocks", blocked("bash <<'EOF'\nrm .ai/decisions/X-D001-a.md\nEOF"));
  check("KIT-T784 control: node reading its program from a heredoc still blocks", blocked("node - <<'EOF'\nfs.writeFileSync('.ai/decisions/X-D001-a.md', t)\nEOF"));

  const FILTER = "npm run publish:runtime 2>&1 | grep -vE '^\\s*$' | grep -v '^> ' | tail -20";
  check("KIT-T1018: a pipe that filters stdout with a '^\\s*$' pattern and a '^> ' pattern passes", !blocked(FILTER), run(FILTER).stderr.slice(0, 120));
  check('KIT-T1018 control: a store redirect after the same filter still blocks', blocked("npm run x | grep -vE '^\\s*$' > .ai/SESSION.md"));
  check('KIT-T1018 control: a store rm after the same filter still blocks', blocked("npm run x | grep -vE '^\\s*$'; rm .ai/tickets/X-T001-a.md"));
  check("KIT-T1018 control: a real $'…' string with a write token still blocks", blocked("echo $'a\\' ; rm .ai/decisions/X-D001-a.md ; echo '"));

  const READ_ONLY_AMBIGUOUS = ["cargo test 2>&1 | grep -E $'^ok' | tail", "cargo test 2>/dev/null | grep -E $'^ok'", "cargo test &>/dev/null; grep -c $'ok' out.log", 'cargo test >&2 | grep -E $\'^ok\''];
  for (const command of READ_ONLY_AMBIGUOUS) check(`KIT-T1012: an ambiguous-quoting read-only pipe with only fd or null-device redirects passes: ${command}`, !blocked(command), run(command).stderr.slice(0, 120));
  check('KIT-T1012 control: the same ambiguous pipe redirected into the store still blocks', blocked("cargo test 2>&1 | grep -E $'^ok' > .ai/SESSION.md"));
  check('KIT-T1012 control: a store target after an fd duplication still blocks', blocked("cargo test 2>&1 >> .ai/SESSION.md ; echo $'x'"));
  check('KIT-T1012 control: a stderr redirect into the store still blocks', blocked("cargo test 2>.ai/SESSION.md ; echo $'x'"));
  check('KIT-T1012 control: an ambiguous pipe with a store rm still blocks', blocked("cargo test 2>&1 | grep -E $'^ok' ; rm .ai/tickets/X-T001-a.md"));

  const chained = (body) => `t notes RDG-T015 "flyover <rings> -> tuned"; git add a.rs b.rs .ai; git commit -q -m @'\n${body}\n'@; git log --oneline -3; git status --short`;
  const MESSAGE = "fix: ancestors' copy -> rename (implements RDG-T015)";
  check('KIT-T1096: a t verb, git add of .ai and a here-string commit message whose body holds an apostrophe, a write word and an arrow passes', !blocked(chained(MESSAGE)), run(chained(MESSAGE)).stderr.slice(0, 160));
  check('KIT-T1096 control: a store rm chained after the here-string commit still blocks', blocked(`${chained(MESSAGE)}; rm .ai/decisions/X-D001-a.md`));
  check('KIT-T1096 control: a Set-Content of a ticket with a here-string value still blocks', blocked("git add .ai; Set-Content .ai/tickets/X-T001-a.md @'\nit's\n'@"));
  const span = run("echo ok ; echo it's ; rm .ai/decisions/X-D001-a.md");
  check('KIT-T1096: the block names the ambiguous construct, its position, the text around it and the write word', span.status === 2
    && /Ambiguous span: a quote that never closes at character 17, near "[^"]*it's[^"]*"/.test(span.stderr) && /write word that made it a hit: "rm"/.test(span.stderr), span.stderr.slice(0, 300));

  check('KIT-T705 negative control: node -e with escaped quotes and no write passes',!blocked('node -e "console.log(\\"x\\")"'));

  const powershellBlocked = (command) => run(command, repo, 'PowerShell').status === 2;
  const TEST_RM = 'rm rapid-game/rust/world/rg-townplan/tests/tmp_drive.rs; cargo test -p rg-townplan 2>&1 | grep -E "test result|\\"FAILED\\"" | tail -20';
  const POWERSHELL_FILTER = 'rm out/a.txt; cargo test 2>&1 | powershell -NoProfile -Command "Where-Object { \\$_ -match \\"ok\\" }"';
  check('KIT-T1154: an rm of a source test file then a cargo test grep with an escaped quote passes under bash rules', !blocked(TEST_RM), run(TEST_RM).stderr.slice(0, 160));
  check('KIT-T1118: an rm then an inline powershell -Command filter with escaped quotes passes under bash rules', !blocked(POWERSHELL_FILTER), run(POWERSHELL_FILTER).stderr.slice(0, 160));
  check('KIT-T1154 control: the same command redirected into the store still blocks', blocked(`${TEST_RM} > .ai/SESSION.md`));
  check('KIT-T1154 control: an escaped-quote grep followed by sed -i on a ticket still blocks', blocked('cargo test 2>&1 | grep -E "a|\\"b\\"" ; sed -i s/todo/doing/ .ai/tickets/X-T001-a.md'));
  check('KIT-T1154 control: an escaped-quote grep followed by an rm of a decision still blocks', blocked('cargo test 2>&1 | grep -E "a|\\"b\\"" ; rm .ai/decisions/X-D001-a.md'));
  check('KIT-T1154 control: a command bash cannot close (unclosed quote) with a redirect still blocks', blocked("echo it's ; echo x >> .ai/SESSION.md"));
  check('KIT-T1154 control: a command bash cannot close (unclosed quote) with an in-place editor still blocks', blocked("echo it's ; sed -i s/a/b/ src/lib.rs"));
  check('KIT-T1154 policy: the PowerShell tool keeps an escape before a quote ambiguous, so a write word in it blocks', powershellBlocked(TEST_RM));
  check('KIT-T1154 policy: the PowerShell tool with no write word and an escaped quote passes', !powershellBlocked('cargo test 2>&1 | grep -E "a|\\"b\\"" | tail -20'));
  check('KIT-T1154 control: the PowerShell tool with an escaped quote and a store redirect blocks', powershellBlocked('cargo test 2>&1 | grep -E "a|\\"b\\"" > .ai/SESSION.md'));

  const READS = [
    ['cat of a ticket', 'cat .ai/tickets/X-T001-a.md'],
    ['a redirect of store content OUT to scratch', 'cat .ai/SESSION.md > /tmp/s.md'],
    ['a kit verb with a store path argument', 'node /k/scripts/t.mjs session --file .ai/draft.md'],
    ['t itself', 't session "x"'],
    ['t status on a ticket (KIT-D120)', 't status X-T001 done --fixed-commit a1b2c3d'],
    ['t unlink on a ticket (KIT-D120)', 'node /k/scripts/t.mjs unlink X-T001 superseded_by X-T002'],
    ['cap', 'cap bug "x" --project claude-kit'],
    ['git add of the store', 'git add .ai/tickets/X-T001-a.md'],
    ['rm of an ordinary file', 'rm build/out.txt'],
    ['node -e that reads the store', `node -e "console.log(require('fs').readFileSync('.ai/SESSION.md','utf8'))"`],
    ['node -e writing an ordinary file', `node -e "require('fs').writeFileSync('out.txt','x')"`],
    ['an arrow in prose', 'echo "a -> .ai/tickets/x.md"'],
    ['q', 'node /k/scripts/q.mjs fts stale'],
  ];
  for (const [name, command] of READS) check(`allows ${name}`, !blocked(command), run(command).stderr.slice(0, 120));

  const script = join(tmpdir(), `kit-shellstore-script-${process.pid}.mjs`);
  writeFileSync(script, "import fs from 'node:fs';\nfs.writeFileSync('.ai/decisions/X-D001-a.md', 'x');\n");
  check('blocks a scratch script that writes a store path', blocked(`node ${script}`));
  writeFileSync(script, "import fs from 'node:fs';\nfs.writeFileSync('out.txt', 'x');\n");
  check('allows a scratch script that writes an ordinary file', !blocked(`node ${script}`));
  rmSync(script, { force: true });

  check('shellStoreWrite names the path it found', shellStoreWrite('rm .ai/inbox/a.md')?.path === '.ai/inbox/a.md');
  check('allows an unadopted repo', run('echo x >> .ai/SESSION.md', plain).status === 0);
  writeFileSync(join(repo, '.claude-kit-ignore.yaml'), 'store-shell-write:\n  - ".ai/inbox/**"\n');
  check('the documented exclusion lifts the block', !blocked('mv .ai/inbox/a.md .ai/inbox/triaged/a.md'));
  check('the exclusion is per path: other store paths still block', blocked('rm .ai/decisions/X-D001-a.md'));
  check('fail-open: a malformed payload exits 0', spawnSync(process.execPath, [HOOK], { cwd: repo, input: 'not json', encoding: 'utf8' }).status === 0);
} finally {
  rmSync(repo, { recursive: true, force: true });
  rmSync(plain, { recursive: true, force: true });
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
