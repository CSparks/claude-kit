// commit-foreign follows a move (KIT-T1134): a file this session wrote with Write or Edit, committed, and then moved with
// git mv is still the session's at its new path. The credit needs git itself to report the staged rename old -> new, a
// CONFIRMED ledger entry of the session for the old path, and the staged blob to be exactly what that tool left; one
// rename credits one destination.
// Run: node hooks/commit-foreign-moves.test.mjs

import { mkdirSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { adopted, cleanup, git, hook, identify, reporter, tmpDir } from './test-harness.mjs';

const { ok, done } = reporter('commit-foreign-moves');

try {
  const env = { CLAUDE_KIT_TURN_STATE: tmpDir('commit-moves-state-') };
  const target = identify(adopted(false));
  const abs = (rel) => join(target, rel);
  const put = (rel, text) => { mkdirSync(dirname(abs(rel)), { recursive: true }); writeFileSync(abs(rel), text); };
  const lines = (n, last) => `${Array.from({ length: n }, (_, i) => `pub fn line_${i}() -> u32 { ${i + 10} }`).join('\n')}\n${last}\n`;
  const BODY = lines(12, 'pub fn tail() -> u32 { 1 }');
  const toolPayload = (rel, session, text) => ({ session_id: session, tool_input: { file_path: abs(rel), content: text } });
  // `confirmed` false leaves only pre-write's unconfirmed prediction in the ledger.
  const written = (rel, text, session, confirmed = true) => {
    put(rel, text);
    hook('pre-write.mjs', toolPayload(rel, session, text), target, env);
    if (confirmed) hook('tool-write-record.mjs', toolPayload(rel, session, text), target, env);
  };
  const commitFile = (rel) => { git(['add', '--', rel], target); git(['commit', '-q', '-m', `add ${rel}`], target); };
  const verdict = (session) => {
    const r = hook('commit-gate.mjs', { session_id: session, tool_input: { command: `git -C ${target} commit -m "implements KIT-T1134"` } }, target, env);
    if (process.env.DEBUG_MOVES) console.log(r.code, r.out.trim(), git(['status', '--short'], target));
    return r;
  };
  const reset = () => { git(['reset', '-q', '--hard', 'HEAD'], target); git(['clean', '-fdq', '-e', '.ai'], target); };
  const movedFile = (from, to, text = BODY, session = 'S1', confirmed = true) => {
    written(from, text, session, confirmed);
    commitFile(from);
    mkdirSync(dirname(abs(to)), { recursive: true });
    git(['mv', from, to], target);
  };

  written('src/anchor.rs', 'pub fn anchor() {}\n', 'S1');
  commitFile('src/anchor.rs');

  movedFile('src/census/index.rs', 'src/layout/index.rs');
  const moved = verdict('S1');
  ok('a committed file the session wrote and then moved with git mv is the writer\'s at its new path', moved.code === 0, moved.out.trim());

  copyFileSync(abs('src/layout/index.rs'), abs('src/layout/index_copy.rs'));
  git(['add', '--', 'src/layout/index_copy.rs'], target);
  const second = verdict('S1');
  ok('negative control: one rename credits one destination, a copy staged beside it is refused', second.code === 2 && second.out.includes('src/layout/index_copy.rs') && !second.out.includes('  src/layout/index.rs'), second.out.trim());
  reset();

  movedFile('src/edge.rs', 'src/edge_moved.rs', BODY, 'S1', false);
  ok('negative control: an unconfirmed (predicted-only) ledger entry proves nothing', verdict('S1').code === 2);
  reset();

  put('src/theirs.rs', BODY);
  commitFile('src/theirs.rs');
  git(['mv', 'src/theirs.rs', 'src/theirs_moved.rs'], target);
  ok('negative control: moving a file the session never wrote stays foreign', verdict('S1').code === 2);
  reset();

  written('src/gone.rs', BODY, 'S1');
  commitFile('src/gone.rs');
  rmSync(abs('src/gone.rs'));
  put('src/lookalike.rs', BODY);
  git(['add', '--', 'src/lookalike.rs'], target);
  ok('negative control: a foreign file with the content of a deleted ledgered file, no staged rename, is refused', verdict('S1').code === 2);
  reset();

  movedFile('src/swap.rs', 'src/swap_moved.rs');
  const stagedOther = lines(12, 'pub fn tail() -> u32 { 2 }');
  put('src/swap_moved.rs', stagedOther);
  git(['add', '--', 'src/swap_moved.rs'], target);
  writeFileSync(abs('src/swap_moved.rs'), BODY);
  ok('negative control: a staged blob that differs from the ledgered content is refused though the working file matches it', verdict('S1').code === 2);
  reset();

  movedFile('src/blank.rs', 'src/blank_moved.rs', '', 'S1');
  ok('negative control: an empty file credits nothing', verdict('S1').code === 2);
  reset();

  movedFile('src/other_session.rs', 'src/other_session_moved.rs', BODY, 'S2');
  ok('negative control: a file another session wrote and moved stays foreign for this one', verdict('S1').code === 2);
  ok('...and is that other session\'s own', verdict('S2').code === 0);
} finally {
  cleanup();
}

done();
