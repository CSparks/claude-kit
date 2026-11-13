// Uncommitted files are never a writer (KIT-T894): a writer dispatch into a tree with modified tracked source is allowed
// unless another live session changed, and has not committed, a file the dispatch declares in [paths:]; a stale holder and
// the maintainer's own edits pass (KIT-T1114).
// Run: node hooks/dispatch-foreign-tree.test.mjs

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, finish, gitTop, makeRepo, runRaw } from './dispatch-guard-harness.mjs';

process.env.CLAUDE_KIT_TURN_STATE = mkdtempSync(join(tmpdir(), 'dft-state-'));
const MS_PER_MIN = 60 * 1000;
const STALE_MIN = 20;
const freshRegistry = () => { process.env.CLAUDE_KIT_HOLDERS_DIR = mkdtempSync(join(tmpdir(), 'dg-holders-')); };
freshRegistry();
const { beatHolder } = await import('./lib/checkout-holder.mjs');
const { recordTurnWrite } = await import('./turn-writes.mjs');
const tree = makeRepo();
const git = (...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: tree, stdio: 'ignore' });
writeFileSync(join(tree, 'src.js'), 'export const a = 1;\n');
git('add', '-A');
git('commit', '-qm', 'init');
writeFileSync(join(tree, 'src.js'), 'export const a = 2;\n');

const send = (sid, input) => runRaw(tree, JSON.stringify({ tool_name: 'Agent', session_id: sid, tool_input: { model: 'sonnet', ...input, prompt: `${input.prompt} [paths: src.js] [job: fix]` } }));
const writer = { subagent_type: 'general-purpose', prompt: 'x' };
const holdBy = (session, now = Date.now()) => {
  beatHolder({ tree: gitTop(tree), session, label: 'claude-kit:agent', now });
  recordTurnWrite(gitTop(tree), join(tree, 'src.js'), session);
};

expect('dirty tracked source with an empty registry: the writer dispatch is allowed', send('SB', writer).code, 0);

freshRegistry();
holdBy('SA');
const blocked = send('SB', writer);
expect('dirty file another live session changed, declared by the dispatch: blocked', blocked.code, 2);
expect('the block names the holder and keeps the check-id footer', /session SA/.test(blocked.err) && /checkout-holder/.test(blocked.err) ? 1 : 0, 1);
expect('[foreign-edits-ok: reason] never lifts a live holder\'s block', send('SB', { ...writer, prompt: 'x [foreign-edits-ok: known wip]' }).code, 2);
expect('the holder\'s own session is allowed back in', send('SA', writer).code, 0);

freshRegistry();
holdBy('SA', Date.now() - STALE_MIN * MS_PER_MIN);
expect('a stale holder does not block a dirty tree', send('SB', writer).code, 0);

freshRegistry();
expect('[foreign-edits-ok: reason] with an empty registry is allowed', send('SB', { ...writer, prompt: 'x [foreign-edits-ok: known wip]' }).code, 0);

finish();
