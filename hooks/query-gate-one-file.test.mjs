// KIT-T1342 (KIT-D134): a pattern search of ONE named file with a Bash text tool is q code --dir's, and reading a file is
// Read's. The retrieval gate blocks grep/rg/git grep/sed -n '/x/p'/awk '/x/'/Select-String of one file (and cat f | grep f)
// with the exact q line; reads, output filters, scratch and outside-repo files, config/state store files, the Grep tool on
// ONE file and the Read tool pass. Run: node hooks/query-gate-one-file.test.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adopted, cleanup, hook, reporter, tmpDir } from './test-harness.mjs';

const { ok, done } = reporter('query-gate-one-file');

try {
  const repo = adopted(false);
  const unadopted = tmpDir('qg1-unadopted-');
  const outside = tmpDir('qg1-outside-');
  const slashed = (p) => p.replace(/\\/g, '/');
  const outsideLog = slashed(join(outside, 'run.log'));
  const gate = (command, tool = 'Bash', cwd = repo) => hook('query-gate.mjs', { tool_name: tool, tool_input: { command } }, cwd);
  const BLOCK = 2;
  const PASS = 0;

  const verdicts = [
    ['grep -n of a Rust file', 'grep -n usePhysics crates/x/src/lib.rs', BLOCK],
    ['rg of a markdown file', 'rg usePhysics docs/guide.md', BLOCK],
    ['grep of a WGSL file (no index language scope needed)', 'grep -n vs_main assets/shaders/road.wgsl', BLOCK],
    ['grep of a TOML file', 'grep -n bevy Cargo.toml', BLOCK],
    ['grep of a log inside the repo', 'grep -c ERROR target/build.log', BLOCK],
    ['grep -v (a flag q has no form for)', 'grep -v usePhysics crates/x/src/lib.rs', BLOCK],
    ['grep -r of one named file', 'grep -rn usePhysics src/a.cpp', BLOCK],
    ['grep of several named files', 'grep -n usePhysics src/a.cpp src/b.h', BLOCK],
    ['git grep of one file', 'git grep -n usePhysics -- src/a.cpp', BLOCK],
    ['sed pattern print of one file', "sed -n '/usePhysics/p' src/a.cpp", BLOCK],
    ['awk address of one file', "awk '/usePhysics/' src/a.cpp", BLOCK],
    ['cat of one file into grep', 'cat crates/x/src/lib.rs | grep -n fn', BLOCK],
    ['sed range of one file into grep', 'sed -n 1,80p crates/x/src/lib.rs | grep -n fn', BLOCK],
    ['grep behind a prefix assignment', 'FOO=1 grep -n fn crates/x/src/lib.rs', BLOCK],
    ['grep after a chain', 'cd crates && grep -n fn x/src/lib.rs', BLOCK],
    ['sed -n range read (Read has offset and limit; the gate calls reads allowed)', 'sed -n 1,40p crates/x/src/lib.rs', PASS],
    ['sed -n of one line', "sed -n '12p' crates/x/src/lib.rs", PASS],
    ['cat of one file', 'cat crates/x/src/lib.rs', PASS],
    ['head of one file', 'head -n 40 docs/guide.md', PASS],
    ['tail of one file', 'tail -n 20 crates/x/src/lib.rs', PASS],
    ['cat of one file into wc', 'cat crates/x/src/lib.rs | wc -l', PASS],
    ['sed in-place edit', "sed -i 's/a/b/' crates/x/src/lib.rs", PASS],
    ['sed substitution print', "sed 's/a/b/' crates/x/src/lib.rs", PASS],
    ['awk field print', "awk '{print $1}' crates/x/src/lib.rs", PASS],
    ['cargo output through grep and tail', "cargo test -p x 2>&1 | grep -E 'test result|FAILED' | tail -20", PASS],
    ['cargo output through grep -c', 'cargo build 2>&1 | grep -c warning', PASS],
    ['git log through grep', 'git log --oneline | grep physics', PASS],
    ['q output through grep', 'node scripts/q.mjs fts physics | grep -i uat', PASS],
    ['q code to grep', 'node scripts/q.mjs code usePhysics --dir src/a.cpp', PASS],
    ['git status', 'git status --short', PASS],
    ['grep of a file outside every adopted repo', `grep -n Town ${outsideLog}`, PASS],
    ['rg of a session scratchpad file', 'rg -n ramps C:/Users/x/AppData/Local/Temp/claude/scratchpad/census.txt', PASS],
    ['grep of the .ai config file (q does not index it)', 'grep uat .ai/config.yml', PASS],
    ['grep of SESSION.md', 'grep -n next .ai/SESSION.md', PASS],
    ['grep of a glob scoped to non-indexed source (not one file)', 'grep -n usePhysics crates/x/src/*.rs', PASS],
  ];
  for (const [name, command, want] of verdicts) ok(`KIT-T1342: ${name} (${want === BLOCK ? 'blocks' : 'passes'})`, gate(command).code === want);

  const exact = (command) => gate(command).out;
  ok('the grep block names q code with the pattern and --dir <file>', /code usePhysics --dir crates\/x\/src\/lib\.rs\n/.test(exact('grep -n usePhysics crates/x/src/lib.rs')));
  ok('the rg block carries -i and the regex flag', /code 'foo\|bar' --regex -i --dir docs\/guide\.md\n/.test(exact("rg -i 'foo|bar' docs/guide.md")));
  ok('the grep -E block carries the regex flag', /code 'foo\|bar' --regex -i --dir docs\/guide\.md\n/.test(exact("grep -n -E -i 'foo|bar' docs/guide.md")));
  ok('the grep -c block carries -c', /code ERROR --dir target\/build\.log -c\n/.test(exact('grep -c ERROR target/build.log')));
  ok('a flag q has no form for still names the pattern and --dir', /code usePhysics --dir crates\/x\/src\/lib\.rs\n/.test(exact('grep -v usePhysics crates/x/src/lib.rs')));
  ok('the sed block names the address pattern as a regex', /code usePhysics --regex --dir src\/a\.cpp\n/.test(exact("sed -n '/usePhysics/p' src/a.cpp")));
  ok('the cat-into-grep block names the fed file', /code fn --dir crates\/x\/src\/lib\.rs\n/.test(exact('cat crates/x/src/lib.rs | grep fn')));
  ok('the PowerShell block names the pattern and --dir', /code fn --regex --dir 'crates\\x\\src\\lib\.rs'\n/.test(gate('Select-String -Path crates\\x\\src\\lib.rs -Pattern fn', 'PowerShell').out));
  const regBlock = exact('grep -n reset_forces ~/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/bevy_pbr-0.16.0/src/lib.rs');
  ok('a registry file names q code --registry <crate>', /code reset_forces --registry bevy_pbr-0\.16\.0\n/.test(regBlock));
  ok('a vendored file names the vendored crate', /code extrude --registry manifold-rs\n/.test(exact('rg extrude rapid-game/rust/vendor/manifold-rs/src/lib.rs')));
  const block = exact('grep -n usePhysics crates/x/src/lib.rs');
  ok('the block names Read, the allowed forms and its check id', /Read tool/.test(block) && /own output/.test(block) && /one-file-search/.test(block) && /HARD STOP/.test(block));
  ok('the block no longer advises a plain grep of one file', !/stays a plain|is allowed/.test(block));

  mkdirSync(join(repo, 'crates', 'x', 'src'), { recursive: true });
  const outsideDir = slashed(outside);
  ok('a cd outside every repo then a grep of a bare file name passes', gate(`cd ${outsideDir} && grep -n Town run.log`).code === PASS);
  ok('a cd outside every repo then rg of a bare file name passes', gate(`cd ${outsideDir} && rg Town run.log`).code === PASS);
  const afterCd = gate('cd crates && grep -n fn x/src/lib.rs');
  ok('a cd into a repo directory then a grep blocks and the q line holds the absolute path', afterCd.code === BLOCK && /--dir '?[^\n]*\/crates\/x\/src\/lib\.rs'?\n/.test(afterCd.out) && /--dir '?(?:[A-Za-z]:)?\//.test(afterCd.out));
  const unresolved = gate('grep -c "test result" "$TEMP/run.log"');
  ok('an unassigned variable path blocks and the block names the variable', unresolved.code === BLOCK && /\$TEMP\/run\.log is a shell variable/.test(unresolved.out));
  ok('a variable assigned as one literal outside every repo passes', gate(`S=${outsideLog}; grep -c ERROR $S`).code === PASS);

  const grepTool = (tool_input, cwd = repo) => hook('query-gate.mjs', { tool_name: 'Grep', tool_input }, cwd).code;
  ok('control: the Grep tool on ONE file passes', grepTool({ pattern: 'usePhysics', path: 'crates/x/src/lib.rs' }) === PASS);
  ok('control: the Read tool is never judged', hook('query-gate.mjs', { tool_name: 'Read', tool_input: { file_path: 'crates/x/src/lib.rs' } }, repo).code === PASS);
  ok('control: an unadopted repo is never gated', hook('query-gate.mjs', { tool_name: 'Bash', tool_input: { command: 'grep -n x src/lib.rs' } }, unadopted).code === PASS);
  ok('control: a tree-wide grep still blocks as source discovery', /grepping the source tree/.test(exact('grep -rn usePhysics src/')));
  ok('control: an item-file grep still blocks as store-grep', /work store/.test(exact('grep uat .ai/tickets/KIT-T001.md')));

  writeFileSync(join(repo, '.claude-kit-ignore.yaml'), 'one-file-search:\n  - docs/generated/**\n');
  mkdirSync(join(repo, 'docs', 'generated'), { recursive: true });
  ok('the ignore file excludes a path under the check id', gate('grep -n x docs/generated/api.md').code === PASS);
  ok('the ignore file leaves other paths blocked', gate('grep -n x docs/guide.md').code === BLOCK);
} finally {
  cleanup();
}
done();
