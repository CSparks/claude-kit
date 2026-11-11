// git-search.test.mjs — the retrieval gate reads a git search past git's global options and counts a search as
// targeted only when EVERY path operand is a concrete file (KIT-T1069). Run: node hooks/git-search.test.mjs

import { gitCommand } from './lib/git-subcommand.mjs';
import { searchPaths, targetsOnlyFiles } from './lib/search-targets.mjs';
import { classifyCalls } from './lib/search-shape.mjs';
import { indexEquivalent } from './lib/index-answerable.mjs';
import { adopted, cleanup, hook, reporter } from './test-harness.mjs';

const { ok, done } = reporter('git-search');

try {
  const sub = (...w) => gitCommand(w);
  ok('gitCommand: plain subcommand', sub('grep', 'x').sub === 'grep');
  ok('gitCommand: --no-pager is skipped', sub('--no-pager', 'grep', 'x').sub === 'grep');
  ok('gitCommand: -C <dir> is skipped and reported', sub('-C', 'src', 'grep', 'x').sub === 'grep' && sub('-C', 'src', 'grep').dir === 'src');
  ok('gitCommand: a quoted -C dir with spaces', sub('-C', '"C:/a b"', 'grep').dir === 'C:/a b');
  ok('gitCommand: -c k=v is skipped', sub('-c', 'color.ui=never', 'grep').sub === 'grep');
  ok('gitCommand: --git-dir=x and --git-dir x', sub('--git-dir=.git', 'grep').sub === 'grep' && sub('--git-dir', '.git', 'grep').sub === 'grep');
  ok('gitCommand: args follow the subcommand', sub('-C', 'x', 'grep', '-n', 'p').args.join(' ') === '-n p');
  ok('gitCommand: negative control: git log is not grep, --grep is no subcommand', sub('log', '--grep=x').sub === 'log' && sub('--no-pager', 'log').sub === 'log');
  ok('gitCommand: options only is empty', sub('--no-pager').sub === '');

  ok('searchPaths: git pathspecs after --', searchPaths(['-n', 'X', '--', 'src', 'a.txt'], { git: true }).join() === 'src,a.txt');
  ok('searchPaths: the pattern is not a path', searchPaths(['-rn', 'foo.bar', 'src/a.cpp']).join() === 'src/a.cpp');
  ok('searchPaths: flag values are not paths', searchPaths(['-n', '-A', '3', '-g', '*.rs', 'foo', 'src/lib.rs']).join() === 'src/lib.rs');
  ok('searchPaths: -e supplies the pattern, every positional is a path', searchPaths(['-e', 'foo', 'a.cpp', 'b.cpp']).join() === 'a.cpp,b.cpp');
  ok('targetsOnlyFiles: files only', targetsOnlyFiles(['a.cpp', 'src/b.h']));
  ok('targetsOnlyFiles: negative control: a directory beside a file', !targetsOnlyFiles(['src', 'CMakeLists.txt']));
  ok('targetsOnlyFiles: negative control: a glob and no path', !targetsOnlyFiles(['src/*.rs']) && !targetsOnlyFiles([]));

  const repo = adopted(false);
  const gate = (command) => hook('query-gate.mjs', { tool_input: { command } }, repo).code;
  const BLOCK = 2;
  const PASS = 0;
  const cases = [
    ['the ticket pipeline: dirs plus one file after --', 'git grep -n ModalOverlay -- src tests CMakeLists.txt | grep -v foo | head', BLOCK],
    ['git -C <dir> grep', 'git -C src grep -n ModalOverlay', BLOCK],
    ['git -C "dir with spaces" grep', 'git -C "C:/Users/Chris Sparks/x" grep ModalOverlay', BLOCK],
    ['git --no-pager grep', 'git --no-pager grep -n ModalOverlay', BLOCK],
    ['git -c k=v grep', 'git -c color.ui=never grep ModalOverlay', BLOCK],
    ['a bare git grep', 'git grep ModalOverlay', BLOCK],
    ['grep -r over a directory and one file', 'grep -rn foo src CMakeLists.txt', BLOCK],
    ['rg over a directory and one file', 'rg -n foo src/ui CMakeLists.txt', BLOCK],
    ['git grep -- one file', 'git grep -n ModalOverlay -- src/a.cpp', PASS],
    ['git grep -- several files', 'git -C . grep -n ModalOverlay -- src/a.cpp src/b.h', PASS],
    ['git grep of a glob scoped to non-indexed source (KIT-T085)', "git grep -n ModalOverlay -- 'src/*.cpp'", PASS],
    ['git log --grep', 'git log --grep=ModalOverlay', PASS],
    ['a filter over git output', 'git log | grep tickets', PASS],
    ['rg with valued flags and one file', "rg -n -g '*.rs' foo crates/x/src/lib.rs", PASS],
    ['grep -r of one named file', 'grep -rn foo src/a.cpp', PASS],
    ['grep -r of a quoted multi-word pattern in one file', 'grep -rn "foo bar" src/a.cpp', PASS],
  ];
  for (const [name, command, want] of cases) ok(`gate: ${name} (${want === BLOCK ? 'blocks' : 'passes'})`, gate(command) === want);
  ok('gate: the block names the exact q equivalent for git -C grep', /Exact equivalent: +node .*q\.mjs.* code ModalOverlay/.test(hook('query-gate.mjs', { tool_input: { command: 'git -C src grep -n ModalOverlay' } }, repo).out));

  const shape = (command) => classifyCalls('Bash', { command })[0];
  ok('search-shape: git -C <dir> grep is a grep with its pattern', shape('git -C src grep -n ModalOverlay').kind === 'grep' && shape('git -C src grep -n ModalOverlay').pattern === 'ModalOverlay');
  ok('search-shape: negative control: git log is no search', shape('git -C src log --oneline') === undefined);
  const eq = (command) => indexEquivalent(command, { qPath: 'q.mjs', root: repo, cwd: repo });
  ok('index-answerable: git --no-pager grep reads as grep (no language scope: no equivalent, no crash)', eq('git --no-pager grep -rn foo') === null);
  ok('index-answerable: negative control: git log is not a grep', eq('git --no-pager log') === null);
} finally {
  cleanup();
}
done();
