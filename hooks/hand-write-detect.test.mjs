// hand-write-detect (KIT-T706, KIT-D117): a shell call that changes a hand-authored source file is caught by
// the repo's state before and after it, whatever sink wrote it; the file joins the session's hand-write
// ledger and commit-gate refuses it until Edit or Write re-saves it. Generator commands, build output,
// data files and scratchpad writes are not hand writes.
// Run: node hooks/hand-write-detect.test.mjs

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { ENV, HOOKS, cleanup, git, identify, reporter, repo, tmpDir } from './test-harness.mjs';

const { ok, done } = reporter('hand-write-detect');

try {
  const wiring = JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8'));
  const wired = (event) => wiring.hooks[event].some((e) => /Bash/.test(e.matcher) && e.hooks.some((h) => h.command.includes('hand-write-detect')));
  ok('wired for PreToolUse and PostToolUse on Bash|PowerShell', wired('PreToolUse') && wired('PostToolUse'));

  const state = tmpDir('hw-state-');
  const scratch = tmpDir('hw-scratch-');
  const spawnHook = (name, input, cwd) => spawnSync(process.execPath, [join(HOOKS, name)], {
    input: JSON.stringify(input), cwd, encoding: 'utf8', env: { ...ENV, CLAUDE_KIT_TURN_STATE: state },
  });
  const node = (cwd, code) => spawnSync(process.execPath, ['--input-type=commonjs', '-e', code], { cwd, encoding: 'utf8' });
  let callId = 0;
  const call = (d, sid, command, action) => {
    const id = `t${++callId}`;
    spawnHook('hand-write-detect.mjs', { hook_event_name: 'PreToolUse', session_id: sid, tool_use_id: id, tool_input: { command } }, d);
    action();
    return spawnHook('hand-write-detect.mjs', { hook_event_name: 'PostToolUse', session_id: sid, tool_use_id: id, tool_input: { command }, tool_response: {} }, d);
  };
  const commit = (d, sid, paths) => {
    git(['add', '--', ...paths], d);
    const r = spawnHook('commit-gate.mjs', { session_id: sid, tool_input: { command: `git -C ${d} commit -m "implements KIT-T706"` } }, d);
    git(['reset', '-q'], d);
    return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
  };
  const fresh = () => {
    const d = identify(repo());
    mkdirSync(join(d, '.ai'));
    mkdirSync(join(d, 'src'));
    writeFileSync(join(d, 'src', 'a.mjs'), 'export const a = 1;\n');
    writeFileSync(join(d, 'src', 'b.mjs'), 'export const b = 2;\n');
    git(['add', '-A'], d);
    git(['commit', '-q', '-m', 'seed'], d);
    return d;
  };
  const rewrite = (d, expr) => node(d, `const fs = require('fs'); const p = 'src/' + 'a.mjs'; ${expr}`);

  const SINKS = [
    ['a variable-path writeFileSync', "fs.writeFileSync(p, 'export const a = 9;\\n')"],
    ["fs['writeFileSync'] through a computed property", "fs['write' + 'FileSync'](p, 'export const a = 9;\\n')"],
    ['openSync and writeSync', "const fd = fs.openSync(p, 'w'); fs.writeSync(fd, 'export const a = 9;\\n'); fs.closeSync(fd)"],
    ['appendFileSync', "fs.appendFileSync(p, 'export const z = 3;\\n')"],
    ['renameSync over the file', "fs.writeFileSync('x.tmp', 'export const a = 9;\\n'); fs.renameSync('x.tmp', p)"],
  ];
  for (const [name, expr] of SINKS) {
    const d = fresh();
    const r = call(d, 'S1', 'node scratch.js', () => rewrite(d, expr));
    ok(`${name} is caught after the fact`, r.status === 2 && r.stderr.includes('src/a.mjs') && /Edit and Write/.test(r.stderr) && r.stderr.includes('source-shell-write'));
  }

  const py = spawnSync('python', ['--version'], { encoding: 'utf8' });
  if (py.status === 0) {
    const d = fresh();
    const code = "import os; fd = os.open('src/' + 'a.mjs', os.O_WRONLY | os.O_TRUNC); os.write(fd, b'export const a = 9;'); os.close(fd)";
    const r = call(d, 'S1', 'python scratch.py', () => spawnSync('python', ['-c', code], { cwd: d }));
    ok('python os.open is caught after the fact', r.status === 2 && r.stderr.includes('src/a.mjs'));
  } else {
    console.log('  skip  python os.open (python not on PATH)');
  }

  const d = fresh();
  const hit = call(d, 'S2', 'node scratch.js', () => rewrite(d, "fs.writeFileSync(p, 'export const a = 9;\\n')"));
  ok('the hand write exits 2 so the message reaches the agent', hit.status === 2);
  const refused = commit(d, 'S2', ['src/a.mjs']);
  ok('the commit holding the ledgered file is refused and names it', refused.code === 2 && refused.out.includes('src/a.mjs') && refused.out.includes('KIT-T706'));
  ok('another session is not held to this ledger', !commit(d, 'S9', ['src/a.mjs']).out.includes('KIT-T706'));
  ok('a different file in the same session commits', !commit(d, 'S2', ['src/b.mjs']).out.includes('KIT-T706'));

  const edit = spawnHook('pre-write.mjs', { session_id: 'S2', tool_input: { file_path: join(d, 'src', 'a.mjs'), content: 'export const a = 9;\n' } }, d);
  ok('the pre-write gate accepts the clean re-save', edit.status === 0);
  ok('a file re-saved through Edit clears its ledger entry: the commit passes', !commit(d, 'S2', ['src/a.mjs']).out.includes('KIT-T706'));

  const NOT_HAND = [
    ['cargo fmt rewriting a source file (generator leader)', 'cargo fmt', (e) => rewrite(e.d,"fs.writeFileSync(p, 'export const a = 9;\\n')")],
    ['git checkout restoring a source file (git leader)', 'git checkout -- src/a.mjs', (e) => rewrite(e.d, "fs.writeFileSync(p, 'export const a = 9;\\n')")],
    ['a kit verb', 'node /k/scripts/t.mjs status KIT-T1 done', (e) => rewrite(e.d, "fs.writeFileSync(p, 'export const a = 9;\\n')")],
    ['build output under target/', 'node build.js', (e) => node(e.d, "const fs = require('fs'); fs.mkdirSync('target/debug', { recursive: true }); fs.writeFileSync('target/debug/out.rs', 'x')")],
    ['a data file', 'node build.js', (e) => node(e.d, "require('fs').writeFileSync('out.json', '{}')")],
    ['a write into the scratchpad', 'node build.js', (e) => node(e.d, `require('fs').writeFileSync(${JSON.stringify(join(scratch, 'probe.mjs'))}, 'x')`)],
    ['a .ai store note', 'node build.js', (e) => node(e.d, "require('fs').writeFileSync('.ai/notes.md', 'x')")],
    ['unlinkSync deleting a source file', 'node scratch.js', (e) => rewrite(e.d, 'fs.unlinkSync(p)')],
    ['rm -rf of a tracked source directory', 'rm -rf src', (e) => node(e.d, "require('fs').rmSync('src', { recursive: true })")],
    ['a read-only script', 'node build.js', (e) => node(e.d, "require('fs').readFileSync('src/a.mjs', 'utf8')")],
  ];
  for (const [name, command, action] of NOT_HAND) {
    const e = { d: fresh() };
    const r = call(e.d, 'S3', command, () => action(e));
    ok(`NEGATIVE CONTROL: ${name} is not flagged`, r.status === 0 && !r.stderr.includes('HAND WRITE'));
  }

  const gone = fresh();
  call(gone, 'S8', 'node scratch.js', () => rewrite(gone, "fs.writeFileSync(p, 'export const a = 9;\\n')"));
  call(gone, 'S8', 'rm src/a.mjs', () => rewrite(gone, 'fs.unlinkSync(p)'));
  ok('a ledgered file deleted afterwards no longer blocks the commit', !commit(gone, 'S8', ['src/a.mjs']).out.includes('KIT-T706'));

  const dirty = fresh();
  writeFileSync(join(dirty, 'src', 'b.mjs'), 'export const b = 5;\n');
  const idle = call(dirty, 'S4', 'node noop.js', () => {});
  ok('NEGATIVE CONTROL: a file already dirty before the call and untouched by it is not flagged', idle.status === 0);
  const again = call(dirty, 'S4', 'node scratch.js', () => node(dirty, "require('fs').writeFileSync('src/b.mjs', 'export const b = 6;\\n')"));
  ok('a file already dirty before the call that the call changes again is flagged', again.status === 2 && again.stderr.includes('src/b.mjs'));

  const excluded = fresh();
  writeFileSync(join(excluded, '.claude-kit-ignore.yaml'), 'source-shell-write:\n  - "src/**"\n');
  const lifted = call(excluded, 'S5', 'node scratch.js', () => rewrite(excluded, "fs.writeFileSync(p, 'export const a = 9;\\n')"));
  ok('the documented exclusion lifts the block', lifted.status === 0);

  const plain = repo();
  writeFileSync(join(plain, 'x.mjs'), 'x\n');
  const bare = call(plain, 'S6', 'node scratch.js', () => node(plain, "require('fs').writeFileSync('x.mjs', 'y')"));
  ok('an unadopted repo is left alone', bare.status === 0);
  ok('malformed stdin fails open', spawnSync(process.execPath, [join(HOOKS, 'hand-write-detect.mjs')], { input: '{not json', cwd: d, encoding: 'utf8', env: ENV }).status === 0);
  ok('a post with no matching pre records nothing and exits 0', spawnHook('hand-write-detect.mjs', { hook_event_name: 'PostToolUse', session_id: 'S7', tool_use_id: 'orphan', tool_input: { command: 'x' }, tool_response: {} }, d).status === 0);
} finally {
  cleanup();
}

done();
