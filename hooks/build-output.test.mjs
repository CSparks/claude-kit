// Build output a tool wrote is no hand write (KIT-T1160): a call that works inside a real build tree that existed before it
// passes both the after-the-fact detector and the shell gate; a marker a call makes, a junk marker, a marker beside tracked
// source and an ignore rule a call adds do not turn hand-written source into output.
// Run: node hooks/build-output.test.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, git, reporter } from './test-harness.mjs';
import { handWriteHarness } from './hand-write-harness.mjs';

const { ok, done } = reporter('build-output');
const SOURCE = 'int main() { return 0; }\n';
const REAL = {
  'CMakeCache.txt': '# cache\nCMAKE_HOME_DIRECTORY:INTERNAL=/repo\nCMAKE_CACHEFILE_DIR:INTERNAL=/repo/build-tidy\n',
  'build.ninja': 'ninja_required_version = 1.5\nrule CC\n  command = cc\n',
  'compile_commands.json': '[{"directory":"/repo/build-tidy","file":"a.cpp","command":"cc a.cpp"}]\n',
};
const GENERATED = ['build-tidy/CMakeFiles/3.28/CMakeCCompilerId.c', 'build-tidy/_deps/catch2/catch_user_config.hpp', 'build-tidy/_deps/asio/asio.cpp'];

const put = (d, rel, text = SOURCE) => {
  mkdirSync(join(d, rel, '..'), { recursive: true });
  writeFileSync(join(d, rel), text);
};
const commit = (d, message) => { git(['add', '-A'], d); git(['commit', '-q', '-m', message], d); };

try {
  const { spawnHook, call, fresh } = handWriteHarness();
  const gate = (d, command) => spawnHook('source-shell-gate.mjs', { tool_name: 'Bash', session_id: 'G', tool_input: { command } }, d);
  const detect = (d, files, command = 'node scratch.js') => call(d, 'D', command, () => files.forEach((f) => put(d, f)));
  const named = (r, file) => r.status === 2 && r.stderr.includes(file);

  for (const [marker, text] of Object.entries(REAL)) {
    const d = fresh();
    put(d, `build-tidy/${marker}`, text);
    const r = detect(d, GENERATED);
    ok(`detector: a call writing generated source under an unignored dir marked by a real ${marker} passes`, r.status === 0, r.stderr.slice(0, 200));
  }

  {
    const d = fresh();
    const r = call(d, 'D', 'node scratch.js', () => { put(d, 'build-tidy/CMakeCache.txt', REAL['CMakeCache.txt']); GENERATED.forEach((f) => put(d, f)); });
    ok('detector: control, a marker the same call creates is ignored', named(r, 'build-tidy/'), r.stderr.slice(0, 200));
  }

  {
    const d = fresh();
    put(d, 'build-tidy/CMakeCache.txt', REAL['CMakeCache.txt']);
    const r = call(d, 'D', 'node scratch.js', () => { put(d, 'build-tidy/CMakeCache.txt', `${REAL['CMakeCache.txt']}# edited\n`); put(d, 'build-tidy/evil.cpp'); });
    ok('detector: control, a marker the call modifies is ignored', named(r, 'build-tidy/evil.cpp'));
  }

  for (const [marker, junk] of [['CMakeCache.txt', 'x\n'], ['build.ninja', 'x\n'], ['compile_commands.json', '[]\n']]) {
    const d = fresh();
    put(d, `junk/${marker}`, junk);
    const r = detect(d, ['junk/evil.cpp']);
    ok(`detector: control, a ${marker} with junk content is ignored`, named(r, 'junk/evil.cpp'));
  }

  {
    const d = fresh();
    put(d, 'build-tidy/gen.cpp');
    const r = call(d, 'D', 'node scratch.js', () => put(d, 'build-tidy/gen2.cpp'));
    ok('detector: control, a source file under build-tidy with no marker is still judged', named(r, 'build-tidy/gen2.cpp'));
  }

  {
    const d = fresh();
    put(d, 'build-tidy/CMakeCache.txt', REAL['CMakeCache.txt']);
    const r = detect(d, ['src/new.cpp']);
    ok('detector: control, a hand-written source outside the build tree is named', named(r, 'src/new.cpp') && !r.stderr.includes('build-tidy'));
  }

  {
    const d = fresh();
    put(d, 'compile_commands.json', REAL['compile_commands.json']);
    const r = detect(d, ['src/x.cpp']);
    ok('detector: control, a marker at the repo root exempts nothing', named(r, 'src/x.cpp'));
  }

  {
    const d = fresh();
    put(d, 'tools/x.cpp');
    commit(d, 'tools');
    put(d, 'tools/CMakeCache.txt', REAL['CMakeCache.txt']);
    const r = call(d, 'D', 'node scratch.js', () => { put(d, 'tools/x.cpp', 'int main() { return 1; }\n'); put(d, 'tools/y.cpp'); });
    ok('detector: control, a tracked file beside a marker is judged and so is a new file in that dir', named(r, 'tools/x.cpp') && r.stderr.includes('tools/y.cpp'));
  }

  {
    const d = fresh();
    writeFileSync(join(d, '.gitignore'), 'out/\n');
    commit(d, 'ignore');
    ok('detector: a dir ignored before the call passes', detect(d, ['out/gen.cpp']).status === 0);
  }

  {
    const d = fresh();
    const r = call(d, 'D', 'node scratch.js', () => { writeFileSync(join(d, '.gitignore'), 'out/\n'); put(d, 'out/evil.cpp'); });
    ok('detector: control, an ignore rule the call adds does not hide the source it wrote', named(r, 'out/evil.cpp'), r.stderr.slice(0, 200));
  }

  {
    const d = fresh();
    put(d, 'build-tidy/CMakeCache.txt', REAL['CMakeCache.txt']);
    ok('gate: a redirect into a real build dir passes', gate(d, 'echo x > build-tidy/gen.cpp').status === 0);
    ok('gate: a cd into the real build dir then a redirect passes', gate(d, 'cd build-tidy && echo x > gen.cpp').status === 0);
    ok('gate: control, a redirect into a dir with no marker is refused', gate(d, 'echo x > build-other/gen.cpp').status === 2);
    ok('gate: control, a redirect into src/x.cpp is refused', gate(d, 'echo x > src/x.cpp').status === 2);
    ok('gate: control, a call that also touches the marker is refused', gate(d, 'touch build-tidy/CMakeCache.txt && echo x > build-tidy/evil.cpp').status === 2);
    ok('gate: control, a call that copies a marker in is refused', gate(d, 'cp m.json build-tidy/compile_commands.json && echo x > build-tidy/evil.cpp').status === 2);
  }

  {
    const d = fresh();
    ok('gate: control, touch of a marker then a redirect into an unmarked dir is refused', gate(d, 'touch build-tidy/CMakeCache.txt && echo x > build-tidy/evil.cpp').status === 2);
    put(d, 'junk/CMakeCache.txt', 'x\n');
    ok('gate: control, a junk marker exempts nothing', gate(d, 'echo x > junk/evil.cpp').status === 2);
  }

  {
    const d = fresh();
    writeFileSync(join(d, '.gitignore'), 'out/\n');
    ok('gate: a redirect into a gitignored dir passes', gate(d, 'echo x > out/gen.cpp').status === 0);
    ok('gate: control, a call that edits the ignore file first is refused', gate(d, 'echo evil/ >> .gitignore && echo x > evil/gen.cpp').status === 2);
  }

  {
    const d = fresh();
    put(d, 'tools/x.cpp');
    commit(d, 'tools');
    put(d, 'tools/CMakeCache.txt', REAL['CMakeCache.txt']);
    ok('gate: control, a marker in a dir holding tracked source exempts nothing', gate(d, 'echo x > tools/y.cpp').status === 2);
  }

  {
    const d = fresh();
    put(d, 'compile_commands.json', REAL['compile_commands.json']);
    ok('gate: control, a marker at the repo root exempts no source', gate(d, 'echo x > src/x.cpp').status === 2);
  }
} finally {
  cleanup();
}

done();
