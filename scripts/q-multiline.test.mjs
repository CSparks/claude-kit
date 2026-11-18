// q code --multiline (KIT-T1369): a regex across lines, `.` matching a newline, `^`/`$` per line, a bounded match span,
// hits shown with line ranges, and the usual filters.
// Run: node --test scripts/q-multiline.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { codeVerbRows, parseCodeArgs } from './code-index-query.mjs';
import { MULTILINE_MAX_LINES, multilineRegex, multilineSpans } from './q-multiline.mjs';

const COLLECT_THEN_ITERATE = String.raw`let (mut )?(\w+)(: [^=]+)? = [^;]*\.collect(::<[^;]*>)?\(\);\n\s*(for [^\n]* in &?\2 \{|\2\.(iter|len|is_empty)\(\))`;

const ONCE = [
  'fn once(xs: &[u32]) -> u32 {',
  '    let picked = xs.iter().map(|x| x * 2).collect::<Vec<_>>();',
  '    for p in &picked {',
  '        println!("{p}");',
  '    }',
  '    0',
  '}',
  '',
].join('\n');
const KEPT = [
  'fn kept(xs: &[u32]) -> Vec<u32> {',
  '    let kept = xs.iter().copied().collect::<Vec<_>>();',
  '    println!("{}", 1);',
  '    kept',
  '}',
  '',
].join('\n');

function repo() {
  const root = mkdtempSync(join(tmpdir(), 'qml-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  mkdirSync(join(root, 'src'));
  mkdirSync(join(root, 'docs'));
  writeFileSync(join(root, 'src', 'once.rs'), ONCE);
  writeFileSync(join(root, 'src', 'kept.rs'), KEPT);
  writeFileSync(join(root, 'docs', 'notes.md'), 'let x = a.collect();\nfor y in &x {\n');
  return root;
}

test('--multiline and -U turn on multiline regex matching', () => {
  assert.equal(parseCodeArgs(['a\\nb', '--multiline']).flags.multiline, true);
  assert.equal(parseCodeArgs(['a\\nb', '-U']).flags.regex, true);
  assert.equal(parseCodeArgs(['a\\nb', '--regex']).flags.multiline, undefined);
});

test('spans: . crosses lines, ^ and $ hold per line, a match over the span bound is dropped', () => {
  assert.deepEqual(multilineSpans('a\nfoo\nbar\nb\n', multilineRegex('foo.bar', {})).map((s) => [s.start, s.end]), [[1, 2]]);
  assert.deepEqual(multilineSpans('x foo\nfoo y\n', multilineRegex('^foo', {})).map((s) => s.start), [1]);
  const long = `start\n${'x\n'.repeat(MULTILINE_MAX_LINES)}end\n`;
  assert.equal(multilineSpans(long, multilineRegex('start.*end', {})).length, 0, 'a match spanning past the bound is dropped');
  assert.equal(multilineSpans('START\nend', multilineRegex('start\\nEND', { ignoreCase: true })).length, 1, '-i');
  assert.equal(multilineRegex('(', {}), null, 'a pattern that does not compile yields null');
});

test('q code --multiline finds collect-then-iterate-once with a line range, and not a binding used again', async () => {
  const root = repo();
  const rows = await codeVerbRows('code', [COLLECT_THEN_ITERATE, '--multiline', '--lang', 'rust'], root);
  const hits = rows.filter((r) => r.loc);
  assert.ok(hits.some((r) => r.loc === 'src/once.rs:2-3' && /collect::<Vec<_>>\(\);/.test(r.text)), JSON.stringify(rows));
  assert.ok(hits.some((r) => r.loc === 'src/once.rs:3' && /for p in &picked/.test(r.text)), 'the match\'s later line is shown');
  assert.ok(!hits.some((r) => r.loc.startsWith('src/kept.rs')), 'negative control: a binding returned, not iterated, is no hit');
  assert.ok(!hits.some((r) => r.loc.startsWith('docs/')), '--lang rust keeps docs out');
});

test('filters and output modes: -C context, -c counts, -l files, -o the match on one row, --path', async () => {
  const root = repo();
  const pattern = String.raw`collect::<Vec<_>>\(\);\n\s*for`;
  const ctx = (await codeVerbRows('code', [pattern, '-U', '-C', '1'], root)).filter((r) => r.loc);
  assert.ok(ctx.some((r) => r.loc === 'src/once.rs-1') && ctx.some((r) => r.loc === 'src/once.rs-4'), JSON.stringify(ctx));
  assert.deepEqual((await codeVerbRows('code', [pattern, '-U', '-c'], root)).filter((r) => r.loc), [{ loc: 'src/once.rs', text: '1' }]);
  assert.equal((await codeVerbRows('code', [pattern, '-U', '-l'], root)).filter((r) => r.loc)[0].loc, 'src/once.rs');
  const only = (await codeVerbRows('code', [pattern, '-U', '-o'], root)).filter((r) => r.loc);
  assert.equal(only.length, 1);
  assert.match(only[0].text, /collect::<Vec<_>>\(\); ⏎ for/);
  assert.equal((await codeVerbRows('code', [pattern, '-U', '--path', 'docs'], root)).filter((r) => r.loc).length, 0, '--path narrows');
  const words = async (p) => (await codeVerbRows('code', [p, '-U', '-w', '--lang', 'rust'], root)).filter((r) => r.loc).length;
  assert.equal(await words(String.raw`collect::<Vec<_>>\(\);\n\s*for p in &pick`), 0, '-w: a pattern ending inside a word does not match');
  assert.ok(await words(String.raw`collect::<Vec<_>>\(\);\n\s*for p in &picked`) > 0, '-w: the whole word matches');
});
