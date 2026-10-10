// Automated test for the dispatch gate (hooks/dispatch-guard.mjs) — all three checks.
// dispatch-ladder: BLOCK on a model-less delegation inheriting a fable session; ALLOW on
//   explicit models, frontmatter-pinned kit agents, non-fable sessions, [allow-fable],
//   missing transcripts, unadopted repos, malformed payloads.
// cold-worktree-build (KIT-D074): BLOCK any worktree dispatch in any adopted repo, even with
//   CARGO_TARGET_DIR or [cold-build-ok] in the brief; ALLOW only on [maintainer-asked-worktree:
//   <his words>] or the ignore file.
// shared-tree-dispatch: BLOCK a writing dispatch while the roster shows a live writer IN THIS
//   TREE; ALLOW a read-only agent type, [maintainer-asked-parallel: <his words>], an
//   empty/stale/finished/corrupt roster,
//   and (KIT-T177) on a row that is worktree-isolated or aimed at another repo.
// Run: node hooks/dispatch-guard.test.mjs

import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { fixtureKit, isoDaysAgo } from './test-harness.mjs';
const FRESH_KIT = fixtureKit(isoDaysAgo(0));
const HOOK = fileURLToPath(new URL('./dispatch-guard.mjs', import.meta.url));
const HOURS = 60 * 60 * 1000;
let failures = 0;

function makeRepo({ adopt = true, cargo = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'dg-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  if (adopt) mkdirSync(join(dir, '.ai'), { recursive: true });
  if (cargo) writeFileSync(join(dir, 'Cargo.toml'), '[workspace]\nmembers = ["game"]\n');
  return dir;
}

// Append roster rows the way agent-roster.mjs does: one JSON object per line, latest row per
// id wins, `ts` carries the delegation time.
function roster(dir, rows) {
  writeFileSync(join(dir, '.ai', 'agents.jsonl'), rows.map((r) => (typeof r === 'string' ? r : JSON.stringify(r))).join('\n') + '\n');
  return dir;
}

function inFlightRow(agesMs = 0, extra = {}) {
  return { ts: new Date(Date.now() - agesMs).toISOString(), id: 'agent-live', status: 'in-flight', task: 'refactor the mesh factory', scope: 'refactorer', ...extra };
}

function ignoreFile(dir, ...checkIds) {
  writeFileSync(join(dir, '.claude-kit-ignore.yaml'), checkIds.map((id) => `${id}:\n  - "**"\n`).join(''));
  return dir;
}

function transcript(dir, name, model) {
  const file = join(dir, `${name}.jsonl`);
  const rows = [
    JSON.stringify({ type: 'user', message: { content: 'hi' } }),
    JSON.stringify({ type: 'assistant', message: { model, content: [] } }),
  ];
  writeFileSync(file, rows.join('\n') + '\n');
  return file;
}

function runRaw(dir, stdin) {
  const r = spawnSync(process.execPath, [HOOK], {
    cwd: dir,
    input: stdin,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_KIT_ALLOW_FABLE: '', CLAUDE_PLUGIN_ROOT: '', CLAUDE_KIT_LADDER_ROOT: process.env.DG_LADDER_ROOT || FRESH_KIT },
  });
  return { code: r.status, err: r.stderr || '' };
}

function run(dir, toolInput, transcriptPath) {
  return runRaw(
    dir,
    JSON.stringify({ tool_name: 'Agent', tool_input: toolInput, transcript_path: transcriptPath })
  );
}

function expect(name, actual, wanted) {
  const ok = actual === wanted;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (exit=${actual}, want=${wanted})`);
  if (!ok) failures++;
}

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

// --- cold-worktree-build (KIT-T176) ---------------------------------------------
const rust = makeRepo({ cargo: true });
const plain = makeRepo();
const wt = { subagent_type: 'general-purpose', model: 'opus', isolation: 'worktree', prompt: 'port the drill mesh (KIT-T176)' };

expect('blocks a worktree dispatch into a Cargo workspace', run(rust, wt).code, 2);
expect('blocks even when the brief provisions CARGO_TARGET_DIR (KIT-D039)', run(rust, { ...wt, prompt: 'port the drill mesh — export CARGO_TARGET_DIR=../main/target first' }).code, 2);
expect('blocks even with the retired [cold-build-ok: reason] token', run(rust, { ...wt, prompt: 'one-off audit [cold-build-ok: no cargo run needed]' }).code, 2);
expect('allows the [maintainer-asked-worktree: <his words>] escape', run(rust, { ...wt, prompt: 'demo [maintainer-asked-worktree: "put the demo in a worktree"]' }).code, 0);
expect('an empty [maintainer-asked-worktree:] does not escape', run(rust, { ...wt, prompt: 'demo [maintainer-asked-worktree: ]' }).code, 2);
expect('blocks a worktree dispatch in a non-Rust repo too (KIT-D074)', run(plain, wt).code, 2);
expect('allows the maintainer escape in a non-Rust repo', run(plain, { ...wt, prompt: 'x [maintainer-asked-worktree: "use a worktree here"]' }).code, 0);
expect('allows a non-worktree dispatch in a Cargo workspace', run(rust, { subagent_type: 'general-purpose', model: 'opus', prompt: 'x' }).code, 0);
expect('allows via the ignore file (cold-worktree-build)', run(ignoreFile(makeRepo({ cargo: true }), 'cold-worktree-build'), wt).code, 0);
expect('allows on malformed stdin with a Cargo repo (fail-open)', runRaw(rust, '{not json').code, 0);

const coldMsg = run(rust, wt).err;
expect('cold-build message cites KIT-D039 (one checkout on main)', /KIT-D039/.test(coldMsg) && /ONE checkout on main/.test(coldMsg) ? 1 : 0, 1);
expect('cold-build message no longer offers CARGO_TARGET_DIR as a fix', /CARGO_TARGET_DIR/.test(coldMsg) ? 1 : 0, 0);
expect('cold-build message names the maintainer escape token', /\[maintainer-asked-worktree:/.test(coldMsg) ? 1 : 0, 1);
expect('cold-build message carries the exclude footer', /id: cold-worktree-build/.test(coldMsg) ? 1 : 0, 1);

// --- shared-tree-dispatch (KIT-T176) --------------------------------------------
const busy = roster(makeRepo({ cargo: true }), [inFlightRow()]);
const shared = { subagent_type: 'general-purpose', model: 'opus', prompt: 'add the ore-seam test (KIT-T176)' };

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

// --- KIT-T177: the roster is session-scoped, the RULE is tree-scoped -------------
// One live false positive (stiletto 2026-08-04) fired on a genuinely empty tree by counting three
// rows that were never colleagues: a collected agent, an agent in its OWN worktree, and an agent
// dispatched into a DIFFERENT repo. One regression case each.
const gitTop = (dir) => execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: dir, encoding: 'utf8' }).trim();
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

// A busy tree that is also unadopted stays silent — the global install never punishes a
// repo that hasn't opted in.
expect('allows on an unadopted repo with a Cargo.toml', run(makeRepo({ adopt: false, cargo: true }), wt).code, 0);

// --- one read/write agent per checkout (KIT-D077) ----------------------------------
const one = { subagent_type: 'general-purpose', model: 'opus', prompt: 'implement the next ticket (KIT-T256)' };
const live = () => roster(makeRepo({ cargo: true }), [inFlightRow()]);
expect('the retired [allow-parallel: …] token does not escape', run(live(), { ...one, prompt: `${one.prompt} ${RETIRED_PAR}` }).code, 2);
expect('the maintainer token does not lift a worktree dispatch', run(live(), { ...one, isolation: 'worktree', prompt: `${one.prompt} ${PAR}` }).code, 2);
expect('two writers in ONE checkout pass with the maintainer token', run(live(), { ...one, prompt: `${one.prompt} ${PAR}` }).code, 0);
expect('allows the first agent (empty roster)', run(roster(makeRepo({ cargo: true }), []), one).code, 0);
expect('allows the ignore-file key', run(ignoreFile(live(), 'shared-tree-dispatch'), one).code, 0);
expect('blocks in a non-Rust repo too (the rule is per checkout)', run(roster(makeRepo(), [inFlightRow()]), one).code, 2);

// --- [tree:] keys the count by the checkout the agent writes in -------------------------
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

// --- [read-only: reason] on a writer-capable type ---------------------------------------
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

// --- read-only lanes never block and are never blocked --------------------------------
// The check prices the edit→build→measure loop. An agent whose definition grants no writing
// tool (researcher, reviewer, the built-in Explore/Plan) has no such loop and no half-written
// files, so analytical lanes run in parallel (the maintainer, 2026-09-17: "WE definitely should
// be able to run parallel agents doing analytical work").
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

// cold-worktree-build now also fires on a HAND-MADE worktree named in the brief (the
// 2026-08-25 lanes were `git worktree add`-ed by hand and dodged the isolation check).
{
  const main = makeRepo({ cargo: true });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'seed'], { cwd: main });
  const wtDir = join(main, '..', `dg-wt-${process.pid}`);
  execFileSync('git', ['worktree', 'add', '-q', wtDir], { cwd: main });
  const named = { subagent_type: 'general-purpose', model: 'opus', prompt: `You work in the worktree \`${wtDir}\` (branch wt/x). Implement KIT-T256.` };
  expect('blocks a brief naming a hand-made worktree in a Cargo repo (cold build)', /cold-worktree-build/.test(run(main, named).err) ? 1 : 0, 1);
  {
    const plainMain = makeRepo();
    execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'seed'], { cwd: plainMain });
    const plainWt = join(plainMain, '..', `dg-wt-plain-${process.pid}`);
    execFileSync('git', ['worktree', 'add', '-q', plainWt], { cwd: plainMain });
    expect('blocks a brief naming a hand-made worktree in a non-Rust repo (KIT-D074)', run(plainMain, { ...named, prompt: `Work in \`${plainWt}\`.` }).code, 2);
  }
  expect('still blocks it with CARGO_TARGET_DIR provisioned (KIT-D039)',run(main, { ...named, prompt: `${named.prompt} Set CARGO_TARGET_DIR=${join(main, 'target')} first.` }).code, 2);

  // A SUBMODULE's .git is a file too (gitdir → .git/modules/…); naming one — every framework
  // brief does — is not a worktree dispatch. Lived false positive: 2026-08-26, stiletto/rapid-game.
  const sub = join(main, 'framework');
  mkdirSync(sub, { recursive: true });
  writeFileSync(join(sub, '.git'), 'gitdir: ../.git/modules/framework\n');
  expect('a brief naming a SUBMODULE path is not a worktree dispatch', /cold-worktree-build/.test(run(main, { ...named, prompt: `Repos: \`${main}\` + submodule \`${sub}\`. Implement KIT-T256.` }).err) ? 1 : 0, 0);
}

// --- no pins anywhere (KIT-D080) -----------------------------------------------------
// Kit agents carry no `model:` line: the orchestrator names a family on every dispatch, so the
// dispatch-ladder check above treats a model-less call on a fable thread as the silent inherit
// for every agent type alike. An agent that pinned a model would reintroduce a second routing home.
{
  const { readdirSync } = await import('node:fs');
  const agentsDir = fileURLToPath(new URL('../agents', import.meta.url));
  for (const file of readdirSync(agentsDir).filter((f) => f.endsWith('.md') && f !== 'README.md')) {
    const frontmatter = readFileSync(join(agentsDir, file), 'utf8').split('---')[1] || '';
    expect(`${file} carries no model line`, /^model:/m.test(frontmatter) ? 1 : 0, 0);
  }
}

// --- foreign-tree-edits (KIT-T407) ---------------------------------------------------
// A writer dispatch into a tree dirty with edits this session never made is blocked; a
// read-only dispatch, an attributed edit, a store-only change and the escape pass.
{
  const { rmSync } = await import('node:fs');
  const stateDir = mkdtempSync(join(tmpdir(), 'dg-state-'));
  process.env.CLAUDE_KIT_TURN_STATE = stateDir;
  const tree = makeRepo();
  const git = (...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: tree, stdio: 'ignore' });
  writeFileSync(join(tree, 'src.js'), 'export const a = 1;\n');
  writeFileSync(join(tree, '.ai', 'T1.md'), 'x\n');
  git('add', '-A');
  git('commit', '-qm', 'init');
  const send = (sid, input) => runRaw(tree, JSON.stringify({ tool_name: 'Agent', session_id: sid, tool_input: { model: 'sonnet', ...input } }));
  const writer = { subagent_type: 'general-purpose', prompt: 'x' };

  writeFileSync(join(tree, '.ai', 'T1.md'), 'changed\n');
  expect('store-only edits do not block a writer dispatch', send('S1', writer).code, 0);

  writeFileSync(join(tree, 'src.js'), 'export const a = 2;\n');
  const blocked = send('S1', writer);
  expect('foreign edit to tracked source blocks a writer dispatch', blocked.code, 2);
  expect('the block names the file and says a second writer is in the tree', /src\.js/.test(blocked.err) && /second writer/.test(blocked.err) ? 0 : 1, 0);
  expect('a read-only agent type is allowed into the dirty tree', send('S1', { subagent_type: 'claude-kit:researcher', prompt: 'x' }).code, 0);
  expect('[read-only: reason] on a writer type is allowed', send('S1', { ...writer, prompt: 'x [read-only: audit]' }).code, 0);
  expect('[foreign-edits-ok: reason] lifts the block', send('S1', { ...writer, prompt: 'x [foreign-edits-ok: known wip]' }).code, 0);
  expect('an unidentified session fails open', runRaw(tree, JSON.stringify({ tool_name: 'Agent', tool_input: { model: 'sonnet', ...writer } })).code, 0);

  spawnSync(process.execPath, [fileURLToPath(new URL('./pre-write.mjs', import.meta.url))], {
    cwd: tree, encoding: 'utf8',
    input: JSON.stringify({ session_id: 'S1', tool_input: { file_path: join(tree, 'src.js'), content: 'export const a = 2;\n' } }),
  });
  expect('an edit this session wrote is attributable: writer allowed', send('S1', writer).code, 0);
  expect('the same edit stays foreign to another session', send('S2', writer).code, 2);
  rmSync(stateDir, { recursive: true, force: true });
  delete process.env.CLAUDE_KIT_TURN_STATE;
}

process.exit(failures ? 1 : 0);
