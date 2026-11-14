// Build output a tool wrote is no hand write (KIT-T1160): a call that works inside a real build tree that existed before it
// passes both the after-the-fact detector and the shell gate; a marker a call makes, a forged or junk marker, a marker beside
// tracked source and an ignore rule a call adds (.gitignore, a nested self-ignoring one, .git/info/exclude, core.excludesFile)
// do not turn hand-written source into output.
// Run: node hooks/build-output.test.mjs

import { mkdirSync, realpathSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import { cleanup, git, reporter } from './test-harness.mjs';
import { handWriteHarness } from './hand-write-harness.mjs';

const { ok, done } = reporter('build-output');
const SOURCE = 'int main() { return 0; }\n';
const GENERATED = ['build-tidy/CMakeFiles/3.28/CMakeCCompilerId.c', 'build-tidy/_deps/catch2/catch_user_config.hpp', 'build-tidy/_deps/asio/asio.cpp'];
const OLD = new Date('2020-01-01T00:00:00Z');

const put = (d, rel, text = SOURCE) => {
  mkdirSync(join(d, rel, '..'), { recursive: true });
  writeFileSync(join(d, rel), text);
};
const commit = (d, message) => { git(['add', '-A'], d); git(['commit', '-q', '-m', message], d); };
const slashed = (p) => realpathSync.native(p).replace(/\\/g, '/');

// What CMake and Ninja write for a configured tree at `dir` of repo `d` (overrides forge a field).
const REAL = {
  'CMakeCache.txt': (d, dir, o = {}) => `# cache\nCMAKE_HOME_DIRECTORY:INTERNAL=${o.home ?? slashed(d)}\nCMAKE_CACHEFILE_DIR:INTERNAL=${o.cacheDir ?? `${slashed(d)}/${dir}`}\n`,
  'build.ninja': () => 'ninja_required_version = 1.5\nrule CC\n  command = cc\nbuild a.o: CC a.cpp\n',
  'compile_commands.json': (d, dir, o = {}) => `[{"directory":"${o.directory ?? `${slashed(d)}/${dir}`}","file":"a.cpp","command":"cc a.cpp"}]\n`,
};
const configured = (d, dir = 'build-tidy', marker = 'CMakeCache.txt', o) => put(d, `${dir}/${marker}`, REAL[marker](d, dir, o));

try {
  const { spawnHook, call, fresh } = handWriteHarness();
  const gate = (d, command) => spawnHook('source-shell-gate.mjs', { tool_name: 'Bash', session_id: 'G', tool_input: { command } }, d);
  const detect = (d, files, command = 'node scratch.js') => call(d, 'D', command, () => files.forEach((f) => put(d, f)));
  const named = (r, file) => r.status === 2 && r.stderr.includes(file);

  for (const marker of ['CMakeCache.txt', 'compile_commands.json']) {
    const d = fresh();
    configured(d, 'build-tidy', marker);
    const r = detect(d, GENERATED);
    ok(`detector: a call writing generated source under an unignored dir marked by a real ${marker} passes`, r.status === 0, r.stderr.slice(0, 200));
  }

  {
    const d = fresh();
    configured(d);
    put(d, 'build-tidy/build.ninja', REAL['build.ninja']());
    ok('detector: a build.ninja beside a real CMakeCache.txt passes', detect(d, GENERATED).status === 0);
  }

  {
    const d = fresh();
    put(d, 'build-tidy/build.ninja', REAL['build.ninja']());
    ok('detector: control, a build.ninja with no real sibling is ignored', named(detect(d, GENERATED), 'build-tidy/'));
  }

  {
    const d = fresh();
    const r = call(d, 'D', 'node scratch.js', () => { configured(d); GENERATED.forEach((f) => put(d, f)); });
    ok('detector: control, a marker the same call creates is ignored', named(r, 'build-tidy/'), r.stderr.slice(0, 200));
  }

  {
    const d = fresh();
    configured(d);
    const r = call(d, 'D', 'node scratch.js', () => { put(d, 'build-tidy/CMakeCache.txt', `${REAL['CMakeCache.txt'](d, 'build-tidy')}# edited\n`); put(d, 'build-tidy/evil.cpp'); });
    ok('detector: control, a marker the call modifies is ignored', named(r, 'build-tidy/evil.cpp'));
  }

  {
    const d = fresh();
    put(d, 'j1/CMakeCache.txt', 'x\n');
    put(d, 'j2/CMakeCache.txt', REAL['CMakeCache.txt'](d, 'j2', { cacheDir: '/elsewhere/j2' }));
    put(d, 'j3/CMakeCache.txt', REAL['CMakeCache.txt'](d, 'j3', { home: '/not/this/repo' }));
    put(d, 'j4/compile_commands.json', '[]\n');
    put(d, 'j5/compile_commands.json', REAL['compile_commands.json'](d, 'j5', { directory: '/not/this/repo/j5' }));
    const labels = ['junk content', 'CMAKE_CACHEFILE_DIR elsewhere', 'CMAKE_HOME_DIRECTORY outside the repo', 'an empty compile database', 'a compile database naming directories outside the repo'];
    labels.forEach((label, i) => {
      const dir = `j${i + 1}`;
      ok(`detector: control, a marker with ${label} is ignored`, named(detect(d, [`${dir}/evil.cpp`]), `${dir}/evil.cpp`));
    });
  }

  {
    const d = fresh();
    put(d, 'build-tidy/gen.cpp');
    const r = call(d, 'D', 'node scratch.js', () => put(d, 'build-tidy/gen2.cpp'));
    ok('detector: control, a source file under build-tidy with no marker is still judged', named(r, 'build-tidy/gen2.cpp'));
  }

  {
    const d = fresh();
    configured(d);
    const r = detect(d, ['src/new.cpp']);
    ok('detector: control, a hand-written source outside the build tree is named', named(r, 'src/new.cpp') && !r.stderr.includes('build-tidy'));
  }

  {
    const d = fresh();
    put(d, 'compile_commands.json', REAL['compile_commands.json'](d, '.'));
    ok('detector: control, a marker at the repo root exempts nothing', named(detect(d, ['src/x.cpp']), 'src/x.cpp'));
  }

  {
    const d = fresh();
    put(d, 'tools/x.cpp');
    commit(d, 'tools');
    configured(d, 'tools');
    const r = call(d, 'D', 'node scratch.js', () => { put(d, 'tools/x.cpp', 'int main() { return 1; }\n'); put(d, 'tools/y.cpp'); });
    ok('detector: control, a tracked file beside a marker is judged and so is a new file in that dir', named(r, 'tools/x.cpp') && r.stderr.includes('tools/y.cpp'));
  }

  {
    const d = fresh();
    writeFileSync(join(d, '.gitignore'), 'out/\n');
    commit(d, 'ignore');
    ok('detector: a dir ignored before the call passes', detect(d, ['out/gen.cpp']).status === 0);
  }

  const ignoreEdits = [
    ['an ignore rule the call adds to .gitignore', (d) => writeFileSync(join(d, '.gitignore'), 'out/\n')],
    ['a nested .gitignore that ignores itself', (d) => put(d, 'out/.gitignore', '*\n')],
    ['a rule added to .git/info/exclude', (d) => writeFileSync(join(d, '.git', 'info', 'exclude'), 'out/\n')],
    ['a core.excludesFile the call points git at', (d) => { writeFileSync(join(d, '..', `${d.split(/[\\/]/).pop()}-excludes`), 'out/\n'); git(['config', 'core.excludesFile', join(d, '..', `${d.split(/[\\/]/).pop()}-excludes`)], d); }],
  ];
  for (const [label, edit] of ignoreEdits) {
    const d = fresh();
    mkdirSync(join(d, '.git', 'info'), { recursive: true });
    const r = call(d, 'D', 'node scratch.js', () => { edit(d); put(d, 'out/evil.cpp'); });
    ok(`detector: control, ${label} does not hide the source the call wrote`, named(r, 'out/evil.cpp'), r.stderr.slice(0, 200));
  }

  const seeded = (rules) => {
    const d = fresh();
    writeFileSync(join(d, '.gitignore'), 'out/\n*.log\n');
    Object.entries(rules).forEach(([rel, text]) => put(d, rel, text));
    commit(d, 'rules');
    return d;
  };

  {
    const d = seeded({});
    const noise = join(d, 'logs');
    const flood = () => { for (let i = 0; i < 5100; i++) writeFileSync(join(noise, `n${i}.log`), 'x'); };
    put(d, 'logs/keep.txt', 'x');
    flood();
    ok('detector: a clean tree with more ignored entries than the snapshot holds passes', detect(d, ['out/gen.cpp']).status === 0);
    const r = call(d, 'D', 'node scratch.js', () => { writeFileSync(join(d, '.git', 'info', 'exclude'), 'zzz/\n'); put(d, 'zzz/e.cpp'); });
    ok('detector: control, an ignore rule added beside more ignored entries than the cap is caught', named(r, 'zzz/e.cpp'), r.stderr.slice(0, 200));
  }

  {
    const d = seeded({ 'sub/.gitignore': 'keep\n' });
    const r = call(d, 'D', 'node scratch.js', () => { rmSync(join(d, 'sub', '.gitignore')); put(d, 'out/evil.cpp'); });
    ok('detector: control, a rule file the call deletes voids the exemption of a source another rule ignores', named(r, 'out/evil.cpp'), r.stderr.slice(0, 200));
  }

  {
    const d = seeded({ 'sub/.gitignore': 'keep\n' });
    const r = call(d, 'D', 'node scratch.js', () => { put(d, 'sub/.gitignore', 'keep\n*.cpp\n'); put(d, 'out/evil.cpp'); });
    ok('detector: control, editing a rule file other than the one that ignores the source is caught', named(r, 'out/evil.cpp'), r.stderr.slice(0, 200));
  }

  {
    const d = seeded({});
    const first = join(d, '..', `${basename(d)}-excludes-a`);
    const second = join(d, '..', `${basename(d)}-excludes-b`);
    writeFileSync(first, 'evil/\n');
    writeFileSync(second, 'evil/\n');
    git(['config', 'core.excludesFile', first], d);
    const r = call(d, 'D', 'node scratch.js', () => { git(['config', 'core.excludesFile', second], d); put(d, 'evil/e.cpp'); });
    ok('detector: control, core.excludesFile re-pointed to an identical file is caught', named(r, 'evil/e.cpp'), r.stderr.slice(0, 200));
    ok('detector: a call that changes no ignore rule and writes into an ignored dir passes', detect(d, ['out/gen.cpp']).status === 0);
  }

  {
    const d = fresh();
    const r = call(d, 'D', 'node scratch.js', () => {
      writeFileSync(join(d, '.gitignore'), 'out/\n');
      put(d, 'out/old.cpp');
      utimesSync(join(d, 'out/old.cpp'), OLD, OLD);
    });
    ok('detector: control, a new ignored source with an old mtime is caught', named(r, 'out/old.cpp'));
  }

  {
    const d = fresh();
    put(d, 'build-tidy/CMakeCache.txt', REAL['CMakeCache.txt'](d, 'build-tidy'));
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
    put(d, 'forged/CMakeCache.txt', REAL['CMakeCache.txt'](d, 'forged', { cacheDir: '/elsewhere' }));
    ok('gate: control, a junk marker exempts nothing', gate(d, 'echo x > junk/evil.cpp').status === 2);
    ok('gate: control, a marker whose CMAKE_CACHEFILE_DIR is elsewhere exempts nothing', gate(d, 'echo x > forged/evil.cpp').status === 2);
  }

  {
    const d = fresh();
    writeFileSync(join(d, '.gitignore'), 'out/\n');
    ok('gate: a redirect into a gitignored dir passes', gate(d, 'echo x > out/gen.cpp').status === 0);
    ok('gate: control, a call that edits the ignore file first is refused', gate(d, 'echo evil/ >> .gitignore && echo x > evil/gen.cpp').status === 2);
    ok('gate: control, a call that writes .git/info/exclude first is refused', gate(d, 'echo evil/ >> .git/info/exclude && echo x > evil/gen.cpp').status === 2);
  }

  {
    const d = fresh();
    put(d, 'tools/x.cpp');
    commit(d, 'tools');
    configured(d, 'tools');
    ok('gate: control, a marker in a dir holding tracked source exempts nothing', gate(d, 'echo x > tools/y.cpp').status === 2);
  }

  {
    const d = fresh();
    put(d, 'compile_commands.json', REAL['compile_commands.json'](d, '.'));
    ok('gate: control, a marker at the repo root exempts no source', gate(d, 'echo x > src/x.cpp').status === 2);
  }
} finally {
  cleanup();
}

done();
