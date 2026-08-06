// Automated test for the dispatch gate (hooks/dispatch-guard.mjs) — all three checks.
// dispatch-ladder: BLOCK on a model-less delegation inheriting a fable session; ALLOW on
//   explicit models, frontmatter-pinned kit agents, non-fable sessions, [allow-fable],
//   missing transcripts, unadopted repos, malformed payloads.
// cold-worktree-build: BLOCK a worktree dispatch into a Cargo workspace; ALLOW when the brief
//   provisions CARGO_TARGET_DIR, on [cold-build-ok], on a non-Rust repo, via the ignore file.
// shared-tree-dispatch: BLOCK a non-worktree dispatch while the roster shows a live agent IN THIS
//   TREE; ALLOW on worktree isolation, [shared-tree-ok], an empty/stale/finished/corrupt roster,
//   and (KIT-T177) on a row that is worktree-isolated or aimed at another repo.
// Run: node hooks/dispatch-guard.test.mjs

import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

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

function ignoreFile(dir, checkId) {
  writeFileSync(join(dir, '.claude-kit-ignore.yaml'), `${checkId}:\n  - "**"\n`);
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
    env: { ...process.env, CLAUDE_KIT_ALLOW_FABLE: '', CLAUDE_PLUGIN_ROOT: '' },
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
expect('allows pinned kit agent (frontmatter model: opus)', run(d, { subagent_type: 'claude-kit:researcher', prompt: 'x' }, fable).code, 0);
expect('allows [allow-fable: reason] escape on a model-less inherit', run(d, { subagent_type: 'general-purpose', prompt: 'judge panel [allow-fable: hardest-reasoning verify]' }, fable).code, 0);
expect('allows inherit from a non-fable session', run(d, { subagent_type: 'general-purpose', prompt: 'x' }, opus).code, 0);
expect('allows when the transcript is missing (indeterminate)', run(d, { subagent_type: 'general-purpose', prompt: 'x' }, join(d, 'missing.jsonl')).code, 0);

// FAIL-OPEN — never wedge a delegation.
expect('allows on an unadopted repo', run(un, { subagent_type: 'general-purpose', prompt: 'x' }, fable).code, 0);
expect('allows on malformed stdin', runRaw(d, 'not json at all').code, 0);

// Block message quality — the fix and the escape are both named.
const msg = run(d, { subagent_type: 'general-purpose', prompt: 'x' }, fable).err;
expect("block message names the fix (model:'opus')", /model:'opus'/.test(msg) ? 1 : 0, 1);
expect('block message names the escape token', /\[allow-fable/.test(msg) ? 1 : 0, 1);
expect('block message carries the exclude footer', /dispatch-ladder/.test(msg) ? 1 : 0, 1);

// --- cold-worktree-build (KIT-T176) ---------------------------------------------
const rust = makeRepo({ cargo: true });
const plain = makeRepo();
const wt = { subagent_type: 'general-purpose', model: 'opus', isolation: 'worktree', prompt: 'port the drill mesh (KIT-T176)' };

expect('blocks a worktree dispatch into a Cargo workspace', run(rust, wt).code, 2);
expect('allows when the brief provisions CARGO_TARGET_DIR', run(rust, { ...wt, prompt: 'port the drill mesh — export CARGO_TARGET_DIR=../main/target first' }).code, 0);
expect('allows the [cold-build-ok: reason] escape', run(rust, { ...wt, prompt: 'one-off audit [cold-build-ok: no cargo run needed]' }).code, 0);
expect('allows a worktree dispatch in a non-Rust repo', run(plain, wt).code, 0);
expect('allows a non-worktree dispatch in a Cargo workspace', run(rust, { subagent_type: 'general-purpose', model: 'opus', prompt: 'x' }).code, 0);
expect('allows via the ignore file (cold-worktree-build)', run(ignoreFile(makeRepo({ cargo: true }), 'cold-worktree-build'), wt).code, 0);
expect('allows on malformed stdin with a Cargo repo (fail-open)', runRaw(rust, '{not json').code, 0);

const coldMsg = run(rust, wt).err;
expect('cold-build message names CARGO_TARGET_DIR', /CARGO_TARGET_DIR/.test(coldMsg) ? 1 : 0, 1);
expect('cold-build message cites the lived 30+ min burn', /30\+ minutes/.test(coldMsg) ? 1 : 0, 1);
expect('cold-build message names the escape token', /\[cold-build-ok/.test(coldMsg) ? 1 : 0, 1);
expect('cold-build message carries the exclude footer', /id: cold-worktree-build/.test(coldMsg) ? 1 : 0, 1);

// --- shared-tree-dispatch (KIT-T176) --------------------------------------------
const busy = roster(makeRepo(), [inFlightRow()]);
const shared = { subagent_type: 'general-purpose', model: 'opus', prompt: 'add the ore-seam test (KIT-T176)' };

expect('blocks a second dispatch while an agent is in flight', run(busy, shared).code, 2);
expect('allows a worktree dispatch while an agent is in flight', run(busy, { ...shared, isolation: 'worktree' }).code, 0);
expect('allows the [shared-tree-ok: reason] escape', run(busy, { ...shared, prompt: 'read-only sweep [shared-tree-ok: no writes]' }).code, 0);
expect('allows via the ignore file (shared-tree-dispatch)', run(ignoreFile(roster(makeRepo(), [inFlightRow()]), 'shared-tree-dispatch'), shared).code, 0);
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
const sameTree = makeRepo();
roster(sameTree, [inFlightRow(0, { targetRoot: gitTop(sameTree) })]);

expect('allows when the live row is worktree-isolated (its own checkout)', run(roster(makeRepo(), [inFlightRow(0, { isolation: 'worktree' })]), shared).code, 0);
expect('allows when the live row targets another repo', run(roster(makeRepo(), [inFlightRow(0, { targetRoot: elsewhere })]), shared).code, 0);
expect('blocks when the live row targets THIS tree', run(sameTree, shared).code, 2);
expect('allows when the NEW dispatch is aimed at another repo root', run(sameTree, { ...shared, prompt: `implement KIT-T177 in \`${elsewhere}\`` }).code, 0);
expect('blocks an old-format row with neither field (conservative)', run(roster(makeRepo(), [inFlightRow()]), shared).code, 2);
expect('an old-format row still ages out at 2h', run(roster(makeRepo(), [inFlightRow(3 * HOURS, { targetRoot: undefined })]), shared).code, 0);
expect('a row with an unparseable isolation value still counts (fail toward the halt)', run(roster(makeRepo(), [inFlightRow(0, { isolation: 42 })]), shared).code, 2);
expect('the tree-scoped filter still fails open on a corrupt roster', run(roster(makeRepo(), ['{ not json', JSON.stringify(inFlightRow(0, { isolation: 'worktree' }))]), shared).code, 0);
expect('block message names the tree it scoped to', run(sameTree, shared).err.includes(gitTop(sameTree)) ? 1 : 0, 1);

const sharedMsg = run(busy, shared).err;
expect('shared-tree message names the one-agent-per-tree rule', /two agents in one working tree/i.test(sharedMsg) ? 1 : 0, 1);
expect('shared-tree message lists the in-flight agent', /agent-live/.test(sharedMsg) ? 1 : 0, 1);
expect('shared-tree message names the worktree remedy', /isolation: "worktree"/.test(sharedMsg) ? 1 : 0, 1);
expect('shared-tree message names the escape token', /\[shared-tree-ok/.test(sharedMsg) ? 1 : 0, 1);
expect('shared-tree message carries the exclude footer', /id: shared-tree-dispatch/.test(sharedMsg) ? 1 : 0, 1);

// A busy tree that is also unadopted stays silent — the global install never punishes a
// repo that hasn't opted in.
expect('allows on an unadopted repo with a Cargo.toml', run(makeRepo({ adopt: false, cargo: true }), wt).code, 0);

// --- the pins the gate RELIES on (KIT-T151, KIT-D061) --------------------------------
// The dispatch-ladder check treats a kit agent as safe because its frontmatter pins a model. That
// makes the pins part of the gate's contract, so they are asserted here rather than trusted: an
// unpinned agent silently inherits the session model, and an ALIAS is not a pin — `opus`
// retargeted 4.8 -> Opus 5 at Claude Code v2.1.219 with no repo change, so pins must be full
// versioned ids. Fable-class pins are legal only for the asset lane (KIT-D061: 3D/visual
// authoring runs fable/medium; before KIT-T191 an implementation agent pinned to fable burned
// ~230K tokens on an opus-grade job).
{
  const FABLE_LANE = new Set(['game-asset-artist.md', 'light-and-shadow.md']);
  const { readdirSync, readFileSync } = await import('node:fs');
  const agentsDir = fileURLToPath(new URL('../agents', import.meta.url));
  for (const file of readdirSync(agentsDir).filter((f) => f.endsWith('.md') && f !== 'README.md')) {
    const pin = (readFileSync(join(agentsDir, file), 'utf8').match(/^model:[ \t]*(\S+)/m) || [])[1];
    expect(`${file} pins a model`, pin ? 1 : 0, 1);
    expect(`${file} pins a full versioned id, not an alias`, /^claude-/.test(pin || '') ? 1 : 0, 1);
    expect(
      `${file} fable pin is asset-lane only`,
      /fable/.test(pin || '') && !FABLE_LANE.has(file) ? 0 : 1,
      1,
    );
  }
}

process.exit(failures ? 1 : 0);
