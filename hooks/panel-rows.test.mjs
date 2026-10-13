// panel-rows.test.mjs — KIT-T461: every path that puts a row in the agent/task panel carries its model.
// Paths: background Bash/PowerShell, Monitor (row-tag), Workflow agent() (workflow-gate),
// SendMessage resume (resume-check), and the registrations that make them fire.
// Run: node hooks/panel-rows.test.mjs

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT, adopted, cleanup, hook, reporter, tmpDir } from './test-harness.mjs';
import { lintWorkflowScript } from './lib/workflow-lint.mjs';

const { ok, done } = reporter('panel-rows');

const pre = (tool, input, extra = {}) => ({ hook_event_name: 'PreToolUse', tool_name: tool, tool_input: input, ...extra });

function transcript(dir, name, models) {
  const p = join(dir, name);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, models.map((model) => JSON.stringify({ type: 'assistant', message: { role: 'assistant', model } })).join('\n') + '\n');
  return p;
}

function rewritten(payload, cwd) {
  const out = hook('row-tag.mjs', payload, cwd).out.trim();
  return out ? JSON.parse(out).hookSpecificOutput : null;
}

try {
  const d = adopted(false);
  const main = transcript(d, 'main.jsonl', ['claude-sonnet-5-5']);

  // background Bash / PowerShell from the main thread
  const bg = rewritten(pre('Bash', { command: 'rg foo', description: 'ChunkGround reference search', run_in_background: true }, { transcript_path: main }), d);
  ok('background Bash: description carries the main thread model', bg && bg.updatedInput.description === '[Sonnet 5.5] ChunkGround reference search');
  ok('background Bash: other fields kept and no permissionDecision', bg.updatedInput.command === 'rg foo' && bg.updatedInput.run_in_background === true && !('permissionDecision' in bg));
  ok('background PowerShell is tagged too', rewritten(pre('PowerShell', { command: 'cargo build', description: 'Build', run_in_background: true }, { transcript_path: main }), d)?.updatedInput.description === '[Sonnet 5.5] Build');
  ok('a background shell with no description is labelled by its command', rewritten(pre('Bash', { command: 'cargo nextest run --workspace', run_in_background: true }, { transcript_path: main }), d)?.updatedInput.description === '[Sonnet 5.5] cargo nextest run --workspace');
  ok('a foreground shell makes no row and is left alone', rewritten(pre('Bash', { command: 'ls', description: 'List' }, { transcript_path: main }), d) === null);
  ok('Monitor is tagged', rewritten(pre('Monitor', { command: 'tail -f log', description: 'Watch the log' }, { transcript_path: main }), d)?.updatedInput.description === '[Sonnet 5.5] Watch the log');

  // from a subagent: its own sidechain transcript decides, meta.json when it has no turn yet
  const sideDir = join(d, 'sess', 'subagents');
  const side = transcript(sideDir, 'agent-a1b2c3.jsonl', ['claude-opus-5-5']);
  ok('a subagent shell carries the SUBAGENT model, not the main thread model', rewritten(pre('Bash', { command: 'x', description: 'Search', run_in_background: true }, { transcript_path: side, agent_id: 'a1b2c3' }), d)?.updatedInput.description === '[Opus 5.5] Search');
  const fresh = join(sideDir, 'agent-d4e5f6.jsonl');
  writeFileSync(fresh, '');
  writeFileSync(join(sideDir, 'agent-d4e5f6.meta.json'), JSON.stringify({ agentType: 'general-purpose', model: 'haiku' }));
  ok('a subagent with no assistant turn yet falls back to its meta.json model', rewritten(pre('Bash', { command: 'x', description: 'Search', run_in_background: true }, { transcript_path: fresh }), d)?.updatedInput.description === '[Haiku 5.5] Search');

  // never untagged
  ok('an owner whose model cannot be resolved is tagged [model?]', rewritten(pre('Bash', { command: 'x', description: 'Search', run_in_background: true }), d)?.updatedInput.description === '[model?] Search');
  ok('a hand-written tag is replaced by the owner model', rewritten(pre('Bash', { command: 'x', description: '[opus] Search', run_in_background: true }, { transcript_path: main }), d)?.updatedInput.description === '[Sonnet 5.5] Search');
  ok('an already-correct tag is left alone (idempotent)', rewritten(pre('Bash', { command: 'x', description: '[Sonnet 5.5] Search', run_in_background: true }, { transcript_path: main }), d) === null);
  ok('garbage stdin exits 0 silently', hook('row-tag.mjs', 'not json', d).code === 0);

  // Workflow agent() calls
  const bad = "export const meta = { name: 'x', description: 'y' }\nconst a = await agent('find it')\nconst b = await agent('judge it', { model: 'opus' })\n";
  const good = "export const meta = { name: 'x', description: 'y' }\nconst a = await agent('say agent(x) in a prompt', { model: 'sonnet', label: '[Sonnet 5.5] find' })\n// agent('commented out')\n";
  ok('lint: missing model and missing label are both named', lintWorkflowScript(bad).length === 2 && /model/.test(lintWorkflowScript(bad)[0].problem));
  ok('lint: labelled calls pass; agent( in a string or comment is not a call', lintWorkflowScript(good).length === 0);
  ok('lint: spread options cannot be verified and are flagged', lintWorkflowScript("agent(p, { ...opts })").length === 1);
  ok('lint: a template-literal label with a tag passes', lintWorkflowScript("agent(p, { model: 'opus', label: `[Opus 5.5] ${i}` })").length === 0);
  const blocked = hook('workflow-gate.mjs', pre('Workflow', { script: bad }), d);
  ok('Workflow with unlabelled agent() is blocked (exit 2) naming the lines', blocked.code === 2 && /line 2/.test(blocked.out) && /line 3/.test(blocked.out));
  ok('Workflow with labelled agent() passes', hook('workflow-gate.mjs', pre('Workflow', { script: good }), d).code === 0);
  const file = join(tmpDir('kit-wf-'), 'wf.js');
  writeFileSync(file, bad);
  ok('Workflow run by scriptPath is linted from the file', hook('workflow-gate.mjs', pre('Workflow', { scriptPath: file }), d).code === 2);
  ok('Workflow run by name passes with a notice', /not linted/.test(hook('workflow-gate.mjs', pre('Workflow', { name: 'saved' }), d).out));
  ok('the escape token lets a deliberate script through', hook('workflow-gate.mjs', pre('Workflow', { script: `// [allow-unlabelled-workflow: probe]\n${bad}` }), d).code === 0);

  // SendMessage resume
  const row = (id, extra) => JSON.stringify({ ts: new Date().toISOString(), id, status: 'in-flight', scope: 'general-purpose', ...extra });
  writeFileSync(join(d, '.ai', 'agents.jsonl'), `${row('aunlabelled1', {})}\n${row('alabelled001', { model: 'opus' })}\n`);
  const warn = hook('resume-check.mjs', pre('SendMessage', { to: 'aunlabelled1', message: 'continue' }), d);
  ok('SendMessage to an unlabelled agent warns and does not block', warn.code === 0 && /aunlabelled1/.test(warn.out) && /no model/.test(warn.out));
  ok('SendMessage to a labelled agent is silent', hook('resume-check.mjs', pre('SendMessage', { to: 'alabelled001', message: 'continue' }), d).out.trim() === '');

  // registrations
  const registered = (file, name) => readFileSync(join(ROOT, file), 'utf8').includes(name);
  for (const [name, matcher] of [['row-tag', 'Bash|PowerShell|Monitor'], ['workflow-gate', 'Workflow'], ['resume-check', 'SendMessage']]) {
    ok(`${name} is registered in hooks.json and settings.recommended.json`, registered('hooks/hooks.json', `${name}.mjs`) && registered('user-config/settings.recommended.json', `${name}.mjs`));
    ok(`${name} is registered on ${matcher}`, registered('hooks/hooks.json', `"matcher": "${matcher}"`));
  }
} finally {
  cleanup();
}
done();
