// commit-foreign for a file a Write creates inside a submodule (KIT-T1166). PreToolUse runs before the Write, so the
// file's directory may not exist yet; the session's record of the write must still carry the submodule-relative path
// the commit is judged by, for the main thread and for a subagent, under any spelling of the checkout path.
// Run: node hooks/commit-foreign-submodule.test.mjs

import { mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { adopted, cleanup, git, hook, identify, reporter, repo, tmpDir } from './test-harness.mjs';

const report = reporter('commit-foreign-submodule');
const { done } = report;
const ok = (name, cond, detail = '') => { report.ok(name, cond); if (!cond && detail) console.log(`        ${detail}`); };

try {
  const env = { CLAUDE_KIT_TURN_STATE: tmpDir('commit-submodule-state-') };
  const origin = identify(repo());
  mkdirSync(join(origin, '.ai'));
  writeFileSync(join(origin, '.ai', 'config.yml'), 'uat:\n  default: none\n');
  writeFileSync(join(origin, 'anchor.rs'), 'pub fn anchor() -> u32 { 1 }\n');
  writeFileSync(join(origin, 'field.rs'), 'pub fn field() -> u32 { 1 }\n');
  git(['add', '--', '.'], origin);
  git(['commit', '-q', '-m', 'seed'], origin);

  const parent = identify(adopted(false));
  git(['-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', origin, 'sub'], parent);
  git(['commit', '-q', '-m', 'pin'], parent);
  const sub = join(parent, 'sub');
  identify(sub);

  const abs = (rel) => join(sub, rel);
  const put = (rel, text) => { mkdirSync(dirname(abs(rel)), { recursive: true }); writeFileSync(abs(rel), text); };
  const payload = (rel, session, text, extra = {}, base = sub) => ({ session_id: session, ...extra, tool_input: { file_path: join(base, rel), content: text } });
  const body = (n) => `pub fn f_${n}() -> u32 { ${n} }\n`;
  // The tool order of a real Write: pre-write, then the file lands, then the recorder.
  const created = (rel, text, session, extra, base) => {
    hook('pre-write.mjs', payload(rel, session, text, extra, base), sub, env);
    put(rel, text);
    hook('tool-write-record.mjs', payload(rel, session, text, extra, base), sub, env);
  };
  const MSG = 'implements KIT-T1166';
  const verdict = (session, command = `git -C ${sub} commit -m "${MSG}"`) => {
    git(['add', '-A'], sub);
    return hook('commit-gate.mjs', { session_id: session, tool_input: { command } }, parent, env);
  };

  created('field.rs', body(2), 'S1');
  created('rust/core/tests/sample_cost.rs', body(3), 'S1', { agent_id: 'a1b2c3' });
  const own = verdict('S1');
  ok('a file a subagent Write created in a new directory of the submodule is the session\'s own', own.code === 0, own.out.trim());

  put('stray.rs', body(4));
  const stray = verdict('S1');
  ok('negative control: a file the session never wrote is refused by name', stray.code === 2 && stray.out.includes('stray.rs') && !stray.out.includes('sample_cost.rs'), `${stray.code} ${stray.out.trim()} :: ${git(['status', '--short'], sub)}`);

  created('other.rs', body(6), 'S2');
  const another = verdict('S1');
  ok('negative control: a file another session wrote is refused for this one', another.code === 2 && another.out.includes('other.rs'), another.out.trim());

  const forward = realpathSync.native(sub).replace(/\\/g, '/');
  const swapCase = (d) => (d === d.toLowerCase() ? d.toUpperCase() : d.toLowerCase());
  const spelled = forward.replace(/^([a-z]):/i, (_, d) => `${swapCase(d)}:`);
  created('rust/deep/er/second.rs', body(5), 'S3', {}, spelled);
  // One parallel round: every PreToolUse runs before any file of the round lands, so each sees a directory not yet made.
  const batch = ['finish/dress.rs', 'finish/ease.rs'];
  batch.forEach((rel, n) => hook('pre-write.mjs', payload(rel, 'S4', body(20 + n), { agent_id: 'p1' }), sub, env));
  batch.forEach((rel, n) => put(rel, body(20 + n)));
  batch.forEach((rel, n) => hook('tool-write-record.mjs', payload(rel, 'S4', body(20 + n), { agent_id: 'p1' }), sub, env));
  const round = verdict('S4', `cd ${sub} && git commit -m "${MSG}" -- ${batch.join(' ')}`);
  ok('KIT-T1170: both files of a parallel round that creates their directory are the session\'s own', round.code === 0, round.out.trim());
  const spelledVerdict =verdict('S3', `cd ${sub} && git commit -m "${MSG}"`);
  ok('a write under one spelling of the checkout path (drive-letter case, slashes, the 8.3 short form where the temp dir has one) is judged under another', spelledVerdict.code === 2 && !spelledVerdict.out.includes('second.rs') && spelledVerdict.out.includes('stray.rs'), spelledVerdict.out.trim());
  const ownCommit = verdict('S3', `cd ${sub} && git commit -m "${MSG}" -- rust/deep/er/second.rs`);
  ok('the same session commits its own file by path', ownCommit.code === 0, ownCommit.out.trim());
} finally {
  cleanup();
}

done();
