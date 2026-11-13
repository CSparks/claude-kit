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

  ok('lib: untracked entries are dropped unless the caller says the command takes them', pathspecFiles('?? src/wav/a.rs\n M x.rs\n').join() === 'x.rs' && pathspecFiles('?? src/wav/a.rs\n M x.rs\n', { staged: true }).join() === 'src/wav/a.rs,x.rs');
  ok('lib: sameCommandAdds reads the pathspecs of each add, a bare add or -A as the whole tree', sameCommandAdds('git add a b && git commit -m x').join() === 'a,b'
    && sameCommandAdds('git add -A && git commit').join() === '.' && sameCommandAdds('git add -- src/wav; git commit').join() === 'src/wav' && sameCommandAdds('git commit -m x').length === 0);
  const adds = (command) => sameCommandAdds(command).join();
  ok('lib: git global options before add are walked (-c, -C, --git-dir, --work-tree, --no-pager)',
    adds('git -c core.x=y add -A') === '.' && adds('git -c core.x=y add src/a') === 'src/a' && adds('git --no-pager add src/a') === 'src/a'
    && adds('git --git-dir=.git --work-tree=. add src/b') === 'src/b' && adds('git --git-dir .git add src/c') === 'src/c' && adds('git -C "my dir" -c a=b add src/d') === 'src/d');
  ok('lib: stage is an add, and an add inside a bash -c string is read', adds('git stage src/e') === 'src/e' && adds('bash -c "git add src/f && git commit -m x"') === 'src/f');
  ok('lib: an add it cannot place is the whole tree (unknown global option, variable subcommand, xargs, pathspec file)',
    adds('git --odd-option add src/g') === '.' && adds('git $SUB src/g') === '.' && adds('ls | xargs git add') === '.' && adds('git add --pathspec-from-file=list.txt') === '.');
  ok('negative control: a commit message or another subcommand naming add stages nothing',
    adds('git commit -m "add foo and git add bar"') === '' && adds('git status') === '' && adds('git -c core.x=y commit -m "stage it"') === '' && adds('git log --oneline') === '');

  const fresh = (dir, session) => { written(`${dir}/a.rs`, body(10), session); written(`${dir}/b.rs`, body(11), session); };
  const refusedByFile = (v, file) => v.code === 2 && v.out.includes(file) && !v.out.includes(`${file.split('/').slice(0, -1).join('/')}/\n`);
  const T = target;
  fresh('src/dashc', 'S1');
  const dashC = `git -C ${T} -c core.x=y add src/dashc && git -C ${T} commit -m "${MSG}"`;
  ok('a git -c add of the session\'s own new directory passes', verdict('S1', dashC).code === 0, verdict('S1', dashC).out.trim());
  put('src/dashc/theirs.rs', body(12));
  ok('negative control: the same add with a foreign file inside is refused by file', refusedByFile(verdict('S1', dashC), 'src/dashc/theirs.rs'), verdict('S1', dashC).out.trim());
  const dashCPaths = `git -C ${T} -c core.x=y add src/dashc && git -C ${T} commit -m "${MSG}" -- src/dashc`;
  ok('negative control: the pathspec commit after the unparsed-form add refuses it too', refusedByFile(verdict('S1', dashCPaths), 'src/dashc/theirs.rs'));

  fresh('src/stg', 'S1');
  const stage = `git -C ${T} stage src/stg && git -C ${T} commit -m "${MSG}"`;
  ok('a git stage of the session\'s own new directory passes', verdict('S1', stage).code === 0, verdict('S1', stage).out.trim());
  put('src/stg/theirs.rs', body(13));
  ok('negative control: git stage with a foreign file inside is refused by file', refusedByFile(verdict('S1', stage), 'src/stg/theirs.rs'));

  fresh('src/all', 'S1');
  const commitAll = `git -C ${T} add src/all && git -C ${T} commit -am "${MSG}"`;
  ok('commit -a after an add of the session\'s own new directory passes', verdict('S1', commitAll).code === 0, verdict('S1', commitAll).out.trim());
  put('src/all/theirs.rs', body(14));
  ok('negative control: commit -a after the add refuses a foreign file in the directory', refusedByFile(verdict('S1', commitAll), 'src/all/theirs.rs'));

  put('src/loose/theirs.rs', body(15));
  const noAdd = `git -C ${T} commit -m "${MSG}" -- src/loose`;
  ok('a pathspec commit judges an untracked foreign file even when no add stages it', refusedByFile(verdict('S1', noAdd), 'src/loose/theirs.rs'), verdict('S1', noAdd).out.trim());
} finally {
  cleanup();
}

done();
