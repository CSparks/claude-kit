// Automated test for the pre-write length gate's post-edit reconstruction (hooks/pre-write.mjs).
// KIT-T211: autocrlf checkouts hold CRLF on disk while Edit payloads arrive LF. The gate must
// match and measure in LF space; unnormalized it judges the PRE-edit file — passing growth
// through the hard limit (the KIT-T121 corridor.rs mode) and blocking shrinking edits.
// Run: node hooks/pre-write.test.mjs

import { spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HOOK = fileURLToPath(new URL('./pre-write.mjs', import.meta.url));
let failures = 0;

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

console.log(`pre-write: ${failures ? 'FAILURES' : 'all pass'}`);
process.exit(failures ? 1 : 0);
