// Tests for hooks/pre-write.mjs — the code-quality gate.
//
// Length gate (KIT-T211): autocrlf checkouts hold CRLF on disk while Edit payloads arrive LF.
// The gate must match and measure in LF space; unnormalized it judges the PRE-edit file —
// passing growth through the hard limit (the KIT-T121 corridor.rs mode) and blocking shrinks.
// Magic-number gate: strings are stripped, so the literal 42s in these payloads are deliberate.
// Run: node hooks/pre-write.test.mjs

import { spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { adopted, cleanup, git, hook, tmpDir } from './test-harness.mjs';

const HOOK = fileURLToPath(new URL('./pre-write.mjs', import.meta.url));
let failures = 0;
let passes = 0;

function ok(name, cond) {
  if (cond) { passes++; console.log('  ok    ' + name); }
  else { failures++; console.log('  FAIL  ' + name); }
}

function expect(name, got, want) {
  const pass = got === want;
  if (!pass) failures++;
  console.log(`  ${pass ? 'ok  ' : 'FAIL'}  ${name}${pass ? '' : `  (got=${got}, want=${want})`}`);
}

function run(cwd, toolInput) {
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_input: toolInput }),
    cwd,
    encoding: 'utf8',
  });
  return { code: r.status, err: r.stderr || '' };
}

const repo = mkdtempSync(join(tmpdir(), 'pw-'));
execFileSync('git', ['init', '-q'], { cwd: repo });
mkdirSync(join(repo, '.ai'));

const UNDER_HARD = 500;
const OVER_HARD = 625;
const CHUNK_START = 100;
const CHUNK_END = 200;
// Comment-only filler: invisible to every fragment-scoped check, so these tests
// exercise ONLY the file-length gate.
const filler = (n) => Array.from({ length: n }, (_, i) => `// filler line ${i}`);

// A CRLF file grown past the hard limit by an LF Edit must BLOCK — pre-fix the LF
// old_string never matched the CRLF disk text and the gate measured the pre-edit file.
{
  const file = join(repo, 'grow.ts');
  writeFileSync(file, filler(UNDER_HARD).join('\r\n') + '\r\n');
  const grown = ['// filler line 10', ...filler(UNDER_HARD).map((l) => `${l} pad`), '// filler line 11'].join('\n');
  const r = run(repo, { file_path: file, old_string: '// filler line 10\n// filler line 11', new_string: grown });
  expect('CRLF file grown past the hard limit by an LF Edit blocks', r.code, 2);
  expect('…and the block names file-length', /file-length|File length/.test(r.err) ? 1 : 0, 1);
}

// A CRLF file shrunk below the hard limit by an LF Edit must PASS — pre-fix the missed
// match measured the 625-line pre-edit file and hard-blocked the shrink itself.
{
  const file = join(repo, 'shrink.ts');
  writeFileSync(file, filler(OVER_HARD).join('\r\n') + '\r\n');
  const chunk = filler(OVER_HARD).slice(CHUNK_START, CHUNK_END).join('\n');
  const r = run(repo, { file_path: file, old_string: chunk, new_string: '// compacted' });
  expect('CRLF file shrunk below the hard limit by an LF Edit is not hard-blocked', r.code === 2 ? 1 : 0, 0);
}

// Control: the plain-LF path still measures the post-edit file (KIT-T121 unchanged).
{
  const file = join(repo, 'lf.ts');
  writeFileSync(file, filler(UNDER_HARD).join('\n') + '\n');
  const grown = ['// filler line 10', ...filler(UNDER_HARD).map((l) => `${l} pad`), '// filler line 11'].join('\n');
  const r = run(repo, { file_path: file, old_string: '// filler line 10\n// filler line 11', new_string: grown });
  expect('LF control: growth past the hard limit still blocks', r.code, 2);
}

// replace_all takes the same normalized path.
{
  const file = join(repo, 'all.ts');
  writeFileSync(file, filler(UNDER_HARD).join('\r\n') + '\r\n');
  const r = run(repo, { file_path: file, replace_all: true, old_string: '// filler line', new_string: '// filler\n// line' });
  expect('CRLF replace_all growth past the hard limit blocks', r.code, 2);
}

// --- code-quality checks: magic numbers, prose numerics, style tokens, exclusion markers ---
try {
  const clean = adopted(false);
  const pw = (payload, cwd = clean) => hook('pre-write.mjs', { tool_input: payload }, cwd);

  ok('pre-write: throw-inducing payload fails OPEN (exit 0, not 1)',
    (() => { const r = pw({ file_path: '/x/a.ts', content: 12345 }); return r.code === 0 && r.out.includes('failing open'); })());

  ok('pre-write: bare magic number blocks (non-declaration line)',
    pw({ file_path: '/x/a.ts', content: 'function f(x) {\n  return x * 1337;\n}\n' }).code === 2);
  ok('pre-write: named constant passes',
    pw({ file_path: '/x/a.ts', content: 'const FACTOR = 1337;\nconst r = compute(seed) * FACTOR;\n' }).code === 0);
  ok('pre-write: data file skipped',
    pw({ file_path: '/x/a.json', content: '{ "n": 1337 }' }).code === 0);
  ok('pre-write: doc never blocks',
    pw({ file_path: '/x/a.md', content: '# note 1337\n' }).code === 0);
  ok('pre-write: markup (.html) skips code checks (regression: brand "GTA 7")',
    pw({ file_path: '/x/i.html', content: '<title>GTA 7 — Guns, Traffic & Anarchy</title>\n' }).code === 0);

  // KIT-T032 — numerics in PROSE (strings, template literals, line and block comments) are
  // not magic constants; a bare code constant must still fail.
  ok('pre-write: numbers in a template-literal heredoc pass (KIT-T032)',
    pw({ file_path: '/x/a.ts', content: 'const out = [];\nout.push(`Budget 60-75k tokens, ~70k after the 5-line preamble.`);\n' }).code === 0);
  ok('pre-write: numbers in a line comment pass (KIT-T032)',
    pw({ file_path: '/x/a.ts', content: '// retry after 1337 ms, ceiling 9000\nconst r = compute();\n' }).code === 0);
  ok('pre-write: numbers in a block comment pass (KIT-T032)',
    pw({ file_path: '/x/a.ts', content: '/* threshold 1337\n   ceiling 9000 */\nconst r = compute();\n' }).code === 0);
  ok('pre-write: bare code constant still blocks even with prose numbers present (KIT-T032)',
    pw({ file_path: '/x/a.ts', content: 'function f(x) {\n  return x * 1337; // was 9000 before\n}\n' }).code === 2);

  // KIT-T077 — precision: named/data/radix/regex idioms pass; real magic still blocks.
  ok('pre-write: multi-line const array data rows pass (KIT-T077)',
    pw({ file_path: '/x/a.ts', content: 'const DIMS = [\n  1920,\n  1080,\n];\n' }).code === 0);
  ok('pre-write: named default parameter passes (KIT-T077)',
    pw({ file_path: '/x/a.ts', content: 'function retry(fn, attempts = 5) {\n  return fn(attempts);\n}\n' }).code === 0);
  ok('pre-write: mid-line named assignment passes (KIT-T077)',
    pw({ file_path: '/x/a.ts', content: 'if (!opts.timeout) opts.timeout = 5000;\n' }).code === 0);
  ok('pre-write: parseInt radix passes (KIT-T077)',
    pw({ file_path: '/x/a.ts', content: 'export function toInt(s) {\n  return parseInt(s, 10);\n}\n' }).code === 0);
  ok('pre-write: regex-literal quantifiers pass after = (KIT-T077)',
    pw({ file_path: '/x/a.ts', content: 'export function f(id) {\n  const ok = /^x{4}-y{6}$/;\n  return ok.test(id);\n}\n' }).code === 0);
  ok('pre-write: regex-literal after return passes (KIT-T077)',
    pw({ file_path: '/x/a.ts', content: 'export function isId(s) {\n  return /^[a-z]{8}$/.test(s);\n}\n' }).code === 0);
  ok('pre-write: division by a magic number STILL blocks (KIT-T077 non-regression)',
    pw({ file_path: '/x/a.ts', content: 'export function third(x) {\n  return x / 3;\n}\n' }).code === 2);
  ok('pre-write: comparison to a magic number STILL blocks (KIT-T077 non-regression)',
    pw({ file_path: '/x/a.ts', content: 'export function gone(s) {\n  return s.status === 404;\n}\n' }).code === 2);

  ok('pre-write: plain css one-off literals pass (no first-class variables)',
    pw({ file_path: '/x/a.css', content: '.a { font-size: 30px; font-weight: 700; }\n' }).code === 0);
  ok('pre-write: scss reused literal hardcoded blocks (should be a token)',
    pw({ file_path: '/x/a.scss', content: '.a{padding:24px}.b{margin:24px}.c{gap:24px}\n' }).code === 2);
  ok('pre-write: scss reused color hardcoded blocks (should be a token)',
    pw({ file_path: '/x/a.scss', content: '.a{color:#3366ff}.b{border-color:#3366ff}.c{background:#3366ff}\n' }).code === 2);
  ok('pre-write: scss literal declared as variable passes',
    pw({ file_path: '/x/a.scss', content: '$gap: 24px;\n.a{padding:$gap}.b{margin:$gap}.c{gap:$gap}\n' }).code === 0);

  // KIT-T084 — file-level marker with trailing prose. The glued em-dash form is the one the
  // \S+ → [\w*-]+ fix rescued.
  const magic = 'function f(x) {\n  return x * 1337;\n}\n'; // blocks without a marker
  ok('pre-write KIT-T084: file marker `magic-numbers — prose` (space before em-dash) suppresses',
    pw({ file_path: '/x/shader.wgsl', content: '// claude-kit-ignore-file magic-numbers — WGSL literals are idiomatic\n' + magic }).code === 0);
  ok('pre-write KIT-T084: file marker `magic-numbers—prose` (glued em-dash) suppresses',
    pw({ file_path: '/x/shader.wgsl', content: '// claude-kit-ignore-file magic-numbers—WGSL literals are idiomatic\n' + magic }).code === 0);
  ok('pre-write KIT-T084: file marker `magic-numbers (reason)` (parenthesised reason) suppresses',
    pw({ file_path: '/x/shader.wgsl', content: '// claude-kit-ignore-file magic-numbers (shader constants are idiomatic)\n' + magic }).code === 0);

  // KIT-T084 — .claude-kit-ignore.yaml is read from the NEAREST git root: a submodule's yaml
  // covers files inside it, and the superproject (no yaml) still blocks.
  {
    const superDir = tmpDir('kit-super-');
    git(['init', '-q'], superDir);
    const subDir = join(superDir, 'sub');
    mkdirSync(subDir);
    git(['init', '-q'], subDir);
    writeFileSync(join(subDir, '.claude-kit-ignore.yaml'), 'magic-numbers:\n  - "**/*.wgsl"\n');

    ok('pre-write KIT-T084: .claude-kit-ignore.yaml glob honored from submodule git root',
      pw({ file_path: join(subDir, 'lighting.wgsl'), content: magic }, subDir).code === 0);
    ok('pre-write KIT-T084: no yaml at superproject root does not leak into submodule glob check',
      pw({ file_path: join(superDir, 'toplevel.ts'), content: magic }, superDir).code === 2);
  }

  // KIT-T057 — the legacy .claudekit-ignore is retired: it warns with the migration and no
  // longer bypasses the gate.
  {
    const legacy = adopted(false);
    writeFileSync(join(legacy, '.claudekit-ignore'), '');
    const r = pw({ file_path: join(legacy, 'a.ts'), content: 'function f(x) {\n  return x * 1337;\n}\n' }, legacy);
    ok('pre-write: legacy .claudekit-ignore no longer bypasses (still blocks)', r.code === 2);
    ok('pre-write: legacy marker warns with the yaml migration', r.out.includes('RETIRED') && r.out.includes('.claude-kit-ignore.yaml'));
  }
} finally {
  cleanup();
}

console.log(`\npre-write: ${failures ? `FAILURES (${failures})` : 'all pass'}, ${passes} code-quality assertions passed`);
process.exit(failures ? 1 : 0);
