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

  {
    const d = fresh();
    writeFileSync(join(d, 'src', 'a.mjs'), 'export const a = 5;\n');
    const sameTick = "const s = fs.statSync(p); fs.writeFileSync(p, 'export const a = 9;\\n'); fs.utimesSync(p, s.atime, s.mtime)";
    const r = call(d, 'S1', 'node scratch.js', () => rewrite(d, sameTick));
    ok('a same-size rewrite of an already dirty file that restores its mtime is caught by content (KIT-T710)', r.status === 2 && r.stderr.includes('src/a.mjs'));
    const untouched = call(d, 'S1', 'node scratch.js', () => {});
    ok('control: a call that leaves the dirty file byte for byte alone reports nothing', untouched.status === 0);
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
    ['another session writes during a git status | head pipeline (KIT-T735)', 'git status --short | head -5', (e) => rewrite(e.d, "fs.writeFileSync(p, 'export const a = 9;\\n')")],
    ['another session writes during a cat | grep pipeline (KIT-T735)', 'cat src/b.mjs | grep export', (e) => rewrite(e.d, "fs.writeFileSync(p, 'export const a = 9;\\n')")],
    ['a read-only script', 'node build.js', (e) => node(e.d, "require('fs').readFileSync('src/a.mjs', 'utf8')")],
    ['a git rename chained with sed -n and grep readers (KIT-T901)', 'git mv src/b.mjs src/c.mjs && sed -n 1,5p src/a.mjs | head -3; grep -c x src/a.mjs', (e) => rewrite(e.d, "fs.writeFileSync(p, 'export const a = 9;\\n')")],
    ['a broker landing writes during watch.mjs (KIT-T746)', 'node /k/scripts/broker/watch.mjs --root /r --for landing', (e) => rewrite(e.d, "fs.writeFileSync(p, 'export const a = 9;\\n')")],
    ['a broker landing writes during a quoted wait.mjs path with a space (KIT-T746)', 'node "C:/Users/Chris Sparks/rt/scripts/broker/wait.mjs" j-1-a --root /r | tail -3', (e) => rewrite(e.d, "fs.writeFileSync(p, 'export const a = 9;\\n')")],
    ['a pipeline whose quoted commit message holds a > (the Co-Authored-By address) is no file redirect (KIT-T746)', 'git log -1 --format="a <b@c.d>" | head -1', (e) => rewrite(e.d, "fs.writeFileSync(p, 'export const a = 9;\\n')")],
    ['a broker landing writes during submit.mjs (KIT-T746)', 'node /k/scripts/broker/submit.mjs --root /r --ticket T-1', (e) => rewrite(e.d, "fs.writeFileSync(p, 'export const a = 9;\\n')")],
  ];
  for (const [name, command, action] of NOT_HAND) {
    const e = { d: fresh() };
    const r = call(e.d, 'S3', command, () => action(e));
    ok(`NEGATIVE CONTROL: ${name} is not flagged`, r.status === 0 && !r.stderr.includes('HAND WRITE'));
  }

  const redirected = fresh();
  const viaCat = call(redirected, 'S10', 'cat src/b.mjs > src/a.mjs', () => rewrite(redirected, "fs.writeFileSync(p, 'export const a = 9;\\n')"));
  ok('KIT-T735 control: a reader redirecting into a source file is still flagged', viaCat.status === 2 && viaCat.stderr.includes('src/a.mjs'));
  const brokerRedirect = fresh();
  const viaWatch = call(brokerRedirect, 'S12', 'node /k/scripts/broker/watch.mjs > src/a.mjs', () => rewrite(brokerRedirect, "fs.writeFileSync(p, 'export const a = 9;\\n')"));
  ok('KIT-T746 control: a broker client redirecting into a source file is still flagged', viaWatch.status === 2 && viaWatch.stderr.includes('src/a.mjs'));
  const inlineNamingKitScript = fresh();
  const viaInline = call(inlineNamingKitScript, 'S12b', `node -e "require('fs').writeFileSync('scripts/t.mjs','x')"`, () => rewrite(inlineNamingKitScript, "fs.writeFileSync(p, 'export const a = 9;\\n')"));
  ok('KIT-T939: node -e whose code names a kit script path is not a kit verb: the hand write is flagged', viaInline.status === 2 && viaInline.stderr.includes('src/a.mjs'));
  const flaggedKit = fresh();
  const viaFlaggedKit = call(flaggedKit, 'S12c', 'node --no-warnings /k/scripts/t.mjs status KIT-T1 done', () => rewrite(flaggedKit, "fs.writeFileSync(p, 'export const a = 9;\\n')"));
  ok('KIT-T939 control: a kit script run behind node flags is still a kit verb', viaFlaggedKit.status === 0 && !viaFlaggedKit.stderr.includes('HAND WRITE'));
  for (const [name, command] of [['sed -i', 'sed -i s/a/b/ src/a.mjs'], ['sed -ni', 'sed -ni 1p src/a.mjs'], ['sed --in-place', 'sed --in-place s/a/b/ src/a.mjs'], ['sed -n redirected', 'sed -n 1,2p src/b.mjs > src/a.mjs']]) {
    const e = fresh();
    const r = call(e, `S13${name}`, command, () => rewrite(e, "fs.writeFileSync(p, 'export const a = 9;\\n')"));
    ok(`KIT-T901 control: ${name} still counts as a hand write`, r.status === 2);
  }
  const piped = fresh();
  const toNull = call(piped, 'S11', 'cat src/b.mjs 2>/dev/null | head -1 > src/a.mjs', () => rewrite(piped, "fs.writeFileSync(p, 'export const a = 9;\\n')"));
  ok('KIT-T735 control: a benign redirect does not hide a real file redirect', toNull.status === 2);

  // KIT-T888: another session's Edit or Write landing during a non-generator call is that tool's write.
  const otherEdit = (d, rel, text) => {
    const input = { session_id: 'OTHER', tool_input: { file_path: join(d, rel), content: text } };
    spawnHook('pre-write.mjs', input, d);
    writeFileSync(join(d, rel), text);
    spawnHook('tool-write-record.mjs', { ...input, hook_event_name: 'PostToolUse', tool_response: {} }, d);
  };
  process.env.CLAUDE_KIT_TURN_STATE = state;
  const { recordTurnWrite } = await import('./turn-writes.mjs');
  const { recordToolWrite } = await import('./lib/tool-writes.mjs');
  const { gitRoot } = await import('./lib.mjs');
  const concurrent = fresh();
  const viaOther = call(concurrent, 'S15', 'node scratch.js', () => otherEdit(concurrent, 'src/a.mjs', 'export const a = 9;\n'));
  ok('KIT-T888: another session\'s Edit during a non-generator call is not blamed on the call', viaOther.status === 0 && !viaOther.stderr.includes('HAND WRITE'));
  ok('KIT-T888: the call\'s session is not held to the other writer\'s file at commit', !commit(concurrent, 'S15', ['src/a.mjs']).out.includes('KIT-T706'));
  const both = fresh();
  const viaBoth = call(both, 'S16', 'node scratch.js', () => {
    otherEdit(both, 'src/b.mjs', 'export const b = 9;\n');
    rewrite(both, "fs.writeFileSync(p, 'export const a = 9;\\n')");
  });
  ok('KIT-T888 control: a true hand write beside a concurrent Edit is still flagged, the other writer\'s file is not', viaBoth.status === 2 && viaBoth.stderr.includes('src/a.mjs') && !viaBoth.stderr.includes('src/b.mjs'));
  const staleEdit = fresh();
  otherEdit(staleEdit, 'src/a.mjs', 'export const a = 7;\n');
  const afterEdit = call(staleEdit, 'S17', 'node scratch.js', () => rewrite(staleEdit, "fs.writeFileSync(p, 'export const a = 9;\\n')"));
  ok('KIT-T888 control: an Edit recorded BEFORE the call does not excuse a hand write during it', afterEdit.status === 2 && afterEdit.stderr.includes('src/a.mjs'));

  // The ledger is state any process of the user can write: a shell call that forges an entry must not buy its own exemption.
  const forgedTurn = fresh();
  const viaForgedTurn = call(forgedTurn, 'S18', 'node scratch.js', () => {
    rewrite(forgedTurn, "fs.writeFileSync(p, 'export const a = 9;\\n')");
    recordTurnWrite(gitRoot(forgedTurn), join(forgedTurn, 'src', 'a.mjs'), 'OTHER');
  });
  ok('KIT-T888 exploit: a shell-forged pre-write turn-ledger entry does not exempt a hand write', viaForgedTurn.status === 2 && viaForgedTurn.stderr.includes('src/a.mjs'));
  const forgedHash = fresh();
  const viaForgedHash = call(forgedHash, 'S19', 'node scratch.js', () => {
    rewrite(forgedHash, "fs.writeFileSync(p, 'export const a = 9;\\n')");
    recordToolWrite(gitRoot(forgedHash), 'src/a.mjs', 'not-the-content-hash');
  });
  ok('KIT-T888 exploit: an accepted-writes entry whose hash is not the file\'s content does not exempt', viaForgedHash.status === 2 && viaForgedHash.stderr.includes('src/a.mjs'));
  const { contentHashOf } = await import('./lib/shell-snapshot.mjs');
  const proven = fresh();
  const viaProven = call(proven, 'S21', 'node scratch.js', () => {
    rewrite(proven, "fs.writeFileSync(p, 'export const a = 9;\\n')");
    recordToolWrite(gitRoot(proven), 'src/a.mjs', contentHashOf(proven, 'src/a.mjs'));
  });
  ok('KIT-T888 keying control: an accepted-writes entry with the right hash does exempt, so the forged cases above reach the ledger', viaProven.status === 0);
  const overwritten = fresh();
  const viaOverwrite = call(overwritten, 'S20', 'node scratch.js', () => {
    otherEdit(overwritten, 'src/a.mjs', 'export const a = 7;\n');
    rewrite(overwritten, "fs.writeFileSync(p, 'export const a = 9;\\n')");
  });
  ok('KIT-T888 control: a shell rewrite AFTER another writer\'s Edit changes the content, so the exemption lapses and it is flagged', viaOverwrite.status === 2 && viaOverwrite.stderr.includes('src/a.mjs'));

  // KIT-T949: a session started before the PostToolUse recorder was wired never runs it; its Edit is known from pre-write alone.
  const preOnlyEdit = (d, rel, oldString, newString, { lands = newString } = {}) => {
    spawnHook('pre-write.mjs', { session_id: 'OTHER', tool_input: { file_path: join(d, rel), old_string: oldString, new_string: newString } }, d);
    writeFileSync(join(d, rel), readFileSync(join(d, rel), 'utf8').replace(oldString, lands));
  };
  const preOnly = fresh();
  const viaPreOnly = call(preOnly, 'S22', 'node scratch.js', () => preOnlyEdit(preOnly, 'src/a.mjs', 'a = 1', 'a = 9'));
  ok('KIT-T949: an Edit seen only by pre-write, landing during a non-generator call, is not blamed on the call', viaPreOnly.status === 0 && !viaPreOnly.stderr.includes('HAND WRITE'));
  const preOnlyWrite = fresh();
  const viaPreOnlyWrite = call(preOnlyWrite, 'S23', 'node scratch.js', () => {
    spawnHook('pre-write.mjs', { session_id: 'OTHER', tool_input: { file_path: join(preOnlyWrite, 'src', 'b.mjs'), content: 'export const b = 9;\n' } }, preOnlyWrite);
    writeFileSync(join(preOnlyWrite, 'src', 'b.mjs'), 'export const b = 9;\n');
  });
  ok('KIT-T949: a Write seen only by pre-write is not blamed either', viaPreOnlyWrite.status === 0 && !viaPreOnlyWrite.stderr.includes('HAND WRITE'));
  const preOnlyCrlf = fresh();
  writeFileSync(join(preOnlyCrlf, 'src', 'a.mjs'), 'export const a = 1;\r\nexport const c = 3;\r\n');
  git(['commit', '-qam', 'crlf'], preOnlyCrlf);
  const viaPreOnlyCrlf = call(preOnlyCrlf, 'S24', 'node scratch.js', () => {
    spawnHook('pre-write.mjs', { session_id: 'OTHER', tool_input: { file_path: join(preOnlyCrlf, 'src', 'a.mjs'), old_string: 'a = 1;\nexport', new_string: 'a = 9;\nexport' } }, preOnlyCrlf);
    writeFileSync(join(preOnlyCrlf, 'src', 'a.mjs'), 'export const a = 9;\r\nexport const c = 3;\r\n');
  });
  ok('KIT-T949: an Edit of a CRLF file, matched through its LF payload, is not blamed on the call', viaPreOnlyCrlf.status === 0 && !viaPreOnlyCrlf.stderr.includes('HAND WRITE'));
  const inFlight = fresh();
  spawnHook('pre-write.mjs', { session_id: 'OTHER', tool_input: { file_path: join(inFlight, 'src', 'b.mjs'), old_string: 'b = 2', new_string: 'b = 9' } }, inFlight);
  const viaInFlight = call(inFlight, 'S27', 'node scratch.js', () => writeFileSync(join(inFlight, 'src', 'b.mjs'), 'export const b = 9;\n'));
  ok('KIT-T949: an Edit whose pre-write ran just before the call and whose write landed inside it is not blamed on the call', viaInFlight.status === 0 && !viaInFlight.stderr.includes('HAND WRITE'));
  const preOnlyLate = fresh();
  const viaPreOnlyLate = call(preOnlyLate, 'S25', 'node scratch.js', () => {
    preOnlyEdit(preOnlyLate, 'src/a.mjs', 'a = 1', 'a = 9');
    rewrite(preOnlyLate, "fs.writeFileSync(p, 'export const a = 8;\\n')");
  });
  ok('KIT-T949 control: a shell rewrite after the Edit changes the content, so the pre-write record no longer excuses it', viaPreOnlyLate.status === 2 && viaPreOnlyLate.stderr.includes('src/a.mjs'));
  const preOnlyRefused = fresh();
  const viaPreOnlyRefused = call(preOnlyRefused, 'S26', 'node scratch.js', () => {
    preOnlyEdit(preOnlyRefused, 'src/a.mjs', 'a = 1', 'a = 9', { lands: 'a = 7' });
  });
  ok('KIT-T949 control: a change that is not the content the Edit asked for is a hand write', viaPreOnlyRefused.status === 2 && viaPreOnlyRefused.stderr.includes('src/a.mjs'));

  const land = (d, files) => {
    for (const [rel, text] of Object.entries(files)) writeFileSync(join(d, rel), text);
    git(['add', '-A'], d);
    git(['commit', '-q', '-m', 'landing'], d);
  };
  const landed = fresh();
  writeFileSync(join(landed, 'src', 'a.mjs'), 'export const a = 5;\n');
  writeFileSync(join(landed, 'src', 'b.mjs'), 'export const b = 5;\n');
  const viaLanding = call(landed, 'S13', 'node scratch.js', () => land(landed, { 'src/a.mjs': 'export const a = 7;\n', 'src/b.mjs': 'export const b = 7;\n' }));
  ok('KIT-T849: files a HEAD move committed during a call are the landing\'s, not the call\'s', viaLanding.status === 0 && !viaLanding.stderr.includes('HAND WRITE'));
  ok('KIT-T849: a later commit is not refused for the landing\'s files', !commit(landed, 'S13', ['src/a.mjs']).out.includes('KIT-T706'));

  const mixed = fresh();
  writeFileSync(join(mixed, 'src', 'b.mjs'), 'export const b = 5;\n');
  const viaMixed = call(mixed, 'S14', 'node scratch.js', () => {
    land(mixed, { 'src/b.mjs': 'export const b = 7;\n' });
    rewrite(mixed, "fs.writeFileSync(p, 'export const a = 9;\\n')");
  });
  ok('KIT-T849 control: a hand write during a call that also saw a HEAD move is still flagged, the landed file is not', viaMixed.status === 2 && viaMixed.stderr.includes('src/a.mjs') && !viaMixed.stderr.includes('src/b.mjs'));

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
