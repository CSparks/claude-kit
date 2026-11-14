// Build output a tool wrote is no hand write (KIT-T1160): a configure that fills an unignored build directory
// passes both the after-the-fact detector and the shell gate; a source file written by hand is still judged.
// Run: node hooks/build-output.test.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, git, reporter } from './test-harness.mjs';
import { handWriteHarness } from './hand-write-harness.mjs';

const { ok, done } = reporter('build-output');
const SOURCE = 'int main() { return 0; }\n';

const put = (d, rel, text = SOURCE) => {
  mkdirSync(join(d, rel, '..'), { recursive: true });
  writeFileSync(join(d, rel), text);
};

try {
  const { spawnHook, call, fresh } = handWriteHarness();
  const gate = (d, command) => spawnHook('source-shell-gate.mjs', { tool_name: 'Bash', session_id: 'G', tool_input: { command } }, d);
  const detect = (d, files, command = 'node scratch.js') => call(d, 'D', command, () => files.forEach((f) => put(d, f)));

  for (const file of ['CMakeCache.txt', 'build.ninja', 'compile_commands.json']) {
    const d = fresh();
    const dir = 'build-tidy';
    put(d, `${dir}/${file}`, '#\n');
    const r = detect(d, [`${dir}/CMakeFiles/3.28/CMakeCCompilerId.c`, `${dir}/_deps/catch2/catch_user_config.hpp`, `${dir}/_deps/asio/asio.cpp`]);
    ok(`detector: a configure writing generated source under an unignored dir marked by ${file} is no hand write`, r.status === 0, r.stderr.slice(0, 200));
  }

  {
    const d = fresh();
    const dir = 'cmake-build-debug';
    const r = detect(d, [`${dir}/CMakeCache.txt`, `${dir}/CMakeFiles/3.28/CMakeCCompilerId.c`, `${dir}/_deps/asio/asio.cpp`]);
    ok('detector: a configure that writes its marker and its sources in one call passes', r.status === 0, r.stderr.slice(0, 200));
  }

  {
    const d = fresh();
    const r = detect(d, ['build-tidy/gen.cpp']);
    ok('detector: control, a source file under build-tidy with no marker is still judged', r.status === 2 && r.stderr.includes('build-tidy/gen.cpp'));
  }

  {
    const d = fresh();
    put(d, 'build-tidy/CMakeCache.txt', '#\n');
    const r = detect(d, ['build-tidy/gen.cpp', 'src/new.cpp']);
    ok('detector: control, a hand-written source beside build output is the only file named', r.status === 2 && r.stderr.includes('src/new.cpp') && !r.stderr.includes('build-tidy'), r.stderr.slice(0, 200));
  }

  {
    const d = fresh();
    put(d, 'compile_commands.json', '[]\n');
    const r = detect(d, ['src/x.cpp']);
    ok('detector: control, a marker at the repo root exempts nothing', r.status === 2 && r.stderr.includes('src/x.cpp'));
  }

  {
    const d = fresh();
    put(d, 'tools/compile_commands.json', '[]\n');
    put(d, 'tools/x.cpp');
    git(['add', '-A'], d);
    git(['commit', '-q', '-m', 'tools'], d);
    const r = call(d, 'D', 'node scratch.js', () => put(d, 'tools/x.cpp', 'int main() { return 1; }\n'));
    ok('detector: control, a tracked file beside a marker is still judged', r.status === 2 && r.stderr.includes('tools/x.cpp'));
  }

  {
    const d = fresh();
    writeFileSync(join(d, '.gitignore'), 'out/\n');
    git(['add', '-A'], d);
    git(['commit', '-q', '-m', 'ignore'], d);
    const r = detect(d, ['out/gen.cpp']);
    ok('detector: a gitignored dir passes', r.status === 0);
  }

  {
    const d = fresh();
    put(d, 'build-tidy/CMakeCache.txt', '#\n');
    ok('gate: a redirect into a marked build dir passes', gate(d, 'echo x > build-tidy/gen.cpp').status === 0);
    ok('gate: a redirect into a dir with no marker is refused', gate(d, 'echo x > build-other/gen.cpp').status === 2);
    ok('gate: a redirect into src/x.cpp is refused', gate(d, 'echo x > src/x.cpp').status === 2);
    ok('gate: a cd into the marked dir then a redirect passes', gate(d, 'cd build-tidy && echo x > gen.cpp').status === 0);
  }

  {
    const d = fresh();
    writeFileSync(join(d, '.gitignore'), 'out/\n');
    ok('gate: a redirect into a gitignored dir passes', gate(d, 'echo x > out/gen.cpp').status === 0);
  }

  {
    const d = fresh();
    put(d, 'compile_commands.json', '[]\n');
    ok('gate: control, a marker at the repo root exempts no source', gate(d, 'echo x > src/x.cpp').status === 2);
  }
} finally {
  cleanup();
}

done();
