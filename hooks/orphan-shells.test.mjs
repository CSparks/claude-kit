// orphan-shells (KIT-T455): never-exited background shells are found from the session tasks dir,
// reported by the SubagentStop hook, listed by orient after 30 minutes, and nagged by the Stop
// flush. Run: node hooks/orphan-shells.test.mjs

import { mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, hook, adopted, reporter, tmpDir, git } from './test-harness.mjs';
import { orphanShells, shellCommands, orphanLines, projectSlug } from './orphan-shells.mjs';

const { ok, done } = reporter('orphan-shells');
const MIN = 60000;

try {
  const base = tmpDir('kit-tasks-');
  process.env.CLAUDE_KIT_TASKS_BASE = base;
  const d = adopted(false);
  const top = git(['rev-parse', '--show-toplevel'], d).trim();
  const dir = join(base, projectSlug(top), 'sess-1', 'tasks');
  mkdirSync(dir, { recursive: true });
  const shell = (id, body, ageMin) => {
    const f = join(dir, `${id}.output`);
    writeFileSync(f, body);
    const t = (Date.now() - ageMin * MIN) / 1000;
    utimesSync(f, t, t);
  };
  shell('bhung0001', 'compiling...\n', 90);
  shell('bdone0002', 'ok\n\n[exited with code 0]\n', 90);
  shell('bfresh003', 'starting\n', 2);
  shell('bstop0004', 'compiling...\n\n[killed]\n', 90);
  shell('a1234567890abcdef', 'agent transcript, no exit marker\n', 90);

  const transcript = join(base, 'agent.jsonl');
  const use = (id, command) => JSON.stringify({ message: { content: [{ type: 'tool_use', id, name: 'Bash', input: { command, run_in_background: true } }] } });
  const result = (id, task) => JSON.stringify({ message: { content: [{ type: 'tool_result', tool_use_id: id, content: `Command running in background with ID: ${task}` }] } });
  writeFileSync(transcript, [use('tu1', 'cargo nextest run --workspace -j 3 && echo done'), result('tu1', 'bhung0001'), use('tu2', 'ls'), result('tu2', 'bdone0002')].join('\n'));

  const commands = shellCommands(transcript);
  ok('shellCommands maps task ids to their commands', commands.get('bhung0001') === 'cargo nextest run --workspace -j 3 && echo done');

  const all = orphanShells({ project: projectSlug(top), commands });
  ok('a shell without the exit marker is an orphan', all.some((o) => o.id === 'bhung0001'));
  ok('an exited shell and an agent output file are not', !all.some((o) => o.id === 'bdone0002' || o.id.startsWith('a')));
  ok('a shell stopped with TaskStop ([killed]) is not', !all.some((o) => o.id === 'bstop0004'));
  ok('the age is in minutes', all.find((o) => o.id === 'bhung0001').ageMin >= 89);
  ok('minAgeMin drops the fresh shell', !orphanShells({ project: projectSlug(top), minAgeMin: 30 }).some((o) => o.id === 'bfresh003'));
  ok('ids restricts to the named shells', orphanShells({ project: projectSlug(top), ids: ['bfresh003'] }).length === 1);
  ok('orphanLines prints id, age and the command', /^ORPHAN SHELLS: bhung0001 \d+m cargo nextest run/.test(orphanLines(all)[0]));
  ok('a missing tasks dir yields nothing', orphanShells({ project: 'no-such-project' }).length === 0);

  const env = { CLAUDE_KIT_TASKS_BASE: base };
  const stop = hook('agent-roster.mjs', { hook_event_name: 'SubagentStop', agent_id: 'agt1', session_id: 'sess-1', agent_transcript_path: transcript }, d, env);
  ok('SubagentStop reports the stopped agent\'s never-exited shells', /ORPHAN SHELLS: bhung0001 \d+m cargo nextest/.test(stop.out) && !stop.out.includes('bdone0002') && stop.code === 0);

  const resume = hook('orient.mjs', { hook_event_name: 'SessionStart' }, d, env);
  ok('orient lists a shell older than 30 minutes as ORPHAN with its id', /ORPHAN .*bhung0001/.test(resume.out) && !resume.out.includes('bfresh003'));

  const nag = hook('flush.mjs', { hook_event_name: 'Stop', session_id: 'sess-1' }, d, env);
  ok('the Stop flush nags while an orphan shell exists', /bhung0001/.test(nag.out) && nag.code === 0);
  ok('another session gets no nag', !hook('flush.mjs', { hook_event_name: 'Stop', session_id: 'sess-2' }, d, env).out.includes('bhung0001'));
  ok('the nag names the check id and both exclusion surfaces', /orphan-shells/.test(nag.out) && nag.out.includes('.claude-kit-ignore.yaml'));
} finally {
  cleanup();
}
done();
