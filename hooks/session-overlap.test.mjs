// Other live sessions in the claude-kit checkout raise no flag unless two sessions write the same file (KIT-D155): the
// holder guard (writer dispatch and edit) and the commit-foreign gate judge the kit checkout per file; any other repo
// keeps the whole-checkout rule. A session that is not live (its registry entry lapsed) never blocks.
// Run: node hooks/session-overlap.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { expect, finish, gitTop, inFlightRow, makeRepo, roster, runRaw } from './dispatch-guard-harness.mjs';

process.env.CLAUDE_KIT_TURN_STATE = mkdtempSync(join(tmpdir(), 'so-state-'));
const { beatHolder } = await import('./lib/checkout-holder.mjs');
const { recordTurnWrite } = await import('./turn-writes.mjs');

const MS_PER_MIN = 60 * 1000;
const LAPSED_MIN = 20;
const freshRegistry = () => { process.env.CLAUDE_KIT_HOLDERS_DIR = mkdtempSync(join(tmpdir(), 'dg-holders-')); };

const git = (tree, ...args) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: tree, stdio: 'ignore' });
function repoWith(name) {
  const tree = makeRepo();
  if (name) writeFileSync(join(tree, 'package.json'), JSON.stringify({ name }));
  for (const f of ['a.js', 'b.js']) writeFileSync(join(tree, f), 'export const x = 1;\n');
  git(tree, 'add', '-A');
  git(tree, 'commit', '-qm', 'init');
  for (const f of ['a.js', 'b.js']) writeFileSync(join(tree, f), 'export const x = 2;\n');
  return tree;
}

const kit = repoWith('claude-kit');
const other = repoWith('some-game');
const writer = (tree, paths) => ({ subagent_type: 'general-purpose', model: 'sonnet', prompt: `x [tree: ${tree}] [job: fix]${paths ? ` [paths: ${paths}]` : ''}` });
const dispatch = (home, sid, tree, paths) => runRaw(home, JSON.stringify({ tool_name: 'Agent', session_id: sid, tool_input: writer(tree, paths) }));
const edit = (sid, tree, file) => spawnSync(process.execPath, [fileURLToPath(new URL('./holder-beat.mjs', import.meta.url))], { cwd: tree, encoding: 'utf8', input: JSON.stringify({ session_id: sid, tool_input: { file_path: join(tree, file) } }) });
const commitGate = (tree, sid) => spawnSync(process.execPath, [fileURLToPath(new URL('./commit-gate.mjs', import.meta.url))], { cwd: tree, encoding: 'utf8', input: JSON.stringify({ session_id: sid, tool_input: { command: `git -C ${tree} commit -m "implements KIT-T407"` } }) });
const stage = (tree, ...files) => { git(tree, 'reset', '-q'); git(tree, 'add', ...files); };
const holdBy = (tree, session, ledgerFiles, now = Date.now()) => {
  beatHolder({ tree: gitTop(tree), session, label: 'claude-kit:agent', now });
  for (const f of ledgerFiles) recordTurnWrite(gitTop(tree), join(tree, f), session);
};

freshRegistry();
holdBy(kit, 'SA', ['a.js']);
expect('kit: a live holder and a dirty tree, writer declaring other files: allowed', dispatch(makeRepo(), 'SB', kit, 'b.js').code, 0);
expect('kit: a writer declaring no paths is never a flag (a dirty tree and a live holder alone)', dispatch(makeRepo(), 'SB', kit).code, 0);
expect('kit: [paths: *] (unknown) is never a flag', dispatch(makeRepo(), 'SB', kit, '*').code, 0);
const clash = dispatch(makeRepo(), 'SB', kit, 'a.js');
expect('kit: a writer declaring the file the live holder changed and has not committed is blocked', clash.code, 2);
expect('kit: the block names the file and the holder session', /a\.js/.test(clash.err) && /session SA/.test(clash.err) ? 1 : 0, 1);
expect('kit: the holder\'s own session is allowed on its file', dispatch(makeRepo(), 'SA', kit, 'a.js').code, 0);

expect('kit edit: a different file passes', edit('SB', kit, 'b.js').status, 0);
const editClash = edit('SB', kit, 'a.js');
expect('kit edit: the file another live session changed and has not committed is blocked', editClash.status, 2);
expect('kit edit: the block names the file and the holder', /a\.js/.test(editClash.stderr) && /session SA/.test(editClash.stderr) ? 1 : 0, 1);
expect('kit edit: the holder editing its own file passes', edit('SA', kit, 'a.js').status, 0);

stage(kit, 'b.js');
expect('kit commit: staging a file no live session changed passes', commitGate(kit, 'SB').status, 0);
stage(kit, 'a.js');
const commitClash = commitGate(kit, 'SB');
expect('kit commit: staging the file a live session changed and has not committed is blocked', commitClash.status, 2);
expect('kit commit: the block names the file and the holder', /a\.js/.test(commitClash.stderr) && /session SA/.test(commitClash.stderr) ? 1 : 0, 1);

git(kit, 'commit', '-qm', 'a', '--', 'a.js');
expect('kit: once the holder committed the file it is clean and the second session edits it freely', edit('SB', kit, 'a.js').status, 0);

freshRegistry();
writeFileSync(join(kit, 'a.js'), 'export const x = 4;\n');
holdBy(kit, 'SA', ['a.js']);
holdBy(kit, 'SB', ['b.js']);
recordTurnWrite(gitTop(kit), join(kit, 'a.js'), 'SB');
expect('kit: SB\'s refused edit of SA\'s file is refused', edit('SB', kit, 'a.js').status, 2);
expect('kit: the refused attempt in SB\'s ledger never locks SA out of its own file', edit('SA', kit, 'a.js').status, 0);
stage(kit, 'a.js');
expect('kit: nor does it block SA\'s commit of that file', commitGate(kit, 'SA').status, 0);
git(kit, 'commit', '-qm', 'a again', '--', 'a.js');
expect('kit: once SA committed, SB edits the file it was refused', edit('SB', kit, 'a.js').status, 0);

freshRegistry();
writeFileSync(join(kit, 'a.js'), 'export const x = 5;\n');
holdBy(kit, 'SA', ['a.js']);
git(kit, 'commit', '-qm', 'SA a', '--', 'a.js');
writeFileSync(join(kit, 'a.js'), 'export const x = 6;\n');
expect('kit edit: the holder committed the file and someone else dirtied it again: no longer the holder\'s, a second session edits it (KIT-T944)', edit('SB', kit, 'a.js').status, 0);
expect('kit: a writer declaring that file is not blocked by the stale ledger either', dispatch(makeRepo(), 'SB', kit, 'a.js').code, 0);
holdBy(kit, 'SA', ['a.js']);
expect('negative control: the holder writing the file again right after a commit of it (same second) is held to it (KIT-T948)', edit('SB', kit, 'a.js').status, 2);
git(kit, 'commit', '-qm', 'other file', '--', 'b.js');
expect('negative control: a commit of another file moves HEAD and releases nothing', edit('SB', kit, 'a.js').status, 2);
git(kit, 'commit', '-qm', 'SA a again', '--', 'a.js');

freshRegistry();
roster(kit, [inFlightRow(0, { scope: 'implementer' })]);
expect('kit: another session\'s in-flight writer in the shared roster does not block a writer on other files', dispatch(kit, 'SB', kit, 'b.js').code, 0);
roster(kit, [inFlightRow(0, { scope: 'implementer', paths: ['b.js'] })]);
expect('kit: an in-flight writer in the roster declaring the same file blocks', dispatch(kit, 'SB', kit, 'b.js').code, 2);
expect('kit: the same roster row does not block a writer declaring another file', dispatch(kit, 'SB', kit, 'a.js').code, 0);

freshRegistry();
holdBy(kit, 'SA', ['b.js'], Date.now() - LAPSED_MIN * MS_PER_MIN);
expect('kit: a session whose registry entry lapsed never blocks, even on its dirty file', dispatch(makeRepo(), 'SB', kit, 'b.js').code, 0);
expect('kit edit: a lapsed session never blocks an edit', edit('SB', kit, 'b.js').status, 0);

freshRegistry();
holdBy(other, 'SA', ['a.js']);
expect('another repo: a live holder still blocks a writer on a different file', dispatch(makeRepo(), 'SB', other, 'b.js').code, 2);
expect('another repo: a live holder still blocks a writer declaring no paths', dispatch(makeRepo(), 'SB', other).code, 2);

finish();
