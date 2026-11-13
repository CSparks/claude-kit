// KIT-T1157: the retrieval gate resolves a shell variable the command assigns as one literal earlier, and a search of a file
// outside every adopted repo (a session scratchpad test log) is no source-tree search. An unresolvable target, a
// directory, a path inside an adopted repo and a path beside a repo directory stay blocked; the block names the variable.
// Run: node hooks/query-gate-variables.test.mjs

import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HOOK = fileURLToPath(new URL('./query-gate.mjs', import.meta.url));
let failures = 0;

function makeRepo(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  mkdirSync(join(dir, '.ai', 'decisions'), { recursive: true });
  mkdirSync(join(dir, 'crates', 'a', 'src'), { recursive: true });
  return dir;
}

const run = (dir, command, tool_name = 'Bash') => {
  const r = spawnSync(process.execPath, [HOOK], { cwd: dir, input: JSON.stringify({ tool_name, tool_input: { command } }), encoding: 'utf8' });
  return { code: r.status, err: r.stderr || '' };
};

function expect(name, actual, wanted) {
  const ok = actual === wanted;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (exit=${actual}, want=${wanted})`);
  if (!ok) failures++;
}

const slashed = (p) => p.replace(/\\/g, '/');
const repo = makeRepo('qgv-repo-');
const other = makeRepo('qgv-other-');
const scratch = mkdtempSync(join(tmpdir(), 'qgv-scratch-'));
const log = slashed(join(scratch, 'joins'));
const logTxt = slashed(join(scratch, 'joins.txt'));
writeFileSync(join(scratch, 'joins'), 'Town: 1\n');
writeFileSync(join(scratch, 'joins.txt'), 'Town: 1\n');
mkdirSync(join(other, 'notes'), { recursive: true });
writeFileSync(join(other, 'notes', 'log'), 'x\n');
const inOther = slashed(join(other, 'notes', 'log'));

const PASSES = [
  ['rg of a variable holding an outside log', `S=${logTxt}; rg "^(Hamlet|Town|City):|^error" $S`],
  ['the reported shape: build into the variable, then rg it twice', `S=${logTxt}; cargo test > $S 2>&1; rg "^error" $S; rg -v "overlap" $S | rg -A3 "^Town:"`],
  ['an assignment joined by && before the rg', `S=${logTxt} && rg Town $S`],
  ['a braced variable', `S=${logTxt}; rg Town \${S}`],
  ['a quoted variable', `S=${logTxt}; rg Town "$S"`],
  ['an outside file with no extension, named literally', `rg Town ${log}`],
  ['a variable holding an outside file with no extension', `S=${log}; rg Town $S`],
  ['grep -r of an outside file', `S=${logTxt}; grep -rn Town $S`],
];
for (const [name, cmd] of PASSES) expect(`KIT-T1157: passes ${name}`, run(repo, cmd).code, 0);
expect('KIT-T1157: PowerShell passes a variable holding an outside log', run(repo, `$S = '${logTxt}'; rg Town $S`, 'PowerShell').code, 0);

const BLOCKS = [
  ['a variable never assigned', 'rg "fn main" $S'],
  ['a variable assigned twice', `S=${logTxt}; S=crates; rg Town $S`],
  ['a variable holding a repo source directory', `S=${slashed(join(repo, 'crates'))}; rg fn $S`],
  ['a variable holding an outside directory', `S=${slashed(scratch)}; rg Town $S`],
  ['an outside log beside a repo directory', `S=${logTxt}; rg Town $S crates/`],
  ['a file inside another adopted repo', `S=${inOther}; rg x $S`],
  ['a variable the command computes', `S=$(echo ${logTxt}); rg Town $S`],
  ['a variable holding the store tickets directory', 'D=.ai/tickets; grep -r x $D'],
];
for (const [name, cmd] of BLOCKS) expect(`KIT-T1157: still blocks ${name}`, run(repo, cmd).code, 2);

const unresolved = run(repo, 'rg "fn main" $S');
expect('KIT-T1157: the block says the variable could not be resolved and how to give it', /\$S is a shell variable this gate could not resolve/.test(unresolved.err) && /S=\/path\/to\/log\.txt/.test(unresolved.err), true);
expect('KIT-T1157: a resolved block names no variable', /could not resolve/.test(run(repo, `S=${slashed(join(repo, 'crates'))}; rg fn $S`).err), false);

console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
