// `claims --release <agent id> --reason "<why>"` (KIT-T1287): the main thread frees the file claims and holds of an agent killed
// by an API error (no stop event); a subagent cannot, and an agent that wrote in the last few minutes is not released.
// Run: node hooks/claims-release-verb.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const holders = mkdtempSync(join(tmpdir(), 'cr-holders-'));
process.env.CLAUDE_KIT_HOLDERS_DIR = holders;
process.env.CLAUDE_KIT_TURN_STATE = mkdtempSync(join(tmpdir(), 'cr-state-'));
const CLAUDE_HOME = mkdtempSync(join(tmpdir(), 'cr-home-'));
process.env.CLAUDE_HOME = CLAUDE_HOME;
const { claimFile, agentEntries } = await import('./lib/checkout-holder.mjs');
const { recordToolWrite } = await import('./lib/tool-writes.mjs');
const { contentHashOf } = await import('./lib/shell-snapshot.mjs');

const repo = mkdtempSync(join(tmpdir(), 'cr-'));
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
git('init', '-q');
git('config', 'user.email', 't@t');
git('config', 'user.name', 't');
mkdirSync(join(repo, '.ai'));
mkdirSync(join(repo, 'src'));
const NAMES = ['a.rs', 'b.rs', 'c.rs', 'd.rs'];
for (const name of NAMES) writeFileSync(join(repo, 'src', name), `pub fn ${name[0]}() -> u32 { 1 }\n`);
git('add', '.');
git('commit', '-q', '-m', 'seed');
const top = git('rev-parse', '--show-toplevel');
const head = git('rev-parse', 'HEAD');

const MINUTE = 60000;
const DEAD = 'a37b9acc2334bdbcb';
const BUSY = 'a37b9acc99999bbbb';
for (const name of NAMES) {
  writeFileSync(join(repo, 'src', name), `pub fn ${name[0]}() -> u32 { 2 }\n`);
  recordToolWrite(top, `src/${name}`, contentHashOf(top, `src/${name}`), Date.now() - 20 * MINUTE, `S2|${name === 'd.rs' ? BUSY : DEAD}`);
}
for (const name of ['a.rs', 'b.rs', 'c.rs']) claimFile({ tree: top, session: 'S2', agent: DEAD, label: 'streets agent', rel: `src/${name}`, head, now: Date.now() - 20 * MINUTE });
claimFile({ tree: top, session: 'S2', agent: BUSY, label: 'busy agent', rel: 'src/d.rs', head, now: Date.now() - MINUTE });

let fails = 0;
const check = (name, cond) => { console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}`); if (!cond) fails++; };
const here = (name) => fileURLToPath(new URL(name, import.meta.url));
const sourceGate = (command, agent = '') => spawnSync(process.execPath, [here('source-shell-gate.mjs')], { cwd: repo, env: process.env, encoding: 'utf8', input: JSON.stringify({ session_id: 'S1', ...(agent ? { agent_id: agent } : {}), tool_name: 'Bash', tool_input: { command } }) });
const releaseGate = (command, agent = '') => spawnSync(process.execPath, [here('claims-release-gate.mjs')], { cwd: repo, env: process.env, encoding: 'utf8', input: JSON.stringify({ session_id: 'S1', ...(agent ? { agent_id: agent } : {}), tool_name: 'Bash', tool_input: { command } }) });
const { issueStamp, STAMP_ENV, STAMP_TTL_MS } = await import('./lib/claims-stamp.mjs');
const withoutStamp = () => { const env = { ...process.env }; delete env[STAMP_ENV]; return env; };
const run = (env, args) => spawnSync(process.execPath, [here('../scripts/claims.mjs'), ...args], { cwd: repo, env, encoding: 'utf8' });
const stampFor = (args) => (args[0] === '--release' && typeof args[1] === 'string' && !args[1].startsWith('--') ? { [STAMP_ENV]: issueStamp(args[1]) } : {});
const claims = (...args) => run({ ...withoutStamp(), ...stampFor(args) }, args);
const blocked = (r) => r.status === 2 && /source-shell-write/.test(r.stderr);

const before = sourceGate('git restore -- src/a.rs src/b.rs src/c.rs');
check('a dead agent that sent no stop event still holds its files: the main thread\'s restore is refused and the refusal names the verb', blocked(before) && /streets agent/.test(before.stderr) && /claims --release <agent id> --reason "<why>"/.test(before.stderr), before.stderr);

const busy = claims('--release', BUSY, '--reason', 'test');
check('an agent that wrote in the last few minutes is refused, and its claims stay', busy.status === 2 && /wrote 1 min ago/.test(busy.stderr) && blocked(sourceGate('git restore -- src/d.rs')));
check('no reason or no id is a usage error', claims('--release', DEAD).status === 64 && claims('--release').status === 64 && claims('--reason', 'x').status === 64);
check('an id with fewer than 8 characters names nothing', /nothing to release/.test(claims('--release', 'a37b', '--reason', 'x').stdout) && blocked(sourceGate('git restore -- src/a.rs')));

const released = claims('--release', DEAD.slice(0, 10), '--reason', 'killed by a usage limit, diff saved');
check('the main thread releases a dead agent by an id prefix', released.status === 0 && /released 1 claim\(s\)/.test(released.stdout), released.stdout + released.stderr);
const row = readFileSync(join(repo, '.ai', 'agents.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((r) => r.id === DEAD);
check('the release is recorded in the roster as killed, with the reason', row && row.status === 'killed' && /killed by a usage limit, diff saved/.test(row.summary));
check('the restore then passes for the main thread', !blocked(sourceGate('git restore -- src/a.rs src/b.rs src/c.rs')));
check('a second release finds nothing to release', /nothing to release/.test(claims('--release', DEAD, '--reason', 'again').stdout));

// KIT-T1356: a stopped agent that wrote nothing holds no claim, yet its in-flight roster row reads as a live writer.
const rosterRows = () => readFileSync(join(repo, '.ai', 'agents.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const inFlight = (id) => appendFileSync(join(repo, '.ai', 'agents.jsonl'), JSON.stringify({ ts: new Date(Date.now() - 20 * MINUTE).toISOString(), id, status: 'in-flight', task: 'a writer' }) + '\n');
const SILENT = 'a6eb8222d80efa278';
inFlight(SILENT);
const silent = claims('--release', SILENT, '--reason', 'TaskStop, wrote nothing');
const silentRows = rosterRows().filter((r) => r.id === SILENT);
check('a claimless agent\'s in-flight roster row is ended as killed, with the reason', silent.status === 0 && /roster row is ended/.test(silent.stdout) && silentRows.at(-1).status === 'killed' && /TaskStop, wrote nothing/.test(silentRows.at(-1).summary), silent.stdout + silent.stderr);
const again = claims('--release', SILENT, '--reason', 'again');
check('a second call ends nothing more', again.status === 0 && !/roster row is ended/.test(again.stdout) && rosterRows().filter((r) => r.id === SILENT).length === silentRows.length);
const TALKING = 'a6eb8222d80efa999';
inFlight(TALKING);
const transcripts = join(CLAUDE_HOME, 'projects', 'D--dev-fixture', 'session-1', 'subagents');
mkdirSync(transcripts, { recursive: true });
writeFileSync(join(transcripts, `agent-${TALKING}.jsonl`), '{"type":"assistant"}\n');
const talking = claims('--release', TALKING, '--reason', 'x');
check('a claimless agent whose transcript moved in the last few minutes is refused and its row stays in flight', talking.status === 2 && /wrote its transcript 0 min ago/.test(talking.stderr) && rosterRows().filter((r) => r.id === TALKING).length === 1, talking.stdout + talking.stderr);

claimFile({ tree: top, session: 'S3', agent: 'a37b9acc2334bdbcb', label: 'twin', rel: 'src/a.rs', head, now: Date.now() - 20 * MINUTE });
claimFile({ tree: top, session: 'S3', agent: 'a37b9accffffffff', label: 'twin two', rel: 'src/b.rs', head, now: Date.now() - 20 * MINUTE });
check('a prefix that names two agents is refused: give the full id', /names \d+ agents/.test(claims('--release', 'a37b9acc', '--reason', 'x').stderr) && claims('--release', 'a37b9acc', '--reason', 'x').status === 2);

check('a subagent that runs the verb is refused by the gate', releaseGate('claims --release a37b9acc2334bdbcb --reason "x"', 'subAgent1').status === 2 && releaseGate('node scripts/claims.mjs --release abc --reason x', 'subAgent1').status === 2);
check('the main thread and other commands pass the gate', releaseGate('claims --release a37b9acc2334bdbcb --reason "x"').status === 0 && releaseGate('echo claims', 'subAgent1').status === 0 && releaseGate('git status', 'subAgent1').status === 0);

const SCRIPT = here('../scripts/claims.mjs').replace(/\\/g, '/');
const ASK = 'claims --release a55dead0 --reason "x"';
const SPELLINGS = {
  'a quoted path': `node "${SCRIPT}" --release a55dead0 --reason x`,
  'a single-quoted shim': "'claims' '--release' a55dead0 --reason x",
  'broken quotes inside a word': 'cla""ims --release a55dead0 --reason x',
  'a backslash path': `node ${SCRIPT.replace(/\//g, '\\')} --release a55dead0 --reason x`,
  'bash -c': `bash -c "claims --release a55dead0 --reason x"`,
  'sh -c with a glued word': `sh -c 'cl\\aims --release a55dead0 --reason x'`,
  'eval': `eval "claims --release a55dead0 --reason x"`,
  'powershell -Command': `powershell -Command "& claims --release a55dead0 --reason x"`,
  'node -e importing the function': `node -e "import('${SCRIPT}').then((m) => m.releaseDead({ id: 'a55dead0', reason: 'x' }))"`,
  'a variable holding the script path': `S=${SCRIPT}; node "$S" --release a55dead0 --reason x`,
  'a variable holding the flag': `R=--release; claims $R a55dead0 --reason x`,
  'builds --run': `builds --run "claims --release a55dead0 --reason x"`,
  'a command substitution inside echo': `echo $(claims --release a55dead0 --reason x)`,
  'a pipe into a shell': `echo "claims --release a55dead0 --reason x" | bash`,
  'a call to releaseAgent': `node -e "import('hooks/lib/checkout-holder.mjs').then((m) => m.releaseAgent('a55dead0'))"`,
  'a read of the stamp folder': 'ls /tmp/claude-kit-turnstate/claims-stamps',
  'an unpaired quote': `claims --release a55dead0 --reason "it's`,
};
for (const [name, command] of Object.entries(SPELLINGS)) check(`a subagent is refused: ${name}`, releaseGate(command, 'subAgent1').status === 2, command);
const READS = ['echo claims', 'git status', 'q code "claims --release"', "t notes KIT-T1288 'claims --release is main thread only'", 'cat hooks/lib/agent-claims.mjs', 'node hooks/claims-release-verb.test.mjs', 'cargo build --release', 'node scripts/claims.mjs'];
for (const command of READS) check(`a subagent's ${command.split(' ').slice(0, 3).join(' ')} passes`, releaseGate(command, 'subAgent1').status === 0 && releaseGate(command, 'subAgent1').stdout === '', command);

const nonceOf = (command) => (command.match(/CLAUDE_KIT_CLAIMS_STAMP='([0-9a-f]{32})'/) || [])[1];
const stamped = JSON.parse(releaseGate(ASK).stdout || '{}').hookSpecificOutput?.updatedInput?.command || '';
check('the main thread\'s plain call is stamped: the nonce is exported ahead of the unchanged command', /^export CLAUDE_KIT_CLAIMS_STAMP='[0-9a-f]{32}'; claims --release a55dead0 --reason "x"$/.test(stamped), stamped);
check('PowerShell gets its own syntax, and an unrelated main-thread command or a subagent gets no stamp', /^\$env:CLAUDE_KIT_CLAIMS_STAMP = '[0-9a-f]{32}'; claims/.test(JSON.parse(spawnSync(process.execPath, [here('claims-release-gate.mjs')], { cwd: repo, env: process.env, encoding: 'utf8', input: JSON.stringify({ session_id: 'S1', tool_name: 'PowerShell', tool_input: { command: ASK } }) }).stdout).hookSpecificOutput.updatedInput.command)
  && releaseGate('git status').stdout === '' && releaseGate(ASK, 'subAgent1').stdout === '' && releaseGate('echo claims').stdout === '');

const GHOST = 'a55dead0cccccdddd';
claimFile({ tree: top, session: 'S4', agent: GHOST, label: 'ghost', rel: 'src/e.rs', head, now: Date.now() - 20 * MINUTE });
const ask = ['--release', GHOST, '--reason', 'killed, test'];
const held = () => agentEntries(GHOST).length > 0;
const refused = (r) => r.status === 2 && /main-thread call the kit stamped/.test(r.stderr);
const forged = 'f'.repeat(32);
check('a direct node call with no stamp is refused and nothing is released', refused(run(withoutStamp(), ask)));
check('a nonce nobody issued is refused', refused(run({ ...withoutStamp(), [STAMP_ENV]: forged }, ask)));
check('a stamp issued for another agent is refused', refused(run({ ...withoutStamp(), [STAMP_ENV]: issueStamp('a55dead0aaaaaaaaa') }, ask)));
check('a stale stamp is refused', refused(run({ ...withoutStamp(), [STAMP_ENV]: issueStamp(GHOST, Date.now() - STAMP_TTL_MS - 5000) }, ask)));
const imported = spawnSync(process.execPath, ['--input-type=module', '-e', `const { releaseDead } = await import(${JSON.stringify(new URL('../scripts/claims.mjs', import.meta.url).href)}); const r = releaseDead({ id: ${JSON.stringify(GHOST)}, reason: 'x', root: ${JSON.stringify(top)} }); console.log(JSON.stringify(r));`], { cwd: repo, env: withoutStamp(), encoding: 'utf8' });
check('importing releaseDead without a stamp is refused', JSON.parse(imported.stdout || '{}').code === 2, imported.stdout + imported.stderr);
check('after all of those the agent still holds its claim', held());

const nonce = nonceOf(JSON.parse(releaseGate(`claims --release ${GHOST} --reason "killed, test"`).stdout).hookSpecificOutput.updatedInput.command);
const first = run({ ...withoutStamp(), [STAMP_ENV]: nonce }, ask);
check('the stamp the hook issued for the main thread releases the agent', first.status === 0 && /released 1 claim\(s\)/.test(first.stdout), first.stdout + first.stderr);
check('the same stamp cannot be spent twice', refused(run({ ...withoutStamp(), [STAMP_ENV]: nonce }, ask)));

console.log(fails ? `\nclaims-release-verb: ${fails} failed` : '\nclaims-release-verb: all pass');
process.exit(fails ? 1 : 0);
