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
const run = (command, cwd = repo) => spawnSync(process.execPath, [HOOK], { cwd, input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8' });
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

  const READS = [
    ['cat of a ticket', 'cat .ai/tickets/X-T001-a.md'],
    ['a redirect of store content OUT to scratch', 'cat .ai/SESSION.md > /tmp/s.md'],
    ['a kit verb with a store path argument', 'node /k/scripts/t.mjs session --file .ai/draft.md'],
    ['t itself', 't session "x"'],
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
