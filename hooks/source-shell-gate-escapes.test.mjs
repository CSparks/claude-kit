// source-shell-gate escape handling (KIT-T941, KIT-T934): under the Bash tool a backslash before a quote inside a
// double-quoted argument is a bash escape, so a cap, t or q call whose text holds escaped quotes, semicolons and
// write words is no shell write. Where the shell's rules are not bash's (the PowerShell tool), or the quoting cannot
// be closed, the line stays ambiguous and a write token in it blocks. Real writes block in both shells.
// Run: node hooks/source-shell-gate-escapes.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = fileURLToPath(new URL('./source-shell-gate.mjs', import.meta.url));
let fails = 0;
let passes = 0;
const check = (name, cond) => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name}`); }
};

const repo = mkdtempSync(join(tmpdir(), 'kit-shellesc-'));
execFileSync('git', ['init', '-q'], { cwd: repo });
mkdirSync(join(repo, '.ai'), { recursive: true });
const run = (tool, command) => spawnSync(process.execPath, [HOOK], { cwd: repo, input: JSON.stringify({ tool_name: tool, tool_input: { command } }), encoding: 'utf8' });

try {
  const PASSES = [
    ['a cap request, escaped quotes and write words in single quotes', `cap request 'Fix the \\"Shuffle\\" screen; users said \\"sed -i\\" fails > bad in Foo.kt'`],
    ['a cap request, escaped quotes and write words in double quotes', 'cap request "Fix the \\"Shuffle\\" screen; rm Foo.kt > bar"'],
    ['a t comment quoting a redirect to a source file', 't comment KIT-T1 "use \\"cat > a.kt\\" in the hook; mv a.kt b.kt"'],
    ['a q regex search with an escaped quote and a semicolon', 'q code "foo\\"bar; tee x.kt" --regex'],
  ];
  for (const [name, command] of PASSES) check(`Bash: ${name} passes`, run('Bash', command).status === 0);

  const BLOCKS = [
    ['Bash', 'an echo redirected into a source file through escaped quotes', 'echo hi \\"x\\" > Foo.kt', /Foo\.kt/],
    ['Bash', 'a heredoc into a source file', "cat > Foo.kt <<'EOF'\nfn main(){}\nEOF", /Foo\.kt/],
    ['Bash', 'sed -i after a verb', 'cap request "ok" ; sed -i s/a/b/ src/Foo.kt', /src\/Foo\.kt/],
    ['Bash', 'a write behind an escaped quote that closes the argument', 'cap request "a\\\\"; sed -i s/a/b/ src/Foo.kt; echo "', /Foo\.kt|may write/],
    ['Bash', 'a $\' string still ambiguous, with a write token', "echo $'a\\' ; sed -i s/a/b/ src/Foo.kt ; echo '", /may write/],
    ['Bash', 'an unclosed quote with a write token', 'cap request "it ; sed -i s/a/b/ src/Foo.kt', /may write/],
    ['PowerShell', 'a cap whose quotes PowerShell reads as escapes, then sed -i', 'cap "x\\" ; sed -i s/a/b/ src/Foo.kt ; echo \\""', /may write/],
  ];
  for (const [tool, name, command, shown] of BLOCKS) {
    const r = run(tool, command);
    check(`CONTROL (${tool}): ${name} blocks`, r.status === 2 && shown.test(r.stderr));
  }
} finally {
  rmSync(repo, { recursive: true, force: true });
}

console.log(`source-shell-gate-escapes: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
