// legacy-freeze-gate (KIT-T989): in a repo whose .ai/config.yml sets `legacy_dir`, the legacy directory is frozen.
// Every write path is blocked (Edit, Write, NotebookEdit, shell writes, git staging/restoring/moving out), every
// reference added to it is blocked with file and line, and reads, `git mv` INTO it and unrelated writes pass.
// Run: node hooks/legacy-freeze-gate.test.mjs

import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { HOOKS, adopted, cleanup, git, hook, identify, reporter } from './test-harness.mjs';
import { legacyDir } from './lib/config.mjs';

const { ok, done } = reporter('legacy-freeze-gate');
const GATE = 'legacy-freeze-gate.mjs';

try {
  const wiring = JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8'));
  const entry = wiring.hooks.PreToolUse.find((e) => e.hooks.some((h) => h.command.includes(GATE)));
  ok('wired for Write, Edit, NotebookEdit, Bash and PowerShell', !!entry && ['Write', 'Edit', 'NotebookEdit', 'Bash', 'PowerShell'].every((t) => entry.matcher.includes(t)));

  const repoWith = (config) => {
    const d = realpathSync.native(adopted(false));
    if (config !== null) writeFileSync(join(d, '.ai', 'config.yml'), config);
    for (const dir of ['legacy/old', 'src/ui', 'crates/app']) mkdirSync(join(d, dir), { recursive: true });
    writeFileSync(join(d, 'legacy', 'old', 'a.ts'), 'export const a = 1;\n');
    writeFileSync(join(d, 'src', 'x.ts'), 'export const x = 1;\n');
    return d;
  };
  const d = repoWith('legacy_dir: legacy\n');
  const at = (...p) => join(d, ...p);
  const run = (payload, cwd = d) => hook(GATE, payload, cwd);
  const file = (tool, path, extra = {}) => run({ tool_name: tool, tool_input: { file_path: path, ...extra } });
  const shell = (command, cwd = d) => run({ tool_name: 'Bash', tool_input: { command } }, cwd);
  const blocks = (r, pattern) => r.code === 2 && r.out.includes('legacy-freeze') && r.out.includes('BLOCK TRIAGE') && (!pattern || pattern.test(r.out));
  const allows = (r) => r.code === 0 && !r.out.includes('BLOCKED');

  ok('config reader: legacy_dir is read, trimmed of quotes and slashes', legacyDir(d) === 'legacy' && legacyDir(repoWith('legacy_dir: "old/code/"  # frozen\n')) === 'old/code');
  ok('config reader: absent, absolute and escaping values mean no freeze', ['', 'other: 1\n', 'legacy_dir: /abs\n', 'legacy_dir: ../x\n', 'legacy_dir: C:/x\n'].every((c) => legacyDir(repoWith(c)) === ''));

  // Blocks: tool writes
  ok('blocks Write of a legacy file', blocks(file('Write', at('legacy', 'old', 'b.ts'), { content: 'x' }), /frozen/));
  ok('blocks Edit of a legacy file', blocks(file('Edit', at('legacy', 'old', 'a.ts'), { old_string: 'a = 1', new_string: 'a = 2' })));
  ok('blocks NotebookEdit (notebook_path) of a legacy notebook', blocks(run({ tool_name: 'NotebookEdit', tool_input: { notebook_path: at('legacy', 'n.ipynb'), new_source: 'x' } })));
  if (process.platform !== 'linux') ok('blocks a path spelled with backslashes and capitals', blocks(file('Write', `${d}\\Legacy\\old\\c.ts`, { content: 'x' })));

  // Blocks: shell writes
  const SHELL_BLOCKS = [
    ['a redirect', 'echo x > legacy/old/a.ts'],
    ['an append', 'echo x >> legacy/old/a.ts'],
    ['rm', 'rm legacy/old/a.ts'],
    ['rm -rf of the directory', 'rm -rf legacy'],
    ['sed -i', "sed -i 's/1/2/' legacy/old/a.ts"],
    ['a plain mv INTO legacy (use git mv)', 'mv src/x.ts legacy/old/x.ts'],
    ['a plain mv OUT of legacy', 'mv legacy/old/a.ts src/a.ts'],
    ['a cp onto legacy', 'cp src/x.ts legacy/old/x.ts'],
    ['tee', 'echo x | tee legacy/old/a.ts'],
    ['a PowerShell Set-Content', 'Set-Content -Path legacy\\old\\a.ts -Value hi'],
    ['node -e writeFileSync', `node -e "require('fs').writeFileSync('legacy/old/a.ts','x')"`],
    ['sed -i after cd into legacy', "cd legacy/old && sed -i 's/1/2/' a.ts"],
    ['git add', 'git add legacy/old/a.ts'],
    ['git add of the directory', 'git add legacy'],
    ['git checkout --', 'git checkout -- legacy/old/a.ts'],
    ['git checkout <ref> --', 'git checkout HEAD~1 -- legacy'],
    ['git restore', 'git restore legacy/old/a.ts'],
    ['git rm', 'git rm -r legacy/old'],
    ['git commit of a legacy path', 'git commit -m x legacy/old/a.ts'],
    ['git mv OUT of legacy', 'git mv legacy/old/a.ts src/a.ts'],
    ['git mv inside legacy', 'git mv legacy/old/a.ts legacy/old/z.ts'],
    ['git -C into the repo', `git -C "${d}" add legacy/old/a.ts`],
    ['a chained add after other work', 'cargo check && git add legacy/old/a.ts'],
    ['an escaped-quote command that names legacy', 'echo \\"x\\" > legacy/old/a.ts'],
  ];
  for (const [name, command] of SHELL_BLOCKS) ok(`blocks ${name}`, blocks(shell(command)));
  ok('names git mv as the way in', /git mv <src> legacy\//.test(shell('mv src/x.ts legacy/old/x.ts').out));

  // Blocks: references
  const refs = (path, text, pattern) => blocks(file('Write', at(...path), { content: text }), pattern);
  ok('blocks a Cargo workspace member and reports file:line', refs(['Cargo.toml'], '[workspace]\nmembers = [\n  "crates/app",\n  "legacy/old",\n]\n', /Cargo\.toml:4 .*legacy\/old/));
  ok('blocks a Cargo path dependency', refs(['crates', 'app', 'Cargo.toml'], '[dependencies]\nold = { path = "../../legacy/old" }\n', /Cargo\.toml:2/));
  ok('blocks an npm script target', refs(['package.json'], '{\n  "scripts": {\n    "old": "node legacy/old/run.js"\n  }\n}\n', /package\.json:3/));
  ok('blocks an npm workspace glob', refs(['package.json'], '{\n  "workspaces": ["legacy/*"]\n}\n', /package\.json:2/));
  ok('blocks a file: dependency', refs(['package.json'], '{\n  "dependencies": { "old": "file:./legacy/old" }\n}\n', /package\.json:2/));
  ok('blocks a relative import from the repo root', refs(['main.ts'], "import { a } from './legacy/old/a';\n", /main\.ts:1/));
  ok('blocks a ../ import from a nested file and reports its line', refs(['src', 'ui', 'p.ts'], "import x from './x';\nconst a = require('../../legacy/old/a');\n", /p\.ts:2/));
  ok('blocks a dynamic import and a bare legacy/ specifier', refs(['src', 'p.ts'], "const m = await import('legacy/old/a');\n", /p\.ts:1/));
  ok('blocks a Rust #[path] and include!', refs(['crates', 'app', 'lib.rs'], '#[path = "../../legacy/old/a.rs"]\nmod a;\n', /lib\.rs:1/) && refs(['crates', 'app', 'lib.rs'], 'const S: &str = include_str!("../../legacy/old/a.txt");\n', /lib\.rs:1/));
  const edited = (path, oldText, newText) => {
    writeFileSync(at(...path), `${oldText}\n`);
    return file('Edit', at(...path), { old_string: oldText, new_string: newText });
  };
  ok('blocks an Edit that adds a reference and reports the file line', blocks((() => {
    writeFileSync(at('Cargo.toml'), '[workspace]\nmembers = [\n  "crates/app",\n]\n');
    return file('Edit', at('Cargo.toml'), { old_string: '  "crates/app",', new_string: '  "crates/app",\n  "legacy/old",' });
  })(), /Cargo\.toml:4/));
  ok('an Edit that keeps an existing legacy line (it was already there) is not blocked', allows(edited(['package.json'], '"old": "node legacy/old/run.js"', '"old": "node legacy/old/run.js"')));

  // Allows
  ok('allows git mv INTO legacy', allows(shell('git mv src/x.ts legacy/old/x.ts')));
  ok('allows git mv of a directory INTO legacy', allows(shell('git mv src/ui legacy/ui')));
  const READS = [
    'cat legacy/old/a.ts', 'ls legacy', 'git log -- legacy', 'git diff HEAD -- legacy', 'git status legacy', 'git show HEAD:legacy/old/a.ts',
    'q code old --legacy', 'grep -n a legacy/old/a.ts', 'cp legacy/old/a.ts /tmp/a.ts', 'cat legacy/old/a.ts > /tmp/out.ts', 'git add src/x.ts', 'git commit -m "legacy/old moved" src/x.ts',
    'git checkout main', 'echo x > src/x.ts', "sed -i 's/1/2/' src/x.ts", 'git add -A', 'git commit -m "freeze legacy/old for reference"', 'node scripts/tool.mjs --note "see legacy/old"',
  ];
  for (const command of READS) ok(`allows ${command}`, allows(shell(command)));
  ok('allows a write outside legacy', allows(file('Write', at('src', 'y.ts'), { content: 'export const y = 2;\n' })));
  ok('allows a file whose name only starts with the directory name', allows(file('Write', at('legacy-notes.md'), { content: 'x' })));
  ok('allows an import of a symbol or package that only looks like it', allows(file('Write', at('src', 'q.ts'), { content: "import { legacyDefaults } from './defaults';\nimport old from 'legacy-utils';\nimport z from 'node_modules/pkg/legacy/z';\n" })));
  ok('allows a relative ./legacy import from a nested file (it resolves to src/legacy, not the frozen directory)', allows(file('Write', at('src', 'r.ts'), { content: "import a from './legacy/a';\n" })));
  ok('allows prose naming legacy in a package.json description', allows(file('Write', at('package.json'), { content: '{\n  "description": "replaces legacy/old",\n  "scripts": { "t": "vitest" }\n}\n' })));
  ok('allows a Cargo workspace exclude of legacy', allows(file('Write', at('Cargo.toml'), { content: '[workspace]\nmembers = ["crates/app"]\nexclude = [\n  "legacy/old",\n]\n' })));
  ok('allows docs and config that mention legacy/', allows(file('Write', at('docs', 'CODEMAP.md'), { content: 'See legacy/old/a.ts and import from legacy/old.\n' })));
  ok('allows a heredoc commit message that mentions a legacy redirect', allows(shell("git commit -q -F - <<'EOF'\nmove: cat x > legacy/old/a.ts is blocked\nEOF")));

  // git mv wherever it sits in the command, and staging a move by path
  const LOOPS_IN = [
    'for f in x y; do git mv src/$f.ts legacy/$f.ts; done',
    'ls src/*.ts | xargs -I{} git mv {} legacy/',
    'mkdir -p legacy/ui && git mv src/ui legacy/ui',
    'Get-ChildItem src | ForEach-Object { git mv $_.Name legacy/ }',
  ];
  for (const command of LOOPS_IN) ok(`allows a git mv INTO legacy inside: ${command}`, allows(shell(command)));
  ok('blocks a git mv OUT of legacy inside a loop', blocks(shell('for f in x y; do git mv legacy/$f.ts src/$f.ts; done')));
  ok('blocks a plain mv INTO legacy inside a loop', blocks(shell('for f in x y; do mv src/$f.ts legacy/$f.ts; done')));
  ok('blocks a sed -i after a cd into legacy even when the command cds back out', blocks(shell("cd legacy/old && sed -i 's/1/2/' a.ts && cd ../..")));
  ok('blocks cargo add --path and npm add of legacy code', blocks(shell('cargo add old --path legacy/old')) && blocks(shell('npm add ./legacy/old')) && blocks(shell('pnpm add file:legacy/old')));
  ok('allows cargo add and npm add of ordinary packages', allows(shell('cargo add serde')) && allows(shell('npm add left-pad')));

  const moved = identify(adopted(false));
  writeFileSync(join(moved, '.ai', 'config.yml'), 'legacy_dir: legacy\n');
  mkdirSync(join(moved, 'src'));
  mkdirSync(join(moved, 'legacy'));
  writeFileSync(join(moved, 'src', 'm.ts'), 'export const m = 1;\n');
  writeFileSync(join(moved, 'legacy', 'n.ts'), 'export const n = 1;\n');
  git(['add', '-A'], moved);
  git(['commit', '-q', '-m', 'seed'], moved);
  git(['mv', 'src/m.ts', 'legacy/m.ts'], moved);
  const inMoved = (command) => shell(command, moved);
  ok('allows git add of a git mv\'d file', allows(inMoved('git add legacy/m.ts')));
  ok('allows a by-path commit of a git mv\'d file', allows(inMoved('git commit -m "freeze m" -- src/m.ts legacy/m.ts')));
  writeFileSync(join(moved, 'legacy', 'n.ts'), 'export const n = 2;\n');
  ok('blocks git add of a legacy file whose content changed', blocks(inMoved('git add legacy/n.ts')));
  ok('blocks a by-path commit of a legacy file whose content changed', blocks(inMoved('git commit -m x -- legacy/n.ts')));
  git(['checkout', '--', 'legacy/n.ts'], moved);
  writeFileSync(join(moved, 'legacy', 'new.ts'), 'export const z = 1;\n');
  ok('blocks git add of a new, untracked legacy file', blocks(inMoved('git add legacy/new.ts')));
  git(['mv', 'legacy/n.ts', 'legacy/o.ts'], moved);
  ok('stages an unchanged rename but still refuses to move a legacy file out', allows(inMoved('git add legacy/o.ts')) && blocks(inMoved('git mv legacy/o.ts src/o.ts')));

  // Opt-in, exclusion, fail-open
  const bare = repoWith(null);
  ok('no legacy_dir: a legacy/ write and git add pass', allows(hook(GATE, { tool_input: { file_path: join(bare, 'legacy', 'old', 'a.ts'), content: 'x' } }, bare)) && allows(hook(GATE, { tool_input: { command: 'git add legacy' } }, bare)));
  const excluded = repoWith('legacy_dir: legacy\n');
  writeFileSync(join(excluded, '.claude-kit-ignore.yaml'), 'legacy-freeze:\n  - legacy/old/a.ts\n');
  ok('a legacy-freeze glob in .claude-kit-ignore.yaml lifts the block for that path only',
    allows(hook(GATE, { tool_input: { file_path: join(excluded, 'legacy', 'old', 'a.ts'), content: 'x' } }, excluded))
    && blocks(hook(GATE, { tool_input: { file_path: join(excluded, 'legacy', 'old', 'b.ts'), content: 'x' } }, excluded)));
  const unadopted = realpathSync.native(adopted(false));
  writeFileSync(join(unadopted, '.ai', 'config.yml'), 'legacy_dir: legacy\n');
  ok('the block text carries the exclusion footer', /\.claude-kit-ignore\.yaml/.test(shell('rm legacy/old/a.ts').out) && /claude-kit-ignore-start legacy-freeze/.test(shell('rm legacy/old/a.ts').out));
  ok('fails open on a payload that is not JSON', spawnSync(process.execPath, [join(HOOKS, GATE)], { cwd: d, input: 'not json', encoding: 'utf8' }).status === 0);
  ok('fails open on an empty payload', allows(run({})));

  // pre-write skips the legacy directory entirely
  const long = `${'export const v = 1;\n'.repeat(700)}`;
  const preWrite = (path) => hook('pre-write.mjs', { tool_input: { file_path: path, content: long } }, d);
  ok('pre-write blocks a 700-line file outside legacy', preWrite(at('src', 'big.ts')).code === 2);
  ok('pre-write judges nothing under legacy', preWrite(at('legacy', 'old', 'big.ts')).code === 0);
} finally {
  cleanup();
}

done();
