// Void claims of another live session in the kit checkout are released (KIT-D155, KIT-T944 residuals):
//  - a claim recorded without a write HEAD names no commit that could release it, so it holds one holder window from the
//    first time it is judged and then lapses; a claim with a recorded HEAD never lapses by time;
//  - a claim on a file whose dirty content another session's Edit or Write produced from clean text is released by that
//    content's hash (the writer commits without a token); a file that began dirty, a changed content and the holder's own
//    write release nothing (KIT-T948).
// Run: node hooks/claim-release.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { expect, finish, gitTop, makeRepo } from './dispatch-guard-harness.mjs';

process.env.CLAUDE_KIT_TURN_STATE = mkdtempSync(join(tmpdir(), 'cr-state-'));
process.env.CLAUDE_KIT_HOLDERS_DIR = mkdtempSync(join(tmpdir(), 'cr-holders-'));
const { beatHolder, HOLDER_WINDOW_MS } = await import('./lib/checkout-holder.mjs');
const { overlappingHolders } = await import('./lib/live-claims.mjs');
const { recordSessionPath } = await import('./turn-writes.mjs');
const { writeTurnState } = await import('./lib/turn-state.mjs');

const MIN = 60 * 1000;
const git = (tree, ...args) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: tree, stdio: 'ignore' });
const hook = (name, tree, input) => spawnSync(process.execPath, [fileURLToPath(new URL(`./${name}`, import.meta.url))], { cwd: tree, encoding: 'utf8', input: JSON.stringify(input) });

function kitRepo() {
  const tree = makeRepo();
  writeFileSync(join(tree, 'package.json'), JSON.stringify({ name: 'claude-kit' }));
  for (const f of ['a.js', 'b.js', 'c.js']) writeFileSync(join(tree, f), 'export const x = 1;\n');
  git(tree, 'add', '-A');
  git(tree, 'commit', '-qm', 'init');
  return tree;
}
const edit = (tree, session, rel, from, to) => {
  hook('pre-write.mjs', tree, { session_id: session, tool_input: { file_path: join(tree, rel), old_string: from, new_string: to } });
  writeFileSync(join(tree, rel), readFileSync(join(tree, rel), 'utf8').replace(from, to));
};
const claimedBy = (tree, session, paths, now) => overlappingHolders({ tree: gitTop(tree), session, paths, now }).flatMap((o) => o.files);
const absorb = (tree, session, rel) => { beatHolder({ tree: gitTop(tree), session, label: 'agent' }); recordSessionPath(gitTop(tree), rel, session); };

// A claim with no recorded write HEAD lapses one window after it was first judged; one with a HEAD does not.
{
  const tree = kitRepo();
  const root = gitTop(tree);
  const t0 = Date.now();
  writeFileSync(join(tree, 'a.js'), 'export const x = 2;\n');
  writeFileSync(join(tree, 'b.js'), 'export const x = 2;\n');
  beatHolder({ tree: root, session: 'SA', now: t0 });
  writeTurnState(root, { files: ['a.js'] }, 'swrites-SA');
  absorb(tree, 'SH', 'b.js');
  beatHolder({ tree: root, session: 'SH', now: t0 });
  expect('a claim with no write HEAD holds when first judged', claimedBy(tree, 'SB', ['a.js'], t0).join(), 'a.js');
  beatHolder({ tree: root, session: 'SA', now: t0 + 10 * MIN });
  expect('it still holds inside the window', claimedBy(tree, 'SB', ['a.js'], t0 + 10 * MIN).join(), 'a.js');
  beatHolder({ tree: root, session: 'SA', now: t0 + 14 * MIN });
  beatHolder({ tree: root, session: 'SH', now: t0 + 14 * MIN });
  expect('a live holder\'s claim with no write HEAD lapses one window after it was first judged', claimedBy(tree, 'SB', ['a.js'], t0 + HOLDER_WINDOW_MS + MIN).join(), '');
  expect('negative control: a claim with a recorded write HEAD never lapses by time', claimedBy(tree, 'SB', ['b.js'], t0 + HOLDER_WINDOW_MS + MIN).join(), 'b.js');
}

// A claim on content another session wrote from clean text is released by the content's hash.
{
  const tree = kitRepo();
  const root = gitTop(tree);
  absorb(tree, 'SA', 'c.js');
  expect('before any write the absorbed claim does not matter: the file is clean', claimedBy(tree, 'SB', ['c.js']).join(), '');
  edit(tree, 'SB', 'c.js', 'x = 1', 'x = 2');
  expect('SB\'s Edit of clean text releases SA\'s claim on the file', claimedBy(tree, 'SB', ['c.js']).join(), '');
  edit(tree, 'SB', 'c.js', 'x = 2', 'x = 3');
  expect('SB\'s second Edit, on its own clean-based text, still releases it', claimedBy(tree, 'SB', ['c.js']).join(), '');
  writeFileSync(join(tree, 'c.js'), 'export const x = 4;\n');
  expect('control: content changed since SB\'s write (a shell rewrite) holds the claim again', claimedBy(tree, 'SB', ['c.js']).join(), 'c.js');
  edit(tree, 'SB', 'c.js', 'x = 4', 'x = 5');
  expect('control: an Edit on top of content nobody proved clean (a chain broken by another change) releases nothing', claimedBy(tree, 'SB', ['c.js']).join(), 'c.js');
}
{
  const tree = kitRepo();
  absorb(tree, 'SA', 'a.js');
  edit(tree, 'SA', 'a.js', 'x = 1', 'x = 2');
  expect('control: the holder\'s own clean-based write releases nothing against another session', claimedBy(tree, 'SB', ['a.js']).join(), 'a.js');
  edit(tree, 'SB', 'a.js', 'x = 2', 'x = 3');
  expect('control: an Edit by SB on top of SA\'s uncommitted work releases nothing (the file began dirty)', claimedBy(tree, 'SB', ['a.js']).join(), 'a.js');
}
{
  const tree = kitRepo();
  absorb(tree, 'SA', 'b.js');
  hook('pre-write.mjs', tree, { session_id: 'SB', tool_input: { file_path: join(tree, 'b.js'), content: 'export const x = 9;\n' } });
  writeFileSync(join(tree, 'b.js'), 'export const x = 9;\n');
  expect('a Write replaces the whole file, so it releases a claim on dirt it overwrote', claimedBy(tree, 'SB', ['b.js']).join(), '');
}

// The hooks judge the claim through the same release rules.
{
  const tree = kitRepo();
  absorb(tree, 'SA', 'c.js');
  edit(tree, 'SB', 'c.js', 'x = 1', 'x = 2');
  const repeat = hook('holder-beat.mjs', tree, { session_id: 'SB', tool_input: { file_path: join(tree, 'c.js'), old_string: 'x = 2', new_string: 'x = 3' } });
  expect('holder-beat: SB\'s repeat edit of the file SA\'s ledger wrongly claims passes', repeat.status, 0);
  git(tree, 'add', 'c.js');
  const commit = hook('commit-gate.mjs', tree, { session_id: 'SB', tool_input: { command: `git -C ${tree} commit -m "implements KIT-T407"` } });
  expect('commit-gate: SB commits it without a token', commit.status, 0);
  const real = kitRepo();
  absorb(real, 'SA', 'a.js');
  edit(real, 'SA', 'a.js', 'x = 1', 'x = 2');
  const refused = hook('holder-beat.mjs', real, { session_id: 'SB', tool_input: { file_path: join(real, 'a.js'), old_string: 'x = 2', new_string: 'x = 3' } });
  expect('control: a claim on work SA really did stays: SB\'s edit is refused', refused.status, 2);
}

finish();
