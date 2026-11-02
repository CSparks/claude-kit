// Automated test for the checks that live inside hooks/dispatch-guard.mjs itself; every check with its own module has its
// own dispatch-*.test.mjs (cold-worktree, shared-tree, foreign-tree, holder, job, escalation, brief, lessons, ...).
// dispatch-ladder: BLOCK on a model-less delegation inheriting a fable session; ALLOW on explicit models, frontmatter-pinned
//   kit agents, non-fable sessions, [allow-fable], missing transcripts, unadopted repos, malformed payloads.
// capability-table-stale (KIT-T339), no pins anywhere (KIT-D080), agent-registry-stale (KIT-T431).
// Run: node hooks/dispatch-guard.test.mjs

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixtureKit, isoDaysAgo } from './test-harness.mjs';
import { expect, finish, ignoreFile, makeRepo, run, runRaw, transcript } from './dispatch-guard-harness.mjs';

const d = makeRepo();
const un = makeRepo({ adopt: false });
const fable = transcript(d, 'fable-session', 'claude-fable-5');
const opus = transcript(d, 'opus-session', 'claude-opus-4-8');

// BLOCK — the silent inherit: no model, no pin, fable session.
expect('blocks inherit from a fable session (unpinned type)', run(d, { subagent_type: 'general-purpose', prompt: 'x' }, fable).code, 2);
expect('blocks inherit on Explore too', run(d, { subagent_type: 'Explore', prompt: 'x' }, fable).code, 2);

// ALLOW — explicitly chosen, pinned, escaped, or indeterminate.
expect('allows explicit opus from a fable session', run(d, { subagent_type: 'general-purpose', model: 'opus', prompt: 'x' }, fable).code, 0);
expect('allows explicit haiku', run(d, { subagent_type: 'general-purpose', model: 'haiku', prompt: 'x' }, fable).code, 0);
expect('allows explicit fable (a chosen tier — deep-tier dispatch)', run(d, { subagent_type: 'general-purpose', model: 'fable', prompt: 'x' }, fable).code, 0);
expect('blocks a kit agent dispatched with no model from a fable session (kit agents carry none, KIT-D080)', run(d, { subagent_type: 'claude-kit:researcher', prompt: 'x' }, fable).code, 2);
expect('allows a kit agent when the call names a family', run(d, { subagent_type: 'claude-kit:researcher', model: 'sonnet', prompt: 'x' }, fable).code, 0);
expect('allows [allow-fable: reason] escape on a model-less inherit', run(d, { subagent_type: 'general-purpose', prompt: 'judge panel [allow-fable: hardest-reasoning verify]' }, fable).code, 0);
expect('allows inherit from a non-fable session', run(d, { subagent_type: 'general-purpose', prompt: 'x' }, opus).code, 0);
// KIT-T403 — a dispatch whose model cannot be resolved is refused, never written unlabelled.
const noModel = run(d, { subagent_type: 'general-purpose', prompt: 'x' }, join(d, 'missing.jsonl'));
expect('blocks a dispatch with no resolvable model (transcript missing)', noModel.code, 2);
expect('the unlabelled block names the fix', /explicit model on the Agent call/.test(noModel.err) ? 1 : 0, 1);
expect('blocks an explicit model of an unknown family', run(d, { subagent_type: 'general-purpose', model: 'banana', prompt: 'x' }, opus).code, 2);
expect('allows [allow-fable] with an unresolvable session', run(d, { subagent_type: 'general-purpose', prompt: '[allow-fable: judge]' }, join(d, 'missing.jsonl')).code, 0);

// FAIL-OPEN — never wedge a delegation.
expect('allows on an unadopted repo', run(un, { subagent_type: 'general-purpose', prompt: 'x' }, fable).code, 0);
expect('allows on malformed stdin', runRaw(d, 'not json at all').code, 0);

// Block message quality — the fix and the escape are both named.
const msg = run(d, { subagent_type: 'general-purpose', prompt: 'x' }, fable).err;
expect("block message names the fix (model:'sonnet', 'opus' or 'haiku')", /model:'sonnet', 'opus' or 'haiku'/.test(msg) ? 1 : 0, 1);
expect('block message points at the capability table resolver', /dispatch-ladder\.mjs resolve --job/.test(msg) ? 1 : 0, 1);
expect('block message names the escape token', /\[allow-fable/.test(msg) ? 1 : 0, 1);
expect('block message carries the exclude footer', /dispatch-ladder/.test(msg) ? 1 : 0, 1);

// --- capability-table-stale (KIT-T339) ----------------------------------------------
{
  const goodCall = { subagent_type: 'general-purpose', model: 'opus', prompt: 'x' };
  process.env.DG_LADDER_ROOT = fixtureKit(isoDaysAgo(30));
  const stale = run(d, goodCall, opus);
  expect('blocks a dispatch when the capability table evidence is older than the refresh period', stale.code, 2);
  expect('the stale block names the refresh script', /model-refresh.mjs/.test(stale.err) ? 1 : 0, 1);
  expect('the stale block carries the capability-table-stale exclude footer', /id: capability-table-stale/.test(stale.err) ? 1 : 0, 1);
  const ignored = ignoreFile(makeRepo(), 'capability-table-stale');
  expect('the ignore file lifts the stale gate', run(ignored, goodCall, opus).code, 0);
  process.env.DG_LADDER_ROOT = fixtureKit(isoDaysAgo(0));
  expect('a fresh table lets the same dispatch through', run(d, goodCall, opus).code, 0);
  delete process.env.DG_LADDER_ROOT;
}

// --- no pins anywhere (KIT-D080) -----------------------------------------------------
// Kit agents carry no `model:` line: the orchestrator names a family on every dispatch, so the dispatch-ladder check
// treats a model-less call on a fable thread as the silent inherit for every agent type alike.
{
  const agentsDir = fileURLToPath(new URL('../agents', import.meta.url));
  for (const file of readdirSync(agentsDir).filter((f) => f.endsWith('.md') && f !== 'README.md')) {
    const frontmatter = readFileSync(join(agentsDir, file), 'utf8').split('---')[1] || '';
    expect(`${file} carries no model line`, /^model:/m.test(frontmatter) ? 1 : 0, 0);
  }
}

// --- agent-registry-stale (KIT-T431) -------------------------------------------------
{
  const kit = fixtureKit(isoDaysAgo(0));
  execFileSync('git', ['init', '-q'], { cwd: kit });
  mkdirSync(join(kit, 'agents'), { recursive: true });
  writeFileSync(join(kit, 'agents', 'newbie.md'), ['---', 'name: newbie', 'description: x', '---', ''].join('\n'));
  execFileSync('git', ['add', '-A'], { cwd: kit });
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'add newbie'], { cwd: kit });
  const repo = makeRepo();
  const session = (name, stamp) => {
    const file = join(repo, `${name}.jsonl`);
    writeFileSync(file, [JSON.stringify({ type: 'user', timestamp: stamp, message: { content: 'hi' } }), JSON.stringify({ type: 'assistant', message: { model: 'claude-opus-5-5', content: [] } })].join('\n') + '\n');
    return file;
  };
  const send = (type, transcript_path) => runRaw(repo, JSON.stringify({ tool_name: 'Agent', transcript_path, tool_input: { subagent_type: type, model: 'sonnet', prompt: 'x [job: fix]' } }));
  process.env.DG_LADDER_ROOT = kit;
  const old = send('claude-kit:newbie', session('old', '2026-01-01T00:00:00.000Z'));
  expect('a session older than the agent still dispatches (warn-only)', old.code, 0);
  expect('the stale-registry warning names the agent and the fix', /agent type "claude-kit:newbie" was added/.test(old.err) && /reload-plugins/.test(old.err) ? 1 : 0, 1);
  expect('the warning carries its check footer', /agent-registry-stale/.test(old.err) ? 1 : 0, 1);
  expect('a session newer than the agent gets no warning', /WARNING: agent type/.test(send('claude-kit:newbie', session('new', '2099-01-01T00:00:00.000Z')).err) ? 1 : 0, 0);
  expect('an agent the kit does not hold gets no warning', /WARNING: agent type/.test(send('claude-kit:ghost', session('old2', '2026-01-01T00:00:00.000Z')).err) ? 1 : 0, 0);
  expect('an unprefixed type gets no warning', /WARNING: agent type/.test(send('general-purpose', session('old3', '2026-01-01T00:00:00.000Z')).err) ? 1 : 0, 0);
  expect('the ignore file lifts the warning', /WARNING: agent type/.test(runRaw(ignoreFile(repo, 'agent-registry-stale'), JSON.stringify({ tool_name: 'Agent', transcript_path: session('old4', '2026-01-01T00:00:00.000Z'), tool_input: { subagent_type: 'claude-kit:newbie', model: 'sonnet', prompt: 'x [job: fix]' } })).err) ? 1 : 0, 0);
  delete process.env.DG_LADDER_ROOT;
}

finish();
