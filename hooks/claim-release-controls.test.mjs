// Negative controls for hooks/lib/live-claims.mjs (KIT-D155, KIT-T944, KIT-T948): a claim with a recorded write HEAD judged
// from the start never lapses by time, and an Edit chained onto content that began dirty never counts as clean-based.
// Run: node hooks/claim-release-controls.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { expect, finish, gitTop, makeRepo } from './dispatch-guard-harness.mjs';

process.env.CLAUDE_KIT_TURN_STATE = mkdtempSync(join(tmpdir(), 'crc-state-'));
process.env.CLAUDE_KIT_HOLDERS_DIR = mkdtempSync(join(tmpdir(), 'crc-holders-'));
const { beatHolder, HOLDER_WINDOW_MS } = await import('./lib/checkout-holder.mjs');
const { overlappingHolders } = await import('./lib/live-claims.mjs');
const { recordSessionPath } = await import('./turn-writes.mjs');

const MIN = 60 * 1000;
const git = (tree, ...args) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: tree, stdio: 'ignore' });
const preWrite = (tree, session, rel, from, to) => spawnSync(process.execPath, [fileURLToPath(new URL('./pre-write.mjs', import.meta.url))], {
  cwd: tree, encoding: 'utf8', input: JSON.stringify({ session_id: session, tool_input: { file_path: join(tree, rel), old_string: from, new_string: to } }),
});
const edit = (tree, session, rel, from, to) => {
  preWrite(tree, session, rel, from, to);
  writeFileSync(join(tree, rel), readFileSync(join(tree, rel), 'utf8').replace(from, to));
};
const claimedBy = (tree, session, paths, now) => overlappingHolders({ tree: gitTop(tree), session, paths, now }).flatMap((o) => o.files);

function kitRepo() {
  const tree = makeRepo();
  writeFileSync(join(tree, 'package.json'), JSON.stringify({ name: 'claude-kit' }));
  for (const f of ['a.js', 'b.js']) writeFileSync(join(tree, f), 'export const x = 1;\n');
  git(tree, 'add', '-A');
  git(tree, 'commit', '-qm', 'init');
  return tree;
}

{
  const tree = kitRepo();
  const root = gitTop(tree);
  const t0 = Date.now();
  recordSessionPath(root, 'a.js', 'SA');
  beatHolder({ tree: root, session: 'SA', now: t0 });
  writeFileSync(join(tree, 'a.js'), 'export const x = 2;\n');
  expect('a claim with a recorded write HEAD holds when first judged', claimedBy(tree, 'SB', ['a.js'], t0).join(), 'a.js');
  beatHolder({ tree: root, session: 'SA', now: t0 + 14 * MIN });
  expect('negative control: judged from the start, it still holds past one holder window', claimedBy(tree, 'SB', ['a.js'], t0 + HOLDER_WINDOW_MS + MIN).join(), 'a.js');
}

{
  const tree = kitRepo();
  recordSessionPath(gitTop(tree), 'a.js', 'SA');
  beatHolder({ tree: gitTop(tree), session: 'SA' });
  edit(tree, 'SA', 'a.js', 'x = 1', 'x = 2');
  edit(tree, 'SB', 'a.js', 'x = 2', 'x = 3');
  edit(tree, 'SB', 'a.js', 'x = 3', 'x = 4');
  expect('negative control: SB\'s second Edit, chained onto text that began as SA\'s uncommitted work, releases nothing', claimedBy(tree, 'SB', ['a.js']).join(), 'a.js');
}

finish();
