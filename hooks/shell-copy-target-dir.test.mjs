#!/usr/bin/env node
// shell-copy-target-dir.test.mjs — KIT-T1086. A recursive cp (-r -R --recursive, alone or clustered with -f -p -v -n) and
// several sources copied into a directory are provable shapes: each source is a read that lands at DIR/<its name>, the
// destination is the only write, and a recursive copy also judges `<landing>/any.rs`. A repo source file copied into a
// scratch directory passes; the same copy into the repo, or with any option outside the set, stays blocked.
// The table runs through the real gate in a repo holding src/ (a directory), src/a.cpp, dir/c.cpp, x.cpp.
// Run: node hooks/shell-copy-target-dir.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyTargets } from './lib/shell-copy-target.mjs';
import { cleanup, reporter, tmpDir } from './test-harness.mjs';

const { ok, done } = reporter('shell-copy-target-dir');
const HOOK = fileURLToPath(new URL('./source-shell-gate.mjs', import.meta.url));
const BLOCK = 2;
const PASS = 0;

try {
  const repo = tmpDir('kit-copydir-');
  execFileSync('git', ['init', '-q'], { cwd: repo });
  mkdirSync(join(repo, '.ai'), { recursive: true });
  for (const file of ['src/a.cpp', 'dir/c.cpp', 'x.cpp']) {
    mkdirSync(join(repo, file, '..'), { recursive: true });
    writeFileSync(join(repo, file), 'int x;\n');
  }
  const scratch = tmpDir('kit-copydir-scratch-').replace(/\\/g, '/');
  const gate = (command) => spawnSync(process.execPath, [HOOK], { cwd: repo, input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8' }).status;
  const allows = (name, command) => ok(`allows ${name}`, gate(command) === PASS);
  const blocks = (name, command) => ok(`blocks ${name}`, gate(command) === BLOCK);
  const into = (command) => `S="${scratch}"; ${command}`;

  allows('several sources into an existing directory', `cp x.cpp dir/c.cpp ${scratch}`);
  allows('several sources into a directory named with a slash', `cp x.cpp dir/c.cpp src/a.cpp ${scratch}/new/`);
  allows('several sources with -t DIR', `cp -t ${scratch} x.cpp dir/c.cpp`);
  allows('a move of several sources out', `mv x.cpp dir/c.cpp ${scratch}`);
  allows('a recursive copy of a repo directory into scratch', `cp -r src ${scratch}/export`);
  allows('a recursive copy of a source file into scratch', `cp -r x.cpp ${scratch}/export.cpp`);
  allows('cp -R', `cp -R src ${scratch}/export`);
  allows('cp --recursive', `cp --recursive src ${scratch}/export`);
  allows('a safe cluster', `cp -rfv src ${scratch}/export`);
  allows('a recursive copy through a variable', into('cp -r src "$S/export"'));
  allows('several sources through a variable', into('cp x.cpp dir/c.cpp "$S/"'));
  allows('the ticket line: rm, recursive copy, three sources, a child in a subshell', into('rm -rf $S/after && cp -r $S/base $S/after && cp x.cpp dir/c.cpp src/a.cpp $S/after/lib/ && (bash $S/after/run.sh)'));

  blocks('several sources into a repo directory', `cp ${scratch}/x.cpp ${scratch}/y.cpp src/`);
  blocks('several repo sources into a repo directory', 'cp x.cpp dir/c.cpp src/');
  blocks('several sources with -t into the repo', `cp -t src/ ${scratch}/x.cpp ${scratch}/y.cpp`);
  blocks('a move of several sources into the repo', `mv ${scratch}/x.cpp ${scratch}/y.cpp src/`);
  blocks('a recursive copy into the repo', `cp -r ${scratch}/base src`);
  blocks('a recursive copy into a repo path that does not exist yet', `cp -r ${scratch}/base src/new`);
  blocks('cp -R into the repo', `cp -R ${scratch}/base src`);
  blocks('cp --recursive into the repo', `cp --recursive ${scratch}/base src`);
  blocks('a safe cluster into the repo', `cp -rfv ${scratch}/base src`);
  blocks('a recursive copy into the repo through a variable', into('cp -r "$S/base" src'));
  blocks('a recursive copy into an existing scratch directory named without a slash', `cp -r x.cpp ${scratch}`);
  const trap = tmpDir('kit-copydir-trap-').replace(/\\/g, '/');
  mkdirSync(join(trap, 'c.cpp'));
  blocks('several sources where one landing is an existing directory', `cp x.cpp dir/c.cpp ${trap}`);
  allows('several sources where the directory-named landing is not among them', `cp x.cpp src/a.cpp ${trap}`);
  blocks('-a with several sources', `cp -a x.cpp dir/c.cpp ${scratch}`);
  blocks('--parents with several sources', `cp --parents x.cpp dir/c.cpp ${scratch}`);
  blocks('a cluster holding -t', `cp -rt src/ ${scratch}/x.cpp`);
  blocks('a cluster holding an unknown letter', `cp -rQ src ${scratch}/export`);
  blocks('a recursive copy with an unresolved variable', 'cp -r src "$UNSET/export"');
  blocks('the ticket line with its variable unassigned', 'rm -rf $S/after && cp -r $S/base $S/after && cp x.cpp dir/c.cpp src/a.cpp $S/after/lib/ && (bash $S/after/run.sh)');
  blocks('a recursive copy with an unresolved source variable', 'cp -r $S/base $S/after');

  const proven = (tool, args) => copyTargets(tool, args).proven;
  const several = proven('cp', `x.cpp dir/c.cpp ${scratch}/`);
  ok('several sources: the directory is the destination', several?.destination === scratch);
  ok('several sources: each lands at DIR/<name>', several?.landings.join() === `${scratch}/x.cpp,${scratch}/c.cpp`);
  ok('several sources: not recursive', several?.recursive === false);
  ok('a pair keeps the destination as its one landing', proven('cp', `x.cpp ${scratch}/y.cpp`)?.landings.join() === `${scratch}/y.cpp`);
  const recursive = proven('cp', `-r src ${scratch}/export`);
  ok('recursive: flagged', recursive?.recursive === true);
  ok('recursive: judges the landing as a directory', recursive?.under.includes(`${scratch}/export/any.rs`));
  ok('recursive: judges the name under an existing directory', recursive?.under.includes(`${scratch}/export/src/any.rs`));
  ok('a cluster of -r and -f is recursive', proven('cp', `-rf src ${scratch}/export`)?.recursive === true);
  ok('mv never takes -r', proven('mv', `-r src ${scratch}/export`) === null);
  ok('a quoted cluster is no option', proven('cp', `"-r" src ${scratch}/export`) === null);
  ok('a lone operand is no shape', proven('cp', `x.cpp`) === null);
  ok('a pair with a trailing-slash destination is no shape', proven('cp', `x.cpp ${scratch}/`) === null);
} finally {
  cleanup();
}
done();
