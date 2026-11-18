// hook-entry-run (KIT-T1357): a subagent's command that runs a kit hook entry point is refused, so a made-up payload piped
// into agent-roster.mjs cannot release another agent's claims; tests, git and read commands that name the path pass.
// Run: node hooks/hook-entry-run.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hookEntryNames, runsHookEntry } from './lib/hook-entries.mjs';

const repo = mkdtempSync(join(tmpdir(), 'her-'));
execFileSync('git', ['init', '-q'], { cwd: repo });
mkdirSync(join(repo, '.ai'));
const GATE = fileURLToPath(new URL('./claims-release-gate.mjs', import.meta.url));
const gate = (command, { agent = 'subAgent1', tool = 'Bash' } = {}) => spawnSync(process.execPath, [GATE], {
  cwd: repo, encoding: 'utf8', env: process.env,
  input: JSON.stringify({ session_id: 'S1', ...(agent ? { agent_id: agent } : {}), tool_name: tool, tool_input: { command } }),
});

let fails = 0;
const check = (name, cond, detail = '') => { console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}${cond ? '' : `  ${detail}`}`); if (!cond) fails++; };

const names = hookEntryNames();
check('the entry names come from hooks.json, launchers included', ['agent-roster.mjs', 'flush.mjs', 'dispatch-guard.mjs', 'compat-run.mjs', 'compat-core.mjs'].every((n) => names.has(n)) && !names.has('agent-roster.test.mjs'));

const REFUSED = {
  'a payload piped into agent-roster.mjs': `echo '{"tool_name":"TaskStop","tool_input":{"task_id":"a6eb8222d80efa278"}}' | node hooks/agent-roster.mjs`,
  'the sealed launcher with a redirect': `node "C:/Users/x/.claude/claude-kit-runtime/current/hooks/compat-run.mjs" agent-roster.mjs < p.json`,
  'an env prefix before the launcher': 'CLAUDE_PLUGIN_ROOT=x node hooks/compat-run.mjs agent-roster.mjs < p.json',
  'a backslash path': 'node D:\\kit\\hooks\\dispatch-guard.mjs < p.json',
  'node.exe': 'node.exe hooks/flush.mjs < p.json',
  'an escaped name': 'node hooks/agent-r\\oster.mjs < p.json',
  'bash -c': `bash -c "node hooks/agent-roster.mjs < p.json"`,
  'builds --run': 'builds --run "node hooks/flush.mjs"',
  'node -e importing the hook': `node -e "import('./hooks/agent-roster.mjs')"`,
  'node --import': 'node --import ./hooks/agent-roster.mjs x.mjs',
  'the hook run as the command': './hooks/agent-roster.mjs < p.json',
  'after a cd': 'cd D:/dev/kit && node hooks/agent-roster.mjs < p.json',
  'the hook that shares a CLI name, run from hooks/': 'node hooks/code-graph.mjs < p.json',
  'a bare name run from inside hooks/': 'cd hooks && node agent-roster.mjs < p.json',
};
for (const [name, command] of Object.entries(REFUSED)) {
  const r = gate(command);
  check(`a subagent is refused: ${name}`, r.status === 2 && /hook-entry-run/.test(r.stderr), `${command} -> ${r.status}`);
}
const ps = gate('Get-Content p.json | node hooks\\agent-roster.mjs', { tool: 'PowerShell' });
check('a subagent is refused: a PowerShell pipe', ps.status === 2 && /hook-entry-run/.test(ps.stderr));

const PASSED = [
  'node hooks/agent-roster.test.mjs',
  'node hooks/task-stop-roster.test.mjs',
  'git add -- hooks/agent-roster.mjs hooks/flush.mjs',
  'git diff -- hooks/dispatch-guard.mjs',
  'q code "node hooks/agent-roster.mjs"',
  'echo node hooks/agent-roster.mjs',
  'node scripts/code-graph.mjs --query importers-of hooks/agent-roster.mjs',
  'wc -l hooks/agent-roster.mjs',
  'npm run publish:runtime',
];
for (const command of PASSED) check(`a subagent's command passes: ${command}`, gate(command).status === 0, String(gate(command).stderr).slice(0, 200));
check('the main thread may run a hook by hand', gate('node hooks/dispatch-guard.mjs < p.json', { agent: '' }).status === 0);
check('negative control: the matcher alone says a test file runs no hook', !runsHookEntry('node hooks/agent-roster.test.mjs', 'Bash') && runsHookEntry('node hooks/agent-roster.mjs', 'Bash'));

console.log(fails ? `\nhook-entry-run: ${fails} failed` : '\nhook-entry-run: all pass');
process.exit(fails ? 1 : 0);
