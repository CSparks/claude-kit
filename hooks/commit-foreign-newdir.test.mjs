// commit-foreign judges a brand-new directory by its files (KIT-T1158): a directory of the session's own files that a
// `git add` in the same command stages is not foreign; a foreign file in it still is; git's collapsed `?? dir/` is never
// judged as a path. Run: node hooks/commit-foreign-newdir.test.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { adopted, cleanup, git, hook, identify, reporter, tmpDir } from './test-harness.mjs';
import { pathspecFiles, sameCommandAdds } from './lib/commit-files.mjs';

const { ok, done } = reporter('commit-foreign-newdir');

try {
  const env = { CLAUDE_KIT_TURN_STATE: tmpDir('commit-newdir-state-') };
  const target = identify(adopted(false));
  const abs = (rel) => join(target, rel);
  const put = (rel, text) => { mkdirSync(dirname(abs(rel)), { recursive: true }); writeFileSync(abs(rel), text); };
  const toolPayload = (rel, session, text) => ({ session_id: session, tool_input: { file_path: abs(rel), content: text } });
  const written = (rel, text, session) => {
    put(rel, text);
    hook('pre-write.mjs', toolPayload(rel, session, text), target, env);
    hook('tool-write-record.mjs', toolPayload(rel, session, text), target, env);
  };
  const body = (n) => `pub fn f_${n}() -> u32 { ${n} }\n`;
  const verdict = (session, command) => hook('commit-gate.mjs', { session_id: session, tool_input: { command } }, target, env);
  const MSG = 'implements KIT-T1158';

  written('src/anchor.rs', body(0), 'S1');
  git(['add', '--', 'src/anchor.rs'], target);
  git(['commit', '-q', '-m', 'anchor'], target);

  written('src/wav/a.rs', body(1), 'S1');
  written('src/wav/b.rs', body(2), 'S1');
  const own = `git -C ${target} add src/wav && git -C ${target} commit -m "${MSG}" -- src/wav`;
  ok('a new directory of the session\'s own files, added in the same command, is not foreign', verdict('S1', own).code === 0, verdict('S1', own).out.trim());
  const ownBare = `git -C ${target} add src/wav && git -C ${target} commit -m "${MSG}"`;
  ok('the same with a bare commit after the add', verdict('S1', ownBare).code === 0, verdict('S1', ownBare).out.trim());

  put('src/wav/theirs.rs', body(3));
  const foreign = verdict('S1', own);
  ok('negative control: a foreign file inside the new directory is still refused and named by file', foreign.code === 2 && foreign.out.includes('src/wav/theirs.rs') && !foreign.out.includes('src/wav/\n'), foreign.out.trim());
  const foreignBare = verdict('S1', ownBare);
  ok('negative control: the bare commit after the add refuses it too', foreignBare.code === 2 && foreignBare.out.includes('src/wav/theirs.rs'), foreignBare.out.trim());

  ok('lib: untracked entries are dropped unless the command stages them', pathspecFiles('?? src/wav/a.rs\n M x.rs\n').join() === 'x.rs' && pathspecFiles('?? src/wav/a.rs\n M x.rs\n', { staged: true }).join() === 'src/wav/a.rs,x.rs');
  ok('lib: sameCommandAdds reads the pathspecs of each add, a bare add or -A as the whole tree', sameCommandAdds('git add a b && git commit -m x').join() === 'a,b'
    && sameCommandAdds('git add -A && git commit').join() === '.' && sameCommandAdds('git add -- src/wav; git commit').join() === 'src/wav' && sameCommandAdds('git commit -m x').length === 0);
} finally {
  cleanup();
}

done();
