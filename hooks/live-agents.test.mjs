// live-agents.test.mjs — KIT-T461: orient lists every live agent on the machine with model, job and
// capability-table row, and flags with !! any agent with no model, no job, or a model off its row.
// Run: node hooks/live-agents.test.mjs

import { mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { join } from 'node:path';

import { TMP_REG, adopted, cleanup, hook, reporter, tmpDir } from './test-harness.mjs';
import { liveAgents, liveAgentLines, terminalAgentIds } from './lib/live-agents.mjs';
import { statusOnlyAgents, unlabelledAgents } from './lib/agent-format.mjs';

const { ok, done } = reporter('live-agents');
const MIN = 60000;

try {
  const home = tmpDir('kit-claude-home-');
  const sub = join(home, 'projects', 'D--dev-proj-a', 'sess-1', 'subagents');
  mkdirSync(sub, { recursive: true });
  const agent = (id, meta, brief, idleMin = 1) => {
    writeFileSync(join(sub, `agent-${id}.meta.json`), JSON.stringify({ agentType: 'general-purpose', description: `[x] task ${id}`, ...meta }));
    const file = join(sub, `agent-${id}.jsonl`);
    writeFileSync(file, `${JSON.stringify({ type: 'user', message: { role: 'user', content: brief } })}\n`);
    const t = (Date.now() - idleMin * MIN) / 1000;
    utimesSync(file, t, t);
  };
  agent('aok0000001', { model: 'sonnet' }, '[job: fix] do it');
  agent('abadmodel1', { model: 'opus' }, '[job: fix] do it');
  agent('aoverride1', { model: 'opus' }, '[job: fix] [model-override: needs synthesis] do it');
  agent('anojob0001', { model: 'sonnet' }, 'do it');
  agent('anomodel01', {}, '[job: fix] do it');
  agent('abadjob001', { model: 'sonnet' }, '[job: no-such-job] do it');
  agent('adone00001', { model: 'sonnet' }, '[job: fix] do it');
  agent('aidle000001', { model: 'sonnet' }, '[job: fix] do it', 300);

  // an agent under an excluded root (kit OFF) is still shown, and still needs a model, but owes no job
  const excl = join(home, 'projects', 'D--dev-excluded-fleet-sub', 'sess-2', 'subagents');
  mkdirSync(excl, { recursive: true });
  writeFileSync(join(excl, 'agent-aexcl00001.meta.json'), JSON.stringify({ agentType: 'implementer', description: '[Opus 5.5] fleet work', model: 'opus' }));
  writeFileSync(join(excl, 'agent-aexcl00001.jsonl'), `${JSON.stringify({ type: 'user', message: { content: 'no job here' } })}\n`);
  writeFileSync(TMP_REG, JSON.stringify({ excluded: ['D:/dev/excluded-fleet'] }));
  process.env.CLAUDE_KIT_REGISTRY = TMP_REG;

  const list = liveAgents({ claudeHome: home, terminalIds: new Set(['adone00001']) });
  const byId = Object.fromEntries(list.map((a) => [a.id, a]));
  ok('a finished agent and a long-idle agent are not live', !byId.adone00001 && !byId.aidle000001 && list.length === 7);
  ok('an agent on its table row carries no flag', byId.aok0000001.flags.length === 0 && byId.aok0000001.row === 'sonnet');
  ok('a model off its job row is flagged', byId.abadmodel1.flags.some((f) => /opus is not in the table row for fix/.test(f)));
  ok('[model-override: reason] lifts the model flag', byId.aoverride1.flags.length === 0);
  ok('no job in the brief is flagged', byId.anojob0001.flags.includes('no job'));
  ok('no model in the meta is flagged', byId.anomodel01.flags.includes('no model'));
  ok('a job outside the table is flagged', byId.abadjob001.flags.some((f) => /not in the capability table/.test(f)));

  const lines = liveAgentLines(list);
  ok('the header counts live agents and flagged ones', /LIVE agents on this machine, all sessions \(7, 1 kit OFF, 4 flagged !!\)/.test(lines[0]));
  ok('a row shows its model tag, job and table row', lines.some((l) => /^\s+\[Sonnet 5\.5\] general-purpose  aok00000.*job=fix \(table: sonnet\)/.test(l)));
  ok('flagged rows print first', /!!/.test(lines[1]));
  ok('an excluded-tree agent owes no job and says the kit is off', byId.aexcl00001.flags.length === 0 && lines.some((l) => /aexcl000.*kit OFF/.test(l)));
  ok('nothing live prints nothing', liveAgentLines([]).length === 0);

  // terminal ids come from the rosters
  const ai = tmpDir('kit-ai-');
  writeFileSync(join(ai, 'agents.jsonl'), [{ id: 'aone', status: 'in-flight' }, { id: 'aone', status: 'done' }, { id: 'atwo', status: 'in-flight' }].map((r) => JSON.stringify(r)).join('\n'));
  const terminal = terminalAgentIds([ai]);
  ok('a roster marks the latest-status-terminal ids finished', terminal.has('aone') && !terminal.has('atwo'));

  // status-only rows are not unlabelled dispatches
  const rows = [{ id: 'a1', status: 'done', source: 'subagentstop' }, { id: 'a2', status: 'in-flight', task: 'real dispatch', scope: 'x' }, { id: 'a3', status: 'in-flight', task: 'labelled', model: 'opus' }];
  ok('status-only rows are counted apart from dispatches', statusOnlyAgents(rows).length === 1 && unlabelledAgents(rows).map((r) => r.id).join() === 'a2');

  // orient prints the machine-wide section and the status-only note
  const d = adopted(false);
  writeFileSync(join(d, '.ai', 'agents.jsonl'), `${JSON.stringify({ ts: new Date().toISOString(), id: 'astop000001', status: 'done', source: 'subagentstop' })}\n${JSON.stringify({ ts: new Date().toISOString(), id: 'adisp000001', status: 'in-flight', task: 'live work', scope: 'general-purpose', model: 'sonnet' })}\n`);
  const out = hook('orient.mjs', { hook_event_name: 'SessionStart' }, d, { CLAUDE_HOME: home }).out;
  ok('orient lists the live agents of every session with the !! flags', /LIVE agents on this machine/.test(out) && /aok00000/.test(out) && /!! model opus is not in the table row for fix/.test(out));
  ok('orient does not call a status-only row an unlabelled dispatch', /1 status-only row\(s\)/.test(out) && !/carry no model/.test(out));
} finally {
  cleanup();
}
done();
