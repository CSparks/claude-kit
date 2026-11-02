// shared-tree-dispatch (KIT-T176, KIT-D077): BLOCK a writing dispatch while the roster shows a live writer IN THIS TREE; ALLOW
// a read-only agent type, [maintainer-asked-parallel: <his words>], an empty/stale/finished/corrupt roster, and (KIT-T177) a
// row that is worktree-isolated or aimed at another repo. [tree:] keys the count by the checkout the agent writes in.
// Run: node hooks/dispatch-shared-tree.test.mjs

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOURS, expect, finish, gitTop, ignoreFile, inFlightRow, makeRepo, roster, run } from './dispatch-guard-harness.mjs';

const busy = roster(makeRepo({ cargo: true }), [inFlightRow()]);
const shared = { subagent_type: 'general-purpose', model: 'opus', prompt: 'add the ore-seam test (KIT-T176) [maintainer-words: "add the ore-seam test"] [reuses: ore-seam fixture]' };

// The one escape for both shared-tree and parallel-dispatch: the maintainer's quoted words.
const PAR = '[maintainer-asked-parallel: "run both lanes at once"]';
const RETIRED_PAR = '[allow-parallel: 2 lanes, ~400k tokens each, disjoint files]';
expect('blocks a second dispatch while an agent is in flight', run(busy, shared).code, 2);
expect('blocks a worktree dispatch while an agent is in flight, even maintainer-asked parallel', run(busy, { ...shared, isolation: 'worktree', prompt: `${shared.prompt} ${PAR}` }).code, 2);
expect('allows the [maintainer-asked-parallel: <his words>] escape', run(busy, { ...shared, prompt: `${shared.prompt} ${PAR}` }).code, 0);
expect('an empty [maintainer-asked-parallel:] does not escape', run(busy, { ...shared, prompt: 'x [maintainer-asked-parallel: ]' }).code, 2);
expect('the retired [shared-tree-ok: reason] note no longer escapes', run(busy, { ...shared, prompt: `read-only sweep [shared-tree-ok: no writes] ${RETIRED_PAR}` }).code, 2);
expect('allows via the ignore file (shared-tree-dispatch + parallel-dispatch)', run(ignoreFile(roster(makeRepo(), [inFlightRow()]), 'shared-tree-dispatch', 'parallel-dispatch'), shared).code, 0);
expect('allows with no roster at all', run(makeRepo(), shared).code, 0);
expect('allows with an empty roster', run(roster(makeRepo(), []), shared).code, 0);
expect('allows when the in-flight row is stale (>2h)', run(roster(makeRepo(), [inFlightRow(3 * HOURS)]), shared).code, 0);
expect('allows when the agent finished (terminal row)', run(roster(makeRepo(), [inFlightRow(), { ts: new Date().toISOString(), id: 'agent-live', status: 'done' }]), shared).code, 0);
expect('allows on a corrupt roster line (fail-open)', run(roster(makeRepo(), ['{ not json at all', '']), shared).code, 0);
expect('allows when a row has no parseable timestamp', run(roster(makeRepo(), [{ id: 'agent-x', status: 'in-flight', ts: 'not-a-date' }]), shared).code, 0);

// The roster is session-scoped, the rule is tree-scoped: a collected agent, an agent in its own worktree, and an agent
// dispatched into a different repo are never colleagues (KIT-T177).
const elsewhere = gitTop(makeRepo());
const sameTree = makeRepo({ cargo: true });
roster(sameTree, [inFlightRow(0, { targetRoot: gitTop(sameTree) })]);

const wtRow = roster(makeRepo({ cargo: true }), [inFlightRow(0, { isolation: 'worktree' })]);
expect('a worktree-isolated live row does not count', run(wtRow, shared).code, 0);
expect('a live row targeting another repo does not count', run(roster(makeRepo({ cargo: true }), [inFlightRow(0, { targetRoot: elsewhere })]), shared).code, 0);
expect('blocks when the live row targets THIS tree', run(sameTree, shared).code, 2);
expect('a new dispatch aimed at another repo root is a different checkout', run(sameTree, { ...shared, prompt: `implement KIT-T177 in \`${elsewhere}\`` }).code, 0);
expect('blocks an old-format row with neither field (conservative)', run(roster(makeRepo(), [inFlightRow()]), shared).code, 2);
expect('an old-format row still ages out at 2h', run(roster(makeRepo(), [inFlightRow(3 * HOURS, { targetRoot: undefined })]), shared).code, 0);
expect('a row with an unparseable isolation value still counts (fail toward the halt)', run(roster(makeRepo(), [inFlightRow(0, { isolation: 42 })]), shared).code, 2);
expect('the tree-scoped filter still fails open on a corrupt roster (the worktree row is parallel-dispatch\'s to block)', /one working tree/.test(run(roster(makeRepo(), ['{ not json', JSON.stringify(inFlightRow(0, { isolation: 'worktree' }))]), shared).err) ? 1 : 0, 0);
expect('block message names the tree it scoped to', run(sameTree, shared).err.includes(gitTop(sameTree)) ? 1 : 0, 1);

const sharedMsg = run(busy, shared).err;
expect('shared-tree message names the one-agent-per-tree rule', /one read\/write agent per checkout/i.test(sharedMsg) ? 1 : 0, 1);
expect('shared-tree message lists the in-flight agent', /agent-live/.test(sharedMsg) ? 1 : 0, 1);
expect('shared-tree message never steers to worktree isolation', /isolation: ?"worktree"|git worktree add/.test(sharedMsg) ? 1 : 0, 0);
expect('shared-tree message names the maintainer escape, not the retired note', /\[maintainer-asked-parallel:/.test(sharedMsg) && !/shared-tree-ok/.test(sharedMsg) ? 1 : 0, 1);
expect('shared-tree message names the read-only agent types', /claude-kit:analyst/.test(sharedMsg) ? 1 : 0, 1);
expect('shared-tree message carries the exclude footer', /id: shared-tree-dispatch/.test(sharedMsg) ? 1 : 0, 1);

// One read/write agent per checkout (KIT-D077).
const one = { subagent_type: 'general-purpose', model: 'opus', prompt: 'implement the next ticket (KIT-T256)' };
const live = () => roster(makeRepo({ cargo: true }), [inFlightRow()]);
expect('the retired [allow-parallel: …] token does not escape', run(live(), { ...one, prompt: `${one.prompt} ${RETIRED_PAR}` }).code, 2);
expect('the maintainer token does not lift a worktree dispatch', run(live(), { ...one, isolation: 'worktree', prompt: `${one.prompt} ${PAR}` }).code, 2);
expect('two writers in ONE checkout pass with the maintainer token', run(live(), { ...one, prompt: `${one.prompt} ${PAR}` }).code, 0);
expect('allows the first agent (empty roster)', run(roster(makeRepo({ cargo: true }), []), one).code, 0);
expect('allows the ignore-file key', run(ignoreFile(live(), 'shared-tree-dispatch'), one).code, 0);
expect('blocks in a non-Rust repo too (the rule is per checkout)', run(roster(makeRepo(), [inFlightRow()]), one).code, 2);

// [tree:] keys the count by the checkout the agent writes in.
{
  const stiletto = makeRepo({ cargo: true });
  roster(stiletto, [inFlightRow(0, { targetRoot: gitTop(stiletto) })]);
  const other = gitTop(makeRepo());
  expect('a writer with [tree: other repo] passes beside a writer in this checkout', run(stiletto, { ...one, prompt: `${one.prompt} [tree: ${other}]` }).code, 0);
  expect('a writer with [tree: this checkout] is still blocked', run(stiletto, { ...one, prompt: `${one.prompt} [tree: ${gitTop(stiletto)}]` }).code, 2);
  expect('a [tree:] that is not a repo falls back to the session checkout', run(stiletto, { ...one, prompt: `${one.prompt} [tree: ${join(other, 'nope')}]` }).code, 2);
  const wrongRow = roster(makeRepo({ cargo: true }), [inFlightRow(0, { targetRoot: other })]);
  expect('a session writer beside a writer row aimed at [tree:] is blocked when they share it', run(wrongRow, { ...one, prompt: `${one.prompt} [tree: ${other}]` }).code, 2);
}

// [read-only: reason] on a writer-capable type.
{
  const dir = live();
  expect('an all-tools type without the token is blocked', run(dir, { subagent_type: 'sonnet55', prompt: 'survey the docs' }).code, 2);
  expect('[read-only: reason] lets an all-tools type through', run(dir, { subagent_type: 'sonnet55', model: 'opus', prompt: 'survey the docs [read-only: research only]' }).code, 0);
  expect('an empty [read-only:] does not count', run(dir, { subagent_type: 'sonnet55', prompt: 'survey [read-only: ]' }).code, 2);
  const declared = roster(makeRepo({ cargo: true }), [inFlightRow(0, { scope: 'sonnet55', readOnly: 'research only' })]);
  expect('a row carrying readOnly never counts', run(declared, one).code, 0);
  spawnSync(process.execPath, [fileURLToPath(new URL('./agent-roster.mjs', import.meta.url))], {
    cwd: declared, encoding: 'utf8', env: { ...process.env, CLAUDE_PLUGIN_ROOT: '' },
    input: JSON.stringify({ hook_event_name: 'PostToolUse', tool_name: 'Agent', tool_input: { subagent_type: 'sonnet55', model: 'opus', description: 'survey', prompt: 'survey [read-only: research only]' }, tool_response: { agent_id: 'agent-ro' } }),
  });
  const rows = readFileSync(join(declared, '.ai', 'agents.jsonl'), 'utf8').trim().split(/\r?\n/).map((l) => JSON.parse(l));
  expect('the roster row logs the read-only declaration', rows.some((r) => r.id === 'agent-ro' && r.readOnly === 'research only') ? 1 : 0, 1);
}

// Read-only lanes never block and are never blocked: an agent whose definition grants no writing tool has no
// edit-build-measure loop to price.
{
  const withAgents = (defs) => {
    const dir = roster(makeRepo({ cargo: true }), [inFlightRow()]);
    mkdirSync(join(dir, '.claude', 'agents'), { recursive: true });
    for (const [name, tools] of Object.entries(defs)) writeFileSync(join(dir, '.claude', 'agents', `${name}.md`), `---\nname: ${name}\nmodel: claude-opus-4-8\ntools: ${tools}\n---\nbody\n`);
    return dir;
  };
  const defs = { reader: 'Read, Grep, Glob, Bash, WebSearch', writer: 'Read, Grep, Edit, Bash', anything: '*' };
  expect('a read-only project agent dispatches while a writer is in flight', run(withAgents(defs), { subagent_type: 'reader', prompt: 'audit the generators' }).code, 0);
  expect('a project agent granted Edit still blocks', run(withAgents(defs), { subagent_type: 'writer', prompt: 'fix the generators' }).code, 2);
  expect('a project agent granted every tool still blocks', run(withAgents(defs), { subagent_type: 'anything', prompt: 'fix the generators' }).code, 2);
  expect('the built-in Explore agent dispatches while a writer is in flight', run(roster(makeRepo({ cargo: true }), [inFlightRow()]), { subagent_type: 'Explore', model: 'opus', prompt: 'find the callers' }).code, 0);
  expect('the kit researcher (plugin-prefixed) dispatches while a writer is in flight', run(roster(makeRepo({ cargo: true }), [inFlightRow()]), { subagent_type: 'claude-kit:researcher', model: 'opus', prompt: 'trace the load path' }).code, 0);
  for (const type of ['claude-kit:analyst', 'claude-kit:analyst-max']) {
    expect(`the kit ${type} dispatches while a writer is in flight (read-only by definition)`, run(roster(makeRepo({ cargo: true }), [inFlightRow()]), { subagent_type: type, model: 'opus', prompt: 'root-cause the seam' }).code, 0);
  }
  const analystLive = roster(makeRepo({ cargo: true }), [inFlightRow(0, { scope: 'claude-kit:analyst', task: 'root-cause the seam' })]);
  expect('a writer dispatches while only a kit analyst is in flight', run(analystLive, one).code, 0);
  const readerLive = withAgents(defs);
  roster(readerLive, [inFlightRow(0, { scope: 'reader', task: 'audit the generators' })]);
  expect('a writer dispatches while only a read-only lane is in flight', run(readerLive, one).code, 0);
  roster(readerLive, [inFlightRow(0, { scope: 'reader' }), inFlightRow(0, { id: 'agent-writer', scope: 'writer' })]);
  expect('…but not while a writer lane is in flight beside it', run(readerLive, one).code, 2);
}

finish();
