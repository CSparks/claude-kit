// The recipes agents need where a gate refuses the obvious shell form (KIT-T1360, KIT-T1361, KIT-T1365): the wait rule every
// agent carries names the one builds --run call and Read for a saved output file, and the data-file sweep recipe rides in
// the implementer definition and in the source-shell gate's block message.
// Run: node hooks/agent-recipes.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
let fails = 0;
const check = (name, cond) => { console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}`); if (!cond) fails++; };

const rule = readFileSync(join(ROOT, 'docs', 'wait-rule.md'), 'utf8');
check('the wait rule names ONE builds --run call with nothing chained after it', /is ONE `builds --run "<command>" --out target\/<file> --timeout 170 --tool-timeout 180` call with nothing chained after it/.test(rule));
check('the wait rule says to end the turn and that wait.mjs waits on broker jobs only', /If it still runs, end your turn/.test(rule) && /wait\.mjs waits on broker jobs only/.test(rule));
check('the wait rule opens a saved output file with Read, never grep, tail or cat', /opened with Read \(offset, limit\), never grep, tail or cat/.test(rule));
const agents = readdirSync(join(ROOT, 'agents')).filter((f) => f.endsWith('.md') && f !== 'README.md');
check('every agent definition carries the new wait rule verbatim', agents.length >= 10 && agents.every((a) => readFileSync(join(ROOT, 'agents', a), 'utf8').includes(rule.trim())));

const SWEEP = /scratch asset root under `?target\/`?/;
check('the implementer definition carries the data-file sweep recipe', SWEEP.test(readFileSync(join(ROOT, 'agents', 'implementer.md'), 'utf8')));

const repo = mkdtempSync(join(tmpdir(), 'recipes-'));
execFileSync('git', ['init', '-q'], { cwd: repo });
mkdirSync(join(repo, '.ai'));
mkdirSync(join(repo, 'src'));
writeFileSync(join(repo, 'src', 'world.rs'), 'pub fn world() -> u32 { 1 }\n');
const gate = spawnSync(process.execPath, [join(ROOT, 'hooks', 'source-shell-gate.mjs')], {
  cwd: repo, encoding: 'utf8',
  env: { ...process.env, CLAUDE_KIT_TURN_STATE: mkdtempSync(join(tmpdir(), 'recipes-state-')), CLAUDE_KIT_HOLDERS_DIR: mkdtempSync(join(tmpdir(), 'recipes-holders-')) },
  input: JSON.stringify({ session_id: 'S1', agent_id: 'aSweep', tool_name: 'Bash', tool_input: { command: "sed -i 's/1/2/' src/world.rs" } }),
});
check('a shell rewrite of a source file is refused', gate.status === 2);
check('and the refusal carries the data-file sweep recipe', SWEEP.test(gate.stderr) && /BEVY_ASSET_ROOT/.test(gate.stderr));

writeFileSync(join(repo, '.gitignore'), 'target/\n');
mkdirSync(join(repo, 'assets', 'world'), { recursive: true });
writeFileSync(join(repo, 'assets', 'world', 'world.ron'), '(octaves: 5)\n');
mkdirSync(join(repo, 'target', 'sweep', 'assets'), { recursive: true });
writeFileSync(join(repo, 'target', 'sweep', 'assets', 'stage.rs'), 'pub fn stage() {}\n');
const shellGate = (command) => spawnSync(process.execPath, [join(ROOT, 'hooks', 'source-shell-gate.mjs')], {
  cwd: repo, encoding: 'utf8',
  env: { ...process.env, CLAUDE_KIT_TURN_STATE: mkdtempSync(join(tmpdir(), 'recipes-state-')), CLAUDE_KIT_HOLDERS_DIR: mkdtempSync(join(tmpdir(), 'recipes-holders-')) },
  input: JSON.stringify({ session_id: 'S1', agent_id: 'aSweep', tool_name: 'Bash', tool_input: { command } }),
}).status;
check('the recipe\'s copy into target/ passes', shellGate('cp -r assets target/sweep-assets') === 0);
check('the recipe\'s literal rm -r of a scratch folder under target/ passes', shellGate('rm -r target/sweep') === 0);
check('negative: the same delete through a variable beside a loop is refused, as the recipe warns', shellGate('X=target/sweep && for n in 1 2; do echo $n; done && rm -rf "$X"') === 2);

console.log(fails ? `\nagent-recipes: ${fails} failed` : '\nagent-recipes: all pass');
process.exit(fails ? 1 : 0);
