// foreign-tree-edits (KIT-T407): a writer dispatch into a tree dirty with edits this session never made is blocked; a
// read-only dispatch, an attributed edit, a store-only change and the escape pass.
// Run: node hooks/dispatch-foreign-tree.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { expect, finish, makeRepo, runRaw } from './dispatch-guard-harness.mjs';

const stateDir = mkdtempSync(join(tmpdir(), 'dg-state-'));
process.env.CLAUDE_KIT_TURN_STATE = stateDir;
const tree = makeRepo();
const git = (...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: tree, stdio: 'ignore' });
writeFileSync(join(tree, 'src.js'), 'export const a = 1;\n');
writeFileSync(join(tree, '.ai', 'T1.md'), 'x\n');
git('add', '-A');
git('commit', '-qm', 'init');
const send = (sid, input) => runRaw(tree, JSON.stringify({ tool_name: 'Agent', session_id: sid, tool_input: { model: 'sonnet', ...input, prompt: `${input.prompt} [job: fix]` } }));
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
expect('an unidentified session fails open', runRaw(tree, JSON.stringify({ tool_name: 'Agent', tool_input: { model: 'sonnet', ...writer, prompt: 'x [job: fix]' } })).code, 0);

spawnSync(process.execPath, [fileURLToPath(new URL('./pre-write.mjs', import.meta.url))], {
  cwd: tree, encoding: 'utf8',
  input: JSON.stringify({ session_id: 'S1', tool_input: { file_path: join(tree, 'src.js'), content: 'export const a = 2;\n' } }),
});
expect('an edit this session wrote is attributable: writer allowed', send('S1', writer).code, 0);
process.env.CLAUDE_KIT_HOLDERS_DIR = mkdtempSync(join(tmpdir(), 'dg-holders-'));
expect('the same edit stays foreign to another session', send('S2', writer).code, 2);
rmSync(stateDir, { recursive: true, force: true });
delete process.env.CLAUDE_KIT_TURN_STATE;

finish();
