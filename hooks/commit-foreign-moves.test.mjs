// commit-foreign follows a move (KIT-T1134): a file this session wrote with Write or Edit and then moved (git mv, mv) is
// still the session's at its new path; a moved file the session never wrote, or one whose content changed after the
// move, stays foreign.
// Run: node hooks/commit-foreign-moves.test.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { adopted, cleanup, git, hook, reporter, tmpDir } from './test-harness.mjs';

const { ok, done } = reporter('commit-foreign-moves');

try {
  const env = { CLAUDE_KIT_TURN_STATE: tmpDir('commit-moves-state-') };
  const target = adopted(false);
  const put = (rel, text) => { mkdirSync(dirname(join(target, rel)), { recursive: true }); writeFileSync(join(target, rel), text); };
  const written = (rel, text, session) => {
    put(rel, text);
    hook('pre-write.mjs', { session_id: session, tool_input: { file_path: join(target, rel), content: text } }, target, env);
  };
  const stage = (...rels) => git(['add', '--', ...rels], target);
  const move = (from, to) => { mkdirSync(dirname(join(target, to)), { recursive: true }); git(['mv', from, to], target); };
  const unstage = () => git(['reset', '-q'], target);
  const verdict = (session) => hook('commit-gate.mjs', { session_id: session, tool_input: { command: `git -C ${target} commit -m "implements KIT-T1134"` } }, target, env);
  const BODY = 'pub fn rings() -> u32 { 1 }\n';

  written('src/anchor.rs', 'pub fn anchor() {}\n', 'S1');

  written('src/census/index.rs', BODY, 'S1');
  stage('src/census/index.rs');
  move('src/census/index.rs', 'src/layout/index.rs');
  const moved = verdict('S1');
  ok('a file written, staged and moved with git mv is the writer\'s at its new path', moved.code === 0, moved.out.trim());
  unstage();

  written('src/old_name.rs', BODY + 'pub fn two() {}\n', 'S1');
  put('src/new_name.rs', BODY + 'pub fn two() {}\n');
  stage('src/new_name.rs');
  ok('a plain copy of that content under another name while the original still exists stays foreign', verdict('S1').code === 2);
  unstage();

  written('src/mine.rs', 'pub fn mine() {}\n', 'S1');
  git(['add', '--', 'src/mine.rs'], target);
  git(['mv', 'src/mine.rs', 'src/mine_renamed.rs'], target);
  ok('a second move by the same session passes too', verdict('S1').code === 0);
  unstage();

  put('src/theirs.rs', 'pub fn theirs() {}\n');
  stage('src/theirs.rs');
  move('src/theirs.rs', 'src/theirs_moved.rs');
  const foreignMove = verdict('S1');
  ok('negative control: moving a file the session never wrote stays foreign', foreignMove.code === 2 && foreignMove.out.includes('src/theirs_moved.rs'), foreignMove.out.trim());
  unstage();

  written('src/edited.rs', 'pub fn before() {}\n', 'S1');
  stage('src/edited.rs');
  move('src/edited.rs', 'src/edited_moved.rs');
  put('src/edited_moved.rs', 'pub fn after_a_stranger() {}\n');
  stage('src/edited_moved.rs');
  ok('negative control: content that differs from everything the session wrote stays foreign', verdict('S1').code === 2);
  unstage();

  written('src/other_session.rs', 'pub fn other() {}\n', 'S2');
  stage('src/other_session.rs');
  move('src/other_session.rs', 'src/other_session_moved.rs');
  ok('negative control: a file another session wrote and moved stays foreign for this one', verdict('S1').code === 2);
  ok('...and is that other session\'s own', verdict('S2').code === 0);
} finally {
  cleanup();
}

done();
